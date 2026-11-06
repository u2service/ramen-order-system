import Image from 'next/image';
import { MenuItem, getImageUrl, categoryLabelMap } from '@/hooks/cust/useCustomerOrder';

type CategoryListProps = {
  categories: string[];
  menuItems: MenuItem[];
  onSelectCategory: (catName: string) => void;
};

export default function CategoryList({ categories, menuItems, onSelectCategory }: CategoryListProps) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">
        メニューグループを選択してください
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {categories.map((catName) => {
          const categoryItem = menuItems.find((item) => item.category === catName);
          const imageSrc = getImageUrl(categoryItem?.category_image_url);

          return (
            <div
              key={catName}
              onClick={() => onSelectCategory(catName)}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md cursor-pointer transition flex flex-col active:scale-[0.99]"
            >
              <div className="h-40 sm:h-64 w-full bg-gray-100 relative overflow-hidden">
                <Image src={imageSrc} alt={catName} fill className="object-cover" unoptimized />
              </div>
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
  );
}