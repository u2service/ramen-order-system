"use client";

import React, { useState, useEffect } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// 型定義
interface OrderItem {
  id: number | string;
  order_id: number;
  table_number: number;
  product_name: string;
  quantity: number;
  category: "noodle" | "side" | "drink";
  options: string[];
  status: "pending" | "cooking" | "served" | "completed";
  created_at: string;
}

export default function KDSStreamPage() {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [filter, setFilter] = useState<"all" | "noodle" | "side">("all");
  // ★ ローディング状態を管理するステートを追加
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // バックエンドからのデータ取得関数
  const fetchKdsOrders = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/kds/orders`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const orders = await res.json();
      const flatItems: OrderItem[] = [];

      orders.forEach((order: any) => {
        // served（提供完了）および completed 以外のステータスを表示対象とする
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            // item.status が served / completed のものは一覧に追加しない（除外する）
            const itemStatus = item.status || order.status || "pending";
            if (itemStatus !== "served" && itemStatus !== "completed") {
              flatItems.push({
                id: item.id || `${order.id}-${item.menu_item_name}`,
                order_id: order.id,
                table_number: order.table_number,
                product_name: item.menu_item_name || item.product_name || item.name || "商品",
                quantity: item.quantity || 1,
                category:
                  item.menu_item_name && item.menu_item_name.includes("ラーメン")
                    ? "noodle"
                    : "side",
                options: item.options || [],
                status: itemStatus,
                created_at: order.created_at,
              });
            }
          });
        }
      });

      // 古い注文が上、新しい注文が下（一番下に追加）になるよう昇順ソート
      flatItems.sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        if (timeA !== timeB) {
          return timeA - timeB; // 時間の昇順
        }
        return Number(a.order_id) - Number(b.order_id); // 時間が同じ場合はorder_idの昇順
      });

      setItems(flatItems);
    } catch (err) {
      console.error("KDSデータの取得エラー:", err);
    } finally {
      // ★ 通信完了時にローディングを終了
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 初回データ取得
    fetchKdsOrders();

    // SSE（Server-Sent Events）接続の確立
    const eventSource = new EventSource(`${API_BASE_URL}/orders/events/stream`);

    // メッセージ受信時に注文データを再取得
    eventSource.onmessage = (event) => {
      // キープアライブ（: keep-alive）以外のメッセージが来たら再取得
      if (event.data && !event.data.startsWith(':')) {
        try {
          const parsed = JSON.parse(event.data);
          // "new_order" または "inventory_updated" などのイベントが来たらデータを再取得
          if (parsed.event === "new_order" || parsed.event === "inventory_updated") {
            fetchKdsOrders();
          }
        } catch (e) {
          // パースエラー時も念のため再取得
          fetchKdsOrders();
        }
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE接続エラー:", err);
    };

    // クリーンアップ処理（画面を離れたら切断）
    return () => {
      eventSource.close();
    };
  }, []);

  // 経過時間（分）の計算関数
  const getElapsedMinutes = (createdAtStr: string) => {
    if (!createdAtStr) return 0;
    const created = new Date(createdAtStr).getTime();
    const now = new Date().getTime();

    const diffMinutes = Math.floor((now - created) / (1000 * 60));

    return Math.max(0, diffMinutes);
  };

  // ステータス更新処理
  const handleStatusChange = async (orderId: number, itemId: number | string, newStatus: string) => {
    // newStatus が "served" や "completed" の場合は画面のリストから即座に除去する
    if (newStatus === "served" || newStatus === "completed") {
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } else {
      // 調理開始などその他のステータス変更の場合はステータスのみ更新
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, status: newStatus as any } : item
        )
      );
    }

    // バックエンドへの API リクエスト
    try {
      const res = await fetch(`${API_BASE_URL}/kds/items/${itemId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        console.error("ステータス更新失敗:", res.status);
        // 通信失敗時は最新状態に再取得して戻す
        fetchKdsOrders();
      }
    } catch (err) {
      console.error("ステータス更新通信エラー:", err);
      fetchKdsOrders();
    }
  };

  // フィルタリング処理
  const filteredItems = items.filter((item) => {
    if (filter === "noodle") return item.category === "noodle";
    if (filter === "side") return item.category === "side" || item.category === "drink";
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 font-sans">
      {/* ヘッダーエリア */}
      <header className="flex justify-between items-center bg-gray-800 p-4 rounded-lg mb-4 border border-gray-700">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-bold text-yellow-400">🍜 厨房リスト</h1>
          <span className="bg-red-600 text-white px-3 py-1 rounded-full font-bold text-sm">
            未提供: {items.filter((i) => i.status !== "served" && i.status !== "completed").length}品
          </span>
        </div>

        {/* 絞り込みタブボタン */}
        <div className="flex gap-2 bg-gray-900 p-1 rounded-lg border border-gray-700">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-md font-bold text-sm transition ${
              filter === "all" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            全表示
          </button>
          <button
            onClick={() => setFilter("noodle")}
            className={`px-4 py-2 rounded-md font-bold text-sm transition ${
              filter === "noodle" ? "bg-yellow-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            🍜 麺類のみ
          </button>
          <button
            onClick={() => setFilter("side")}
            className={`px-4 py-2 rounded-md font-bold text-sm transition ${
              filter === "side" ? "bg-green-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            🥟 サイドのみ
          </button>
        </div>
      </header>

      {/* アイテムストリーム表示（テーブル形式） */}
      <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-700 text-gray-300 border-b border-gray-600 text-lg">
              <th className="p-3 w-16 text-center">卓</th>
              <th className="p-3 w-20 text-center">経過</th>
              <th className="p-3">商品・カスタマイズ内容</th>
              <th className="p-3 w-20 text-center">数量</th>
              <th className="p-3 w-48 text-center">ステータス操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 text-xl">
            {/* ★ 読み込み中の表示制御 */}
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-yellow-400 font-bold animate-pulse text-2xl">
                  データを読み込み中... ⏳
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400 font-bold">
                  現在、対象の注文はありません 🍜
                </td>
              </tr>
            ) : (
              filteredItems.map((item, index) => {
                const elapsed = getElapsedMinutes(item.created_at);
                const isSameTableAsPrevious =
                  index > 0 && filteredItems[index - 1].table_number === item.table_number;

                return (
                  <tr
                    key={`${item.id}-${index}`}
                    className={`hover:bg-gray-750 transition ${
                      isSameTableAsPrevious ? "border-t-0" : "border-t-2 border-gray-500"
                    }`}
                  >
                    {/* 卓番号 */}
                    <td className="p-3 text-center font-extrabold text-2xl bg-gray-800 text-yellow-300">
                      {item.table_number}
                    </td>

                    {/* 経過時間 */}
                    <td className="p-3 text-center font-bold">
                      <span
                        className={`px-2 py-1 rounded ${
                          elapsed >= 10
                            ? "bg-red-600 text-white animate-pulse"
                            : elapsed >= 5
                            ? "bg-yellow-600 text-white"
                            : "text-gray-300"
                        }`}
                      >
                        {String(elapsed).padStart(2, "0")}分
                      </span>
                    </td>

                    {/* 商品・オプション情報 */}
                    <td className="p-3">
                      <div className="font-bold text-white text-2xl">{item.product_name}</div>
                      {item.options && item.options.length > 0 && (
                        <div className="text-lg text-yellow-200 mt-1 pl-4">
                          └ {item.options.join(", ")}
                        </div>
                      )}
                    </td>

                    {/* 数量 */}
                    <td className="p-3 text-center font-extrabold text-2xl text-yellow-400">
                      × {item.quantity}
                    </td>

                    {/* ステータス切り替えボタン */}
                    <td className="p-3 text-center">
                      {item.status === "cooking" ? (
                        <button
                          onClick={() => handleStatusChange(item.order_id, item.id, "served")}
                          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg text-lg transition"
                        >
                          提供完了
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStatusChange(item.order_id, item.id, "cooking")}
                          className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-4 rounded-lg text-lg transition"
                        >
                          調理を開始
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
