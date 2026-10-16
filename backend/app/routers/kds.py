from app.auth import require_roles
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from typing import List, Optional
from datetime import datetime, date, time
from pydantic import BaseModel, ConfigDict
from collections import defaultdict  # ★ 追加

from app.database import get_db
from app.models import Order, OrderItem, OrderItemOption, Option, Product

router = APIRouter(
    prefix="/kds",
    tags=["KDS"],
    dependencies=[Depends(require_roles(["admin", "kitchen"]))]
)

# レスポンス用 Pydantic スキーマ
class OrderItemResponse(BaseModel):
    id: int
    menu_item_name: str
    quantity: int
    price: int
    cost_price: int
    options: List[str] = []
    status: str

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


# 1. 注文一覧取得 API (高速化対応)
@router.get("/orders", response_model=List[OrderResponse])
def get_kds_orders(
    target_date: Optional[str] = Query(None, alias="date", description="検索対象の日付 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    # OrderItem を起点に、served・cancelled 以外の明細を取得
    # idx_order_items_active の部分インデックスが使われる
    query = (
        db.query(OrderItem)
        .join(Order)
        .options(
            joinedload(OrderItem.order),          # ★ Order情報を一括取得（N+1防止）
            joinedload(OrderItem.product),
            selectinload(OrderItem.order_item_options)
            .joinedload(OrderItemOption.option)
        )
        .filter(
            OrderItem.status.notin_(["served", "cancelled"])
        )
    )

    if target_date:
        try:
            parsed_date = datetime.strptime(target_date, "%Y-%m-%d").date()
            start_datetime = datetime.combine(parsed_date, time.min)
            end_datetime = datetime.combine(parsed_date, time.max)
            query = query.filter(
                Order.created_at >= start_datetime,
                Order.created_at <= end_datetime
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    # 古い注文が上、新しい注文が下になるよう昇順ソート
    items = query.order_by(Order.created_at.asc(), Order.id.asc()).all()

    # order_id でグループ化して OrderResponse 形式に組み立て
    orders_map = defaultdict(lambda: {"order": None, "items": []})

    for item in items:
        oid = item.order_id

        if orders_map[oid]["order"] is None:
            orders_map[oid]["order"] = item.order

        opt_names = []
        options_total_price = 0
        for oio in item.order_item_options:
            if oio.option:
                opt_names.append(oio.option.name)
            options_total_price += (oio.price or 0)

        product_name = item.product.name if item.product else "不明な商品"
        item_price_with_options = (item.price or 0) + options_total_price

        orders_map[oid]["items"].append({
            "id": item.id,
            "menu_item_name": product_name,
            "quantity": item.quantity,
            "price": item_price_with_options,
            "cost_price": item.cost_price or 0,
            "options": opt_names,
            "status": str(item.status).lower()
        })

    # order_id 昇順を維持しつつ result リストに変換
    result = []
    for oid in sorted(orders_map.keys()):
        order = orders_map[oid]["order"]

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
            "items": orders_map[oid]["items"]
        })

    return result


# 2. 明細別ステータス更新 API (既存のまま保持)
@router.patch("/items/{item_id}/status")
def update_order_item_status(item_id: int, req: StatusUpdateRequest, db: Session = Depends(get_db)):
    item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Order item not found")

    item.status = req.status.lower()
    db.commit()
    return {"message": "Item status updated successfully", "status": item.status}