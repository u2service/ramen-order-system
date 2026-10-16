from app.auth import require_roles
from datetime import date, datetime, timedelta, timezone, time
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, selectinload, joinedload
from sqlalchemy import func
from pydantic import BaseModel

from app.database import get_db
from app.models import (
    Category, 
    InventoryItem, 
    InventoryLot, 
    Order, 
    OrderItem, 
    Product,
    OptionGroup,
    OrderItemOption
)
from app.schemas import (
    CategoryCreateSchema,
    CategoryUpdateSchema,
    CategoryResponseSchema, 
    InventoryLotCreateSchema,
    InventoryAlertSchema,
    AnalyticsSummarySchema,
    ProductCreateSchema,
    ProductUpdateSchema,
    ProductResponseSchema
)

from app.routers.kds import OrderResponse # レスポンススキーマを流用

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_roles(["admin"]))]
)

# ==========================================
# 0. カテゴリ管理 API
# ==========================================

# カテゴリ一覧取得
@router.get("/categories", response_model=List[CategoryResponseSchema])
def get_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.sort_order.asc(), Category.id.asc()).all()

# カテゴリ新規登録
@router.post("/categories", response_model=CategoryResponseSchema, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreateSchema, db: Session = Depends(get_db)):
    db_category = Category(**payload.model_dump())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

# ★ カテゴリ更新 (追加)
@router.put("/categories/{category_id}", response_model=CategoryResponseSchema)
def update_category(category_id: int, payload: CategoryUpdateSchema, db: Session = Depends(get_db)):
    db_category = db.query(Category).filter(Category.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="指定されたカテゴリが存在しません。")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_category, key, value)

    db.commit()
    db.refresh(db_category)
    return db_category

# カテゴリ削除
@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    db_category = db.query(Category).filter(Category.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="指定されたカテゴリが存在しません。")
    db.delete(db_category)
    db.commit()
    return None

# 1. 新規仕入ロットの登録 API[cite: 1, 2]
@router.post("/inventory-lots", status_code=status.HTTP_201_CREATED)
def create_inventory_lot(payload: InventoryLotCreateSchema, db: Session = Depends(get_db)):
    item = db.query(InventoryItem).filter_by(id=payload.inventory_item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="指定された在庫品目が存在しません。")

    unit_cost = payload.total_cost / payload.initial_quantity if payload.initial_quantity > 0 else Decimal("0.00")

    new_lot = InventoryLot(
        inventory_item_id=payload.inventory_item_id,
        received_date=payload.received_date,
        expiration_date=payload.expiration_date,
        initial_quantity=payload.initial_quantity,
        current_quantity=payload.initial_quantity,
        total_cost=payload.total_cost,
        unit_cost=unit_cost,
        status="active"
    )
    db.add(new_lot)
    db.commit()
    db.refresh(new_lot)
    return {"message": "仕入ロットを登録しました。", "lot_id": new_lot.id}

# 2. 在庫自動アラート・使用期限切れ間近チェック API[cite: 1, 2]
@router.get("/inventory/alerts", response_model=list[InventoryAlertSchema])
def get_inventory_alerts(db: Session = Depends(get_db)):
    alerts = []
    today = date.today()
    three_days_later = today + timedelta(days=3)

    items = db.query(InventoryItem).all()
    for item in items:
        # 有効な残数の合計を算出[cite: 1, 2]
        total_current_qty = db.query(func.sum(InventoryLot.current_quantity)).filter(
            InventoryLot.inventory_item_id == item.id,
            InventoryLot.status == "active",
            InventoryLot.expiration_date >= today
        ).scalar() or Decimal("0.00")

        # 1. 発注アラート（安全在庫割れ）[cite: 1]
        if total_current_qty <= item.alert_threshold:
            alerts.append(InventoryAlertSchema(
                inventory_item_id=item.id,
                item_name=item.name,
                current_quantity=total_current_qty,
                alert_threshold=item.alert_threshold,
                unit=item.unit,
                status="LOW_STOCK"
            ))

        # 2. 期限切れ間近（3日以内）のロットが存在するかチェック[cite: 1]
        expiring_lot = db.query(InventoryLot).filter(
            InventoryLot.inventory_item_id == item.id,
            InventoryLot.status == "active",
            InventoryLot.current_quantity > 0,
            InventoryLot.expiration_date.between(today, three_days_later)
        ).first()

        if expiring_lot:
            alerts.append(InventoryAlertSchema(
                inventory_item_id=item.id,
                item_name=item.name,
                current_quantity=total_current_qty,
                alert_threshold=item.alert_threshold,
                unit=item.unit,
                status="EXPIRING_SOON"
            ))

    return alerts

# 3. 売上・粗利分析サマリー API[cite: 1, 2]
@router.get("/analytics/summary", response_model=AnalyticsSummarySchema)
def get_analytics_summary(db: Session = Depends(get_db)):
    # 精算完了（paid_at が存在する）注文を抽出[cite: 2]
    paid_orders = db.query(Order).filter(Order.paid_at.isnot(None)).all()

    total_sales = sum(order.total_price for order in paid_orders)
    total_orders_count = len(paid_orders)

    # 該当注文に紐づく原価の合計を算出[cite: 2]
    paid_order_ids = [o.id for o in paid_orders]
    total_cost = 0
    if paid_order_ids:
        order_items = db.query(OrderItem).filter(OrderItem.order_id.in_(paid_order_ids)).all()
        total_cost = sum(item.cost_price * item.quantity for item in order_items)

    gross_profit = total_sales - total_cost
    margin = round((gross_profit / total_sales * 100), 2) if total_sales > 0 else 0.0

    return AnalyticsSummarySchema(
        total_sales=total_sales,
        total_cost=total_cost,
        gross_profit=gross_profit,
        gross_profit_margin=margin,
        total_orders_count=total_orders_count
    )

# ==========================================
# 0.2 商品管理 API
# ==========================================

# 商品一覧取得（カテゴリ情報も合わせて取得したい場合に便利）
@router.get("/products", response_model=List[ProductResponseSchema])
def get_products(db: Session = Depends(get_db)):
    return db.query(Product).order_by(Product.sort_order.asc(), Product.id.asc()).all()

# 商品新規登録
@router.post("/products", response_model=ProductResponseSchema, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreateSchema, db: Session = Depends(get_db)):
    # カテゴリの存在確認
    category = db.query(Category).filter(Category.id == payload.category_id).first()
    if not category:
        raise HTTPException(status_code=400, detail="指定されたカテゴリが存在しません。")

    db_product = Product(**payload.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

# 商品更新（売り切れフラグや価格の変更）
@router.put("/products/{product_id}", response_model=ProductResponseSchema)
def update_product(product_id: int, payload: ProductUpdateSchema, db: Session = Depends(get_db)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="指定された商品が存在しません。")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_product, key, value)

    db.commit()
    db.refresh(db_product)
    return db_product

# 商品削除
@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="指定された商品が存在しません。")
    db.delete(db_product)
    db.commit()
    return None

# ==========================================
# 0.3 商品 × オプショングループ紐付け API
# ==========================================

class ProductOptionGroupUpdateSchema(BaseModel):
    option_group_ids: List[int]

# 指定された商品に現在紐付いているオプショングループ一覧を取得
@router.get("/products/{product_id}/option-groups")
def get_product_option_groups(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="指定された商品が存在しません。")
    
    # Product モデルに option_groups リレーションが定義されている前提
    return [{"id": og.id, "name": og.name} for og in product.option_groups]

# 指定された商品のオプショングループ紐付けを更新・保存
@router.post("/products/{product_id}/option-groups")
def update_product_option_groups(
    product_id: int, 
    payload: ProductOptionGroupUpdateSchema, 
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="指定された商品が存在しません。")

    # 指定された ID のオプショングループを取得
    option_groups = db.query(OptionGroup).filter(OptionGroup.id.in_(payload.option_group_ids)).all()

    # 多対多リレーションを更新
    product.option_groups = option_groups
    db.commit()

    return {"message": "オプショングループの紐付けを更新しました。"}


# ==========================================
# 0.4 管理画面　注文履歴用 API
# ==========================================

@router.get("/orders", response_model=List[OrderResponse])
def get_admin_orders(
    target_date: Optional[str] = Query(None, alias="date", description="検索対象の日付 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """管理画面用: 会計済み・提供済みを含む全注文履歴を取得"""
    query = (
        db.query(Order)
        .options(
            selectinload(Order.items).joinedload(OrderItem.product),
            selectinload(Order.items)
            .selectinload(OrderItem.order_item_options)
            .joinedload(OrderItemOption.option)
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

    orders = query.order_by(Order.id.desc()).all()

    # レスポンス用データの整形
    result = []
    for order in orders:
        items_data = []
        for item in order.items:
            product_name = item.product.name if item.product else "不明な商品"

            opt_names = []
            options_total_price = 0
            for oio in item.order_item_options:
                if oio.option:
                    opt_names.append(oio.option.name)
                options_total_price += (oio.price or 0)

            item_price_with_options = (item.price or 0) + options_total_price

            items_data.append({
                "id": item.id,
                "menu_item_name": product_name,
                "quantity": item.quantity,
                "price": item_price_with_options,
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