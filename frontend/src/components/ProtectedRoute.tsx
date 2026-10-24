'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAuthToken, getAuthUser, clearAuth } from '@/lib/auth';
import { LogOut } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  allowedRoles: ('admin' | 'cashier' | 'kitchen')[];
}

const emptySubscribe = () => () => {};

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  
  // マウント判定（ハイドレーションミスマッチ防止）
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const isRedirectingRef = useRef(false);

  useEffect(() => {
    if (!isMounted || isRedirectingRef.current) return;

    const token = getAuthToken();
    const currentUser = getAuthUser();

    if (!token || !currentUser) {
      isRedirectingRef.current = true;
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!allowedRoles.includes(currentUser.role)) {
      isRedirectingRef.current = true;
      alert(`この画面へのアクセス権限がありません。（必要ロール: ${allowedRoles.join(', ')} / 現在: ${currentUser.role}）`);
      router.replace('/login');
      return;
    }
  }, [isMounted, router, pathname, allowedRoles]);

  // マウント前または権限チェック中はプレースホルダーを表示
  if (!isMounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-600 font-bold">
        認証確認中...
      </div>
    );
  }

  const token = getAuthToken();
  const currentUser = getAuthUser();

  if (!token || !currentUser || !allowedRoles.includes(currentUser.role)) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-600 font-bold">
        認証確認中...
      </div>
    );
  }

  return (
    <div>
      <div className="bg-slate-900 text-white text-xs px-4 py-1.5 flex justify-between items-center z-50">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-400"></span>
          <span>ログイン中: <strong>{currentUser?.label}</strong> ({currentUser?.username})</span>
        </div>
        <button
          onClick={() => {
            clearAuth();
            router.push('/login');
          }}
          className="flex items-center gap-1 hover:text-red-400 transition"
        >
          <LogOut size={12} />
          <span>ログアウト</span>
        </button>
      </div>
      {children}
    </div>
  );
}