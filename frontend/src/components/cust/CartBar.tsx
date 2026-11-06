import { ShoppingBag, ChevronUp } from 'lucide-react';

type CartBarProps = {
  cartLength: number;
  grandTotal: number;
  onOpenCart: () => void;
  onSubmitOrder: () => void;
};

export default function CartBar({ cartLength, grandTotal, onOpenCart, onSubmitOrder }: CartBarProps) {
  if (cartLength === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t p-3 shadow-lg">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div onClick={onOpenCart} className="flex items-center gap-3 cursor-pointer">
          <div className="relative bg-red-100 p-2.5 rounded-full text-red-700">
            <ShoppingBag size={20} />
            <span className="absolute -top-1 -right-1 bg-red-700 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {cartLength}
            </span>
          </div>
          <div>
            <div className="text-xs text-red-700 font-bold flex items-center gap-0.5">
              カートを見る <ChevronUp size={12} />
            </div>
            <p className="text-lg font-black text-red-700">¥{grandTotal.toLocaleString()}</p>
          </div>
        </div>

        <button
          onClick={onSubmitOrder}
          className="bg-red-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow hover:bg-red-800"
        >
          注文を送信 ({cartLength})
        </button>
      </div>
    </div>
  );
}