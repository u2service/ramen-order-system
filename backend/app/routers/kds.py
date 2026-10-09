from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date, time
from pydantic import BaseModel, ConfigDict

from app.database import get_db
# ★ OrderItem もインポートに追加
from app.models import Order, OrderItem, OrderItemOption, Option, Product

router = APIRouter(
    prefix="/kds",
    tags=["KDS"]
)

# レスポンス用 Pydantic スキーマ
class OrderItemResponse(BaseModel):
    id: int
    menu_item_name: str
    quantity: int
    price: int
    cost_price: int
    options: List[str] = []
    status: str  # ★ 明細ごとのステータスを追加

    model_config = ConfigDict(from_attributes=True)

class OrderResponse(BaseModel):
    id: int
    table_number: int
    status: str
    created_at: str
    items: List[OrderItemResponse]

    model_config = ConfigDict(from_attributes=True)

class StatusUpdateRequest(BaseModel):
    status: str

# 1. 注文一覧取得 API
@router.get("/orders", response_model=List[OrderResponse])
def get_kds_orders(
    target_date: Optional[str] = Query(None, alias="date", description="検索対象の日付 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    # ベースのクエリを作成
    query = db.query(Order).filter(Order.status != "cancelled")

    # date パラメータが渡された場合、指定された日の 00:00:00 〜 23:59:59 でフィルタリング
    if target_date:
        try:
            parsed_date = datetime.strptime(target_date, "%Y-%m-%d").date()
            start_datetime = datetime.combine(parsed_date, time.min) # 例: 2026-09-08 00:00:00
            end_datetime = datetime.combine(parsed_date, time.max)   # 例: 2026-09-08 23:59:59.999999

            query = query.filter(
                Order.created_at >= start_datetime,
                Order.created_at <= end_datetime
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    orders = query.order_by(Order.id.desc()).all()
    
    result = []
    for order in orders:
        items_data = []
        for item in order.items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            product_name = product.name if product else "不明な商品"

            # ★ オプションの名前と価格を取得
            item_options = (
                db.query(Option.name, OrderItemOption.price)
                .join(OrderItemOption, OrderItemOption.option_id == Option.id)
                .filter(OrderItemOption.order_item_id == item.id)
                .all()
            )
            opt_names = [opt[0] for opt in item_options]
            # ★ トッピング・オプションの価格合計を計算
            options_total_price = sum(opt[1] or 0 for opt in item_options)

            # ★ 商品単価 + オプション価格合計
            item_price_with_options = (item.price or 0) + options_total_price

            items_data.append({
                "id": item.id,
                "menu_item_name": product_name,
                "quantity": item.quantity,
                "price": item_price_with_options,    # ★ オプション価格を含めた単価を返却
                "cost_price": item.cost_price or 0,
                "options": opt_names,
                "status": str(item.status).lower()
            })
            
        created_at_val = ""
        if getattr(order, "created_at", None):
            try:
                created_at_val = order.created_at.isoformat()
            except AttributeError:
                created_at_val = str(order.created_at)

        result.append({
            "id": order.id,
            "table_number": order.table_number,
            "status": str(order.status).lower(),
            "created_at": created_at_val,
            "items": items_data
        })
    return result

# 2. 明細別ステータス更新 API (OrderItem の ID で更新)
@router.patch("/items/{item_id}/status")
def update_order_item_status(item_id: int, req: StatusUpdateRequest, db: Session = Depends(get_db)):
    # Order ではなく OrderItem を検索
    item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Order item not found")
    
    item.status = req.status.lower()
    db.commit()
    return {"message": "Item status updated successfully", "status": item.status}