import pytest
from datetime import date, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.main import app
from app.models import (
    Category, Product, OptionGroup, Option,
    InventoryItem, InventoryLot, ProductInventoryItem, OptionInventoryItem
)

# テスト用のインメモリSQLite
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """テスト関数ごとにクリーンなDBスキーマを作成・破棄する"""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """FastAPIの get_db 依存関係をテスト用セッションでオーバーライドしたクライアント"""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def seed_master_data(db_session):
    """結合テストに必要なマスタデータ・レシピ・在庫ロットの投入"""
    # 1. カテゴリ
    cat_ramen = Category(name="ラーメン", sort_order=1)
    cat_side = Category(name="サイド", sort_order=2)
    db_session.add_all([cat_ramen, cat_side])
    db_session.flush()

    # 2. 商品
    p_tonkotsu = Product(name="豚骨ラーメン", price=800, category_id=cat_ramen.id, is_active=True, is_sold_out=False)
    p_gyoza = Product(name="焼き餃子", price=350, category_id=cat_side.id, is_active=True, is_sold_out=False)
    db_session.add_all([p_tonkotsu, p_gyoza])
    db_session.flush()

    # 3. オプショングループ & オプション
    grp_topping = OptionGroup(name="トッピング", is_required=False, is_multiple_choice=True)
    grp_set = OptionGroup(name="セットメニュー", is_required=False, is_multiple_choice=False)
    db_session.add_all([grp_topping, grp_set])
    db_session.flush()

    # 通常トッピング（味玉: +100円）
    opt_ajitama = Option(name="味玉", price=100, option_group_id=grp_topping.id, is_active=True)
    # セットオプション（餃子セット: +300円、linked_product_id付き）
    opt_set_gyoza = Option(name="餃子セット", price=300, option_group_id=grp_set.id, linked_product_id=p_gyoza.id, is_active=True)
    db_session.add_all([opt_ajitama, opt_set_gyoza])
    db_session.flush()

    # 4. 在庫品目マスタ
    inv_men = InventoryItem(name="生麺", tani="玉", zaiko_alert=10)
    inv_egg = InventoryItem(name="味付玉子", tani="個", zaiko_alert=5)
    db_session.add_all([inv_men, inv_egg])
    db_session.flush()

    # 5. レシピ定義
    # 豚骨ラーメン 1食につき 生麺 1.0玉 消費
    recipe_men = ProductInventoryItem(product_id=p_tonkotsu.id, inventory_item_id=inv_men.id, consumed_quantity=1.0)
    # 味玉トッピング 1個につき 味付玉子 1.0個 消費
    recipe_egg = OptionInventoryItem(option_id=opt_ajitama.id, inventory_item_id=inv_egg.id, consumed_quantity=1.0)
    db_session.add_all([recipe_men, recipe_egg])
    db_session.flush()

    # 6. 在庫ロット（FIFO検証用: 古いロットと新しいロットを投入）
    today = date.today()
    lot_men_old = InventoryLot(
        inventory_item_id=inv_men.id,
        received_date=today - timedelta(days=2),
        expiration_date=today + timedelta(days=2),  # 賞味期限が近い（先に引当）
        initial_quantity=2.0,
        current_quantity=2.0,
        total_cost=200,
        unit_cost=100,
        status="active"
    )
    lot_men_new = InventoryLot(
        inventory_item_id=inv_men.id,
        received_date=today - timedelta(days=1),
        expiration_date=today + timedelta(days=7),  # 賞味期限が遠い
        initial_quantity=5.0,
        current_quantity=5.0,
        total_cost=500,
        unit_cost=100,
        status="active"
    )
    lot_egg = InventoryLot(
        inventory_item_id=inv_egg.id,
        received_date=today,
        expiration_date=today + timedelta(days=5),
        initial_quantity=10.0,
        current_quantity=10.0,
        total_cost=500,
        unit_cost=50,
        status="active"
    )
    db_session.add_all([lot_men_old, lot_men_new, lot_egg])
    db_session.commit()

    return {
        "p_tonkotsu": p_tonkotsu,
        "p_gyoza": p_gyoza,
        "opt_ajitama": opt_ajitama,
        "opt_set_gyoza": opt_set_gyoza,
        "inv_men": inv_men,
        "inv_egg": inv_egg,
        "lot_men_old": lot_men_old,
        "lot_men_new": lot_men_new,
        "lot_egg": lot_egg,
    }