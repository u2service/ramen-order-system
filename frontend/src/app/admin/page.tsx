"use client";

import { useEffect, useState } from "react";
import Link from "next/link"; // Linkコンポーネントをインポート

type DashboardSummary = {
  today_sales: number;
  today_gross_profit: number; // ★ 粗利を追加
  today_orders: number;
  stock_alerts: number;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary>({
    today_sales: 0,
    today_gross_profit: 0, // ★ 初期値を追加
    today_orders: 0,
    stock_alerts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardSummary = async () => {
      try {
        // FastAPIのエンドポイントを呼び出し
        const res = await fetch(`${API_BASE_URL}/dashboard/summary`);
        if (res.ok) {
          const data = await res.json();
          setSummary(data);
        }
      } catch (error) {
        console.error("ダッシュボードデータの取得に失敗しました", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardSummary();
  }, []);

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: "bold", marginBottom: "1.5rem" }}>
        📊 ダッシュボード
      </h1>
      
      {/* 概要カード（4列に変更） */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
        {/* 本日の売上 -> 注文確認画面へ */}
        <Link href="/admin/orders" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ background: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "pointer" }}>
            <div style={{ fontSize: "0.875rem", color: "#64748b" }}>本日の売上</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#0f172a", marginTop: "0.5rem" }}>
              ¥{loading ? "---" : summary.today_sales.toLocaleString()}
            </div>
          </div>
        </Link>

        {/* 本日の粗利 -> 注文確認画面へ ★追加 */}
        <Link href="/admin/orders" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ background: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "pointer" }}>
            <div style={{ fontSize: "0.875rem", color: "#64748b" }}>本日の粗利</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#10b981", marginTop: "0.5rem" }}>
              ¥{loading ? "---" : summary.today_gross_profit.toLocaleString()}
            </div>
          </div>
        </Link>

        {/* 注文数 -> 注文確認画面へ */}
        <Link href="/admin/orders" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ background: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "pointer" }}>
            <div style={{ fontSize: "0.875rem", color: "#64748b" }}>注文数</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#0f172a", marginTop: "0.5rem" }}>
              {loading ? "---" : summary.today_orders} 件
            </div>
          </div>
        </Link>

        {/* 在庫アラート -> 在庫品目マスタへ */}
        <Link href="/admin/inventory/items" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ background: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "pointer" }}>
            <div style={{ fontSize: "0.875rem", color: "#64748b" }}>在庫アラート</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#ef4444", marginTop: "0.5rem" }}>
              {loading ? "---" : summary.stock_alerts} 件
            </div>
          </div>
        </Link>
      </div>

      <div style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
        <p style={{ color: "#64748b" }}>
          左側のサイドバーメニューから各種管理機能（カテゴリ設定、商品登録など）を選択してください。
        </p>
      </div>
    </div>
  );
}