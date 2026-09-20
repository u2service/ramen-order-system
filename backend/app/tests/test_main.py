import pytest
from fastapi.testclient import TestClient
# from main import app, UPLOAD_DIR
from app.main import app, UPLOAD_DIR
import os

client = TestClient(app)

# 1. ルートエンドポイントの導通確認
def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "message": "Ramen Backend Service is Running"}

# 2. 静的ファイル用ディレクトリが生成されているか確認
def test_upload_directory_exists():
    assert os.path.exists(UPLOAD_DIR)

# 3. CORSヘッダーの動作確認
def test_cors_preflight():
    response = client.options(
        "/api/v1/menu",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") in ["http://localhost:3000", "*"]