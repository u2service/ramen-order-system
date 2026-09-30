import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import engine, Base
from app.routers import (
    menu, orders, kds, pos, 
    admin, options, inventory, 
    dashboard, upload
)

from dotenv import load_dotenv
from supabase import create_client, Client

# app/main.py から見たルート（backend/）直下の .env を明示的に指定
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# デバッグ用：読み込めているキーの確認（ターミナルに出力されます）
if SUPABASE_KEY:
    print(f"✅ 読めてるよLoaded SUPABASE_SERVICE_KEY: {SUPABASE_KEY[:10]}...")
else:
    print("❌ 違う！！SUPABASE_SERVICE_KEY is NOT set!")

# Supabase SDKクライアントの初期化（※Storageや認証を直接操作する場合用）
supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="ラーメン店注文・在庫管理API")

# ★ 静的ファイル（画像アップロード用）ディレクトリの設定
UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ★ /static/uploads 配下のファイルをブラウザから参照可能にする設定
app.mount("/static/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# CORS設定の強化
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# 各ルーターの読み込み (SQLAlchemy経由でSupabaseにアクセス)
app.include_router(menu.router, prefix="/api/v1")
app.include_router(orders.router, prefix="/api/v1")
app.include_router(kds.router, prefix="/api/v1")
app.include_router(pos.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(options.router, prefix="/api/v1")
app.include_router(inventory.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(upload.router, prefix="/api/v1")  # ★ 画像アップロードAPIを追加

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Ramen Backend Service is Running"}

# --- テスト用エンドポイント（必要に応じて利用） ---
# @app.get("/users")
# def get_users():
#     if not supabase:

#         raise HTTPException(status_code=500, detail="Supabase client is not initialized.")
#     try:

#         response = supabase.table("categories").select("*").execute()
#         return response.data
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
