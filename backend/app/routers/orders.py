from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Order, OrderItem, OrderItemOption, Product, Option,
    OptionInventoryItem, ProductInventoryItem, InventoryLot
)
from app.schemas import OrderCreateSchema, OrderCreateResponseSchema

import json
from app.events import order_broadcaster

import asyncio

router = APIRouter(prefix="/orders", tags=["orders"])

@router.post("", response_model=OrderCreateResponseSchema, status_code=status.HTTP_201_CREATED)
def create_order(order_in: OrderCreateSchema, db: Session = Depends(get_db)):
    """
    卓上端末からの新規注文を受け付け、セットオプションがあれば個別明細へ分解しつつ
    先入れ先出し(FIFO)で在庫ロットを自動減算するAPI
    """
    try:
        # 1. 注文ヘッダーの作成
        new_order = Order(
            table_number=order_in.table_number,
            status="pending",
            total_price=0
        )
        db.add(new_order)
        db.flush()

        calculated_total_price = 0

        for item_data in order_in.items:
            # メイン商品の存在・売り切れチェック
            product = db.query(Product).filter_by(id=item_data.product_id).with_for_update().first()
            if not product or not product.is_active or product.is_sold_out:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"商品(ID: {item_data.product_id})は現在注文できません。"
                )

            # 選択されたオプションの取得
            selected_options = []
            if item_data.options:
                selected_options = db.query(Option).filter(Option.id.in_(item_data.options)).all()

            # --- A. 通常トッピング と セットオプション（linked_product_id あり）に分類 ---
            normal_options = [opt for opt in selected_options if not getattr(opt, 'linked_product_id', None)]
            set_options = [opt for opt in selected_options if getattr(opt, 'linked_product_id', None)]

            # --- B. 在庫消費計算 (メイン商品 + 通常トッピング分) ---
            item_cost_decimal = Decimal("0.00")
            consumed_inventory_map = {}

            # ★ メイン商品（ラーメン本体）の在庫消費定義を取得して集計マップに追加
            product_invs = db.query(ProductInventoryItem).filter_by(product_id=product.id).all()
            for prod_inv in product_invs:
                consumed_inventory_map[prod_inv.inventory_item_id] = (
                    consumed_inventory_map.get(prod_inv.inventory_item_id, Decimal("0.00"))
                    + (Decimal(str(prod_inv.consumed_quantity)) * item_data.quantity)
                )

            # 通常トッピングの在庫消費定義を取得
            for opt in normal_options:
                opt_invs = db.query(OptionInventoryItem).filter_by(option_id=opt.id).all()
                for opt_inv in opt_invs:
                    consumed_inventory_map[opt_inv.inventory_item_id] = (
                        consumed_inventory_map.get(opt_inv.inventory_item_id, Decimal("0.00"))
                        + (opt_inv.consumed_quantity * item_data.quantity)
                    )

            # FIFO (先入れ先出し) 在庫引当処理
            for inv_item_id, req_qty in consumed_inventory_map.items():
                lots = (
                    db.query(InventoryLot)
                    .filter(
                        InventoryLot.inventory_item_id == inv_item_id,
                        InventoryLot.status == "active",
                        InventoryLot.expiration_date >= date.today(),
                        InventoryLot.current_quantity > 0
                    )
                    .order_by(InventoryLot.expiration_date.asc())
                    .with_for_update()
                    .all()
                )

                remaining_qty = req_qty
                for lot in lots:
                    if remaining_qty <= 0:
                        break

                    if lot.current_quantity >= remaining_qty:
                        lot.current_quantity -= remaining_qty
                        item_cost_decimal += (lot.unit_cost * remaining_qty)
                        if lot.current_quantity == 0:
                            lot.status = "depleted"
                        remaining_qty = Decimal("0.00")
                    else:
                        deduct_qty = lot.current_quantity
                        item_cost_decimal += (lot.unit_cost * deduct_qty)
                        remaining_qty -= deduct_qty
                        lot.current_quantity = Decimal("0.00")
                        lot.status = "depleted"

                if remaining_qty > 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"在庫品目(ID: {inv_item_id})の在庫が不足しているため注文を完了できません。"
                    )

            # --- C. メイン商品 (ラーメンなど) の OrderItem を作成 ---
            main_order_item = OrderItem(
                order_id=new_order.id,
                product_id=product.id,
                price=product.price,
                cost_price=int(item_cost_decimal),
                quantity=item_data.quantity,
                status="pending"
            )
            db.add(main_order_item)
            db.flush()

            # 通常トッピングのオプション明細を紐付け
            for opt in normal_options:
                item_opt = OrderItemOption(
                    order_item_id=main_order_item.id,
                    option_id=opt.id,
                    price=opt.price
                )
                db.add(item_opt)

            # メイン商品＋通常トッピングの小計を加算
            normal_options_price = sum(opt.price for opt in normal_options)
            calculated_total_price += (product.price + normal_options_price) * item_data.quantity

            # --- D. セットオプションを「独立した別行の OrderItem (サイドメニュー等)」として追加作成 ---
            for set_opt in set_options:
                set_product = db.query(Product).filter_by(id=set_opt.linked_product_id).first()
                if not set_product or not set_product.is_active or set_product.is_sold_out:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"セット対象商品(ID: {set_opt.linked_product_id})は現在注文できません。"
                    )

                set_order_item = OrderItem(
                    order_id=new_order.id,
                    product_id=set_product.id,
                    price=set_opt.price,  # セットオプション側の価格（差額・セット価格）を設定
                    cost_price=0,
                    quantity=item_data.quantity,  # 親商品(ラーメン)の数量に連動
                    status="pending"
                )
                db.add(set_order_item)

                # セットメニュー分の金額を加算
                calculated_total_price += set_opt.price * item_data.quantity

        # 5. ヘッダー合計金額の更新
        new_order.total_price = calculated_total_price
        db.commit()
        db.refresh(new_order)

        # ★ SSEで厨房端末へ新着注文をリアルタイム通知
        try:
            event_data = json.dumps({
                "event": "new_order",
                "order_id": new_order.id,
                "table_number": new_order.table_number,
                "total_price": new_order.total_price
            })

            # ★ 在庫更新通知を追加
            inventory_event_data = json.dumps({
                "event": "inventory_updated"
            })

            # 現在実行中のイベントループを取得して非同期ブロードキャストタスクを作成
            try:
                loop = asyncio.get_running_loop()

                loop.create_task(order_broadcaster.broadcast(event_data))
                loop.create_task(order_broadcaster.broadcast(inventory_event_data))
            except RuntimeError:
                # 実行中ループが存在しない場合（同期テストなど）
                asyncio.run(order_broadcaster.broadcast(event_data))
                asyncio.run(order_broadcaster.broadcast(inventory_event_data))

        except Exception as e:
            print(f"Broadcast notice failed: {e}")

        # レスポンス返却
        created_at_str = (
            new_order.created_at.isoformat() 
            if new_order.created_at 
            else ""
        )

        return {
            "id": new_order.id,
            "order_id": new_order.id,
            "table_number": new_order.table_number,
            "status": new_order.status,
            "total_price": new_order.total_price,
            "created_at": created_at_str
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"処理中にエラーが発生しました: {str(e)}"
        )

@router.get("/events/stream")
async def sse_stream():
    """フロントエンドへリアルタイムイベント(注文・在庫更新)をSSE配信するエンドポイント"""
    async def event_generator():
        queue = order_broadcaster.subscribe()
        try:
            while True:
                # タイムアウト付きでキューからデータ取得
                try:
                    # 15秒タイムアウト付きで Queue から受信
                    data = await asyncio.wait_for(queue.get(), timeout=15.0)
                    # イベントデータとして送信
                    yield f"data: {data}\n\n"
                except asyncio.TimeoutError:
                    # 15秒間動きがない場合はキープアライブメッセージを送信して接続を維持
                    yield ": keep-alive\n\n"

        finally:
            # クライアント切断(CancelledError)やエラー終了時に確実にリスナーを削除
            order_broadcaster.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no", # Nginx等を使用している場合のバッファリング無効化
        }
    )