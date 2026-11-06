'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { CartItem } from '@/types';
import { Option, OptionGroup } from '@/components/OptionSelectModal';

export type MenuItem = {
  id: number;
  name: string;
  category: string;
  category_image_url?: string;
  base_price: number;
  sort_order: number;
  is_available: boolean;
  image_url?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  option_groups: OptionGroup[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const getImageUrl = (url?: string | null) => {
  if (!url) return "/images/default.jpg";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const backendHost = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
  return `${backendHost}${url.startsWith("/") ? "" : "/"}${url}`;
};

export const categoryLabelMap: Record<string, string> = {
  'サイド': 'サイドメニュー',
};

export function useCustomerOrder() {
  const searchParams = useSearchParams();
  const tableParam = searchParams.get('table');
  const tokenParam = searchParams.get('token');

  const [tableNumber] = useState<number>(() => (tableParam ? parseInt(tableParam, 10) : 1));
  const [sessionToken] = useState<string>(() => tokenParam || '');
  const [sessionError, setSessionError] = useState<string | null>(() => {
    if (!tableParam || !tokenParam) {
      return "無効なQRコードです。卓上のQRコードを再度読み取ってください。";
    }
    return null;
  });

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!(tableParam && tokenParam));
  const [orderSuccess, setOrderSuccess] = useState<boolean>(false);
  const [isCartModalOpen, setIsCartModalOpen] = useState<boolean>(false);
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null);
  const [initialOptionsForModal, setInitialOptionsForModal] = useState<Option[]>([]);
  const [initialQuantityForModal, setInitialQuantityForModal] = useState<number>(1);

  const fetchMenu = useCallback(async () => {
    try {
      const res = await api.get('/menu');
      let items: MenuItem[] = [];

      if (res.data && Array.isArray(res.data.categories)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items = res.data.categories.flatMap((cat: any) => {
          const products = cat.products || cat.items || [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return products.map((prod: any) => ({
            id: prod.id,
            name: prod.name,
            category: cat.name,
            category_image_url: cat.image_url || cat.image || null,
            base_price: prod.price ?? prod.base_price ?? 0,
            sort_order: prod.sort_order ?? 0,
            is_available: !prod.is_sold_out,
            image_url: prod.image_url || prod.image || null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            option_groups: (prod.option_groups || []).map((grp: any) => ({
              id: grp.id,
              name: grp.name,
              is_required: grp.is_required ?? false,
              is_multiple_choice: grp.is_multiple_choice ?? false,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!tableParam || !tokenParam) return;
    let isMounted = true;

    api.get(`/orders/session/verify?table_number=${tableParam}&token=${tokenParam}`)
      .then(() => {
        if (isMounted) fetchMenu();
      })
      .catch((err) => {
        if (isMounted) {
          setSessionError(err.response?.data?.detail || "お会計が完了したか、無効なQRコードです。");
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [tableParam, tokenParam, fetchMenu]);

  useEffect(() => {
    if (sessionError) return;
    const intervalId = setInterval(() => { void fetchMenu(); }, 5000);
    return () => clearInterval(intervalId);
  }, [fetchMenu, sessionError]);

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
        const hasSelectedInGroup = selectedOptions.some((opt) => opt.option_group_id === group.id);
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
      setCart((prev) => prev.map((item, idx) => (idx === editingCartIndex ? updatedCartItem : item)));
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
        session_token: sessionToken,
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
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorObj = err as any;
      let errorMessage = '注文に失敗しました。もう一度お試しください。';
      if (errorObj.response?.data?.detail) {
        errorMessage = typeof errorObj.response.data.detail === 'string'
          ? errorObj.response.data.detail
          : JSON.stringify(errorObj.response.data.detail);
      } else if (errorObj.response?.data?.message) {
        errorMessage = errorObj.response.data.message;
      }
      alert(errorMessage);
    }
  };

  return {
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
  };
}