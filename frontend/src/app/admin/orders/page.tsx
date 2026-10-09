'use client';

import { useEffect, useState, useCallback } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; // react-calendar の基本スタイル
import { Order, OrderStatus, ItemStatus } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ステータス表示用ラベルとスタイル定義
const ORDER_STATUS_LABELS: Record<OrderStatus, { label: string; style: string }> = {
  pending: { label: '受付済', style: 'bg-yellow-100 text-yellow-800' },
  cooking: { label: '調理中', style: 'bg-blue-100 text-blue-800' },
  served: { label: '提供済', style: 'bg-green-100 text-green-800' },
  paid: { label: '会計済', style: 'bg-gray-100 text-gray-800' },
  cancelled: { label: 'キャンセル', style: 'bg-red-100 text-red-800' },
};

const ITEM_STATUS_LABELS: Record<ItemStatus, { label: string; style: string }> = {
  pending: { label: '未着手', style: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  cooking: { label: '調理中', style: 'text-blue-600 bg-blue-50 border-blue-200' },
  served: { label: '提供済', style: 'text-green-600 bg-green-50 border-green-200' },
  cancelled: { label: '取消', style: 'text-red-600 bg-red-50 border-red-200' },
};

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 選択された日付 (Date オブジェクト)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // 注文が存在する日付のリスト ('YYYY-MM-DD' 形式の文字列配列)
  const [datesWithOrders, setDatesWithOrders] = useState<string[]>([]);
  
  // カレンダーポップオーバーの表示フラグ
  const [showCalendar, setShowCalendar] = useState<boolean>(false);

  // 日付オブジェクトを 'YYYY-MM-DD' 形式の文字列に変換するヘルパー関数
  const formatDateToStr = (date: Date): string => {
    return date.toLocaleDateString('sv-SE');
  };

  // 1. 全注文履歴（または存在する日付一覧）を取得して「注文がある日付」を抽出
  const fetchAllOrderDates = useCallback(async () => {
    try {
      // 全注文を取得して日付を収集 (バックエンドに専用エンドポイントがある場合はそちらを呼び出します)
      const response = await fetch(`${API_BASE_URL}/kds/orders`);
      if (response.ok) {
        const allOrders: Order[] = await response.json();
        // 注文データの created_at から YYYY-MM-DD を抽出して重複を除去
        const dates = Array.from(
          new Set(
            allOrders.map((order) =>
              new Date(order.created_at).toLocaleDateString('sv-SE')
            )
          )
        );
        setDatesWithOrders(dates);
      }
    } catch (err) {
      console.error('注文日付一覧の取得エラー:', err);
    }
  }, []);

  // 2. 選択された日付の注文データを取得
  const fetchOrdersByDate = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const dateStr = formatDateToStr(selectedDate);

      try {
        const response = await fetch(
          `${API_BASE_URL}/kds/orders?date=${dateStr}`
        );
        if (!response.ok) {
          throw new Error('注文履歴の取得に失敗しました');
        }
        const data: Order[] = await response.json();
        setOrders(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : '予期せぬエラーが発生しました'
        );
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedDate]
  );

  // 初回ロード時に日付一覧を取得
  useEffect(() => {
    fetchAllOrderDates();
  }, [fetchAllOrderDates]);

  // 選択日付が変更されたら該当日の注文を取得
  useEffect(() => {
    fetchOrdersByDate();
  }, [fetchOrdersByDate]);

  // カレンダーの日付マスに付与する CSS クラス判定
  const getTileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const dateStr = formatDateToStr(date);
      if (datesWithOrders.includes(dateStr)) {
        return 'has-order-tile'; // 注文がある日付用のカスタムスタイル
      }
    }
    return null;
  };

  // 今日へ戻るボタン
  const handleSetToday = () => {
    setSelectedDate(new Date());
  };

  if (loading && !isRefreshing) {
    return <div className="p-8 text-center text-gray-500">データを読み込み中...</div>;
  }

  const selectedDateStr = formatDateToStr(selectedDate);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      {/* ページヘッダー */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">注文履歴</h1>
          <p className="text-xs text-gray-500 mt-1">
            {selectedDateStr} の注文: 全 {orders.length} 件
          </p>
        </div>

        {/* カレンダー & アクションエリア */}
        <div className="flex items-center space-x-2 relative">
          {/* 日付表示 ＆ カレンダー開閉ボタン */}
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="flex items-center space-x-2 border border-gray-300 bg-white hover:bg-gray-50 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition"
          >
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>{selectedDateStr}</span>
          </button>

          {/* ポップアップカレンダー */}
          {showCalendar && (
            <div className="absolute right-0 top-12 z-50 bg-white p-3 border border-gray-200 rounded-xl shadow-xl">
              <Calendar
                onChange={(value) => {
                  setSelectedDate(value as Date);
                  setShowCalendar(false); // 日付選択時に閉じる
                }}
                value={selectedDate}
                tileClassName={getTileClassName}
                locale="ja-JP"
              />
            </div>
          )}

          {/* 今日ボタン */}
          <button
            onClick={handleSetToday}
            className="text-xs text-gray-600 hover:text-blue-600 border border-gray-300 bg-white px-2.5 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"
          >
            今日
          </button>

          {/* 再読み込みボタン */}
          <button
            onClick={() => {
              fetchAllOrderDates();
              fetchOrdersByDate(true);
            }}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-3.5 py-2 rounded-lg transition-colors duration-200 shadow-sm disabled:bg-blue-300"
          >
            <svg
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>{isRefreshing ? '更新中...' : '更新'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          {selectedDateStr} の注文履歴はありません。
        </p>
      ) : (
        /* 注文リスト表示部分 */
        <div className="space-y-4">
          {orders.map((order) => {
            const formattedTime = new Date(order.created_at).toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            const formattedDate = new Date(order.created_at).toLocaleDateString('ja-JP', {
              month: 'numeric',
              day: 'numeric',
            });

            return (
              <div
                key={order.id}
                className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
              >
                {/* 伝票ヘッダー */}
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-lg font-bold text-gray-900">
                      {formattedTime}
                      <span className="text-xs font-normal text-gray-500 ml-1.5">({formattedDate})</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded bg-gray-800 text-white font-bold text-sm">
                      卓 {order.table_number}
                    </span>
                    <span className="text-xs text-gray-400">注文ID: #{order.id}</span>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      ORDER_STATUS_LABELS[order.status]?.style || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {ORDER_STATUS_LABELS[order.status]?.label || order.status}
                  </span>
                </div>

                {/* 注文明細リスト */}
                <div className="p-4">
                  <ul className="divide-y divide-gray-100">
                    {order.items.map((item) => {
                      // ブラウザのデベロッパーツール（F12 -> Console）に表示されます
                      console.log('OrderItem item data:', item);

                      return (
                        <li key={item.id} className="py-2.5 flex items-start justify-between first:pt-0 last:pb-0">
                          <div className="space-y-1">
                            <div className="text-base font-semibold text-gray-800">
                              {item.menu_item_name}

                              <span className="ml-2 text-xs text-gray-500 font-normal">
                                (売: ¥{item.price?.toLocaleString()} / 原: ¥{item.cost_price?.toLocaleString()})
                              </span>
                              <span className="ml-2 text-sm font-bold text-blue-600">× {item.quantity}</span>
                            </div>

                            {item.options && item.options.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {item.options.map((opt: any, idx: number) => {
                                  const optionName =
                                    typeof opt === 'object' && opt !== null ? opt.name || opt.id : String(opt);

                                  return (
                                    <span
                                      key={idx}
                                      className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded border border-gray-200"
                                    >
                                      {optionName}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <span
                            className={`text-xs px-2.5 py-1 font-medium border rounded-md whitespace-nowrap ${
                              ITEM_STATUS_LABELS[item.status]?.style || 'text-gray-500 border-gray-200'
                            }`}
                          >
                            {ITEM_STATUS_LABELS[item.status]?.label || item.status}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 注文が存在する日の背景色カスタマイズCSS */}
      <style jsx global>{`
        .react-calendar__tile.has-order-tile {
          background-color: #dbeafe !important; /* 薄い青色 (Tailwind: bg-blue-100) */
          color: #1e40af !important; /* 青字 (Tailwind: text-blue-800) */
          font-weight: bold;
          border-radius: 6px;
        }
        .react-calendar__tile.has-order-tile:hover {
          background-color: #bfdbfe !important; /* ホバー時の青色 (Tailwind: bg-blue-200) */
        }
      `}</style>
    </div>
  );
}