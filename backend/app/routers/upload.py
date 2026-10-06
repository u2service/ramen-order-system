import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from supabase import create_client, Client
from dotenv import load_dotenv
from pathlib import Path

# .env の読み込み（ローカル用：override=False でシステム環境変数を優先）
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

router = APIRouter(prefix="/upload", tags=["upload"])

# Supabase クライアントの初期化
SUPABASE_URL = os.getenv("SUPABASE_URL")
# SUPABASE_SERVICE_KEY が取れなければ SUPABASE_KEY も見にいく（フォールバック）
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = "ROS_images"  # ← 作成したバケット名

supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"【ERROR】Supabaseクライアント作成失敗: {e}")

# 許可する拡張子とMIMEタイプ
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}

@router.post("", response_model=dict)
async def upload_image(file: UploadFile = File(...)):
    """
    画像ファイルをSupabase Storageにアップロードし、公開URLを返します。
    """
    if not supabase:
        # ★ エラーメッセージを詳細化して何が足りないか判別できるようにする
        missing = []
        if not SUPABASE_URL: missing.append("SUPABASE_URL")
        if not SUPABASE_KEY: missing.append("SUPABASE_SERVICE_KEY / SUPABASE_KEY")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase 初期化失敗。不足している値: {', '.join(missing)}"
        )

    # 1. コンテンツタイプの検証
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="許可されていないファイル形式です。JPG, PNG, WebP のみアップロード可能です。"
        )

    # 2. 拡張子の取得と検証
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="無効なファイル拡張子です。"
        )

    # 3. ユニークなファイル名を生成
    filename = f"{uuid.uuid4().hex}{ext}"

    # 4. ファイルを読み込んでSupabase Storageにアップロード
    try:
        contents = await file.read()

        supabase.storage.from_(SUPABASE_BUCKET).upload(
            path=filename,
            file=contents,
            file_options={"content-type": file.content_type}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase へのアップロードに失敗しました: {str(e)}"
        )

    # 5. 公開URLを取得して返却
    public_url = supabase.storage.from_(SUPABASE_BUCKET).get_public_url(filename)

    return {
        "url": public_url,
        "filename": filename
    }