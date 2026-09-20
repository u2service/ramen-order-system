"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // サイドバーのメニュー構成
  const navGroups = [
    {
      title: "📊 メイン",
      items: [
        { name: "ダッシュボード", href: "/admin" },
      ],
    },
    {
      title: "🍜 メニュー管理",
      items: [
        { name: "カテゴリ設定", href: "/admin/categories" },
        { name: "商品登録・編集", href: "/admin/products" },
        { name: "オプション管理", href: "/admin/options" },
      ],
    },
    {
      title: "📦 在庫・仕入管理",
      items: [
        { name: "在庫品目マスタ", href: "/admin/inventory/items" },
        { name: "入荷ロット登録", href: "/admin/inventory/lots" },
        { name: "レシピ設定", href: "/admin/inventory/recipes" },
      ],
    },
    {
      title: "🧾 注文・履歴",
      items: [
        { name: "注文履歴確認", href: "/admin/orders" },
      ],
    },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      {/* --- 左側：サイドバー --- */}
      <aside
        style={{
          width: "240px",
          backgroundColor: "#1e293b",
          color: "#f8fafc",
          padding: "1.5rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: "1.2rem", fontWeight: "bold", paddingLeft: "0.5rem", color: "#38bdf8" }}>
          店舗管理システム
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {navGroups.map((group, idx) => (
            <div key={idx}>
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: "bold",
                  color: "#94a3b8",
                  marginBottom: "0.5rem",
                  paddingLeft: "0.5rem",
                }}
              >
                {group.title}
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        style={{
                          display: "block",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "6px",
                          fontSize: "0.875rem",
                          color: isActive ? "#ffffff" : "#cbd5e1",
                          backgroundColor: isActive ? "#0284c7" : "transparent",
                          textDecoration: "none",
                          fontWeight: isActive ? "bold" : "normal",
                          marginBottom: "0.25rem",
                          transition: "background-color 0.15s ease",
                        }}
                      >
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* --- 右側：メインコンテンツエリア --- */}
      <main style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}