"use client";

import { useEffect, useState } from "react";

type Product = { id: number; name: string; price: number };
type Option = { id: number; name: string; price: number };
type InventoryItem = { id: number; name: string; unit: string };

type RecipeRow = {
  inventory_item_id: number;
  consumed_quantity: number;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function RecipeSettingPage() {
  const [targetType, setTargetType] = useState<"product" | "option">("product");
  const [products, setProducts] = useState<Product[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const [selectedTargetId, setSelectedTargetId] = useState<number>(0);
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 初期データの取得 (商品・オプション・在庫品目)
  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);
        const [prodRes, optRes, itemRes] = await Promise.all([
          fetch(`${API_BASE_URL}/admin/products`).catch(() => null), // または /products
          fetch(`${API_BASE_URL}/options`).catch(() => null),
          fetch(`${API_BASE_URL}/inventory/items`).catch(() => null),
        ]);

        if (prodRes && prodRes.ok) {
          const prods = await prodRes.json();

          setProducts(prods);

          if (prods.length > 0) {
            setSelectedTargetId(prods[0].id);
          }
        }

        if (optRes && optRes.ok) {
          const opts = await optRes.json();
          setOptions(opts);
        }

        if (itemRes && itemRes.ok) {
          const items = await itemRes.json();
          setInventoryItems(items);
        }
      } catch (err) {
        console.error("初期データ取得エラー:", err);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  // 対象（商品 or オプション）変更時にレシピを取得
  useEffect(() => {
    if (!selectedTargetId) return;

    const fetchRecipe = async () => {
      try {
        const endpoint = targetType === "product"
          ? `${API_BASE_URL}/inventory/recipes/products/${selectedTargetId}`
          : `${API_BASE_URL}/inventory/recipes/options/${selectedTargetId}`;

        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          setRecipeRows(
            data.map((r: any) => ({
              inventory_item_id: r.inventory_item_id,
              consumed_quantity: r.consumed_quantity,
            }))
          );
        }
      } catch (err) {
        console.error("レシピ取得エラー:", err);
      }
    };

    fetchRecipe();
  }, [targetType, selectedTargetId]);

  // 行の追加
  const handleAddRow = () => {
    if (inventoryItems.length === 0) return;
    setRecipeRows([
      ...recipeRows,
      { inventory_item_id: inventoryItems[0].id, consumed_quantity: 1.0 },
    ]);
  };

  // 行の削除
  const handleRemoveRow = (index: number) => {
    setRecipeRows(recipeRows.filter((_, i) => i !== index));
  };

  // 行の値変更
  const handleRowChange = (index: number, key: keyof RecipeRow, value: number) => {
    const updated = [...recipeRows];
    updated[index] = { ...updated[index], [key]: value };
    setRecipeRows(updated);
  };

  // レシピ保存処理
  const handleSave = async () => {
    if (!selectedTargetId) return;
    try {
      setSaving(true);
      const endpoint = targetType === "product"
        ? `${API_BASE_URL}/inventory/recipes/products/sync`
        : `${API_BASE_URL}/inventory/recipes/options/sync`;

      const payload = targetType === "product"
        ? { product_id: selectedTargetId, recipes: recipeRows }
        : { option_id: selectedTargetId, recipes: recipeRows };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert("レシピを保存しました！");
      } else {
        alert("保存に失敗しました。");
      }
    } catch (err) {
      console.error("保存エラー:", err);
      alert("エラーが発生しました。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#0f172a", marginBottom: "1.5rem" }}>
        🍲 レシピ（消費材料）設定
      </h1>

      {loading ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>読み込み中...</div>
      ) : (
        <div style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          {/* 種別切替タブ */}
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
            <button
              onClick={() => {
                setTargetType("product");
                if (products.length > 0) setSelectedTargetId(products[0].id);
              }}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "6px",
                border: "none",
                fontWeight: "bold",
                cursor: "pointer",
                background: targetType === "product" ? "#2563eb" : "#f1f5f9",
                color: targetType === "product" ? "#fff" : "#475569",
              }}
            >
              🍜 商品（メイン）
            </button>
            <button
              onClick={() => {
                setTargetType("option");
                if (options.length > 0) setSelectedTargetId(options[0].id);
              }}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "6px",
                border: "none",
                fontWeight: "bold",
                cursor: "pointer",
                background: targetType === "option" ? "#2563eb" : "#f1f5f9",
                color: targetType === "option" ? "#fff" : "#475569",
              }}
            >
              🥚 トッピング・オプション
            </button>
          </div>

          {/* 対象選択ドロップダウン */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.4rem" }}>
              設定対象の{targetType === "product" ? "商品" : "オプション"}を選択
            </label>
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(Number(e.target.value))}
              style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "1rem", background: "#fff" }}
            >
              {targetType === "product"
                ? products.map((p) => <option key={p.id} value={p.id}>{p.name} (¥{p.price})</option>)
                : options.map((o) => <option key={o.id} value={o.id}>{o.name} (+¥{o.price})</option>)}
            </select>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "1.5rem 0" }} />

          {/* 材料一覧テーブル */}
          <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#0f172a", margin: 0 }}>消費する材料一覧</h3>
            <button
              onClick={handleAddRow}
              style={{ background: "#f8fafc", border: "1px solid #cbd5e1", padding: "0.4rem 0.8rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600", color: "#334155" }}
            >
              ＋ 材料を追加
            </button>
          </div>

          {recipeRows.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", background: "#f8fafc", borderRadius: "6px", border: "1px dashed #cbd5e1" }}>
              消費材料が設定されていません。「＋ 材料を追加」から登録してください。
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1.5rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontSize: "0.85rem", textAlign: "left" }}>
                  <th style={{ padding: "0.6rem" }}>在庫品目</th>
                  <th style={{ padding: "0.6rem", width: "180px" }}>1食あたりの消費量</th>
                  <th style={{ padding: "0.6rem", width: "80px", textAlign: "center" }}>単位</th>
                  <th style={{ padding: "0.6rem", width: "80px", textAlign: "center" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {recipeRows.map((row, idx) => {
                  const currentItem = inventoryItems.find((i) => i.id === row.inventory_item_id);
                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.5rem" }}>
                        <select
                          value={row.inventory_item_id}
                          onChange={(e) => handleRowChange(idx, "inventory_item_id", Number(e.target.value))}
                          style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                        >
                          {inventoryItems.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        <input
                          type="number"
                          step="0.01"
                          value={row.consumed_quantity}
                          onChange={(e) => handleRowChange(idx, "consumed_quantity", Number(e.target.value))}
                          style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                        />
                      </td>
                      <td style={{ padding: "0.5rem", textAlign: "center", color: "#64748b", fontWeight: "bold" }}>
                        {currentItem?.unit || "-"}
                      </td>
                      <td style={{ padding: "0.5rem", textAlign: "center" }}>
                        <button
                          onClick={() => handleRemoveRow(idx)}
                          style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: saving ? "#94a3b8" : "#2563eb",
                color: "#fff",
                padding: "0.65rem 1.5rem",
                borderRadius: "6px",
                border: "none",
                fontWeight: "bold",
                fontSize: "1rem",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "保存中..." : "レシピ設定を保存"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}