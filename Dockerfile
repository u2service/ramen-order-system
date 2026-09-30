FROM python:3.11-slim

WORKDIR /app

# backend配下のrequirements.txtをコピーしてインストール
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# backend配下のアプリケーションコードと静的ファイルをコピー
COPY backend/app /app/app
COPY backend/static /app/static

# Renderの環境変数PORTに対応して起動（本番なので--reloadは外します）
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
