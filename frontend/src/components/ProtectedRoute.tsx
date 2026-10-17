'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAuthToken, getAuthUser, clearAuth } from '@/lib/auth';
import { LogOut, ShieldAlert } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  allowedRoles: ('admin' | 'cashier' | 'kitchen')[];
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState<boolean>(false);
  const user = getAuthUser();

  //  多重実行防止用の ref フラグを用意
  const isRedirectingRef = useRef(false);

  useEffect(() => {
      // すでにリダイレクト処理中なら何もしない
    if (isRedirectingRef.current) return;

    const token = getAuthToken();
    const currentUser = getAuthUser();

    if (!token || !currentUser) {
      isRedirectingRef.current = true;
      // 未ログインならログイン画面へ
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!allowedRoles.includes(currentUser.role)) {
      // 3. アラートを出す前にフラグを true にして多重実行をブロック
      isRedirectingRef.current = true;
      alert(`この画面へのアクセス権限がありません。（必要ロール: ${allowedRoles.join(', ')} / 現在: ${currentUser.role}）`);
      router.replace('/login');
      return;
    }

    setAuthorized(true);
  }, [router, pathname, allowedRoles]);

  if (!authorized) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-600 font-bold">
        認証確認中...
      </div>
    );
  }

  // 画面上部にログイン状態とログアウトボタンを表示するバナー
  return (
    <div>
      <div className="bg-slate-900 text-white text-xs px-4 py-1.5 flex justify-between items-center z-50">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-400"></span>
          <span>ログイン中: <strong>{user?.label}</strong> ({user?.username})</span>
        </div>
        <button
          onClick={() => {
            clearAuth();
            router.push('/login');
          }}
          className="flex items-center gap-1 bg-slate-800 hover:bg-red-700 px-2.5 py-1 rounded text-white transition"
        >
          <LogOut size={12} />
          <span>ログアウト</span>
        </button>
      </div>
      {children}
    </div>
  );
}