import { CartItem } from '@/types';
import { ShoppingBag, X, Edit3, Trash2 } from 'lucide-react';

type CartModalProps = {
  isOpen: boolean;
  cart: CartItem[];
  grandTotal: number;
  onClose: () => void;
  onEditItem: (index: number) => void;
  onRemoveItem: (index: number) => void;
  onSubmitOrder: () => void;
};

export default function CartModal({
  isOpen,
  cart,
  grandTotal,
  onClose,
  onEditItem,
  onRemoveItem,
  onSubmitOrder,
}: CartModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
      <div className="bg-white w-full max-w-md rounded-t-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-base text-gray-800 flex items-center gap-2">
            <ShoppingBag className="text-red-700" size={18} />
            ご注文内容の確認 ({cart.length}点)
          </h3>
          <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {cart.map((cartItem, idx) => (
            <div key={idx} className="p-3 border border-gray-200 rounded-xl flex justify-between items-start bg-gray-50">
              <div className="flex-1 pr-2">
                <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  {cartItem.product.name}
                  <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">{cartItem.quantity}点</span>
                </div>

                {cartItem.selectedOptions.length > 0 && (
                  <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-1">
                    {cartItem.selectedOptions.map((opt) => (
                      <span key={opt.id} className="bg-white border px-1 py-0.5 rounded">{opt.name}</span>
                    ))}
                  </div>
                )}

                <div className="text-sm font-bold text-red-700 mt-1">
                  ¥{cartItem.itemTotalPrice.toLocaleString()}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button onClick={() => onEditItem(idx)} className="p-1.5 text-xs text-gray-600 border rounded hover:bg-white">
                  <Edit3 size={14} />
                </button>
                <button onClick={() => onRemoveItem(idx)} className="p-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500">合計</div>
            <div className="text-xl font-black text-red-700">¥{grandTotal.toLocaleString()}</div>
          </div>
          <button
            onClick={onSubmitOrder}
            className="bg-red-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow hover:bg-red-800"
          >
            注文を送信する
          </button>
        </div>
      </div>
    </div>
  );
}