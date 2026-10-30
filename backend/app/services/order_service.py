import asyncio
from datetime import date
from decimal import Decimal
import json
from typing import List, Tuple
from sqlalchemy.orm import Session

from app.events import order_broadcaster
from app.models import (
    Order, OrderItem, OrderItemOption, Product, Option,
    OptionInventoryItem, ProductInventoryItem, InventoryLot,
    TableSession
)
from app.schemas import OrderCreateSchema


class OrderServiceError(Exception):
    """注文処理に関するドメイン例外の基底クラス"""
    pass


class ProductUnavailableError(OrderServiceError):
    """商品が販売停止または売り切れの場合の例外"""
    pass


class InsufficientStockError(OrderServiceError):
    """在庫不足時の例外"""
    pass


class OrderService:
    @staticmethod
    def create_order(db: Session, order_in: OrderCreateSchema) -> Order:
        """
        注文作成、在庫引当(FIFO)、セット展開、合計金額・原価計算を行い、イベント送信する
        """
        try:
            # ★ 0. セッションの有効性確認（追加）
            valid_session = db.query(TableSession).filter(
                TableSession.table_number == order_in.table_number,
                TableSession.session_token == order_in.session_token,
                TableSession.is_active == True
            ).first()

            if not valid_session:
                raise OrderServiceError("お会計が完了しているか、無効なQRコードです。注文できません。")
                
            # 1. 注文ヘッダーの初期作成
            new_order = Order(
                table_number=order_in.table_number,
                status="pending",
                total_price=0
            )
            db.add(new_order)
            db.flush()

            calculated_total_price = 0

            for item_data in order_in.items:
                # 2. メイン商品の検証
                product = (
                    db.query(Product)
                    .filter_by(id=item_data.product_id)
                    .with_for_update()
                    .first()
                )
                if not product or not product.is_active or product.is_sold_out:
                    raise ProductUnavailableError(f"商品(ID: {item_data.product_id})は現在注文できません。")

                # 3. オプションの取得と分類 (通常トッピング / セットオプション)
                selected_options = []
                if item_data.options:
                    selected_options = db.query(Option).filter(Option.id.in_(item_data.options)).all()

                normal_options = [opt for opt in selected_options if not getattr(opt, "linked_product_id", None)]
                set_options = [opt for opt in selected_options if getattr(opt, "linked_product_id", None)]

                # 4. 在庫引当と原価計算 (FIFO)
                cost_price = OrderService._allocate_inventory_fifo(
                    db=db,
                    product=product,
                    normal_options=normal_options,
                    quantity=item_data.quantity
                )

                # 5. メイン商品 OrderItem の作成
                main_order_item = OrderItem(
                    order_id=new_order.id,
                    product_id=product.id,
                    price=product.price,
                    cost_price=cost_price,
                    quantity=item_data.quantity,
                    status="pending"
                )
                db.add(main_order_item)
                db.flush()

                # 通常トッピングの紐付け
                for opt in normal_options:
                    db.add(OrderItemOption(
                        order_item_id=main_order_item.id,
                        option_id=opt.id,
                        price=opt.price
                    ))

                # 小計加算（メイン商品 + 通常トッピング）
                normal_options_price = sum(opt.price for opt in normal_options)
                calculated_total_price += (product.price + normal_options_price) * item_data.quantity

                # 6. セットオプションを別行 OrderItem として展開
                set_total = OrderService._expand_set_options(
                    db=db,
                    order_id=new_order.id,
                    set_options=set_options,
                    quantity=item_data.quantity
                )
                calculated_total_price += set_total

            # 7. 合計金額の確定とコミット
            new_order.total_price = calculated_total_price
            db.commit()
            db.refresh(new_order)

            # 8. リアルタイムイベント通知
            OrderService._broadcast_order_events(new_order)

            return new_order

        except Exception:
            db.rollback()
            raise

    @staticmethod
    def _allocate_inventory_fifo(
        db: Session,
        product: Product,
        normal_options: List[Option],
        quantity: int
    ) -> int:
        """必要在庫を集計し、FIFO(先入れ先出し)で在庫ロットを引き落として原価を算出する"""
        consumed_inventory_map = {}

        # メイン商品の消費量
        product_invs = db.query(ProductInventoryItem).filter_by(product_id=product.id).all()
        for prod_inv in product_invs:
            consumed_inventory_map[prod_inv.inventory_item_id] = (
                consumed_inventory_map.get(prod_inv.inventory_item_id, Decimal("0.00"))
                + (Decimal(str(prod_inv.consumed_quantity)) * quantity)
            )

        # 通常トッピングの消費量
        for opt in normal_options:
            opt_invs = db.query(OptionInventoryItem).filter_by(option_id=opt.id).all()
            for opt_inv in opt_invs:
                consumed_inventory_map[opt_inv.inventory_item_id] = (
                    consumed_inventory_map.get(opt_inv.inventory_item_id, Decimal("0.00"))
                    + (opt_inv.consumed_quantity * quantity)
                )

        item_cost_decimal = Decimal("0.00")

        # FIFO 引当処理
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
                raise InsufficientStockError(
                    f"在庫品目(ID: {inv_item_id})の在庫が不足しているため注文を完了できません。"
                )

        return int(item_cost_decimal)

    @staticmethod
    def _expand_set_options(
        db: Session,
        order_id: int,
        set_options: List[Option],
        quantity: int
    ) -> int:
        """セットオプションを独立したOrderItem明細行として生成し、在庫引当・原価計算を行ってセット加算額を返す"""
        set_total = 0
        for set_opt in set_options:
            set_product = db.query(Product).filter_by(id=set_opt.linked_product_id).first()
            if not set_product or not set_product.is_active or set_product.is_sold_out:
                raise ProductUnavailableError(
                    f"セット対象商品(ID: {set_opt.linked_product_id})は現在注文できません。"
                )

            # ★ セット商品に対してもFIFOで在庫引当と原価計算を行う
            # （※セット商品自体にトッピングが紐づかない場合は normal_options=[] を渡す）
            set_cost_price = OrderService._allocate_inventory_fifo(
                db=db,
                product=set_product,
                normal_options=[],
                quantity=quantity
            )

            set_order_item = OrderItem(
                order_id=order_id,
                product_id=set_product.id,
                price=set_opt.price,
                cost_price=set_cost_price,  # ★ 算出した原価を設定
                quantity=quantity,
                status="pending"
            )
            db.add(set_order_item)
            set_total += set_opt.price * quantity

        return set_total

    @staticmethod
    def _broadcast_order_events(order: Order) -> None:
        """厨房端末及び在庫更新のリアルタイム通知(SSE)"""
        try:
            event_data = json.dumps({
                "event": "new_order",
                "order_id": order.id,
                "table_number": order.table_number,
                "total_price": order.total_price
            })
            inventory_event_data = json.dumps({"event": "inventory_updated"})

            try:
                loop = asyncio.get_running_loop()
                loop.create_task(order_broadcaster.broadcast(event_data))
                loop.create_task(order_broadcaster.broadcast(inventory_event_data))
            except RuntimeError:
                asyncio.run(order_broadcaster.broadcast(event_data))
                asyncio.run(order_broadcaster.broadcast(inventory_event_data))
        except Exception as e:
            print(f"Broadcast notice failed: {e}")