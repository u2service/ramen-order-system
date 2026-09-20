"use client";

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface OrderItemOption {
  id: number;
  name: string;
  price: number;
}

interface OrderItem {
  id: number;
  item_id?: number;
  product_name: string;
  price: number;
  quantity: number;
  status: string;
  discount_amount: number;
  options: OrderItemOption[];
}

interface Order {
  id: number;
  table_number: number;
  status: string;
  total_price: number;
  items: OrderItem[];
}

// -------------------------------------------------------------
// ▼ クレジットカード決済入力フォーム (Stripe Elements)
// -------------------------------------------------------------
function StripeCheckoutForm({
  amount,
  onSuccess,
}: {
  amount: number;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage(null);

    // Stripe 決済の確定処理
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required', // リダイレクトせずに画面上で結果を受け取る
    });

    if (error) {
      setErrorMessage(error.message ?? '決済処理中にエラーが発生しました。');
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      // 決済成功時の処理を実行（親コンポーネント側の完了処理を呼び出す）
      onSuccess();
    } else {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-2 p-4 border rounded bg-gray-50">
      <PaymentElement />
      {errorMessage && (
        <div className="text-red-500 text-sm font-semibold">{errorMessage}</div>
      )}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-indigo-700 disabled:opacity-50"
      >
        {isProcessing ? '決済処理中...' : `カードで ¥${amount.toLocaleString()} を支払う`}
      </button>
    </form>
  );
}

// -------------------------------------------------------------
// ▼ メイン POS コンポーネント
// -------------------------------------------------------------
export default function PosCheckout() {
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  
  // Stripe 決済用 ClientSecret
  const [clientSecret, setClientSecret] = useState<string>('');
  const [isCreatingIntent, setIsCreatingIntent] = useState<boolean>(false);

  // ▼ 未会計注文が存在する卓番号のリスト
  const [activeTables, setActiveTables] = useState<number[]>([]);

  // ▼ 未会計の卓一覧をバックエンドから取得
  const fetchActiveTables = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/pos/active-tables`);
      if (res.ok) {
        const data = await res.json();
        setActiveTables(data.active_tables || []);
      }
    } catch (error) {
      console.error("アクティブ卓の取得に失敗しました", error);
    }
  };

  // ▼ 1. 卓選択時に未会計伝票を取得
  const fetchTableOrder = async (tableNum: number) => {
    setSelectedTable(tableNum);
    setClientSecret(''); // 卓切り替え時に前回の Stripe 情報をクリア
    try {
      const res = await fetch(`${API_BASE_URL}/pos/tables/${tableNum}`);
      
      if (res.status === 404) {
        setCurrentOrder(null);
        return;
      }

      if (!res.ok) {
        console.error(`APIエラー: ${res.status}`);
        setCurrentOrder(null);
        return;
      }

      const data = await res.json();
      
      setCurrentOrder({
        id: data.items[0]?.order_id || 0,
        table_number: data.table_number,
        status: 'pending',
        total_price: data.total_price,
        items: data.items.map((item: any) => ({
          ...item,
          id: item.item_id || item.id
        }))
      });
      setPaidAmount(0);

    } catch (error) {
      console.error("伝票データの取得に失敗しました", error);
      setCurrentOrder(null);
    }
  };

  // ▼ クレジットカード選択時 または 注文金額変更時に Stripe PaymentIntent を作成
  useEffect(() => {
    if (paymentMethod === 'credit' && currentOrder && currentOrder.total_price > 0) {
      setIsCreatingIntent(true);
      fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: currentOrder.total_price }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.clientSecret) {
            setClientSecret(data.clientSecret);
          }
        })
        .catch((err) => {
          console.error('PaymentIntent 作成失敗:', err);
        })
        .finally(() => {
          setIsCreatingIntent(false);
        });
    }
  }, [paymentMethod, currentOrder?.total_price]);

  // ▼ 裏で伝票を最新化する関数[cite: 2]
  const fetchTableOrderSilent = async (tableNum: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/pos/tables/${tableNum}`);
      if (res.status === 404) {
        setCurrentOrder(null);
        fetchActiveTables();
        return;
      }
      if (!res.ok) return;

      const data = await res.json();
      setCurrentOrder({
        id: data.items[0]?.order_id || 0,
        table_number: data.table_number,
        status: 'pending',
        total_price: data.total_price,
        items: data.items.map((item: any) => ({
          ...item,
          id: item.item_id || item.id
        }))
      });
    } catch (error) {
      // 自動更新時のエラーは静かにスルー[cite: 2]
    }
  };

  // ▼ SSE接続および初期データの取得
  useEffect(() => {
    // 1. 初回の未会計卓一覧を取得
    fetchActiveTables();

    // 2. SSE接続の確立
    const eventSource = new EventSource(`${API_BASE_URL}/orders/events/stream`);

    // サーバーからメッセージを受信した際の処理
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // 未会計卓一覧の自動更新
        fetchActiveTables();

        // 選択中の卓のデータ更新通知が来た場合、または全体更新イベント時に再取得
        if (selectedTable !== null) {
          fetchTableOrderSilent(selectedTable);
        }
      } catch (error) {
        console.error("SSEメッセージの解析エラー:", error);
      }
    };

    // カスタムイベント（例: order_updated）を受信する場合の例
    eventSource.addEventListener('order_update', (event) => {
      fetchActiveTables();
      if (selectedTable !== null) {
        fetchTableOrderSilent(selectedTable);
      }
    });

    eventSource.onerror = (error) => {
      console.error("SSE接続エラーが発生しました:", error);
      // EventSourceは自動的に再接続を試みますが、必要に応じてクローズ処理等を行います
    };

    // クリーンアップ（コンポーネントのアンマウント時・卓変更時に切断）
    return () => {
      eventSource.close();
    };
  }, [selectedTable]);

  // 2. 商品個別の取り消し処理[cite: 2]
  const handleCancelItem = async (itemId: number, reason: 'customer_mistake' | 'kitchen_error' | 'out_of_stock') => {
    if (!currentOrder) return;
    try {
      const res = await fetch(`${API_BASE_URL}/pos/items/${itemId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_reason: reason }),
      });
      if (res.ok) {
        fetchTableOrder(currentOrder.table_number);
        fetchActiveTables();
      } else {
        const err = await res.json();
        alert(`取消エラー: ${err.detail}`);
      }
    } catch (error) {
      console.error("キャンセルの通信に失敗しました", error);
    }
  };

  // 3. 商品単位または全額サービス（100%割引・おごり）適用[cite: 2]
  const handleApplyDiscount = async (itemId?: number, isFullComp: boolean = false) => {
    if (!currentOrder) return;
    try {
      const res = await fetch(`${API_BASE_URL}/pos/orders/${currentOrder.id}/discount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_item_id: itemId || null,
          is_full_comp: isFullComp
        }),
      });
      if (res.ok) {
        fetchTableOrder(currentOrder.table_number);
      } else {
        const err = await res.json();
        alert(`サービス適用エラー: ${err.detail}`);
      }
    } catch (error) {
      console.error("割引処理の通信に失敗しました", error);
    }
  };

  // 4. 精算完了処理 (現金)[cite: 2]
  const handleCashCheckout = async () => {
    if (!currentOrder || !selectedTable) return;

    if (paidAmount < currentOrder.total_price) {
      alert("お預かり金額が不足しています");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/pos/checkout/cash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_number: selectedTable,
          paid_amount: Number(paidAmount),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(`会計エラー: ${errorData.detail || '精算処理に失敗しました'}`);
        return;
      }

      const data = await res.json();
      alert(`お会計が完了しました！\nお釣り: ¥${data.change_amount.toLocaleString()}`);

      clearCheckoutState();
    } catch (error) {
      console.error('精算処理中にエラーが発生しました', error);
      alert('サーバーとの通信に失敗しました。');
    }
  };

  // 5. 精算完了処理 (クレジットカード)
  const handleCreditCheckoutSuccess = async () => {
    if (!currentOrder || !selectedTable) return;

    try {
      // バックエンド側にもクレジットカード精算成功の通知・伝票クローズリクエストを送る
      // (※バックエンド側でクレジット用のAPIが存在する場合、URLを変更してください)
      const res = await fetch(`${API_BASE_URL}/pos/checkout/cash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_number: selectedTable,
          paid_amount: currentOrder.total_price,
        }),
      });

      if (!res.ok) {
        // 例えバックエンドの更新通知でエラーが出てもStripe側の決済は完了しています
        const errorData = await res.json().catch(() => ({}));
        console.warn('バックエンドの伝票クローズ処理でエラー:', errorData);
      }

      alert('クレジットカードでの精算が完了しました！');
      clearCheckoutState();
    } catch (error) {
      console.error('精算通知エラー:', error);
      alert('クレジットカードでの決済は完了しましたが、ステータス更新に失敗しました。');
      clearCheckoutState();
    }
  };

  // 会計完了後の共通クリア処理[cite: 2]
  const clearCheckoutState = () => {
    setCurrentOrder(null);
    setSelectedTable(null);
    setPaidAmount(0);
    setClientSecret('');
    fetchActiveTables();
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 左側: 卓一覧[cite: 2] */}
      <div className="w-1/3 p-4 border-r bg-white">
        <h2 className="text-xl font-bold mb-4">卓一覧・未会計伝票</h2>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((tableNum) => {
            const hasOrder = activeTables.includes(tableNum);
            const isSelected = selectedTable === tableNum;

            let buttonStyle = "bg-gray-50 text-gray-700 border-gray-300";
            if (isSelected) {
              buttonStyle = "bg-blue-600 text-white border-blue-700 shadow-lg";
            } else if (hasOrder) {
              buttonStyle = "bg-orange-500 text-white border-orange-600 animate-pulse";
            }

            return (
              <button
                key={tableNum}
                onClick={() => fetchTableOrder(tableNum)}
                className={`p-6 border rounded-lg text-lg font-bold transition-all relative ${buttonStyle}`}
              >
                卓 {tableNum}
                {hasOrder && !isSelected && (
                  <span className="absolute top-1 right-2 text-xs bg-red-600 text-white px-1.5 py-0.5 rounded-full">
                    未会計
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 右側: 伝票詳細 & 精算パネル[cite: 2] */}
      <div className="w-2/3 p-4 flex flex-col justify-between">
        {currentOrder ? (
          <>
            <div>
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h2 className="text-2xl font-bold">卓 No. {currentOrder.table_number} 伝票</h2>
                <button
                  onClick={() => handleApplyDiscount(undefined, true)}
                  className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-purple-700"
                >
                  全額サービス（大将のおごり）
                </button>
              </div>

              {/* 明細リスト[cite: 2] */}
              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                {currentOrder.items.map((item: any, index: number) => {
                  const optionsTotal = item.options?.reduce((sum: number, opt: any) => sum + (opt.price || 0), 0) || 0;
                  const baseUnitPrice = Math.max(0, item.price - item.discount_amount);
                  const subtotal = (baseUnitPrice + optionsTotal) * item.quantity;

                  return (
                    <div key={item.item_id || item.id || `item-${index}`} className="p-3 bg-white border rounded flex justify-between items-center">
                      <div>
                        <div className="font-bold text-lg">
                          {item.product_name} @{item.price.toLocaleString()}円
                        </div>

                        {item.options && item.options.length > 0 && (
                          <div className="text-sm text-gray-500">
                            {item.options.map((o: any) => o.option_name || o.name).join(', ')}
                          </div>
                        )}

                        <div>
                          {item.options && item.options.length > 0 && (
                            <ul className="mt-2 pl-3 text-sm text-gray-600 space-y-0.5 border-l-2 border-orange-300 bg-gray-50 p-2 rounded">
                              {item.options.map((opt: any, optIdx: number) => (
                                <li key={optIdx} className="flex justify-between items-center text-xs">
                                  <span>・{opt.option_name || opt.name}</span>
                                  {opt.price > 0 && (
                                    <span className="text-gray-500">+{opt.price}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        
                        <div className="text-sm font-semibold text-blue-600 mt-1">
                          数量：{item.quantity} 小計：¥{subtotal.toLocaleString()}
                        </div>
                      </div>

                      {item.status !== 'cancelled' ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleApplyDiscount(item.id, false)}
                            className="px-2 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600"
                          >
                            単品サービス
                          </button>
                          <button
                            onClick={() => handleCancelItem(item.id, 'customer_mistake')}
                            className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                          >
                            客都合取消
                          </button>
                          <button
                            onClick={() => handleCancelItem(item.id, 'kitchen_error')}
                            className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-800"
                          >
                            厨房ミス/廃棄
                          </button>
                        </div>
                      ) : (
                        <span className="text-red-500 font-bold">取消済</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 精算・合計表示[cite: 2] */}
            <div className="bg-white p-6 border rounded-lg shadow-md mt-4">
              <div className="flex justify-between text-2xl font-bold mb-4">
                <span>お支払い総合計:</span>
                <span className="text-red-600">¥{currentOrder.total_price.toLocaleString()}</span>
              </div>

              {/* 支払い方法の選択切り替え[cite: 2] */}
              <div className="flex gap-4 mb-4">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex-1 py-3 font-bold rounded ${paymentMethod === 'cash' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
                >
                  現金決済
                </button>
                <button
                  onClick={() => setPaymentMethod('credit')}
                  className={`flex-1 py-3 font-bold rounded ${paymentMethod === 'credit' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
                >
                  クレジットカード (Stripe)
                </button>
              </div>

              {/* 現金決済フォーム[cite: 2] */}
              {paymentMethod === 'cash' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <label className="font-bold">お預かり金額:</label>
                    <input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(Number(e.target.value))}
                      className="border p-2 rounded text-xl w-48 text-right"
                    />
                  </div>
                  <div className="text-lg font-semibold">
                    お釣り: <span className="text-blue-600 font-bold">¥{Math.max(0, paidAmount - currentOrder.total_price).toLocaleString()}</span>
                  </div>
                  <button
                    onClick={handleCashCheckout}
                    className="w-full bg-green-600 text-white text-xl font-bold py-3 rounded hover:bg-green-700"
                  >
                    現金精算を確定する
                  </button>
                </div>
              )}

              {/* クレジットカード (Stripe) 決済フォーム */}
              {paymentMethod === 'credit' && (
                <div>
                  {isCreatingIntent ? (
                    <p className="text-center text-gray-500 py-4">Stripe 決済画面を読み込み中...</p>
                  ) : clientSecret ? (
                    <Elements
                      stripe={stripePromise}
                      options={{
                        clientSecret,
                        locale: 'ja',
                        // ▼ Link や自動補完機能を無効化し、毎回新規入力画面にする設定
                        appearance: {
                          theme: 'stripe',
                        },
                      }}
                    >
                      <StripeCheckoutForm
                        amount={currentOrder.total_price}
                        onSuccess={handleCreditCheckoutSuccess}
                      />
                    </Elements>
                  ) : (
                    <p className="text-center text-red-500 py-4">決済フォームの初期化に失敗しました。</p>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-xl">
            卓を選択してください
          </div>
        )}
      </div>
    </div>
  );
}