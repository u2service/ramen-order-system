import os
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from pathlib import Path

# main.py と同じくプロジェクトルートの .env を明示的に指定
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

JWT_SECRET = os.getenv("JWT_SECRET_KEY", "ramen-order-secret-key-3891")
JWT_ALGORITHM = "HS256"
EXPIRE_HOURS = 24

# 今回のデモ用アカウント（ユーザー名のみでログイン可能）
SYSTEM_ACCOUNTS: Dict[str, Dict[str, Any]] = {
    "admin": {
        "username": "admin",
        "role": "admin",
        "label": "管理者 (店長)",
        "allowed_pages": ["/admin", "/pos", "/kds"]
    },
    "cashier": {
        "username": "cashier",
        "role": "cashier",
        "label": "レジ担当",
        "allowed_pages": ["/pos"]
    },
    "kitchen": {
        "username": "kitchen",
        "role": "kitchen",
        "label": "厨房スタッフ",
        "allowed_pages": ["/kds"]
    }
}

bearer_scheme = HTTPBearer(auto_error=True)

def generate_user_token(username: str, role: str) -> str:
    """JWTトークンを発行"""
    expire = datetime.now(timezone.utc) + timedelta(hours=EXPIRE_HOURS)
    payload = {
        "sub": username,
        "role": role,
        "exp": expire
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_current_account(
    cred: HTTPAuthorizationCredentials = Depends(bearer_scheme)
) -> Dict[str, Any]:
    """トークンを検証してユーザー情報を取得"""
    token = cred.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username: Optional[str] = payload.get("sub")
        if not username or username not in SYSTEM_ACCOUNTS:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="ユーザーが見つかりません。"
            )
        return SYSTEM_ACCOUNTS[username]
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="認証トークンが無効または期限切れです。"
        )

def require_roles(allowed_roles: List[str]):
    """ロール（権限）を制限する依存性注入ガード"""
    def role_checker(account: Dict[str, Any] = Depends(get_current_account)) -> Dict[str, Any]:
        if account["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"この操作には権限が必要です（許可ロール: {', '.join(allowed_roles)}）"
            )
        return account
    return role_checker