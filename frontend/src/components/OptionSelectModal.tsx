// src/components/OptionSelectModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { X, ChevronRight, Check, ArrowLeft, Plus, Minus } from 'lucide-react';

export type Option = {
  id: number;
  option_group_id: number;
  name: string;
  price: number;
};

export type OptionGroup = {
  id: number;
  name: string;
  is_required: boolean;
  multi_flag: boolean;
  options: Option[];
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  baseImage?: string; // ★ 追加: 親からベース画像のURLを受け取る
  optionGroups: OptionGroup[];
  onConfirm: (selectedOptions: Option[], quantity: number) => void;
  initialSelectedOptions?: Option[];
  initialQuantity?: number;
};

export default function OptionSelectModal({
  isOpen,
  onClose,
  productName,
  baseImage,
  optionGroups = [],
  onConfirm,
  initialSelectedOptions = [],
  initialQuantity = 1,
}: Props) {
  const [selectedOptions, setSelectedOptions] = useState<Option[]>([]);
  const [activeGroup, setActiveGroup] = useState<OptionGroup | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  // オプション（カスタマイズ項目）が存在するかどうかの判定
  const hasOptions = optionGroups && optionGroups.length > 0;

  // ★ 追加: ねぎ増しが選択されているかどうかの判定
  const isNegiSelected = selectedOptions.some((opt) =>
    opt.name.includes('ねぎ増し')
  );

  // ★ 追加: チャーシューが選択されているかどうかの判定
  const isChashuSelected = selectedOptions.some((opt) =>
    opt.name.includes('チャーシュー')
  );

  // ★ 追加: 味玉が選択されているかどうかの判定
  const isAjitamaSelected = selectedOptions.some((opt) =>
    opt.name.includes('味玉')
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedOptions(initialSelectedOptions || []);
      setActiveGroup(null);
      // オプションがある場合は常に「1」、ない場合のみ受け取った数量（または1）をセット
      setQuantity(hasOptions ? 1 : initialQuantity || 1);
    }
  }, [isOpen, initialQuantity, hasOptions]);

  if (!isOpen) return null;

  // 指定グループの選択済みオプション名を文字列で取得
  const getSelectedNamesText = (groupId: number) => {
    const selectedInGroup = selectedOptions.filter(
      (opt) => opt.option_group_id === groupId
    );
    if (selectedInGroup.length === 0) return null;
    return selectedInGroup.map((opt) => opt.name).join('、');
  };

  // オプション選択/解除のトグル処理
  const handleOptionToggle = (group: OptionGroup, option: Option) => {
    if (group.multi_flag) {
      const exists = selectedOptions.some((item) => item.id === option.id);
      if (exists) {
        setSelectedOptions(selectedOptions.filter((item) => item.id !== option.id));
      } else {
        setSelectedOptions([...selectedOptions, option]);
      }
    } else {
      const filtered = selectedOptions.filter(
        (item) => item.option_group_id !== group.id
      );
      setSelectedOptions([...filtered, option]);
    }
  };

  // 1階層目の「カートに追加する」を押した時の処理
  const handleFinalConfirm = () => {
    // オプションがある場合は確実に1固定で渡す
    onConfirm(selectedOptions, hasOptions ? 1 : quantity);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">

      <div className="bg-white w-full max-w-md rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        

        {/* モーダルヘッダー */}
        <div className="px-3 py-2.5 border-b flex justify-between items-center bg-gray-50">
          <div>
            <h3 className="font-bold text-base text-gray-800 leading-tight">{productName}</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {activeGroup
                ? `＜ ${activeGroup.name} を選択中`
                : hasOptions
                ? 'カスタムオプションの選択'
                : '数量の選択'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 text-gray-500 transition"
          >
            <X size={18} />
          </button>
        </div>


        {/* モーダルコンテンツ領域 */}
        <div className="p-3 overflow-y-auto flex-1 space-y-3">
          
          {/* ★ 追加: 合成画像プレビュー表示領域 */}
          {baseImage && (
            <div className="relative w-full aspect-[16/9] bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
              {/* ベースラーメン画像 */}
              <img
                src={baseImage}
                alt={productName}
                className="w-full h-full object-cover"
              />

              {/* ねぎ増し重ね合わせ表示 */}
              {isNegiSelected && (
                <img
                  src="/images/negi.png"
                  alt="ねぎ増しトッピング"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-300"
                />
              )}

              {/* チャーシュー重ね合わせ表示 */}
              {isChashuSelected && (
                <img
                  src="/images/chashu.png"
                  alt="チャーシュートッピング"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-300"
                />
              )}

              {/* 味玉重ね合わせ表示 */}
              {isAjitamaSelected && (
                <img
                  src="/images/ajitama.png"
                  alt="味玉トッピング"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-300"
                />
              )}

            </div>
          )}

          {activeGroup ? (


            /* 【2階層目】選択肢一覧 */

            <div>
              <button
                onClick={() => setActiveGroup(null)}
                className="text-xs font-bold text-red-600 mb-2.5 flex items-center gap-1 hover:underline"
              >
                <ArrowLeft size={14} /> オプショングループ一覧に戻る
              </button>

              <div className="space-y-1.5">
                {activeGroup.options?.map((opt) => {
                  const isSelected = selectedOptions.some((item) => item.id === opt.id);
                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleOptionToggle(activeGroup, opt)}
                      className={`px-3 py-2 rounded-lg border cursor-pointer flex justify-between items-center transition ${
                        isSelected
                          ? 'border-red-600 bg-red-50 text-red-950 font-bold'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? 'bg-red-600 border-red-600 text-white'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check size={12} />}
                        </div>
                        <span className="text-sm">{opt.name}</span>
                      </div>
                      {opt.price > 0 && (
                        <span className="text-xs text-gray-500">+{opt.price}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (


            /* 【1階層目】オプショングループ一覧 ＋ 数量選択 */

            <div>
              {/* オプションがない商品（餃子等）のみ数量変更UIを表示 */}
              {!hasOptions ? (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 my-2">
                  <span className="font-bold text-gray-700 text-sm">数量</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-8 h-8 bg-white border border-gray-300 rounded-full flex items-center justify-center font-bold text-base shadow-sm hover:bg-gray-100 active:scale-95 transition"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-lg font-bold min-w-[20px] text-center">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-8 h-8 bg-white border border-gray-300 rounded-full flex items-center justify-center font-bold text-base shadow-sm hover:bg-gray-100 active:scale-95 transition"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                /* オプショングループ一覧 */
                <div className="space-y-2">
                  {optionGroups.map((group) => {
                    const selectedNames = getSelectedNamesText(group.id);

                    return (
                      <div
                        key={group.id}
                        onClick={() => setActiveGroup(group)}
                        className="px-3 py-2 border border-gray-200 rounded-lg cursor-pointer hover:border-red-500 hover:bg-gray-50 flex justify-between items-center transition"
                      >
                        <div>
                          <div className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                            {group.name}
                          </div>

                          <div className="text-xs mt-0.5">
                            {selectedNames ? (
                              <span className="text-red-600 font-bold">
                                {selectedNames}
                              </span>
                            ) : (
                              <span className="text-gray-400 font-normal">
                                未選択
                              </span>
                            )}
                          </div>
                        </div>

                        <ChevronRight className="text-gray-400" size={18} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>


        {/* モーダル内部フッター */}
        <div className="p-3 border-t bg-gray-50 flex justify-end gap-2">
          {activeGroup ? (
            <button
              onClick={() => setActiveGroup(null)}
              className="w-full py-2.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold transition shadow text-xs flex items-center justify-center gap-1"
            >
              選択を完了して一覧に戻る
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-gray-300 font-bold text-gray-600 hover:bg-gray-100 transition text-xs"
              >
                キャンセル
              </button>
              <button
                onClick={handleFinalConfirm}
                className="px-5 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold transition shadow text-xs"
              >
                この内容でカートに入れる
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
