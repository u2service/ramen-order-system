"use client";

import { useEffect, useState, useMemo } from "react";

type InventoryItem = {
  id: number;
  name: string;
  unit: string;
};

type InventoryLot = {
  id: number;
  inventory_item_id: number;
  inventory_item_name: string;
  unit: string;
  received_date: string;
  expiration_date: string;
  initial_quantity: number;
  current_quantity: number;
  total_cost: number;
  unit_cost: number;
  status: "active" | "depleted" | "expired" | "discarded";
  is_discarded: boolean;
  discarded_at?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function InventoryLotsPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [loading, setLoading] = useState(true);

  // モーダル・フォーム用ステート
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<InventoryLot | null>(null);

  const [selectedItemId, setSelectedItemId] = useState<number>(0);
  const [receivedDate, setReceivedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [expirationDate, setExpirationDate] = useState<string>("");
  const [initialQuantity, setInitialQuantity] = useState<number>(100);
  const [totalCost, setTotalCost] = useState<number>(5000);

  // データ取得
  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsRes, lotsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/inventory/items`),
        fetch(`${API_BASE_URL}/inventory/lots`),
      ]);

      if (itemsRes.ok && lotsRes.ok) {
        const itemsData = await itemsRes.json();
        const lotsData = await lotsRes.json();
        setItems(itemsData);
        setLots(lotsData);
        if (itemsData.length > 0 && selectedItemId === 0) {
          setSelectedItemId(itemsData[0].id);
        }
      }
    } catch (error) {
      console.error("データ取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currentSelectedItem = useMemo(
    () => items.find((it) => it.id === selectedItemId),
    [items, selectedItemId]
  );

  const computedUnitCost = useMemo(() => {
    if (!initialQuantity || initialQuantity <= 0) return 0;
    return Math.round((totalCost / initialQuantity) * 100) / 100;
  }, [totalCost, initialQuantity]);

  // 新規登録用モーダルを開く
  const handleOpenCreateModal = () => {
    setEditingLot(null);
    if (items.length > 0) setSelectedItemId(items[0].id);
    setReceivedDate(new Date().toISOString().split("T")[0]);
    setExpirationDate("");
    setInitialQuantity(100);
    setTotalCost(5000);
    setIsModalOpen(true);
  };

  // 編集用モーダルを開く
  const handleOpenEditModal = (lot: InventoryLot) => {
    setEditingLot(lot);
    setSelectedItemId(lot.inventory_item_id);
    setReceivedDate(lot.received_date);
    setExpirationDate(lot.expiration_date);
    setInitialQuantity(lot.initial_quantity);
    setTotalCost(lot.total_cost);
    setIsModalOpen(true);
  };

  // 保存処理（POST/PUT）
  const handleSaveLot = async () => {
    if (!selectedItemId || initialQuantity <= 0 || !expirationDate) return;

    try {
      const payload = {
        inventory_item_id: selectedItemId,
        received_date: receivedDate,
        expiration_date: expirationDate,
        initial_quantity: initialQuantity,
        total_cost: totalCost,
      };

      const url = editingLot 
        ? `${API_BASE_URL}/inventory/lots/${editingLot.id}`
        : `${API_BASE_URL}/inventory/lots`;

      const method = editingLot ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchData();
        setIsModalOpen(false);
      } else {
        console.error("ロット保存失敗:", await res.text());
      }
    } catch (error) {
      console.error("ロット保存エラー:", error);
    }
  };

  // 廃棄処理（論理削除・会計用データ保持）
  const handleDeleteLot = async (lotId: number) => {
    if (!window.confirm(`ロット LOT-${lotId} を廃棄処理しますか？\n（会計帳簿記録のためデータは保持されます）`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/inventory/lots/${lotId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchData();
      } else {
        console.error("ロット廃棄失敗:", await res.text());
      }
    } catch (error) {
      console.error("ロット廃棄エラー:", error);
    }
  };

  // ソート済みのロット一覧を作成（未廃棄を上、廃棄済みを下に配置）
  const sortedLots = useMemo(() => {
    return [...lots].sort((a, b) => {
      const aDiscarded = a.status === "discarded" || a.is_discarded;
      const bDiscarded = b.status === "discarded" || b.is_discarded;

      if (aDiscarded === bDiscarded) return 0;
      return aDiscarded ? 1 : -1; // 廃棄済みを後ろへ移動
    });
  }, [lots]);

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#0f172a", margin: 0 }}>🚚 入荷ロット管理・登録</h1>
        <button
          onClick={handleOpenCreateModal}
          style={{ backgroundColor: "#2563eb", color: "#fff", padding: "0.6rem 1.2rem", borderRadius: "6px", border: "none", fontWeight: "600", cursor: "pointer" }}
        >
          ＋ 新規入荷ロットを登録
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>読み込み中...</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontSize: "0.875rem" }}>
                <th style={{ padding: "0.75rem 1rem" }}>ロットID</th>
                <th style={{ padding: "0.75rem 1rem" }}>品目名</th>
                <th style={{ padding: "0.75rem 1rem" }}>仕入日</th>
                <th style={{ padding: "0.75rem 1rem" }}>使用期限 (廃棄日)</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>現在残数 / 入荷数</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>仕入単価</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>状態</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>廃棄日</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {sortedLots.map((lot) => {
                const isExpired = lot.status === "expired";
                const isDepleted = lot.status === "depleted";
                const isDiscarded = lot.status === "discarded" || lot.is_discarded;

                return (
                  <tr 
                    key={lot.id} 
                    style={{ 
                      borderBottom: "1px solid #f1f5f9", 
                      fontSize: "0.95rem",
                      backgroundColor: isDiscarded ? "#f8fafc" : "transparent",
                      opacity: isDiscarded ? 0.75 : 1
                    }}
                  >
                    <td style={{ padding: "0.85rem 1rem", color: "#64748b", fontFamily: "monospace" }}>LOT-{lot.id}</td>
                    <td style={{ padding: "0.85rem 1rem", fontWeight: "600", color: "#0f172a" }}>{lot.inventory_item_name}</td>
                    <td style={{ padding: "0.85rem 1rem", color: "#475569" }}>{lot.received_date}</td>
                    <td style={{ padding: "0.85rem 1rem", color: isExpired ? "#dc2626" : "#475569", fontWeight: isExpired ? "bold" : "normal" }}>
                      {lot.expiration_date}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", textAlign: "right", fontWeight: "bold", color: isDepleted || isDiscarded ? "#94a3b8" : "#0f172a" }}>
                      {lot.current_quantity.toLocaleString()} / {lot.initial_quantity.toLocaleString()} {lot.unit}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", textAlign: "right", color: "#334155" }}>¥{lot.unit_cost.toFixed(2)}</td>
                    <td style={{ padding: "0.85rem 1rem", textAlign: "center" }}>
                      {isDiscarded && <span style={{ background: "#f1f5f9", color: "#475569", padding: "0.25rem 0.6rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: "bold", border: "1px solid #cbd5e1" }}>🗑️ 廃棄済み</span>}
                      {!isDiscarded && lot.status === "active" && <span style={{ background: "#f0fdf4", color: "#16a34a", padding: "0.25rem 0.6rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: "bold", border: "1px solid #bbf7d0" }}>🟢 有効</span>}
                      {!isDiscarded && lot.status === "depleted" && <span style={{ background: "#f8fafc", color: "#64748b", padding: "0.25rem 0.6rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: "bold", border: "1px solid #e2e8f0" }}>⚪ 使い切り</span>}
                      {!isDiscarded && lot.status === "expired" && <span style={{ background: "#fef2f2", color: "#dc2626", padding: "0.25rem 0.6rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: "bold", border: "1px solid #fecaca" }}>🔴 期限切れ</span>}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", color: "#475569" }}>{lot.discarded_at?.split("T")[0]}</td>
                    <td style={{ padding: "0.85rem 1rem", textAlign: "center" }}>
                      {!isDiscarded ? (
                        <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center" }}>
                          <button
                            onClick={() => handleOpenEditModal(lot)}
                            style={{ background: "none", border: "1px solid #cbd5e1", padding: "0.3rem 0.6rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem", color: "#334155" }}
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDeleteLot(lot.id)}
                            style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "0.3rem 0.6rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem", color: "#dc2626", fontWeight: "600" }}
                          >
                            廃棄
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", padding: "1.75rem", borderRadius: "8px", width: "460px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1.25rem", color: "#0f172a" }}>
              {editingLot ? `入荷ロットの編集 (LOT-${editingLot.id})` : "新規入荷ロットの登録"}
            </h2>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.3rem" }}>対象品目 *</label>
              <select value={selectedItemId} onChange={(e) => setSelectedItemId(Number(e.target.value))} style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1", boxSizing: "border-box", background: "#fff" }}>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.3rem" }}>仕入日 *</label>
                <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.3rem" }}>使用期限 (廃棄日) *</label>
                <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.3rem" }}>入荷数量 ({currentSelectedItem?.unit}) *</label>
                <input type="number" value={initialQuantity} onChange={(e) => setInitialQuantity(Number(e.target.value))} style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.3rem" }}>総仕入額 (円) *</label>
                <input type="number" value={totalCost} onChange={(e) => setTotalCost(Number(e.target.value))} style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "6px", marginBottom: "1.5rem", border: "1px dashed #cbd5e1", fontSize: "0.875rem", color: "#334155" }}>
              💡 自動計算仕入単価 (unit_cost): <strong style={{ color: "#2563eb", fontSize: "1rem" }}>¥{computedUnitCost.toFixed(2)}</strong> / {currentSelectedItem?.unit}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "#f1f5f9", border: "none", padding: "0.5rem 1rem", borderRadius: "4px", cursor: "pointer", color: "#475569" }}>キャンセル</button>
              <button onClick={handleSaveLot} style={{ background: "#2563eb", border: "none", padding: "0.5rem 1rem", borderRadius: "4px", cursor: "pointer", color: "#fff", fontWeight: "600" }}>
                {editingLot ? "更新" : "登録"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}