'use client';

import React, { useState, useEffect } from 'react';
import ProductOptionMapping from '@/components/ProductOptionMapping';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Option {
  id: number;
  option_group_id: number;
  name: string;
  price: number;
  linked_product_id?: number | null;
  is_active: boolean;
}

interface OptionGroup {
  id: number;
  name: string;
  hissu_flag: boolean;
  multi_flag: boolean;
  options: Option[];
}

interface Product {
  id: number;
  name: string;
  price: number;
}

export default function OptionManagementPage() {
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<OptionGroup | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  // モーダル表示状態
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isOptionModalOpen, setIsOptionModalOpen] = useState(false);

  // 編集中のID（nullの場合は新規作成）
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editingOptionId, setEditingOptionId] = useState<number | null>(null); // ★ 追加

  // グループ作成・編集フォーム
  const [groupForm, setGroupForm] = useState({
    name: '',
    hissu_flag: false,
    multi_flag: false,
  });

  // 選択肢作成・編集フォーム
  const [optionForm, setOptionForm] = useState({
    name: '',
    price: 0,
    linked_product_id: null as number | null,
  });

  // データ一括取得
  const fetchGroups = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/option-groups/`);
      if (res.ok) {
        const data: OptionGroup[] = await res.json();
        setGroups(data);

        if (selectedGroup) {
          const updated = data.find((g) => g.id === selectedGroup.id);
          setSelectedGroup(updated || data[0] || null);
        } else if (data.length > 0) {
          setSelectedGroup(data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch option groups:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/products`);
      if (res.ok) {
        const data: Product[] = await res.json();
        setProducts(data);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchProducts();
  }, []);

  // --- グループ用モーダル制御 ---
  const openCreateGroupModal = () => {
    setEditingGroupId(null);
    setGroupForm({ name: '', hissu_flag: false, multi_flag: false });
    setIsGroupModalOpen(true);
  };

  const openEditGroupModal = (group: OptionGroup) => {
    setEditingGroupId(group.id);
    setGroupForm({
      name: group.name,
      hissu_flag: group.hissu_flag,
      multi_flag: group.multi_flag,
    });
    setIsGroupModalOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) return;

    const isEdit = editingGroupId !== null;
    const url = isEdit
      ? `${API_BASE_URL}/admin/option-groups/${editingGroupId}`
      : `${API_BASE_URL}/admin/option-groups/`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupForm),
      });

      if (res.ok) {
        setIsGroupModalOpen(false);
        setEditingGroupId(null);
        setGroupForm({ name: '', hissu_flag: false, multi_flag: false });
        fetchGroups();
      } else {
        console.error('Save failed:', await res.json());
      }
    } catch (error) {
      console.error('Network error:', error);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('このグループと配下の選択肢を削除しますか？')) return;
    const res = await fetch(`${API_BASE_URL}/admin/option-groups/${groupId}`, { method: 'DELETE' });
    if (res.ok) {
      setSelectedGroup(null);
      fetchGroups();
    }
  };

  // --- 選択肢（オプション）用モーダル制御 ---
  const openCreateOptionModal = () => {
    setEditingOptionId(null);
    setOptionForm({ name: '', price: 0, linked_product_id: null });
    setIsOptionModalOpen(true);
  };

  // ★ 追加：選択肢編集モーダルを開く
  const openEditOptionModal = (opt: Option) => {
    setEditingOptionId(opt.id);
    setOptionForm({
      name: opt.name,
      price: opt.price,
      linked_product_id: opt.linked_product_id ?? null,
    });
    setIsOptionModalOpen(true);
  };

  // ★ 変更：選択肢の保存（新規作成 / 更新）
  const handleSaveOption = async () => {
    if (!selectedGroup || !optionForm.name.trim()) return;

    const isEdit = editingOptionId !== null;
    const url = isEdit
      ? `${API_BASE_URL}/admin/options/${editingOptionId}`
      : `${API_BASE_URL}/admin/options`;
    const method = isEdit ? 'PUT' : 'POST';

    const payload = isEdit
      ? { ...optionForm }
      : { ...optionForm, option_group_id: selectedGroup.id };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsOptionModalOpen(false);
        setEditingOptionId(null);
        setOptionForm({ name: '', price: 0, linked_product_id: null });
        fetchGroups();
      } else {
        console.error('Save option failed:', await res.json());
      }
    } catch (error) {
      console.error('Network error:', error);
    }
  };

  const handleDeleteOption = async (optionId: number) => {
    if (!confirm('この選択肢を削除しますか？')) return;
    const res = await fetch(`${API_BASE_URL}/admin/options/${optionId}`, { method: 'DELETE' });
    if (res.ok) {
      fetchGroups();
    }
  };

  const handleToggleOptionStatus = async (opt: Option) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/options/${opt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...opt,
          is_active: !opt.is_active, // トグル反転
        }),
      });
      if (res.ok) {
        fetchGroups();
      }
    } catch (error) {
      console.error('Failed to toggle option status:', error);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <section>
        <ProductOptionMapping />
      </section>

      <hr className="my-6 border-gray-300" />

      <section className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">【オプションマスタ管理】</h1>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* 左側：オプショングループ一覧 */}
          <div className="md:col-span-5 bg-white p-4 border rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg text-gray-700">[1] オプショングループ</h2>
              <button
                onClick={openCreateGroupModal}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-1.5 rounded transition"
              >
                + グループ追加
              </button>
            </div>

            <div className="space-y-2">
              {groups.map((group) => {
                const isSelected = selectedGroup?.id === group.id;
                return (
                  <div
                    key={group.id}
                    onClick={() => setSelectedGroup(group)}
                    className={`p-3 border rounded-md cursor-pointer flex justify-between items-center transition ${
                      isSelected ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-gray-800">• {group.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        ({group.hissu_flag ? '必須' : '任意'} / {group.multi_flag ? '複数選択' : '単一'})
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditGroupModal(group);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1"
                      >
                        編集
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group.id);
                        }}
                        className="text-red-500 hover:text-red-700 text-xs px-2 py-1"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 右側：選択肢一覧テーブル */}
          <div className="md:col-span-7 bg-white p-4 border rounded-lg shadow-sm">
            {selectedGroup ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="font-bold text-lg text-gray-700">[2] 選択肢（オプション）</h2>
                    <p className="text-xs text-gray-500">
                      （「{selectedGroup.name}」を選択中）
                    </p>
                  </div>
                  <button
                    onClick={openCreateOptionModal}
                    className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-3 py-1.5 rounded transition"
                  >
                    + 選択肢を追加
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50 text-gray-600">
                        <th className="p-2.5">状態</th>
                        <th className="p-2.5">名称</th>
                        <th className="p-2.5">追加価格</th>
                        <th className="p-2.5">セット連動</th>
                        <th className="p-2.5 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-b">
                      {selectedGroup.options
                        ?.slice() // 元の配列を変更しないよう浅いコピーを作成
                        .sort((a, b) => {
                          // is_active が True のものを優先して上に配置 (True: 1, False: 0)
                          if (a.is_active === b.is_active) {
                            return a.id - b.id; // 同じステータス内では ID 順（または名称順）
                          }
                          return a.is_active ? -1 : 1;
                        })
                        .map((opt) => {
                        const linkedProduct = products.find((p) => p.id === opt.linked_product_id);
                        return (
                          <tr 
                            key={opt.id} 
                            className={`hover:bg-gray-50 ${!opt.is_active ? 'bg-gray-100 opacity-60' : ''}`}
                          >
                            {/* 状態バッジ */}
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                opt.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-300 text-gray-700'
                              }`}>
                                {opt.is_active ? '有効' : '無効'}
                              </span>
                            </td>
                            <td className="p-2.5 font-medium">{opt.name}</td>
                            <td className="p-2.5">+{opt.price}</td>
                            <td className="p-2.5 text-gray-600">
                              {linkedProduct ? (
                                <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs font-bold">
                                  {linkedProduct.name}
                                </span>
                              ) : (
                                <span className="text-gray-400">なし</span>
                              )}
                            </td>
                            {/* ★ 変更：操作列に「編集」ボタンを追加 */}
                            <td className="p-2.5 text-right space-x-2">
                              <button
                                onClick={() => openEditOptionModal(opt)}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                              >
                                編集
                              </button>
                              {/* 有効 / 無効 切り替えボタン */}
                              <button
                                onClick={() => handleToggleOptionStatus(opt)}
                                className={`text-xs font-medium ${
                                  opt.is_active ? 'text-amber-600 hover:text-amber-800' : 'text-green-600 hover:text-green-800'
                                }`}
                              >
                                {opt.is_active ? '無効化' : '有効化'}
                              </button>

                              {/* 3. 削除ボタン (復活) */}
                              <button
                                onClick={() => handleDeleteOption(opt.id)}
                                className="text-red-500 hover:text-red-700 text-xs font-medium"
                              >
                                削除
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {(!selectedGroup.options || selectedGroup.options.length === 0) && (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-gray-400">
                            選択肢が未登録です
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-16 text-gray-400">
                左側のオプショングループを選択してください
              </div>
            )}
          </div>
        </div>
      </section>

      {/* --- グループ作成・編集モーダル --- */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg space-y-4">
            <h3 className="font-bold text-lg border-b pb-2">
              {editingGroupId ? 'オプショングループ編集' : 'オプショングループ追加'}
            </h3>
            
            <div>
              <label className="block text-sm font-medium mb-1">グループ名</label>
              <input
                type="text"
                className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                placeholder="例: 麺のかたさ"
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">選択タイプ</label>
              <div className="flex gap-4 text-sm mt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="multi_flag"
                    checked={!groupForm.multi_flag}
                    onChange={() => setGroupForm({ ...groupForm, multi_flag: false })}
                  />
                  単一選択 (ラジオ)
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="multi_flag"
                    checked={groupForm.multi_flag}
                    onChange={() => setGroupForm({ ...groupForm, multi_flag: true })}
                  />
                  複数選択 (チェック)
                </label>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm cursor-pointer mt-2">
                <input
                  type="checkbox"
                  checked={groupForm.hissu_flag}
                  onChange={(e) => setGroupForm({ ...groupForm, hissu_flag: e.target.checked })}
                />
                注文時に選択を必須とする (`hissu_flag`)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                onClick={() => setIsGroupModalOpen(false)}
                className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveGroup}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- 選択肢作成・編集モーダル --- */}
      {isOptionModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg space-y-4">
            <h3 className="font-bold text-lg border-b pb-2">
              {editingOptionId ? '選択肢編集' : `選択肢追加（${selectedGroup?.name}）`}
            </h3>

            <div>
              <label className="block text-sm font-medium mb-1">名称</label>
              <input
                type="text"
                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none text-sm"
                placeholder="例: 硬め, 餃子3個"
                value={optionForm.name}
                onChange={(e) => setOptionForm({ ...optionForm, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">追加価格 (円)</label>
              <input
                type="number"
                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none text-sm"
                value={optionForm.price}
                onChange={(e) => setOptionForm({ ...optionForm, price: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                セット連動商品 <span className="text-xs text-gray-500 font-normal">(KDSで別商品として分割したい場合)</span>
              </label>
              <select
                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none text-sm bg-white"
                value={optionForm.linked_product_id || ''}
                onChange={(e) =>
                  setOptionForm({
                    ...optionForm,
                    linked_product_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">なし (通常のトッピング)</option>
                {products.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    {prod.name} (¥{prod.price})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                onClick={() => setIsOptionModalOpen(false)}
                className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveOption}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded font-medium hover:bg-green-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}