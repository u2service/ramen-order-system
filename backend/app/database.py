import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# main.py と同じくプロジェクトルートの .env を明示的に指定
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# docker-compose.yml で設定した環境変数を取得
DATABASE_URL = os.getenv("DATABASE_URL")

# 万が一取得できない場合のガード（任意）
if not DATABASE_URL:
    raise ValueError("DATABASE_URL が設定されていません。.env ファイルを確認してください。")

# --- 追加: postgresql:// で始まっている場合は psycopg2 を明示的に指定 ---
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
# ------------------------------------------------------------------

print(f"🔗 [DEBUG] デバッグ　データベースに接続Connecting to Database: {DATABASE_URL}")

# SQLAlchemy Engine の作成
# 接続切断対策として pool_pre_ping=True を追加
# （Direct connection / Session pooler を使用する場合に推奨）
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # 接続が無効（タイムアウト）になっていないか事前に確認する設定
    pool_recycle=300     # 5分ごとに接続を再作成する設定
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# DBセッションを取得する依存関係
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()