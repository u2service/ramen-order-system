import Image from 'next/image';
import { MenuItem, getImageUrl, categoryLabelMap } from '@/hooks/cust/useCustomerOrder';
import { ArrowLeft } from 'lucide-react';

type MenuListProps = {
  selectedCategory: string;
  menuItems: MenuItem[];
  onBack: () => void;
  onSelectItem: (item: MenuItem) => void;
};

export default function MenuList({ selectedCategory, menuItems, onBack, onSelectItem }: MenuListProps) {
  const filteredMenuItems = menuItems.filter((item) => item.category === selectedCategory);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800 border-l-4 border-red-700 pl-2">
          {categoryLabelMap[selectedCategory] || selectedCategory}
        </h2>
        <button onClick={onBack} className="text-xs text-gray-500 font-bold underline">
          カテゴリーを変更
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filteredMenuItems.map((item) => {
          const itemImageSrc = getImageUrl(item.image_url || item.category_image_url);

          return (
            <div
              key={item.id}
              onClick={() => onSelectItem(item)}
              className={`bg-white rounded-2xl border overflow-hidden transition flex flex-col justify-between relative shadow-sm ${
                item.is_available
                  ? 'border-gray-200 cursor-pointer active:scale-[0.98]'
                  : 'border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="w-full aspect-[4/3] bg-gray-100 relative overflow-hidden">
                <Image src={itemImageSrc} alt={item.name} fill className="object-cover" unoptimized />
                {!item.is_available && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-bold">
                    売り切れ
                  </div>
                )}
              </div>

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
  );
}