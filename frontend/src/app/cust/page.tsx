'use client';

import { Suspense } from 'react';
import { useCustomerOrder, getImageUrl } from '@/hooks/cust/useCustomerOrder';
import CategoryList from '@/components/cust/CategoryList';
import MenuList from '@/components/cust/MenuList';
import CartModal from '@/components/cust/CartModal';
import CartBar from '@/components/cust/CartBar';
import OptionSelectModal from '@/components/OptionSelectModal';
import { Check, ArrowLeft } from 'lucide-react';

function CustomerOrderContent() {
  const {
    tableNumber,
    sessionError,
    loading,
    menuItems,
    categories,
    selectedCategory,
    setSelectedCategory,
    cart,
    setCart,
    selectedItem,
    setSelectedItem,
    orderSuccess,
    isCartModalOpen,
    setIsCartModalOpen,
    initialOptionsForModal,
    initialQuantityForModal,
    handleSelectItem,
    handleEditCartItem,
    handleConfirmOptions,
    grandTotal,
    submitOrder,
  } = useCustomerOrder();

  if (sessionError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center bg-gray-50">
        <div className="p-6 bg-white rounded-xl shadow-md max-w-sm">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">ご注文いただけません</h2>
          <p className="text-sm text-gray-600 mb-4">{sessionError}</p>
          <p className="text-xs text-gray-400">ご不明な点は店員までお声がけください。</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-lg font-bold text-gray-600">
        メニューを読み込み中...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
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
        {!selectedCategory ? (
          <CategoryList
            categories={categories}
            menuItems={menuItems}
            onSelectCategory={setSelectedCategory}
          />
        ) : (
          <MenuList
            selectedCategory={selectedCategory}
            menuItems={menuItems}
            onBack={() => setSelectedCategory(null)}
            onSelectItem={handleSelectItem}
          />
        )}
      </main>

      {/* オプション選択モーダル */}
      {selectedItem && (
        <OptionSelectModal
          isOpen={!!selectedItem}
          productName={selectedItem.name}
          baseImage={getImageUrl(selectedItem.image_url || selectedItem.category_image_url)}
          optionGroups={selectedItem.option_groups}
          initialSelectedOptions={initialOptionsForModal}
          initialQuantity={initialQuantityForModal}
          onClose={() => {
            setSelectedItem(null);
          }}
          onConfirm={handleConfirmOptions}
        />
      )}

      {/* カート内容確認モーダル */}
      <CartModal
        isOpen={isCartModalOpen}
        cart={cart}
        grandTotal={grandTotal}
        onClose={() => setIsCartModalOpen(false)}
        onEditItem={handleEditCartItem}
        onRemoveItem={(idx) => {
          setCart((prev) => prev.filter((_, i) => i !== idx));
          if (cart.length === 1) setIsCartModalOpen(false);
        }}
        onSubmitOrder={submitOrder}
      />

      {/* 固定ボトムカートバー */}
      <CartBar
        cartLength={cart.length}
        grandTotal={grandTotal}
        onOpenCart={() => setIsCartModalOpen(true)}
        onSubmitOrder={submitOrder}
      />
    </div>
  );
}

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