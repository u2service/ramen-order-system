from app.auth import require_roles
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone, timedelta, time
from pydantic import BaseModel

from app.database import get_db
from app.models import Order, InventoryLot, InventoryItem

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
    dependencies=[Depends(require_roles(["admin"]))]
)

class DashboardSummaryResponse(BaseModel):
    today_sales: int
    today_cost: int
    today_gross_profit: int
    today_orders: int
    stock_alerts: int

@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)):
    # 日本時間 (JST = UTC+9) の今日の0時を取得
    jst = timezone(timedelta(hours=9))
    now_jst = datetime.now(jst)
    today_start_jst = datetime.combine(now_jst.date(), time.min, tzinfo=jst)

    # 1. 本日精算済みの注文（paid_at が本日の0時以降、かつ status が paid や completed）
    # ★ options(joinedload(Order.items)) を追加して注文明細を一緒に取得します
    paid_orders = (
        db.query(Order)
        .options(joinedload(Order.items))
        .filter(Order.status.in_(["paid", "completed"])) # pos.pyで更新されるステータス
        .filter(Order.paid_at >= today_start_jst)
        .all()
    )

    # 本日の売上合計（order.total_price を足し上げる）
    today_sales = sum(order.total_price for order in paid_orders)

    # 本日の原価合計（各明細の cost_price * quantity を足し上げる）
    today_cost = sum(
        (item.cost_price or 0) * item.quantity
        for order in paid_orders
        for item in order.items
    )

    # 本日の粗利合計 = 売上合計 - 原価合計
    today_gross_profit = today_sales - today_cost

    # 2. 本日の全注文数（注文作成日時 created_at が本日0時以降で、キャンセル以外）
    today_orders_count = (
        db.query(Order)
        .filter(Order.status != "cancelled")
        .filter(Order.created_at >= today_start_jst)
        .count()
    )

    # 3. 在庫アラート数（各品目の有効在庫合計がアラート閾値以下の品目数をカウント）
    items = db.query(InventoryItem).all()
    stock_alerts_count = 0
    for item in items:
        stock_sum = (
            db.query(func.coalesce(func.sum(InventoryLot.current_quantity), 0))
            .filter(
                InventoryLot.inventory_item_id == item.id,
                InventoryLot.status == "active",  # 有効なロットのみ対象
            )
            .scalar()
        )
        # 現在の有効在庫数がアラート閾値以下ならアラート件数に加算
        if stock_sum <= item.alert_threshold:
            stock_alerts_count += 1

    return DashboardSummaryResponse(
        today_sales=today_sales,
        today_cost=today_cost,
        today_gross_profit=today_gross_profit,
        today_orders=today_orders_count,
        stock_alerts=stock_alerts_count,
    )