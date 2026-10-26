import os
from pathlib import Path
from dotenv import load_dotenv
import secrets
from datetime import datetime
import zoneinfo

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models import TableMaster, TableSession
from app.schemas import IssueTokenRequestSchema, IssueTokenResponseSchema

router = APIRouter(
    prefix="/reception",
    tags=["Reception"]
)

# main.py と同じくプロジェクトルートの .env を明示的に指定
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# docker-compose.yml で設定した環境変数を取得
DATABASE_URL = os.getenv("DATABASE_URL")

# 万が一取得できない場合のガード（任意）
if not DATABASE_URL:
    raise ValueError("DATABASE_URL が設定されていません。.env ファイルを確認してください。")

def get_jst_now():
    return datetime.now(zoneinfo.ZoneInfo("Asia/Tokyo"))

@router.post("/issue-token", response_model=IssueTokenResponseSchema, status_code=status.HTTP_201_CREATED)
def issue_token(
    request: IssueTokenRequestSchema,
    db: Session = Depends(get_db)  # Session (同期) に変更
):
    # guest_count または party_size のどちらか入っている方を取得（デフォルト1名）
    guest_count = request.guest_count or request.party_size or 1

    # 1. 人数に応じた優先 table_type の決定
    if guest_count <= 2:
        preferred_types = ['counter', 'table']
    elif guest_count <= 4:
        preferred_types = ['table', 'large_table']
    else:
        preferred_types = ['large_table']

    assigned_table = None

    # 2. 優先タイプごとに空き卓を検索（ローテーション適用：last_used_at が古い順）
    for t_type in preferred_types:
        # 現在アクティブなセッションが存在する卓番号サブクエリ
        active_tables_subquery = (
            select(TableSession.table_number)
            .where(TableSession.is_active == True)
            .scalar_subquery()
        )

        assigned_table = (
            db.query(TableMaster)
            .filter(
                TableMaster.table_type == t_type,
                TableMaster.is_active == True,
                TableMaster.table_number.not_in(active_tables_subquery)
            )
            .order_by(TableMaster.last_used_at.asc().nulls_first())
            .first()
        )

        if assigned_table:
            break

    # 3. 卓が見つからなかった場合（満席）
    if not assigned_table:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,  # 満席時は 409 を返す
            detail="申し訳ございません。現在ご案内できるお席が満席です。"
        )

    # 4. 割り当て確定処理
    now = get_jst_now()
    assigned_table.last_used_at = now
    new_token = secrets.token_urlsafe(32)

    new_session = TableSession(
        table_number=assigned_table.table_number,
        session_token=new_token,
        is_active=True,
        created_at=now
    )

    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    # 5. フロントエンド注文画面（/cust）のURLを組み立て
    frontend_url = os.getenv("DATABASE_URL", "http://localhost:3000")
    order_url = f"{frontend_url}/cust?table={assigned_table.table_number}&token={new_token}"

    return {
        "table_number": assigned_table.table_number,
        "session_token": new_token,
        "order_url": order_url,
        "message": f"卓 {assigned_table.table_number} を割り当てました。"
    }