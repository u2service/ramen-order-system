'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Check, Save, Loader2 } from 'lucide-react';

type Product = {
  id: number;
  name: string;
  category_id?: number;
};

type OptionGroup = {
  id: number;
  name: string;
  is_required?: boolean;
  multi_flag?: boolean;
};

export default function ProductOptionMapping() {
  const [products, setProducts] = useState<Product[]>([]);
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [checkedGroupIds, setCheckedGroupIds] = useState<number[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  // 初回表示：商品一覧とオプショングループ一覧を取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [prodRes, groupRes] = await Promise.all([
          api.get('/admin/products'),
          api.get('/admin/option-groups'), // オプショングループ一覧API
        ]);

        const loadedProducts = prodRes.data || [];
        setProducts(loadedProducts);
        setOptionGroups(groupRes.data || []);

        if (loadedProducts.length > 0) {
          setSelectedProductId(loadedProducts[0].id);
        }
      } catch (err) {
        console.error('データの取得に失敗しました:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 選択商品が変更されたら、現在紐付いているグループを取得
  useEffect(() => {
    if (!selectedProductId) return;

    const fetchCurrentMapping = async () => {
      try {
        const res = await api.get(`/admin/products/${selectedProductId}/option-groups`);
        const currentGroupIds = (res.data || []).map((grp: { id: number }) => grp.id);
        setCheckedGroupIds(currentGroupIds);
      } catch (err) {
        console.error('紐付け情報の取得に失敗しました:', err);
      }
    };

    fetchCurrentMapping();
  }, [selectedProductId]);

  // チェック切り替え
  const handleToggleGroup = (groupId: number) => {
    setCheckedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  // 保存実行
  const handleSave = async () => {
    if (!selectedProductId) return;

    try {
      setSaving(true);
      setMessage(null);

      await api.post(`/admin/products/${selectedProductId}/option-groups`, {
        option_group_ids: checkedGroupIds,
      });

      setMessage('紐付け設定を保存しました！');
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('保存に失敗しました:', err);
      alert('保存に失敗しました。もう一度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500 font-bold">
        <Loader2 className="animate-spin mr-2" size={20} /> データを読み込み中...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-2xl shadow-md border border-gray-200 mt-6">
      <h2 className="text-xl font-bold text-gray-800 border-b pb-3 mb-6">
        【商品 × オプショングループ 紐付け設定】
      </h2>

      {message && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-lg flex items-center gap-2 font-bold">
          <Check size={20} /> {message}
        </div>
      )}

      {/* 対象商品選択 */}
      <div className="mb-6">
        <label className="block text-sm font-bold text-gray-700 mb-2">
          対象商品を選択:
        </label>
        <select
          value={selectedProductId ?? ''}
          onChange={(e) => setSelectedProductId(Number(e.target.value))}
          className="w-full max-w-md p-3 border border-gray-300 rounded-xl bg-gray-50 font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-600"
        >
          {products.map((prod) => (
            <option key={prod.id} value={prod.id}>
              {prod.name}
            </option>
          ))}
        </select>
      </div>

      {/* オプショングループ選択 */}
      <div className="mb-8">
        <p className="text-sm font-bold text-gray-700 mb-3">
          この商品で選択可能なオプショングループにチェックを入れてください：
        </p>

        <div className="space-y-3">
          {optionGroups.map((group) => {
            const isChecked = checkedGroupIds.includes(group.id);
            return (
              <label
                key={group.id}
                onClick={() => handleToggleGroup(group.id)}
                className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition ${
                  isChecked
                    ? 'border-red-600 bg-red-50 text-red-950 font-bold'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                  />
                  <span className="text-base font-bold">{group.name}</span>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* 保存ボタン */}
      <div className="flex justify-end border-t pt-4">
        <button
          onClick={handleSave}
          disabled={saving || !selectedProductId}
          className="flex items-center gap-2 bg-red-700 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-800 disabled:opacity-50 transition shadow-md"
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin" size={18} /> 保存中...
            </>
          ) : (
            <>
              <Save size={18} /> 設定を保存
            </>
          )}
        </button>
      </div>
    </div>
  );
}