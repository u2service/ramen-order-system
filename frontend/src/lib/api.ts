import axios from 'axios';
import { Category, CategoryCreatePayload } from "@/types";
import { Product, ProductCreatePayload } from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// カテゴリ一覧取得
export const fetchCategories = async (): Promise<Category[]> => {
  const response = await api.get('/admin/categories');
  return response.data;
};

// カテゴリ新規作成 (JSON送信)
export const createCategory = async (data: { name: string; sort_order: number; image_url?: string | null }): Promise<Category> => {
  const response = await api.post('/admin/categories', data);
  return response.data;
};

// カテゴリ更新 (JSON送信)
export const updateCategory = async (id: number, data: { name: string; sort_order: number; image_url?: string | null }): Promise<Category> => {
  const response = await api.put(`/admin/categories/${id}`, data);
  return response.data;
};

// カテゴリー削除
export const deleteCategory = async (id: number): Promise<void> => {
  await api.delete(`/admin/categories/${id}`);
};

// 商品一覧取得
export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${API_BASE_URL}/admin/products`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

// 商品作成
export async function createProduct(payload: ProductCreatePayload): Promise<Product> {
  const res = await fetch(`${API_BASE_URL}/admin/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create product");
  return res.json();
}

// 商品更新（売り切れ切替や価格変更）
export async function updateProduct(id: number, payload: ProductCreatePayload): Promise<Product> {
  const res = await fetch(`${API_BASE_URL}/admin/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update product");
  return res.json();
}

// 商品削除
export async function deleteProduct(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/admin/products/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete product");
}

// 商品画像の追加
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/v1/upload`, {
    method: "POST",
    // ※ FormData を送信する場合、'Content-Type' ヘッダーは指定しないでください。
    // ブラウザが自動的に boundary を含む適切な Content-Type を設定してくれます。
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Failed to upload image");
  }

  const data = await res.json();
  return data.url; // 返ってきた画像URL ("/.../static/uploads/xxx.png")
}