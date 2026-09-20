import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# docker-compose.yml で設定した環境変数を取得
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://ramen_user:ramen_pass@localhost:5432/ramen_db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# DBセッションを取得する依存関係
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()