"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { Category } from "@/types";
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  uploadImage,
} from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);

  // フォーム用ステート
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploading, setUploading] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  const loadCategories = async () => {
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // フォームのリセット処理
  const resetForm = () => {
    setEditingId(null);
    setName("");
    setSortOrder(0);
    setImageUrl("");
  };

  // 編集ボタンをクリックした時の処理
  const handleEditClick = (category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    setSortOrder(category.sort_order ?? 0);
    setImageUrl((category as any).image_url || "");
  };

  // 画像選択時のアップロード処理（商品登録と同一処理）
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
    if (!name.trim()) return;

    setLoading(true);
    try {
      const payload = {
        name,
        sort_order: Number(sortOrder),
        image_url: imageUrl || null,
      };

      if (editingId !== null) {
        // --- 編集モード（PUT） ---
        await updateCategory(editingId, payload);
      } else {
        // --- 新規登録モード（POST） ---
        await createCategory(payload);
      }

      resetForm();
      await loadCategories();
    } catch (error) {
      console.error(error);
      alert(editingId ? "カテゴリの更新に失敗しました" : "カテゴリの登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // 削除処理
  const handleDelete = async (id: number) => {
    if (!confirm("本当に削除しますか？")) return;
    try {
      await deleteCategory(id);
      if (editingId === id) resetForm();
      await loadCategories();
    } catch (error) {
      console.error(error);
      alert("削除に失敗しました");
    }
  };

  // 画像の相対パスを完全なURLに変換するヘルパー関数
  const getImageUrl = (url?: string | null) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const backendHost = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
    return `${backendHost}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 0" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1.5rem" }}>
        カテゴリ管理
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
            {editingId ? `📝 カテゴリ情報の編集 (ID: ${editingId})` : "➕ 新規カテゴリ登録"}
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

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.25rem", fontWeight: "bold" }}>
              カテゴリ名
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: ラーメン"
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

        {/* 画像アップロード & プレビュー表示エリア */}
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: "1rem" }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.25rem", fontWeight: "bold" }}>
              カテゴリ画像
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
      </form>

      {/* カテゴリ一覧テーブル */}
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
            <th style={{ padding: "0.75rem" }}>カテゴリ名</th>
            <th style={{ padding: "0.75rem" }}>表示順</th>
            <th style={{ padding: "0.75rem" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {[...categories]
            .sort((a, b) => {
              const orderA = a.sort_order ?? 0;
              const orderB = b.sort_order ?? 0;
              if (orderA !== orderB) return orderA - orderB;
              return a.id - b.id;
            })
            .map((cat) => (
              <tr key={cat.id} style={{ borderBottom: "1px solid #edf2f7", background: editingId === cat.id ? "#f0f9ff" : "transparent" }}>
                <td style={{ padding: "0.75rem" }}>{cat.id}</td>
                <td style={{ padding: "0.5rem 0.75rem" }}>
                  {(cat as any).image_url ? (
                    <img
                      src={getImageUrl((cat as any).image_url)}
                      alt={cat.name}
                      style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px", border: "1px solid #e2e8f0" }}
                    />
                  ) : (
                    <div style={{ width: "40px", height: "40px", borderRadius: "4px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", color: "#94a3b8" }}>
                      なし
                    </div>
                  )}
                </td>
                <td style={{ padding: "0.75rem", fontWeight: "bold" }}>{cat.name}</td>
                <td style={{ padding: "0.75rem", fontWeight: "bold" }}>{cat.sort_order ?? 0}</td>
                <td style={{ padding: "0.75rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => handleEditClick(cat)}
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
                      onClick={() => handleDelete(cat.id)}
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