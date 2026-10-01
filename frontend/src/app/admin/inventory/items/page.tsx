"use client";

import { useEffect, useState, useCallback } from "react";

type InventoryItem = {
  id: number;
  name: string;
  tani: string;
  zaiko_alert: number;
  current_stock: number;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function InventoryItemsPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<InventoryItem> | null>(null);

  // 自動更新のON/OFF状態（デフォルトはON）
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  // データ取得関数
  const fetchItems = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch(`${API_BASE_URL}/inventory/items`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (error) {
      console.error("品目マスタ取得エラー:", error);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // ポーリング & SSE 処理（isAutoRefresh の切り替えで適切にオン/オフ）
  useEffect(() => {
    // 初回表示またはフラグ変更時に1回最新化
    fetchItems();

    // OFF の場合はタイマーやSSEを起動しない
    if (!isAutoRefresh) return;

    // 1. ポーリング（3秒ごとにサイレント取得）
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchItems(true);
      }
    }, 3000);

    // 2. SSE接続
    const sseUrl = `${API_BASE_URL}/orders/events/stream`;
    const eventSource = new EventSource(sseUrl);

    const handleInventoryUpdate = (event?: MessageEvent) => {
      if (event?.data) console.log("在庫更新イベント受信:", event.data);
      fetchItems(true);
    };

    eventSource.addEventListener("inventory_updated", handleInventoryUpdate);
    eventSource.addEventListener("new_order", handleInventoryUpdate);

    eventSource.onmessage = (event) => {
      if (!event.data) return;
      try {
        const data = JSON.parse(event.data);
        if (data.event === "inventory_updated" || data.event === "new_order") {
          handleInventoryUpdate();
        }
      } catch (e) {
        // JSON解析エラーは無視
      }
    };

    eventSource.onerror = (err) => {
      if (eventSource.readyState === EventSource.CLOSED) {
        console.error("SSE 接続が終了しました:", err);
      }
    };

    // クリーンアップ処理：isAutoRefresh が false になった時や画面破棄時に確実に停止・切断する
    return () => {
      clearInterval(interval);
      eventSource.removeEventListener("inventory_updated", handleInventoryUpdate);
      eventSource.removeEventListener("new_order", handleInventoryUpdate);
      eventSource.close();
    };
  }, [fetchItems, isAutoRefresh]);

  const handleOpenModal = (item?: InventoryItem) => {
    setEditingItem(item || { name: "", tani: "個", zaiko_alert: 0 });
    setIsModalOpen(true);
  };

  // 保存（新規登録 / 更新）
  const handleSave = async () => {
    if (!editingItem?.name) return;

    try {
      if (editingItem.id) {
        // PUT 更新
        const res = await fetch(`${API_BASE_URL}/inventory/items/${editingItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editingItem.name,
            tani: editingItem.tani,
            zaiko_alert: Number(editingItem.zaiko_alert),
          }),
        });
        if (res.ok) await fetchItems();
      } else {
        // POST 新規作成
        const res = await fetch(`${API_BASE_URL}/inventory/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editingItem.name,
            tani: editingItem.tani,
            zaiko_alert: Number(editingItem.zaiko_alert),
          }),
        });
        if (res.ok) await fetchItems();
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("保存失敗:", error);
    }
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      {/* ヘッダーエリア */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#0f172a", margin: 0 }}>📦 在庫品目マスタ管理</h1>
        
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          {/* 手動更新ボタン */}
          <button 
            onClick={() => fetchItems()} 
            style={{
              backgroundColor: "#f1f5f9",
              border: "1px solid #cbd5e1",
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.875rem",
              color: "#334155",
              fontWeight: "500"
            }}
          >
            🔄 手動更新
          </button>

          {/* 自動更新トグルスイッチ（ON: ピンク / OFF: グレー） */}
          <label 
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: "bold",
              padding: "0.5rem 0.85rem",
              borderRadius: "20px",
              transition: "all 0.2s ease",
              // ONの場合はピンク系統、OFFの場合はグレー系統の背景・文字色に切替
              backgroundColor: isAutoRefresh ? "#fce7f3" : "#ffff00",
              color: isAutoRefresh ? "#be185d" : "#64748b",
              border: isAutoRefresh ? "1px solid #fbcfe8" : "1px solid #cbd5e1",
            }}
          >
            <input
              type="checkbox"
              checked={isAutoRefresh}
              onChange={(e) => setIsAutoRefresh(e.target.checked)}
              style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "#ec4899" }}
            />
            <span>リアルタイム自動更新 ({isAutoRefresh ? "ON" : "OFF"})</span>
          </label>

          {/* 新規登録ボタン */}
          <button
            onClick={() => handleOpenModal()}
            style={{ backgroundColor: "#2563eb", color: "#fff", padding: "0.6rem 1.2rem", borderRadius: "6px", border: "none", fontWeight: "600", cursor: "pointer" }}
          >
            ＋ 新規品目を追加
          </button>
        </div>
      </div>

      {/* テーブルエリア */}
      <div style={{ background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>読み込み中...</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontSize: "0.875rem" }}>
                <th style={{ padding: "0.75rem 1rem" }}>ID</th>
                <th style={{ padding: "0.75rem 1rem" }}>品目名</th>
                <th style={{ padding: "0.75rem 1rem" }}>単位</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>現在の有効在庫数</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>アラート閾値</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>状態</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isAlert = item.current_stock <= item.zaiko_alert;
                return (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9", fontSize: "0.95rem" }}>
                    <td style={{ padding: "0.85rem 1rem", color: "#64748b" }}>{item.id}</td>
                    <td style={{ padding: "0.85rem 1rem", fontWeight: "600", color: "#0f172a" }}>{item.name}</td>
                    <td style={{ padding: "0.85rem 1rem", color: "#475569" }}>{item.tani}</td>
                    <td style={{ padding: "0.85rem 1rem", textAlign: "right", fontWeight: "bold", color: isAlert ? "#dc2626" : "#0f172a" }}>
                      {item.current_stock.toLocaleString()} {item.tani}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", textAlign: "right", color: "#64748b" }}>
                      {item.zaiko_alert.toLocaleString()} {item.tani}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", textAlign: "center" }}>
                      {isAlert ? (
                        <span style={{ background: "#fef2f2", color: "#dc2626", padding: "0.25rem 0.6rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: "bold", border: "1px solid #fecaca" }}>⚠️ 発注要</span>
                      ) : (
                        <span style={{ background: "#f0fdf4", color: "#16a34a", padding: "0.25rem 0.6rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: "bold", border: "1px solid #bbf7d0" }}>正常</span>
                      )}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", textAlign: "center" }}>
                      <button onClick={() => handleOpenModal(item)} style={{ background: "none", border: "1px solid #cbd5e1", padding: "0.3rem 0.75rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", color: "#334155" }}>
                        編集
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* モーダルダイアログ */}
      {isModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", padding: "1.75rem", borderRadius: "8px", width: "420px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1.25rem", color: "#0f172a" }}>{editingItem?.id ? "在庫品目の編集" : "新規在庫品目の登録"}</h2>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.3rem" }}>品目名 *</label>
              <input type="text" value={editingItem?.name || ""} onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })} style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.3rem" }}>管理単位 (tani) *</label>
              <input type="text" value={editingItem?.tani || ""} onChange={(e) => setEditingItem({ ...editingItem, tani: e.target.value })} style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.3rem" }}>発注アラート閾値 (zaiko_alert) *</label>
              <input type="number" value={editingItem?.zaiko_alert ?? 0} onChange={(e) => setEditingItem({ ...editingItem, zaiko_alert: Number(e.target.value) })} style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "#f1f5f9", border: "none", padding: "0.5rem 1rem", borderRadius: "4px", cursor: "pointer", color: "#475569" }}>キャンセル</button>
              <button onClick={handleSave} style={{ background: "#2563eb", border: "none", padding: "0.5rem 1rem", borderRadius: "4px", cursor: "pointer", color: "#fff", fontWeight: "600" }}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}