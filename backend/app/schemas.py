from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal

# ==========================================
# オプション選択肢 & オプショングループ
# ==========================================

# --- オプション選択肢（Option） ---
class OptionSchema(BaseModel):
    id: int
    name: str
    price: int
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)

class OptionCreateSchema(BaseModel):
    option_group_id: int
    name: str
    price: int = 0
    linked_product_id: Optional[int] = None
    is_active: bool = True

class OptionResponseSchema(OptionCreateSchema):
    id: int

    model_config = ConfigDict(from_attributes=True)


# --- オプショングループ（OptionGroup） ---
class OptionGroupSchema(BaseModel):
    id: int
    name: str
    is_required: bool
    is_multiple_choice: bool
    options: List[OptionSchema] = []

    model_config = ConfigDict(from_attributes=True)

class OptionGroupCreateSchema(BaseModel):
    name: str
    is_required: bool = False
    is_multiple_choice: bool = False

class OptionGroupResponseSchema(OptionGroupCreateSchema):
    id: int
    options: List[OptionResponseSchema] = []

    model_config = ConfigDict(from_attributes=True)


# --- 商品とオプショングループの紐付け ---
class ProductOptionGroupSyncSchema(BaseModel):
    product_id: int
    option_group_ids: List[int]


# ==========================================
# 商品（Product）スキーマ
# ==========================================

# 客用メニュー画面：商品表示用
class ProductSchema(BaseModel):
    id: int
    name: str
    price: int
    image_url: Optional[str] = None  # ★ 追加
    is_sold_out: bool
    sort_order: int = 0
    option_groups: List[OptionGroupSchema] = []

    model_config = ConfigDict(from_attributes=True)

# ★ 管理画面：商品新規登録用（POST用）
class ProductCreateSchema(BaseModel):
    category_id: int
    name: str
    price: int
    image_url: Optional[str] = None  # ★ 追加
    sort_order: int = 0
    is_sold_out: bool = False
    is_active: bool = True

# ★ 管理画面：商品更新用（PUT/PATCH用）
class ProductUpdateSchema(BaseModel):
    category_id: Optional[int] = None
    name: Optional[str] = None
    price: Optional[int] = None
    image_url: Optional[str] = None  # ★ 追加
    sort_order: Optional[int] = None
    is_sold_out: Optional[bool] = None
    is_active: Optional[bool] = None

# ★ 管理画面：商品レスポンス用（GET/POST/PUT用）
class ProductResponseSchema(ProductCreateSchema):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# カテゴリ（Category）スキーマ
# ==========================================

# ★ 管理画面：カテゴリ新規登録（POSTリクエスト用）
class CategoryCreateSchema(BaseModel):
    name: str
    image_url: Optional[str] = None  # ★ 追加
    sort_order: int = 0

# ★ 管理画面：カテゴリ更新用（PUT/PATCH用）
class CategoryUpdateSchema(BaseModel):
    name: Optional[str] = None
    image_url: Optional[str] = None  # ★ 追加
    sort_order: Optional[int] = None

# ★ 管理画面：カテゴリレスポンス（GET/POST用）
class CategoryResponseSchema(CategoryCreateSchema):
    id: int

    model_config = ConfigDict(from_attributes=True)

# 客用メニュー画面：カテゴリ（商品一覧含む）
class CategorySchema(BaseModel):
    id: int
    name: str
    image_url: Optional[str] = None  # ★ 追加
    sort_order: int
    products: List[ProductSchema] = []

    model_config = ConfigDict(from_attributes=True)

# GET /api/v1/menu の全体系レスポンス
class MenuResponseSchema(BaseModel):
    categories: List[CategorySchema]


# ==========================================
# 注文（Order） & 決済（Checkout）スキーマ
# ==========================================

# 注文アイテムの入力スキーマ
class OrderItemCreateSchema(BaseModel):
    product_id: int
    quantity: int = 1
    options: List[int] = []  # 選択された option_id のリスト

# POST /api/v1/orders のリクエスト本体
class OrderCreateSchema(BaseModel):
    table_number: int
    items: List[OrderItemCreateSchema]

# 注文作成完了のレスポンス
class OrderCreateResponseSchema(BaseModel):
    order_id: int
    status: str
    total_price: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# 卓ごとの会計確認レスポンス
class TableBillResponseSchema(BaseModel):
    table_number: int
    unpaid_orders_count: int
    subtotal: int
    tax: int
    total_price: int

# 現金決済リクエスト
class CashCheckoutSchema(BaseModel):
    table_number: int
    paid_amount: int

# 現金決済レスポンス
class CashCheckoutResponseSchema(BaseModel):
    table_number: int
    total_price: int
    paid_amount: int
    change_amount: int
    status: str

# Stripe決済リクエスト
class StripeCheckoutSchema(BaseModel):
    table_number: int
    payment_method_id: str  # Stripeから渡されるカード識別ID

# Stripe決済レスポンス
class StripeCheckoutResponseSchema(BaseModel):
    table_number: int
    total_price: int
    payment_intent_id: str
    status: str


# ==========================================
# 在庫（Inventory）スキーマ
# ==========================================

# 在庫品目 (InventoryItem) スキーマ
class InventoryItemBaseSchema(BaseModel):
    name: str
    unit: str
    zaiko_alert: float

class InventoryItemCreateSchema(InventoryItemBaseSchema):
    pass

class InventoryItemUpdateSchema(InventoryItemBaseSchema):
    pass

class InventoryItemResponseSchema(InventoryItemBaseSchema):
    id: int
    current_stock: float = 0.0

    model_config = ConfigDict(from_attributes=True)


# 入荷ロット (InventoryLot) スキーマ
class InventoryLotBaseSchema(BaseModel):
    inventory_item_id: int
    received_date: date
    expiration_date: date
    initial_quantity: float
    total_cost: float

class InventoryLotCreateSchema(InventoryLotBaseSchema):
    pass  # ★ 重複していた旧InventoryLotCreateSchemaを削除し、こちらに統一

class InventoryLotDiscardSchema(BaseModel):
    discarded_at: Optional[datetime] = None  # 指定がなければAPI側で現在時刻を入れる

class InventoryLotResponseSchema(BaseModel):
    id: int
    inventory_item_id: int
    inventory_item_name: str = ""
    unit: str = ""
    received_date: date
    expiration_date: date
    initial_quantity: float
    current_quantity: float
    total_cost: float
    unit_cost: float
    status: str
    is_discarded: bool = False
    discarded_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# 在庫アラート情報
class InventoryAlertSchema(BaseModel):
    inventory_item_id: int
    item_name: str
    current_quantity: float
    zaiko_alert: float
    unit: str
    status: str  # "LOW_STOCK" や "EXPIRING_SOON"


# ==========================================
# レシピ（Recipe） & 分析（Analytics） & ダッシュボード
# ==========================================

class RecipeItemInputSchema(BaseModel):
    inventory_item_id: int
    consumed_quantity: float

class RecipeItemResponseSchema(BaseModel):
    inventory_item_id: int
    inventory_item_name: str
    unit: str
    consumed_quantity: float

    model_config = ConfigDict(from_attributes=True)

# 商品レシピの一括設定リクエスト
class ProductRecipeSyncSchema(BaseModel):
    product_id: int
    recipes: List[RecipeItemInputSchema]

# オプションレシピの一括設定リクエスト
class OptionRecipeSyncSchema(BaseModel):
    option_id: int
    recipes: List[RecipeItemInputSchema]

# 売上・損益分析サマリー
class AnalyticsSummarySchema(BaseModel):
    total_sales: int          # 売上高
    total_cost: int           # 売上原価 (FIFO引き当て分)
    gross_profit: int         # 粗利益 (売上 - 原価)
    gross_profit_margin: float # 粗利率 (%)
    total_orders_count: int   # 注文数

# ダッシュボードサマリー用スキーマ
class DashboardSummarySchema(BaseModel):
    today_sales: int
    today_orders: int
    stock_alerts: int