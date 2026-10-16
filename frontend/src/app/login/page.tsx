'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { saveAuth } from '@/lib/auth';
import { ShieldCheck, User, ArrowRight } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect');

  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

  // ログイン実行関数
  const handleLogin = async (targetUsername: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: targetUsername }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'ログインに失敗しました');
      }

      const data = await res.json();
      saveAuth(data.token, {
        username: data.username,
        role: data.role,
        label: data.label,
        allowed_pages: data.allowed_pages,
      });

      // 遷移先の決定（クエリ指定があればそこへ、なければ各ロールのデフォルト画面へ）
      if (redirectUrl) {
        router.push(redirectUrl);
      } else {
        const defaultPath = data.allowed_pages[0] || '/admin';
        router.push(defaultPath);
      }
    } catch (err: any) {
      setError(err.message || '通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-full bg-red-100 text-red-700 mb-3">
            <ShieldCheck size={36} />
          </div>
          <h1 className="text-2xl font-black text-gray-900">🍜 店舗システム ログイン</h1>
          <p className="text-sm text-gray-500 mt-1">
            就活確認用：ワンクリックで各権限をお試しいただけます
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-bold">
            {error}
          </div>
        )}

        {/* 1. 採用担当者向けワンクリックログインボタン */}
        <div className="space-y-3 mb-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            ▼ デモ用ワンクリックログイン
          </p>

          <button
            onClick={() => handleLogin('admin')}
            disabled={loading}
            className="w-full flex items-center justify-between p-3.5 rounded-xl border-2 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-900 font-bold transition text-left group"
          >
            <div>
              <div className="flex items-center gap-2">
                <span>👑 管理者 (店長)</span>
                <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full font-mono">admin</span>
              </div>
              <div className="text-xs text-gray-500 font-normal mt-0.5">全画面（管理・レジ・厨房）にアクセス可能</div>
            </div>
            <ArrowRight size={18} className="text-indigo-400 group-hover:translate-x-1 transition" />
          </button>

          <button
            onClick={() => handleLogin('cashier')}
            disabled={loading}
            className="w-full flex items-center justify-between p-3.5 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 text-emerald-900 font-bold transition text-left group"
          >
            <div>
              <div className="flex items-center gap-2">
                <span>💵 レジ担当</span>
                <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-mono">cashier</span>
              </div>
              <div className="text-xs text-gray-500 font-normal mt-0.5">レジ (/pos) のみアクセス可能</div>
            </div>
            <ArrowRight size={18} className="text-emerald-400 group-hover:translate-x-1 transition" />
          </button>

          <button
            onClick={() => handleLogin('kitchen')}
            disabled={loading}
            className="w-full flex items-center justify-between p-3.5 rounded-xl border-2 border-amber-200 bg-amber-50/50 hover:bg-amber-100 text-amber-900 font-bold transition text-left group"
          >
            <div>
              <div className="flex items-center gap-2">
                <span>🍳 厨房スタッフ</span>
                <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-mono">kitchen</span>
              </div>
              <div className="text-xs text-gray-500 font-normal mt-0.5">厨房 (/kds) のみアクセス可能</div>
            </div>
            <ArrowRight size={18} className="text-amber-400 group-hover:translate-x-1 transition" />
          </button>
        </div>

        {/* 2. 手動入力フォーム */}
        <div className="relative flex py-2 items-center mb-6">
          <div className="flex-grow border-t border-gray-200"></div>
          <span className="flex-shrink mx-4 text-gray-400 text-xs">または手動で入力</span>
          <div className="flex-grow border-t border-gray-200"></div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (username.trim()) handleLogin(username.trim());
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              ユーザー名
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin, cashier, kitchen"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-600 font-medium text-gray-900"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="w-full bg-red-700 hover:bg-red-800 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition shadow"
          >
            {loading ? 'ログイン中...' : 'ユーザー名でログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center">読み込み中...</div>}>
      <LoginForm />
    </Suspense>
  );
}