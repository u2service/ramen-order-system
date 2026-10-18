'use client';

export interface AuthUser {
  username: string;
  role: 'admin' | 'cashier' | 'kitchen';
  label: string;
  allowed_pages: string[];
}

const TOKEN_KEY = 'ramen_auth_token';
const USER_KEY = 'ramen_auth_user';

export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const getAuthUser = (): AuthUser | null => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const saveAuth = (token: string, user: AuthUser) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

// ★ ブラウザの fetch を拡張し、APIリクエスト時に自動で Bearer トークンを付与
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const token = getAuthToken();
    if (token) {
      const headers = new Headers(init.headers || {});
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      init.headers = headers;
    }
    const response = await originalFetch(input, init);

    // ★ 401 (認証切れ) を検知した場合、古いセッションをクリアしてログイン画面へリダイレクト
    if (response.status === 401 && !window.location.pathname.startsWith('/login')) {
      clearAuth();
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
    }

    return response;
  };
}