from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.models import Order, OrderItem, OrderItemOption, InventoryLot, OptionInventoryItem
from app.schemas import (
    TableBillResponseSchema,
    CashCheckoutSchema,
    CashCheckoutResponseSchema,
    StripeCheckoutSchema,
    StripeCheckoutResponseSchema,
)

router = APIRouter(prefix="/pos", tags=["pos"])

# --- 追加リクエストスキーマ ---
class CancelItemSchema(BaseModel):
    cancel_reason: str  # 'customer_mistake', 'kitchen_error', 'out_of_stock'

class DiscountSchema(BaseModel):
    order_item_id: Optional[int] = None
    is_full_comp: bool = False  # True の場合は伝票全体サービス（大将のおごり）


# --- ヘルパー関数: 注文合計額の再計算 ---
def recalculate_order_total(order: Order):
    """
    有効な明細（status != 'cancelled'）から再計算し、order.total_price を更新
    """
    total = 0
    for item in order.items:
        if item.status == 'cancelled':
            continue
        discount = getattr(item, "discount_amount", 0)
                
        # 1品あたりの基本価格（割引後）
        effective_price = max(0, item.price - discount)
                
        # オプション合計
        options = getattr(item, "order_item_options", getattr(item, "options", []))
        option_total = sum(opt.price for opt in options)
        
        # (商品割引後価格 + オプション価格) * 数量
        item_total = (effective_price + option_total) * item.quantity
        total += item_total

    order.total_price = total


# 未会計注文が存在する卓番号の一覧を取得
@router.get("/active-tables")
def get_active_tables(db: Session = Depends(get_db)):
    # completed, cancelled 以外の注文がある卓番号を取得
    active_orders = (
        db.query(Order.table_number)
        .filter(Order.status.notin_(["completed", "cancelled", "paid"])) # ← "paid" を追加
        .distinct()
        .all()
    )
    # [1, 3, 5] のような数値配列にして返す
    active_table_numbers = [order.table_number for order in active_orders if order.table_number is not None]
    return {"active_tables": active_table_numbers}

# 1. 卓ごとの未伝票確認・明細取得・合計金額計算
@router.get("/tables/{table_number}")
def get_table_bill(table_number: int, db: Session = Depends(get_db)):
    unpaid_orders = db.query(Order).filter(
        Order.table_number == table_number,
        Order.paid_at.is_(None),
        Order.status != "cancelled"
    ).all()

    if not unpaid_orders:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"卓番号 {table_number} の未清算の注文はありません。"
        )

    # 明細とオプションのデータ整形
    items_list = []

    # 取得時に各注文の total_price を再計算して同期を保つ
    grand_total = 0
    for order in unpaid_orders:
        recalculate_order_total(order) # DB側の合計値を最新化
        grand_total += order.total_price

        for item in order.items:
            options_data = [
                {
                    "id": opt.id, 
                    "name": opt.option.name if getattr(opt, "option", None) else "オプション", 
                    "price": opt.price
                }
                for opt in getattr(item, "order_item_options", getattr(item, "options", []))
            ]
            
            product_name = item.product.name if getattr(item, "product", None) else "商品"

            items_list.append({
                "order_id": order.id,
                "item_id": item.id,
                "product_name": product_name,  # ← 定義した変数に変更
                "price": item.price,
                "quantity": item.quantity,
                "status": item.status,
                "discount_amount": getattr(item, "discount_amount", 0),
                "options": options_data
            })

    db.commit() # 計算した total_price を保存

    tax = int(grand_total * 0.10 / 1.10)

    return {
        "table_number": table_number,
        "unpaid_orders_count": len(unpaid_orders),
        "items": items_list,
        "subtotal": grand_total,
        "tax": tax,
        "total_price": grand_total
    }


# 2. 明細個別取り消し（在庫復元マトリクス制御）
@router.post("/items/{item_id}/cancel")
def cancel_order_item(item_id: int, payload: CancelItemSchema, db: Session = Depends(get_db)):
    item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="対象の明細が見つかりません。")

    if item.status == "cancelled":
        raise HTTPException(status_code=400, detail="すでにキャンセルされています。")

    item.status = "cancelled"
    item.cancel_reason = payload.cancel_reason

    # 【仕様書マトリクス準拠】客都合キャンセルの場合のみ在庫を加算還元
    if payload.cancel_reason == "customer_mistake":
        for item_option in item.order_item_options:
            option_inventories = db.query(OptionInventoryItem).filter(
                OptionInventoryItem.option_id == item_option.option_id
            ).all()
            
            for opt_inv in option_inventories:
                # 使用中の最新ロットへ戻す
                lot = db.query(InventoryLot).filter(
                    InventoryLot.inventory_item_id == opt_inv.inventory_item_id,
                    InventoryLot.status.in_(["active", "depleted"])
                ).order_by(InventoryLot.expiration_date.desc()).first()

                if lot:
                    lot.current_quantity += (opt_inv.consumed_quantity * item.quantity)
                    if lot.status == "depleted":
                        lot.status = "active"

    # 親注文の合計金額を再計算
    recalculate_order_total(item.order)
    db.commit()

    return {
        "message": "明細のキャンセル処理が完了しました。",
        "item_id": item_id,
        "new_total_price": item.order.total_price
    }


# 3. おごり・サービス（100%割引）適用
@router.post("/orders/{order_id}/discount")
def apply_discount(order_id: int, payload: DiscountSchema, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="注文データが見つかりません。")

    if payload.is_full_comp:
        # 伝票全体サービス（全明細を100%引き）
        for item in order.items:
            if item.status != "cancelled":
                item.discount_type = "comp"
                item.discount_amount = item.price
    elif payload.order_item_id:
        # 特定商品のみ100%引き
        item = db.query(OrderItem).filter(OrderItem.id == payload.order_item_id).first()
        if item and item.status != "cancelled":
            item.discount_type = "100_percent_off"
            item.discount_amount = item.price

    recalculate_order_total(order)
    db.commit()

    return {
        "message": "サービス処理を適用しました。",
        "order_id": order_id,
        "new_total_price": order.total_price
    }


# 4. 現金お会計処理
@router.post("/checkout/cash", response_model=CashCheckoutResponseSchema)
def checkout_cash(payload: CashCheckoutSchema, db: Session = Depends(get_db)):
    unpaid_orders = db.query(Order).filter(
        Order.table_number == payload.table_number,
        Order.paid_at.is_(None),
        Order.status != "cancelled"
    ).all()

    if not unpaid_orders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"卓番号 {payload.table_number} に未清算の注文が存在しません。"
        )

    total_price = sum(order.total_price for order in unpaid_orders)

    if payload.paid_amount < total_price:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"お預かり金額が不足しています。(合計: {total_price}円, お預かり: {payload.paid_amount}円)"
        )

    change_amount = payload.paid_amount - total_price
    now = datetime.now(timezone.utc)

    for order in unpaid_orders:
        order.payment_method = "cash"
        order.paid_amount = payload.paid_amount
        order.change_amount = change_amount
        order.paid_at = now
        order.status = "paid"  # 仕様書に合わせて 'paid' に更新

    db.commit()

    return CashCheckoutResponseSchema(
        table_number=payload.table_number,
        total_price=total_price,
        paid_amount=payload.paid_amount,
        change_amount=change_amount,
        status="paid"
    )


# 5. クレジットカード(Stripe)お会計処理
@router.post("/checkout/stripe", response_model=StripeCheckoutResponseSchema)
def checkout_stripe(payload: StripeCheckoutSchema, db: Session = Depends(get_db)):
    unpaid_orders = db.query(Order).filter(
        Order.table_number == payload.table_number,
        Order.paid_at.is_(None),
        Order.status != "cancelled"
    ).all()

    if not unpaid_orders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"卓番号 {payload.table_number} に未清算の注文が存在しません。"
        )

    total_price = sum(order.total_price for order in unpaid_orders)
    now = datetime.now(timezone.utc)

    mock_payment_intent_id = f"pi_mock_{payload.table_number}_{int(now.timestamp())}"

    for order in unpaid_orders:
        order.payment_method = "credit"
        order.stripe_payment_intent_id = mock_payment_intent_id
        order.paid_amount = total_price
        order.change_amount = 0
        order.paid_at = now
        order.status = "paid"  # 仕様書に合わせて 'paid' に更新

    db.commit()

    return StripeCheckoutResponseSchema(
        table_number=payload.table_number,
        total_price=total_price,
        payment_intent_id=mock_payment_intent_id,
        status="paid"
    )
