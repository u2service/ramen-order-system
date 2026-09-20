import pytest
from app.models import Order, InventoryLot, OrderItem


def test_e2e_order_to_checkout_flow(client, db_session, seed_master_data):
    """
    【シナリオ1: 一気通貫フロー】
    注文作成 -> FIFO在庫減算 -> KDS調理ステータス更新 -> POS伝票確認 -> 現金会計完了
    """
    master = seed_master_data
    table_no = 5

    # 1. 卓上端末から「豚骨ラーメン + 味玉トッピング」を1杯注文
    order_payload = {
        "table_number": table_no,
        "items": [
            {
                "product_id": master["p_tonkotsu"].id,
                "quantity": 1,
                "options": [master["opt_ajitama"].id]
            }
        ]
    }
    res_order = client.post("/api/v1/orders", json=order_payload)
    assert res_order.status_code == 201
    order_data = res_order.json()
    order_id = order_data["order_id"]
    # 豚骨ラーメン(800円) + 味玉(100円) = 900円
    assert order_data["total_price"] == 900
    assert order_data["status"] == "pending"

    # 2. 在庫がFIFO（賞味期限の古いロット）から正しく減算されたかDB直接検証
    db_session.expire_all()
    old_lot = db_session.query(InventoryLot).filter_by(id=master["lot_men_old"].id).first()
    egg_lot = db_session.query(InventoryLot).filter_by(id=master["lot_egg"].id).first()
    assert float(old_lot.current_quantity) == 1.0  # 初期2.0 - 1.0 = 1.0
    assert float(egg_lot.current_quantity) == 9.0  # 初期10.0 - 1.0 = 9.0

    # 3. KDS（厨房画面）に新着注文が表示されているか確認
    res_kds = client.get("/api/v1/kds/orders")
    assert res_kds.status_code == 200
    kds_orders = res_kds.json()
    target_kds_order = next((o for o in kds_orders if o["id"] == order_id), None)
    assert target_kds_order is not None
    assert target_kds_order["table_number"] == table_no
    assert len(target_kds_order["items"]) == 1
    kds_item = target_kds_order["items"][0]
    assert kds_item["menu_item_name"] == "豚骨ラーメン"
    assert "味玉" in kds_item["options"]
    assert kds_item["status"] == "pending"

    # 4. KDSで調理完了（served）に更新
    res_status = client.patch(f"/api/v1/kds/items/{kds_item['id']}/status", json={"status": "served"})
    assert res_status.status_code == 200
    assert res_status.json()["status"] == "served"

    # 5. POS（レジ画面）で卓番5の未清算伝票を取得
    res_bill = client.get(f"/api/v1/pos/tables/{table_no}")
    assert res_bill.status_code == 200
    bill_data = res_bill.json()
    assert bill_data["table_number"] == table_no
    assert bill_data["total_price"] == 900
    assert bill_data["unpaid_orders_count"] == 1
    assert len(bill_data["items"]) == 1

    # 6. POSで現金会計（1,000円お預かり）
    checkout_payload = {
        "table_number": table_no,
        "paid_amount": 1000
    }
    res_checkout = client.post("/api/v1/pos/checkout/cash", json=checkout_payload)
    assert res_checkout.status_code == 200
    checkout_data = res_checkout.json()
    assert checkout_data["total_price"] == 900
    assert checkout_data["paid_amount"] == 1000
    assert checkout_data["change_amount"] == 100
    assert checkout_data["status"] == "paid"

    # 7. 会計完了後、未清算卓リストから卓番5が除外されていること
    res_active = client.get("/api/v1/pos/active-tables")
    assert res_active.status_code == 200
    assert table_no not in res_active.json()["active_tables"]


def test_fifo_multi_lot_deduction(client, db_session, seed_master_data):
    """
    【シナリオ2: FIFO複数ロット跨ぎ消費】
    古いロット(残2)を超える注文(3杯)を行い、古いロットが0(depleted)になり
    新しいロットから残り1が消費されることを検証
    """
    master = seed_master_data

    # 3杯注文（生麺が計3玉必要）
    order_payload = {
        "table_number": 2,
        "items": [{"product_id": master["p_tonkotsu"].id, "quantity": 3, "options": []}]
    }
    res = client.post("/api/v1/orders", json=order_payload)
    assert res.status_code == 201

    db_session.expire_all()
    old_lot = db_session.query(InventoryLot).filter_by(id=master["lot_men_old"].id).first()
    new_lot = db_session.query(InventoryLot).filter_by(id=master["lot_men_new"].id).first()

    # 古いロットは2玉すべて消費されて depleted になる
    assert float(old_lot.current_quantity) == 0.0
    assert old_lot.status == "depleted"

    # 新しいロットから残り1玉が消費される（初期5.0 - 1.0 = 4.0）
    assert float(new_lot.current_quantity) == 4.0
    assert new_lot.status == "active"


def test_order_stock_shortage_rollback(client, db_session, seed_master_data):
    """
    【シナリオ3: 在庫不足エラーとロールバック】
    全ロットの合計残数(2 + 5 = 7玉)を超える8杯を注文した場合にエラーとなり、
    注文データが作成されず在庫ロットも減算されないことを検証
    """
    master = seed_master_data

    order_payload = {
        "table_number": 3,
        "items": [{"product_id": master["p_tonkotsu"].id, "quantity": 8, "options": []}]
    }
    res = client.post("/api/v1/orders", json=order_payload)
    assert res.status_code == 400
    assert "在庫が不足しているため" in res.json()["detail"]

    db_session.expire_all()
    # 注文がロールバックされ作成されていないこと
    assert db_session.query(Order).filter_by(table_number=3).first() is None
    # ロット数量が変化していないこと
    old_lot = db_session.query(InventoryLot).filter_by(id=master["lot_men_old"].id).first()
    assert float(old_lot.current_quantity) == 2.0


def test_set_option_decomposition(client, db_session, seed_master_data):
    """
    【シナリオ4: セットオプションの自動個別明細化】
    ラーメン注文時に餃子セット（linked_product_id付き）を指定した場合、
    独立したOrderItem行として餃子が生成され、合計金額に正しく反映されることを検証
    """
    master = seed_master_data

    order_payload = {
        "table_number": 4,
        "items": [
            {
                "product_id": master["p_tonkotsu"].id,
                "quantity": 1,
                "options": [master["opt_set_gyoza"].id]
            }
        ]
    }
    res = client.post("/api/v1/orders", json=order_payload)
    assert res.status_code == 201
    order_id = res.json()["order_id"]

    # 豚骨ラーメン(800円) + 餃子セット(+300円) = 1,100円
    assert res.json()["total_price"] == 1100

    db_session.expire_all()
    order = db_session.query(Order).filter_by(id=order_id).first()
    # 明細が2行（豚骨ラーメン、セット餃子）に分解されていること
    assert len(order.items) == 2
    product_ids = [item.product_id for item in order.items]
    assert master["p_tonkotsu"].id in product_ids
    assert master["p_gyoza"].id in product_ids


def test_pos_cancel_and_inventory_restore(client, db_session, seed_master_data):
    """
    【シナリオ5: 明細キャンセルと在庫復元】
    客都合キャンセル（customer_mistake）時にトッピング在庫がロットへ加算還元され、
    注文合計金額が自動で再計算されることを検証
    """
    master = seed_master_data

    # 1. 注文（豚骨ラーメン + 味玉トッピング）
    order_payload = {
        "table_number": 1,
        "items": [
            {
                "product_id": master["p_tonkotsu"].id,
                "quantity": 1,
                "options": [master["opt_ajitama"].id]
            }
        ]
    }
    res_order = client.post("/api/v1/orders", json=order_payload)
    assert res_order.status_code == 201

    db_session.expire_all()
    egg_lot = db_session.query(InventoryLot).filter_by(id=master["lot_egg"].id).first()
    assert float(egg_lot.current_quantity) == 9.0  # 1個消費されている

    # 注文明細を取得
    order_item = db_session.query(OrderItem).first()

    # 2. 客都合で明細をキャンセル
    res_cancel = client.post(
        f"/api/v1/pos/items/{order_item.id}/cancel",
        json={"cancel_reason": "customer_mistake"}
    )
    assert res_cancel.status_code == 200

    db_session.expire_all()
    # 在庫が復元され、10.0個に戻っていること
    egg_lot = db_session.query(InventoryLot).filter_by(id=master["lot_egg"].id).first()
    assert float(egg_lot.current_quantity) == 10.0

    # 注文合計金額が0円に再計算されていること
    order = db_session.query(Order).first()
    assert order.total_price == 0