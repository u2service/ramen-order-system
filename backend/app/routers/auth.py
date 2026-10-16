from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Dict, Any, List
from app.auth import SYSTEM_ACCOUNTS, generate_user_token, get_current_account

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    username: str

class LoginResponse(BaseModel):
    token: str
    username: str
    role: str
    label: str
    allowed_pages: List[str]

@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest):
    """ユーザー名のみでログイン（採用担当者が即テスト可能）"""
    username = req.username.strip().lower()
    if username not in SYSTEM_ACCOUNTS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ユーザー '{req.username}' は登録されていません。(利用可能: admin, cashier, kitchen)"
        )

    account = SYSTEM_ACCOUNTS[username]
    token = generate_user_token(account["username"], account["role"])

    return LoginResponse(
        token=token,
        username=account["username"],
        role=account["role"],
        label=account["label"],
        allowed_pages=account["allowed_pages"]
    )

@router.get("/me", response_model=LoginResponse)
def get_me(account: Dict[str, Any] = Depends(get_current_account)):
    """現在ログイン中のセッション確認用"""
    token = generate_user_token(account["username"], account["role"])
    return LoginResponse(
        token=token,
        username=account["username"],
        role=account["role"],
        label=account["label"],
        allowed_pages=account["allowed_pages"]
    )