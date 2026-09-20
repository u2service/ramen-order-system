import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import engine, Base
from app.routers import (
    menu, orders, kds, pos, 
    admin, options, inventory, 
    dashboard, upload  # ★ upload をインポートに追加
)

Base.metadata.create_all(bind=engine)

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