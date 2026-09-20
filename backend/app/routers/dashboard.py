from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone, timedelta, time
from pydantic import BaseModel

from app.database import get_db
from app.models import Order, InventoryLot  # 在庫数確認用モデルもインポート

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

class DashboardSummaryResponse(BaseModel):
    today_sales: int
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

    # 本日の粗利合計（明細の (販売単価 - 原価) * 数量 から算出）
    today_gross_profit = 0
    for order in paid_orders:
        for item in order.items:
            # OrderItem には price, cost_price, quantity が直接定義されている
            item_cost = item.cost_price or 0
            today_gross_profit += (item.price - item_cost) * item.quantity

    # 2. 本日の全注文数（注文作成日時 created_at が本日0時以降で、キャンセル以外）
    today_orders_count = (
        db.query(Order)
        .filter(Order.status != "cancelled")
        .filter(Order.created_at >= today_start_jst)
        .count()
    )

    # 3. 在庫アラート数（在庫数が5以下、または status が 'depleted'）
    stock_alerts_count = (
        db.query(InventoryLot)
        .filter(
            (InventoryLot.current_quantity <= 5) | (InventoryLot.status == "depleted")
        )
        .count()
    )

    return DashboardSummaryResponse(
        today_sales=today_sales,
        today_gross_profit=today_gross_profit,
        today_orders=today_orders_count,
        stock_alerts=stock_alerts_count,
    )