'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { CartItem } from '@/types';
import { ShoppingBag, Check, Trash2, X, ChevronUp, Edit3, ArrowLeft } from 'lucide-react';
import OptionSelectModal, { OptionGroup, Option } from '@/components/OptionSelectModal';

type MenuItem = {
  id: number;
  name: string;
  category: string;
  category_image_url?: string;
  base_price: number;
  sort_order: number;
  is_available: boolean;
  image_url?: string;
  option_groups: OptionGroup[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// 画像の相対パスを完全なURLに変換するヘルパー関数
const getImageUrl = (url?: string | null) => {
  if (!url) return "/images/default.jpg"; // フォールバック用デフォルト画像
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  const backendHost = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
  return `${backendHost}${url.startsWith("/") ? "" : "/"}${url}`;
};

// DBのカテゴリー名から表示用テキストへの変換マッピング
const categoryLabelMap: Record<string, string> = {
  'サイド': 'サイドメニュー',
  // 必要に応じて他のカテゴリーも追加できます
  // 'ドリンク': 'ドリンクメニュー',
};

// 画像が設定されていない場合や読み込めない場合の予備画像
const defaultCategoryImage = '/images/default.jpg';

// ★ 追加: useSearchParams を使う専用の非表示コンポーネント
function TableNumberFetcher({ onTableFetched }: { onTableFetched: (table: number) => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const tableParam = searchParams.get('table');
    if (tableParam) {
      const parsedTable = parseInt(tableParam, 10);
      if (!isNaN(parsedTable)) {
        onTableFetched(parsedTable);
      }
    }
  }, [searchParams, onTableFetched]);

  return null;
}

// 1. 注文画面の実体コンポーネント
function CustomerOrderContent() {
  const [tableNumber, setTableNumber] = useState<number>(1);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [orderSuccess, setOrderSuccess] = useState<boolean>(false);

  const [isCartModalOpen, setIsCartModalOpen] = useState<boolean>(false);
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null);
  const [initialOptionsForModal, setInitialOptionsForModal] = useState<Option[]>([]);
  const [initialQuantityForModal, setInitialQuantityForModal] = useState<number>(1);

  // メニュー一覧の取得
  const fetchMenu = async (isInitial = false) => {
    try {
      const res = await api.get('/menu');
      let items: MenuItem[] = [];

      if (res.data && Array.isArray(res.data.categories)) {
        items = res.data.categories.flatMap((cat: any) => {
          const products = cat.products || cat.items || [];
          return products.map((prod: any) => ({
            id: prod.id,
            name: prod.name,
            category: cat.name,
            category_image_url: cat.image_url || cat.image || null,
            base_price: prod.price ?? prod.base_price ?? 0,
            sort_order: prod.sort_order ?? 0,
            is_available: !prod.is_sold_out,
            image_url: prod.image_url || prod.image || null,
            option_groups: (prod.option_groups || []).map((grp: any) => ({
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
            })),
          }));
        });
      }

      items.sort((a, b) => {
        if (a.is_available !== b.is_available) return a.is_available ? -1 : 1;
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });

      setMenuItems(items);
    } catch (err) {
      console.error('メニューの取得に失敗しました:', err);
    } finally {
      setLoading(false); // isInitial の条件を外し、初回の試行が終わったら必ず解除する
    }
  };

  useEffect(() => {
    fetchMenu(true);
    const intervalId = setInterval(() => fetchMenu(false), 5000);
    return () => clearInterval(intervalId);
  }, []);

  const categories = Array.from(new Set(menuItems.map((item) => item.category)));

  const handleSelectItem = (item: MenuItem) => {
    if (!item.is_available) return;
    setEditingCartIndex(null);
    setInitialOptionsForModal([]);
    setInitialQuantityForModal(1);
    setSelectedItem(item);
  };

  const handleEditCartItem = (indexToEdit: number) => {
    const targetCartItem = cart[indexToEdit];
    const originalMenuItem = menuItems.find((m) => m.id === targetCartItem.product.id);
    if (!originalMenuItem) return;

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
    setInitialQuantityForModal(targetCartItem.quantity);
    setSelectedItem(originalMenuItem);
    setIsCartModalOpen(false);
  };

  const handleConfirmOptions = (selectedOptions: Option[], quantity: number) => {
    if (!selectedItem) return;

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
      setCart((prev) =>
        prev.map((item, idx) => (idx === editingCartIndex ? updatedCartItem : item))
      );
      setEditingCartIndex(null);
    } else {
      setCart((prev) => [...prev, updatedCartItem]);
    }

    setSelectedItem(null);
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
      setSelectedCategory(null);
      setTimeout(() => setOrderSuccess(false), 5000);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        '注文に失敗しました。もう一度お試しください。';
      alert(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-lg font-bold text-gray-600">
        メニューを読み込み中...
      </div>
    );
  }

  const filteredMenuItems = selectedCategory
    ? menuItems.filter((item) => item.category === selectedCategory)
    : [];

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
            {/* ★ Suspense で囲んでパラメータ取得コンポーネントを配置 */}
      <Suspense fallback={null}>
        <TableNumberFetcher onTableFetched={setTableNumber} />
      </Suspense>

      {/* ヘッダー */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-red-700 px-4 py-3 text-white shadow">
        <div className="flex items-center gap-2">
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory(null)}
              className="p-1 rounded-full hover:bg-red-800 transition"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <h1 className="text-xl font-bold tracking-wide">ラーメン注文</h1>
        </div>
        <div className="bg-red-800 px-3 py-1 rounded-full text-xs font-bold">
          {tableNumber} 番卓
        </div>
      </header>

      {/* 注文完了表示 */}
      {orderSuccess && (
        <div className="bg-emerald-600 text-white text-center py-3 font-bold text-sm flex items-center justify-center gap-2">
          <Check size={20} /> 注文を送信しました！到着をお待ちください。
        </div>
      )}

      {/* メインコンテンツ */}
      <main className="max-w-6xl mx-auto p-4">
        {/* Top画面: カテゴリー選択（selectedCategory === null の時） */}
        {!selectedCategory ? (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">
              メニューグループを選択してください
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {categories.map((catName) => {
                // カテゴリ名に一致する最初のアイテムから category_image_url を取得
                const categoryItem = menuItems.find((item) => item.category === catName);
                const imageSrc = getImageUrl(categoryItem?.category_image_url);

                return (
                  <div
                    key={catName}
                    onClick={() => setSelectedCategory(catName)}
                    className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md cursor-pointer transition flex flex-col active:scale-[0.99]"
                  >
                    {/* ★ 追加: カテゴリー画像表示領域 */}
                    <div className="h-40 sm:h-64 w-full bg-gray-100 relative overflow-hidden">
                      <img
                        src={imageSrc}
                        alt={catName}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* カテゴリー名領域 */}
                    <div className="p-4 flex justify-between items-center bg-white">
                      <span className="text-xl font-black text-gray-900">
                        {categoryLabelMap[catName] || catName}
                      </span>
                      <span className="text-xs text-red-700 font-bold bg-red-50 px-3 py-1.5 rounded-full border border-red-100">
                        メニューを見る →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* 商品一覧画面 */
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 border-l-4 border-red-700 pl-2">
                {categoryLabelMap[selectedCategory] || selectedCategory}
              </h2>
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-xs text-gray-500 font-bold underline"
              >
                カテゴリーを変更
              </button>
            </div>

            {/* 商品一覧画面 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredMenuItems.map((item) => {
                const itemImageSrc = getImageUrl(item.image_url || item.category_image_url);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className={`bg-white rounded-2xl border overflow-hidden transition flex flex-col justify-between relative shadow-sm ${
                      item.is_available
                        ? 'border-gray-200 cursor-pointer active:scale-[0.98]'
                        : 'border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    {/* ★ 画像表示エリア（アスペクト比を固定して大きく表示） */}
                    <div className="w-full aspect-[4/3] bg-gray-100 relative overflow-hidden">
                      <img
                        src={itemImageSrc}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                      {!item.is_available && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-bold">
                          売り切れ
                        </div>
                      )}
                    </div>

                    {/* 商品情報 ＆ ボタンエリア */}
                    <div className="p-3 flex flex-col flex-1 justify-between gap-2">
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-gray-900 line-clamp-2 leading-tight">
                          {item.name}
                        </h3>
                        <div className="text-red-700 font-extrabold text-base sm:text-lg mt-1">
                          ¥{item.base_price.toLocaleString()}
                        </div>
                      </div>

                      <button
                        disabled={!item.is_available}
                        className={`w-full py-2 rounded-lg text-xs font-bold transition ${
                          item.is_available
                            ? 'bg-red-700 text-white hover:bg-red-800'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {item.is_available ? '選択' : '売り切れ'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* オプション選択モーダル */}
      {selectedItem && (
        <OptionSelectModal
          isOpen={!!selectedItem}
          productName={selectedItem.name}
          /* getImageUrl を使用して動的パスに解決 */
          baseImage={getImageUrl(selectedItem.image_url || selectedItem.category_image_url)}
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
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-base text-gray-800 flex items-center gap-2">
                <ShoppingBag className="text-red-700" size={18} />
                ご注文内容の確認 ({cart.length}点)
              </h3>
              <button
                onClick={() => setIsCartModalOpen(false)}
                className="p-1 rounded-full text-gray-500 hover:bg-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {cart.map((cartItem, idx) => (
                <div
                  key={idx}
                  className="p-3 border border-gray-200 rounded-xl flex justify-between items-start bg-gray-50"
                >
                  <div className="flex-1 pr-2">
                    <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                      {cartItem.product.name}
                      <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                        {cartItem.quantity}点
                      </span>
                    </div>

                    {cartItem.selectedOptions.length > 0 && (
                      <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-1">
                        {cartItem.selectedOptions.map((opt) => (
                          <span key={opt.id} className="bg-white border px-1 py-0.5 rounded">
                            {opt.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="text-sm font-bold text-red-700 mt-1">
                      ¥{cartItem.itemTotalPrice.toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditCartItem(idx)}
                      className="p-1.5 text-xs text-gray-600 border rounded hover:bg-white"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setCart((prev) => prev.filter((_, i) => i !== idx));
                        if (cart.length === 1) setIsCartModalOpen(false);
                      }}
                      className="p-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">合計</div>
                <div className="text-xl font-black text-red-700">
                  ¥{grandTotal.toLocaleString()}
                </div>
              </div>
              <button
                onClick={submitOrder}
                className="bg-red-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow hover:bg-red-800"
              >
                注文を送信する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 固定ボトムカートバー */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t p-3 shadow-lg">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div
              onClick={() => setIsCartModalOpen(true)}
              className="flex items-center gap-3 cursor-pointer"
            >
              <div className="relative bg-red-100 p-2.5 rounded-full text-red-700">
                <ShoppingBag size={20} />
                <span className="absolute -top-1 -right-1 bg-red-700 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {cart.length}
                </span>
              </div>
              <div>
                <div className="text-xs text-red-700 font-bold flex items-center gap-0.5">
                  カートを見る <ChevronUp size={12} />
                </div>
                <p className="text-lg font-black text-red-700">
                  ¥{grandTotal.toLocaleString()}
                </p>
              </div>
            </div>

            <button
              onClick={submitOrder}
              className="bg-red-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow hover:bg-red-800"
            >
              注文を送信 ({cart.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 2. ページのエントリーポイント（Suspenseでラップしてエクスポート）
export default function CustomerOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-lg font-bold text-gray-600">
          読み込み中...
        </div>
      }
    >
      <CustomerOrderContent />
    </Suspense>
  );
}