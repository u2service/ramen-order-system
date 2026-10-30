'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Users, CheckCircle2, RefreshCw, AlertCircle, ArrowLeft, ExternalLink } from 'lucide-react';

// FastAPI /issue-token APIのレスポンス型
interface IssueTokenResponse {
  table_number: number;
  session_token: string;
  order_url: string;
}

const AUTO_RESET_SECONDS = 30; // 発券画面の自動リセット秒数

export default function ReceptionPage() {
  const [partySize, setPartySize] = useState<number | null>(null);
  const [issuedData, setIssuedData] = useState<IssueTokenResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(AUTO_RESET_SECONDS);

  // 画面リセット処理
  const handleReset = useCallback(() => {
    setPartySize(null);
    setIssuedData(null);
    setErrorMsg(null);
    setCountdown(AUTO_RESET_SECONDS);
  }, []);

  // 画面2（発券完了時）の自動カウントダウン＆リセットタイマー
  useEffect(() => {
    if (!issuedData) return;

    setCountdown(AUTO_RESET_SECONDS);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleReset();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [issuedData, handleReset]);

  // トークン発行 API 呼び出し
  const handleIssueToken = async () => {
    if (!partySize) return;

    setLoading(true);
    setErrorMsg(null);

    // 💡 Renderの起動遅延（最大1分程度）を考慮して、タイムアウトを90秒に設定
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      const res = await fetch(`${apiBaseUrl}/api/v1/reception/issue-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ guest_count: partySize }),
        signal: controller.signal, // タイムアウト制御を紐付け
      });

      clearTimeout(timeoutId); // 応答が返ったらタイマーをクリア

      if (!res.ok) {
        if (res.status === 409 || res.status === 404) {
          throw new Error('ただいま満席のため、すぐにご案内できるお席がございません。スタッフにお申し付けください。');
        }
        throw new Error('発券処理に失敗しました。もう一度お試しください。');
      }

      const data: IssueTokenResponse = await res.json();
      setIssuedData(data);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setErrorMsg('サーバーの起動に時間がかかっています。もう一度「決定（発券する）」ボタンを押してください。');
        } else {
          setErrorMsg(err.message);
        }
      } else {
        setErrorMsg('予期せぬエラーが発生しました。');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-8 select-none font-sans">
      {/* ヘッダーバー */}
      <header className="w-full max-w-4xl mx-auto flex justify-between items-center py-4 border-b border-slate-700">
        <h1 className="text-2xl font-black tracking-wider text-amber-500 flex items-center gap-2">
          <span>🍜</span> ラーメン夢屋
        </h1>
        <span className="text-sm px-3 py-1 bg-slate-800 text-slate-300 rounded-full border border-slate-700 font-medium">
          受付システム
        </span>
      </header>

      {/* メインコンテンツエリア */}
      <main className="flex-1 flex items-center justify-center py-6">
        <div className="w-full max-w-xl">
          {issuedData ? (
            /* 📱 画面2：QRコード・URL表示画面 */
            <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-emerald-400 font-bold bg-emerald-950/60 px-4 py-1.5 rounded-full border border-emerald-800 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  お席が決まりました
                </div>
                <div className="text-4xl sm:text-5xl font-black text-amber-400 tracking-tight pt-2">
                  卓番号： 卓 {issuedData.table_number}
                </div>
                <p className="text-slate-300 text-sm sm:text-base">
                  お手元のスマートフォンで下のQRコードを読み取り、<br className="hidden sm:inline" />
                  ご注文画面へお進みください。
                </p>
              </div>

              {/* QRコード表示エリア */}
              <div className="bg-white p-6 rounded-2xl inline-block shadow-inner">
                <QRCodeSVG
                  value={issuedData.order_url}
                  size={220}
                  level="H"
                  includeMargin={false}
                />
              </div>

              {/* テスト用URL表示領域 */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-700/80 text-left space-y-1 text-xs">
                <div className="flex justify-between items-center text-slate-400 font-semibold">
                  <span>【開発・テスト用URL】</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
                <a
                  href={issuedData.order_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 underline break-all font-mono hover:text-amber-300 transition-colors block"
                >
                  {issuedData.order_url}
                </a>
              </div>

              {/* タイムアウト案内 */}
              <div className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
                <span>
                  <strong className="text-amber-400">{countdown} 秒</strong> 操作がない場合、自動で初期画面に戻ります
                </span>
              </div>

              {/* 受付画面へ戻るボタン */}
              <button
                onClick={handleReset}
                className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-lg rounded-2xl transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                受付画面に戻る
              </button>
            </div>
          ) : (
            /* 📱 画面1：人数選択画面 */
            <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-bold text-slate-100">ご来店ありがとうございます！</h2>
                <p className="text-slate-400 text-sm">ご来店人数を選んで「決定」を押してください</p>
              </div>

              {/* エラーアラート表示 */}
              {errorMsg && (
                <div className="bg-rose-950/80 border border-rose-800 text-rose-200 p-4 rounded-2xl flex items-start gap-3 text-sm animate-in fade-in">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">{errorMsg}</div>
                </div>
              )}

              {/* 人数選択グリッド */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map((num) => {
                  const isSelected = partySize === num;
                  const label = num === 6 ? '6名〜' : `${num}名`;

                  return (
                    <button
                      key={num}
                      onClick={() => {
                        setPartySize(num);
                        setErrorMsg(null);
                      }}
                      className={`py-5 text-2xl font-black rounded-2xl border-2 transition-all flex items-center justify-center gap-2 shadow-sm ${
                        isSelected
                          ? 'bg-amber-500 border-amber-400 text-slate-950 scale-[1.02] ring-4 ring-amber-500/20'
                          : 'bg-slate-900/60 border-slate-700 text-slate-200 hover:border-slate-500 hover:bg-slate-700/50'
                      }`}
                    >
                      <Users className={`w-5 h-5 ${isSelected ? 'text-slate-950' : 'text-slate-400'}`} />
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* 選択中の人数ステータス */}
              <div className="h-10 flex items-center justify-center bg-slate-950/50 rounded-xl border border-slate-800">
                {partySize ? (
                  <span className="text-amber-400 font-bold text-lg">
                    選択中: 【 {partySize === 6 ? '6名〜' : `${partySize}名`} 】
                  </span>
                ) : (
                  <span className="text-slate-500 text-sm font-medium">人数ボタンを選択してください</span>
                )}
              </div>

              {/* 下部アクションボタン */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <button
                  onClick={() => setPartySize(null)}
                  disabled={!partySize || loading}
                  className="py-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:hover:bg-slate-700 text-slate-200 font-bold text-lg rounded-2xl transition-all"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleIssueToken}
                  disabled={!partySize || loading}
                  className="py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-slate-950 font-black text-lg rounded-2xl transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span className="text-sm">
                        サーバー起動中（初回1分ほどかかります）...
                      </span>
                    </>
                  ) : (
                    '決定（発券する）'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* フッター */}
      <footer className="w-full max-w-4xl mx-auto text-center py-2 text-xs text-slate-500">
        &copy; {new Date().getFullYear()} ラーメン夢屋 Order System. All rights reserved.
      </footer>
    </div>
  );
}
