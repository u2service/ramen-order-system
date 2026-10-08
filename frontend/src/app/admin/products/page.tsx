"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { Category, Product } from "@/types";
import {
  fetchCategories,
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadImage, // ★ 画像アップロードAPI関数のインポート
} from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AdminProductsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // フォーム用ステート
  const [editingId, setEditingId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number>(0);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number>(800);
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);
  
  // ★ 追加: 画像関連ステート
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploading, setUploading] = useState<boolean>(false);
  
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    try {
      const [cats, prods] = await Promise.all([fetchCategories(), fetchProducts()]);
      setCategories(cats);
      setProducts(prods);
      if (cats.length > 0 && categoryId === 0) {
        setCategoryId(cats[0].id);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // フォームのリセット処理
  const resetForm = () => {
    setEditingId(null);
    setName("");
    setPrice(800);
    setSortOrder(0);
    setImageUrl(""); // ★ 画像リセット
    setIsActive(true);
    if (categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  };

  // 編集ボタンをクリックした時の処理（フォームにデータを反映）
  const handleEditClick = (product: Product) => {
    setEditingId(product.id);
    setCategoryId(product.category_id);
    setName(product.name);
    setPrice(product.price);
    setSortOrder(product.sort_order ?? 0);
    setImageUrl(product.image_url || ""); // ★ 画像URLの反映
    setIsActive(product.is_active ?? true);
  };

  // ★ 追加: 画像選択時のアップロード処理
  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const url = await uploadImage(file);
      setImageUrl(url);
    } catch (error) {
      console.error("画像のアップロードに失敗しました:", error);
      alert("画像のアップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  };

  // 登録・更新処理の実行
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !categoryId) return;

    setLoading(true);
    try {
      const payload = {
        category_id: Number(categoryId),
        name,
        price: Number(price),
        sort_order: Number(sortOrder),
        image_url: imageUrl || null, // ★ image_url をペイロードに追加
        is_active: isActive,
      };

      if (editingId !== null) {
        // --- 編集モード（PUT） ---
        const targetProduct = products.find((p) => p.id === editingId);
        await updateProduct(editingId, {
          ...payload,
          is_sold_out: targetProduct ? targetProduct.is_sold_out : false,
        });
      } else {
        // --- 新規登録モード（POST） ---
        await createProduct({
          ...payload,
          is_sold_out: false,
        });
      }

      resetForm();
      await loadData();
    } catch (error) {
      console.error(error);
      alert(editingId ? "商品の更新に失敗しました" : "商品の登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // ★ 追加: 有効/無効フラグの切り替え
  const toggleActive = async (product: Product) => {
    try {
      await updateProduct(product.id, {
        ...product,
        sort_order: product.sort_order ?? 0,
        is_active: !product.is_active,
      });
      await loadData();
    } catch (error) {
      console.error(error);
      alert("有効/無効状態の更新に失敗しました");
    }
  };

  // 売り切れフラグの切り替え
  const toggleUrikire = async (product: Product ) => {
    try {
      await updateProduct(product.id, {
        ...product,
        sort_order: product.sort_order ?? 0,
        is_sold_out: !product.is_sold_out,
      });
      await loadData();
    } catch (error) {
      console.error(error);
      alert("状態の更新に失敗しました");
    }
  };

  // 削除処理
  const handleDelete = async (id: number) => {
    if (!confirm("本当に削除しますか？")) return;
    try {
      await deleteProduct(id);
      if (editingId === id) resetForm();
      await loadData();
    } catch (error) {
      console.error(error);
      alert("削除に失敗しました");
    }
  };

  const getCategoryName = (catId: number) => {
    const cat = categories.find((c) => c.id === catId);
    return cat ? cat.name : "未設定";
  };

  // 画像の相対パスを完全なURLに変換するヘルパー関数
  const getImageUrl = (url?: string | null) => {
    if (!url) return "";
    // すでに http:// や https:// から始まる場合はそのまま返す
    if (url.startsWith("http://") || url.startsWith("https://")) return url;

    // BASE_URL から末尾の /api/v1 などを除外してホスト部分（http://localhost:8000）を取得
    const backendHost = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
    
    return `${backendHost}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1.5rem" }}>
        商品登録・編集
      </h1>

      {/* 登録・編集フォーム */}
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          padding: "1.25rem",
          borderRadius: "8px",
          border: editingId ? "2px solid #0284c7" : "1px solid #e2e8f0",
          marginBottom: "2rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: "bold", margin: 0, color: editingId ? "#0284c7" : "#0f172a" }}>
            {editingId ? `📝 商品情報の編集 (ID: ${editingId})` : "➕ 新規商品登録"}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              style={{
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                padding: "0.25rem 0.75rem",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              キャンセル（新規登録に戻る）
            </button>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.25rem", fontWeight: "bold" }}>
              カテゴリ
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.25rem", fontWeight: "bold" }}>
              商品名
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 特製醤油ラーメン"
              required
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.25rem", fontWeight: "bold" }}>
              価格 (円)
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              required
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.25rem", fontWeight: "bold" }}>
              表示順
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              required
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
            />
          </div>
        </div>

        {/* ★ 追加: 画像アップロード & プレビュー表示エリア */}
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: "1rem" }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.25rem", fontWeight: "bold" }}>
              商品画像
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              disabled={uploading}
              style={{ width: "100%", fontSize: "0.85rem" }}
            />
            {uploading && <span style={{ fontSize: "0.75rem", color: "#64748b" }}>アップロード中...</span>}
          </div>

          {/* 画像プレビュー領域 */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {imageUrl ? (
              <div style={{ position: "relative" }}>
                <img
                  src={getImageUrl(imageUrl)}
                  alt="Preview"
                  style={{ width: "64px", height: "64px", objectFit: "cover", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  style={{
                    position: "absolute",
                    top: "-6px",
                    right: "-6px",
                    background: "#ef4444",
                    color: "#fff",
                    border: "none",
                    borderRadius: "50%",
                    width: "18px",
                    height: "18px",
                    cursor: "pointer",
                    fontSize: "0.7rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "6px",
                  border: "1px dashed #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  color: "#94a3b8",
                  background: "#f8fafc",
                }}
              >
                No Image
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || uploading}
            style={{
              padding: "0.65rem 2rem",
              background: editingId ? "#0284c7" : "#16a34a",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              marginLeft: "auto",
            }}
          >
            {loading ? "保存中..." : editingId ? "更新" : "登録"}
          </button>
        </div>

        {/* フォームの grid エリアの末尾などに配置 */}
        <div>
          <label style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.25rem", fontWeight: "bold" }}>
            公開ステータス
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ width: "18px", height: "18px" }}
            />
            <span style={{ fontSize: "0.9rem" }}>{isActive ? "有効 (公開中)" : "無効 (非公開)"}</span>
          </label>
        </div>
      </form>

      {/* 商品一覧テーブル */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          background: "#fff",
          borderRadius: "8px",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
        }}
      >
        <thead>
          <tr style={{ background: "#f8fafc", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
            <th style={{ padding: "0.75rem" }}>ID</th>
            <th style={{ padding: "0.75rem" }}>画像</th>
            <th style={{ padding: "0.75rem" }}>カテゴリ</th>
            <th style={{ padding: "0.75rem" }}>商品名</th>
            <th style={{ padding: "0.75rem" }}>価格</th>
            <th style={{ padding: "0.75rem" }}>表示順</th>
            <th style={{ padding: "0.75rem" }}>販売状態</th>
            <th style={{ padding: "0.75rem" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {[...products]
            .sort((a, b) => {
              // 1. 有効フラグ(is_active)による判定（有効な商品を優先し、無効化商品は下に配置）
              const activeA = a.is_active ?? true;
              const activeB = b.is_active ?? true;
              if (activeA !== activeB) {
                return activeA ? -1 : 1; // true(有効) を先に表示
              }

              // 2. 表示順(sort_order)による判定
              const orderA = a.sort_order ?? 0;
              const orderB = b.sort_order ?? 0;
              if (orderA !== orderB) {
                return orderA - orderB;
              }
              
              // 3. IDによる判定
              return a.id - b.id;
            })
            .map((prod) => (
              <tr key={prod.id} style={{ borderBottom: "1px solid #edf2f7", background: editingId === prod.id ? "#f0f9ff" : "transparent" }}>
                <td style={{ padding: "0.75rem" }}>{prod.id}</td>
                {/* ★ サムネイル画像表示セル */}
                <td style={{ padding: "0.5rem 0.75rem" }}>
                  {prod.image_url ? (
                    <img
                      src={getImageUrl(prod.image_url)}
                      alt={prod.name}
                      style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px", border: "1px solid #e2e8f0" }}
                    />
                  ) : (
                    <div style={{ width: "40px", height: "40px", borderRadius: "4px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", color: "#94a3b8" }}>
                      なし
                    </div>
                  )}
                </td>
                <td style={{ padding: "0.75rem" }}>
                  <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.85rem" }}>
                    {getCategoryName(prod.category_id)}
                  </span>
                </td>
                <td style={{ padding: "0.75rem", fontWeight: "bold" }}>{prod.name}</td>
                <td style={{ padding: "0.75rem" }}>¥{prod.price.toLocaleString()}</td>
                <td style={{ padding: "0.75rem", fontWeight: "bold" }}>{prod.sort_order ?? 0}</td>
                <td style={{ padding: "0.75rem" }}>
                  <div style={{ display: "flex", gap: "0.4rem", flexDirection: "column" }}>
                    {/* 売り切れ状態ボタン */}
                    <button
                      onClick={() => toggleUrikire(prod)}
                      style={{
                        padding: "0.25rem 0.75rem",
                        borderRadius: "20px",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontWeight: "bold",
                        backgroundColor: prod.is_sold_out ? "#fee2e2" : "#dcfce7",
                        color: prod.is_sold_out ? "#ef4444" : "#15803d",
                      }}
                    >
                      {prod.is_sold_out ? "売り切れ中" : "販売中"}
                    </button>

                    {/* ★ 追加: 有効/無効化ボタン */}
                    <button
                      onClick={() => toggleActive(prod)}
                      style={{
                        padding: "0.2rem 0.5rem",
                        borderRadius: "12px",
                        border: "1px solid #cbd5e1",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                        backgroundColor: prod.is_active ? "#f1f5f9" : "#e2e8f0",
                        color: prod.is_active ? "#475569" : "#94a3b8",
                      }}
                    >
                      {prod.is_active ? "有効" : "無効 (非公開)"}
                    </button>
                  </div>
                </td>
                <td style={{ padding: "0.75rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => handleEditClick(prod)}
                      style={{
                        color: "#0284c7",
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(prod.id)}
                      style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer" }}
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}