import axios from 'axios';
import { Category, Product, ProductCreatePayload } from "@/types";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// カテゴリ関連
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

// 商品関連（axios に統一）
export async function fetchProducts(): Promise<Product[]> {
  const response = await api.get('/admin/products');
  return response.data;
}

// 商品作成
export async function createProduct(payload: ProductCreatePayload): Promise<Product> {
  const response = await api.post('/admin/products', payload);
  return response.data;
}

// 商品更新（売り切れ切替や価格変更）
export async function updateProduct(id: number, payload: ProductCreatePayload): Promise<Product> {
  const response = await api.put(`/admin/products/${id}`, payload);
  return response.data;
}

// 商品削除
export async function deleteProduct(id: number): Promise<void> {
  await api.delete(`/admin/products/${id}`);
}

// 画像アップロード
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  // FormData 送信時は axios が自動で適切な Content-Type (multipart/form-data) を設定します
  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.url; // 返ってきた画像URL ("/.../static/uploads/xxx.png")
}
