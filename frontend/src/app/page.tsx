// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { CartItem } from '@/types';
import { ShoppingBag, Check, Trash2, X, ChevronUp, Edit3 } from 'lucide-react';
import OptionSelectModal, { OptionGroup, Option } from '@/components/OptionSelectModal';

type MenuItem = {
  id: number;
  name: string;
  category: string;
  base_price: number;
  sort_order: number;
  is_available: boolean;
  option_groups: OptionGroup[];
};

export default function OrderPage() {
  const [tableNumber, setTableNumber] = useState<number>(1);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [orderSuccess, setOrderSuccess] = useState<boolean>(false);

  // カート詳細モーダルの開閉状態
  const [isCartModalOpen, setIsCartModalOpen] = useState<boolean>(false);

  // ★ 編集対象のカートインデックス（新規追加時は null）
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null);
  // ★ モーダルに渡す初期選択オプションと初期数量
  const [initialOptionsForModal, setInitialOptionsForModal] = useState<Option[]>([]);
  const [initialQuantityForModal, setInitialQuantityForModal] = useState<number>(1);

  // メニュー一覧取得処理
  const fetchMenu = async (isInitial = false) => {
    try {
      const res = await api.get('/menu');
      let items: MenuItem[] = [];

      if (res.data && Array.isArray(res.data.categories)) {
        items = res.data.categories.flatMap((cat: any) => {
          const products = cat.products || cat.items || [];
          return products.map((prod: any) => {
            const optionGroups: OptionGroup[] = (prod.option_groups || []).map((grp: any) => ({
              id: grp.id,
              name: grp.name,
              is_required: grp.is_required ?? false,
              is_multiple_choice: grp.is_multiple_choice ?? false,
              options: (grp.options || []).map((opt: any) => ({
                id: opt.id,
                option_group_id: grp.id,
                name: opt.name,
                price: opt.price_delta ?? opt.price ?? 0,
              })),
            }));

            return {
              id: prod.id,
              name: prod.name,
              category: cat.name,
              base_price: prod.price ?? prod.base_price ?? 0,
              sort_order: prod.sort_order ?? 0,
              is_available: !prod.is_sold_out,
              option_groups: optionGroups,
            };
          });
        });
      }

      items.sort((a, b) => {
        if (a.is_available !== b.is_available) {
          return a.is_available ? -1 : 1;
        }
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });

      setMenuItems(items);
    } catch (err) {
      console.error('メニューの取得に失敗しました:', err);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchMenu(true);
    const intervalId = setInterval(() => fetchMenu(false), 3000);
    return () => clearInterval(intervalId);
  }, []);

  // 新規商品タップ時
  const handleSelectItem = (item: MenuItem) => {
    if (!item.is_available) return;

    setEditingCartIndex(null);
    setInitialOptionsForModal([]);
    setInitialQuantityForModal(1);

    setSelectedItem(item);
  };

  // ★ カート内の特定商品を修正・編集する処理
  const handleEditCartItem = (indexToEdit: number) => {
    const targetCartItem = cart[indexToEdit];
    const originalMenuItem = menuItems.find((m) => m.id === targetCartItem.product.id);

    if (!originalMenuItem) return;

    // 選ばれている各オプションの option_group_id を正確に復元する
    const currentOptions: Option[] = targetCartItem.selectedOptions.map((cartOpt) => {
      const matchingGroup = originalMenuItem.option_groups.find((grp) =>
        grp.options.some((opt) => opt.id === cartOpt.id)
      );

      return {
        id: cartOpt.id,
        option_group_id: matchingGroup ? matchingGroup.id : 0,
        name: cartOpt.name,
        price: cartOpt.price_delta ?? 0,
      };
    });

    setEditingCartIndex(indexToEdit);
    setInitialOptionsForModal(currentOptions);
    setInitialQuantityForModal(targetCartItem.quantity); // カート既存の数量をセット
    setSelectedItem(originalMenuItem);
    setIsCartModalOpen(false); // カートモーダルを閉じる
  };

  // オプション決定時（新規追加／既存編集の両方に対応）
  const handleConfirmOptions = (selectedOptions: Option[], quantity: number) => {
    if (!selectedItem) return;

    // 必須チェック
    for (const group of selectedItem.option_groups) {
      if (group.is_required) {
        const hasSelectedInGroup = selectedOptions.some(
          (opt) => opt.option_group_id === group.id
        );
        if (!hasSelectedInGroup) {
          alert(`「${group.name}」を選択してください。`);
          return;
        }
      }
    }

    const selectedOptionsList = selectedOptions.map((opt) => ({
      id: opt.id,
      name: opt.name,
      price_delta: opt.price,
    }));

    const optionsTotalPrice = selectedOptions.reduce((sum, opt) => sum + opt.price, 0);
    // ★ 単価（基本価格 + オプション合計） × 数量で計算
    const unitPrice = selectedItem.base_price + optionsTotalPrice;
    const itemTotalPrice = unitPrice * quantity;

    const updatedCartItem: CartItem = {
      product: {
        id: selectedItem.id,
        name: selectedItem.name,
        category: selectedItem.category,
        base_price: selectedItem.base_price,
        is_available: selectedItem.is_available,
        options: [],
      },
      quantity: quantity,
      selectedOptions: selectedOptionsList,
      itemTotalPrice: itemTotalPrice,
    };

    if (editingCartIndex !== null) {
      // 既存アイテムの差し替え更新
      setCart((prev) =>
        prev.map((item, idx) => (idx === editingCartIndex ? updatedCartItem : item))
      );
      setEditingCartIndex(null);
    } else {
      // 新規追加
      setCart((prev) => [...prev, updatedCartItem]);
    }

    setSelectedItem(null);
    setInitialOptionsForModal([]);
    setInitialQuantityForModal(1);
  };

  const handleRemoveFromCart = (indexToRemove: number) => {
    setCart((prev) => {
      const updated = prev.filter((_, index) => index !== indexToRemove);
      if (updated.length === 0) {
        setIsCartModalOpen(false);
      }
      return updated;
    });
  };

  const grandTotal = cart.reduce((sum, item) => sum + item.itemTotalPrice, 0);

  const submitOrder = async () => {
    if (cart.length === 0) return;

    try {
      const payload = {
        table_number: tableNumber,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          options: item.selectedOptions.map((opt) => opt.id),
        })),
      };

      await api.post('/orders', payload);
      setCart([]);
      setIsCartModalOpen(false);
      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 4000);
    } catch (err: any) {
      console.error('注文の送信に失敗しました:', err);
      
      // ★ サーバーから返ってきた具体エラー（detail）があればそれを表示
      const errorMessage =
        err.response?.data?.detail ||
        err.response?.data?.message ||

        '注文に失敗しました。もう一度お試しください。';

      alert(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-xl font-bold">
        メニューを読み込み中...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-28">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-red-700 px-6 py-4 text-white shadow-md">
        <h1 className="text-2xl font-black tracking-wider">🍜 ラーメン注文</h1>
        <div className="flex items-center gap-2 bg-red-800 px-4 py-2 rounded-lg">
          <span className="text-sm font-medium">卓番号:</span>
          <select
            value={tableNumber}
            onChange={(e) => setTableNumber(Number(e.target.value))}
            className="bg-white text-gray-900 font-bold rounded px-2 py-1 text-base focus:outline-none"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <option key={num} value={num}>
                {num} 番卓
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* 注文完了アラート */}
      {orderSuccess && (
        <div className="bg-green-600 text-white text-center py-3 font-bold text-lg flex items-center justify-center gap-2">
          <Check size={24} /> 注文を厨房に送信しました！到着をお待ちください。
        </div>
      )}

      {/* メニュー一覧 */}
      <main className="max-w-5xl mx-auto p-6">
        <h2 className="text-xl font-bold mb-4 border-l-4 border-red-700 pl-3">
          メニュー一覧
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleSelectItem(item)}
              className={`bg-white rounded-xl border p-5 transition flex flex-col justify-between relative ${
                item.is_available
                  ? 'border-gray-200 shadow-sm hover:shadow-md cursor-pointer'
                  : 'border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed'
              }`}
            >
              {!item.is_available && (
                <span className="absolute top-3 right-3 bg-gray-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                  売り切れ
                </span>
              )}

              <div>
                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-semibold">
                  {item.category}
                </span>
                <h3 className="text-lg font-bold text-gray-900 mt-2">
                  {item.name}
                </h3>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xl font-extrabold text-red-700">
                  ¥{item.base_price.toLocaleString()}
                </span>
                <button
                  disabled={!item.is_available}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
                    item.is_available
                      ? 'bg-red-700 text-white hover:bg-red-800'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {item.is_available ? '選択する' : '売り切れ'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* オプション選択モーダル */}
      {selectedItem && (
        <OptionSelectModal
          isOpen={!!selectedItem}
          productName={selectedItem.name}
          optionGroups={selectedItem.option_groups}
          initialSelectedOptions={initialOptionsForModal}
          initialQuantity={initialQuantityForModal}
          onClose={() => {
            setSelectedItem(null);
            setEditingCartIndex(null);
          }}
          onConfirm={handleConfirmOptions}
        />
      )}

      {/* カート内容確認モーダル */}
      {isCartModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-0 md:p-4">
          <div className="bg-white w-full max-w-2xl rounded-t-2xl md:rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <ShoppingBag className="text-red-700" size={20} />
                選択中の注文内容 ({cart.length}点)
              </h3>
              <button
                onClick={() => setIsCartModalOpen(false)}
                className="p-1 rounded-full hover:bg-gray-200 text-gray-500"
              >
                <X size={20} />
              </button>
            </div>

            {/* カート内アイテム一覧 */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {cart.map((cartItem, idx) => (
                <div
                  key={idx}
                  className="p-3 border border-gray-200 rounded-xl flex justify-between items-start bg-gray-50"
                >
                  <div className="flex-1 pr-3">
                    <div className="font-bold text-gray-900 text-base flex items-center gap-2">
                      {cartItem.product.name}
                      
                      {/* 単価表示タグ */}
                      <span className="text-xs bg-gray-200 text-gray-800 px-2 py-0.5 rounded font-bold">
                        @{cartItem.product.base_price}
                      </span>

                      {/* 数量表示タグ */}
                      <span className="text-xs bg-gray-200 text-gray-800 px-2 py-0.5 rounded font-bold">
                        {cartItem.quantity}点
                      </span>
                      <button
                        onClick={() => handleEditCartItem(idx)}
                        className="text-xs text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-0.5 rounded font-bold flex items-center gap-1"
                      >
                        <Edit3 size={12} /> 変更
                      </button>
                    </div>

                    {cartItem.selectedOptions.length > 0 ? (
                      <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-1">
                        {cartItem.selectedOptions.map((opt) => (
                          <span key={opt.id} className="bg-white border px-1.5 py-0.5 rounded text-gray-700">
                            {opt.name} {(opt.price_delta ?? 0) > 0 && `(+${opt.price_delta})`}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 mt-0.5">オプションなし</div>
                    )}

                    <div className="text-sm font-bold text-red-700 mt-2">
                      小計: ¥{cartItem.itemTotalPrice.toLocaleString()}
                    </div>
                  </div>

                  {/* 削除ボタン */}
                  <button
                    onClick={() => handleRemoveFromCart(idx)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="この商品を削除"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            {/* カートモーダル用フッター */}
            <div className="p-4 border-t bg-gray-50 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-gray-500">合計金額</div>
                <div className="text-xl font-black text-red-700">
                  ¥{grandTotal.toLocaleString()}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsCartModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 font-bold text-gray-600 hover:bg-gray-100 text-sm"
                >
                  戻る
                </button>
                <button
                  onClick={() => handleEditCartItem(cart.length - 1)}
                  className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold transition shadow text-sm"
                >
                  注文を修正する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 固定ボトムカートバー */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div
              onClick={() => setIsCartModalOpen(true)}
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition"
            >
              <div className="relative bg-red-100 p-3 rounded-full text-red-700">
                <ShoppingBag size={24} />
                <span className="absolute -top-1 -right-1 bg-red-700 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cart.length}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-1 text-xs text-red-700 font-bold">
                  内訳を確認・変更 <ChevronUp size={14} />
                </div>
                <p className="text-xl font-black text-red-700">
                  ¥{grandTotal.toLocaleString()}
                </p>
              </div>
            </div>

            <button
              onClick={submitOrder}
              className="bg-red-700 text-white px-8 py-3.5 rounded-xl font-bold text-lg hover:bg-red-800 shadow-md transition"
            >
              注文を確定する ({cart.length}点)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}