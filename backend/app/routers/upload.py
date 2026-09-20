import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, status

router = APIRouter(prefix="/upload", tags=["upload"])

# アップロード保存先ディレクトリ
UPLOAD_DIR = "static/uploads"

# 許可する拡張子とMIMEタイプ
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}

@router.post("", response_model=dict)
async def upload_image(file: UploadFile = File(...)):
    """
    画像ファイルをアップロードし、アクセス可能なURLを返します。
    """
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

    # 3. ユニークなファイル名を生成（重複・同名上書き防止）
    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    # 4. ファイルの保存
    try:
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ファイルの保存に失敗しました: {str(e)}"
        )

    # 5. 返却用URLの構築
    # フロントエンドからアクセスできるパスを返します（例: /static/uploads/xxxx.png）
    image_url = f"/static/uploads/{filename}"

    return {
        "url": image_url,
        "filename": filename
    }