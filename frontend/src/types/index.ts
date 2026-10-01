// カテゴリ関連の型
export type Category = {
  id: number;
  name: string;
  sort_order: number;
  products?: Product[];
  image_url?: string | null;
};

export type CategoryCreatePayload = {
  name: string;
  sort_order?: number;
};

// オプションの型
export type Option = {
  id: number;
  name: string;
  price_delta?: number;
};

// 商品（注文画面用）の型
export type MenuItem = {
  id: number;
  name: string;
  category: string;
  base_price: number;
  sort_order?: number;
  is_available: boolean; // ★ 販売中・売り切れフラグ
  options: Option[];
};

// カート内の商品アイテムの型
export type CartItem = {
  product: MenuItem;
  quantity: number;
  selectedOptions: Option[];
  itemTotalPrice: number;
};

// 管理画面用の商品型
export type Product = {
  id: number;
  category_id: number;
  name: string;
  price: number;
  sort_order: number;
  urikire_flag: boolean;
  image_url?: string | null;
  is_active?: boolean;
};

export type ProductCreatePayload = {
  category_id: number;
  name: string;
  price: number;
  sort_order?: number;
  urikire_flag: boolean;
  image_url?: string | null;
  is_active?: boolean;
};

// --- 注文確認・履歴用型定義 ---
export type ItemStatus = 'pending' | 'cooking' | 'served' | 'cancelled';
export type OrderStatus = 'pending' | 'cooking' | 'served' | 'paid' | 'cancelled';

export interface OrderItemOption {
  id: number;
  name?: string;
  price?: number;
}

export interface OrderItem {
  id: number;
  menu_item_name: string;
  quantity: number;
  options: OrderItemOption[];
  status: ItemStatus;
}

export interface Order {
  id: number;
  table_number: number;
  status: OrderStatus;
  created_at: string;
  items: OrderItem[];
}