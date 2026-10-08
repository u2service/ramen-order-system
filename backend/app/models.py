from datetime import datetime
import zoneinfo
from sqlalchemy import Column, Integer, String, Boolean, Numeric, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base

# 日本時間(JST)を取得する共通関数
def get_jst_now():
    return datetime.now(zoneinfo.ZoneInfo("Asia/Tokyo"))

# オプションと商品の中間テーブル
class ProductOptionGroup(Base):
    __tablename__ = "product_option_groups"
    product_id = Column(Integer, ForeignKey("products.id"), primary_key=True)
    option_group_id = Column(Integer, ForeignKey("option_groups.id"), primary_key=True)

# オプショングループマスタ
class OptionGroup(Base):
    __tablename__ = "option_groups"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    is_required = Column(Boolean, nullable=False, default=False)
    is_multiple_choice = Column(Boolean, nullable=False, default=False)

    options = relationship("Option", back_populates="option_group")

# オプション選択肢マスタ
class Option(Base):
    __tablename__ = "options"
    id = Column(Integer, primary_key=True, index=True)
    option_group_id = Column(Integer, ForeignKey("option_groups.id"), nullable=False)
    name = Column(String(100), nullable=False)
    price = Column(Integer, nullable=False, default=0)
    linked_product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    option_group = relationship("OptionGroup", back_populates="options")

# 1. カテゴリマスタ
class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    image_url = Column(String(255), nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=get_jst_now)

    products = relationship("Product", back_populates="category")

# 2. 商品マスタ
class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    name = Column(String(100), nullable=False)
    price = Column(Integer, nullable=False, default=0)
    image_url = Column(String(255), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_sold_out = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=get_jst_now)

    category = relationship("Category", back_populates="products")
    option_groups = relationship("OptionGroup", secondary="product_option_groups")

# 3. 在庫品目マスタ
class InventoryItem(Base):
    __tablename__ = "inventory_items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    tani = Column(String(20), nullable=False)
    zaiko_alert = Column(Numeric(10, 2), nullable=False, default=0)

    lots = relationship("InventoryLot", back_populates="inventory_item")

# 4. 在庫ロットテーブル (FIFO管理用)
class InventoryLot(Base):
    __tablename__ = "inventory_lots"
    id = Column(Integer, primary_key=True, index=True)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    received_date = Column(Date, nullable=False)
    expiration_date = Column(Date, nullable=False)
    initial_quantity = Column(Numeric(10, 2), nullable=False)
    current_quantity = Column(Numeric(10, 2), nullable=False)
    total_cost = Column(Numeric(10, 2), nullable=False, default=0)
    unit_cost = Column(Numeric(10, 2), nullable=False, default=0)
    status = Column(String(20), nullable=False, default="active")
    is_discarded = Column(Boolean, nullable=False, default=False)
    discarded_at = Column(DateTime(timezone=True), nullable=True)

    inventory_item = relationship("InventoryItem", back_populates="lots")

# 4-2. オプション在庫消費テーブル (複合主キー)
class OptionInventoryItem(Base):
    __tablename__ = "option_inventory_items"
    option_id = Column(Integer, ForeignKey("options.id"), primary_key=True)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), primary_key=True)
    consumed_quantity = Column(Numeric(10, 2), nullable=False)

# 5. 注文ヘッダー
class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    table_number = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    total_price = Column(Integer, nullable=False, default=0)
    payment_method = Column(String(20), nullable=True)
    paid_amount = Column(Integer, nullable=True)
    change_amount = Column(Integer, nullable=True)
    stripe_payment_intent_id = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_jst_now)
    paid_at = Column(DateTime(timezone=True), nullable=True)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

# 6. 注文明細
class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    price = Column(Integer, nullable=False)
    cost_price = Column(Integer, nullable=False, default=0)
    quantity = Column(Integer, nullable=False, default=1)
    status = Column(String(20), nullable=False, default="pending")
    cancel_reason = Column(String(30), nullable=True)
    discount_type = Column(String(30), nullable=True)
    discount_amount = Column(Integer, nullable=False, default=0)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")
    order_item_options = relationship("OrderItemOption", back_populates="order_item", cascade="all, delete-orphan")
    options = relationship("OrderItemOption", overlaps="order_item_options")

# 7. 注文明細オプション選択
class OrderItemOption(Base):
    __tablename__ = "order_item_options"
    id = Column(Integer, primary_key=True, index=True)
    order_item_id = Column(Integer, ForeignKey("order_items.id", ondelete="CASCADE"), nullable=False)
    option_id = Column(Integer, ForeignKey("options.id"), nullable=False)
    price = Column(Integer, nullable=False)
    order_item = relationship("OrderItem", back_populates="order_item_options", overlaps="options")
    option = relationship("Option")

# 商品在庫消費テーブル (レシピマスタ)
class ProductInventoryItem(Base):
    __tablename__ = "product_inventory_items"
    product_id = Column(Integer, ForeignKey("products.id"), primary_key=True)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), primary_key=True)
    consumed_quantity = Column(Numeric(10, 2), nullable=False) # 例: ラーメン1食で麺 1.0 (玉) や スープ 300.0 (ml)