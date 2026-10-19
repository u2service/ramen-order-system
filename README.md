#  ラーメン店向けリアルタイム注文・店舗運営管理システム  
  
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js)](https://nextjs.org/)
    [![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
    [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
    [![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker)](https://www.docker.com/)
    [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
    [![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python)](https://www.python.org/)

    飲食店舗における「注文・調理・会計・在庫原価管理」を一気通貫でDX化するフルスタックWebアプリケーションです。

  客席タブレットからの注文受付から厨房ディスプレイ（KDS）へのリアルタイム配信、POSレジでの会計処理、さらに仕入れロット別のFIFO（先入れ先出し）に基づいた精
  密な原価・賞味期限管理までを一元管理します。

---

##  目次
- [システム概要・機能一覧](#-システム概要機能一覧)
- [システムアーキテクチャ](#-システムアーキテクチャ)
- [就活・技術的アピールポイント（設計と工夫）](#-技術的アピールポイント設計と工夫)
- [使用技術スタック](#-使用技術スタック)
- [ER図・データモデル設計](#-er図データモデル設計)
- [ローカル環境構築・起動手順](#-ローカル環境構築起動手順)
- [テスト実行方法](#-テスト実行方法)

---

##  システム概要・機能一覧

    本システムは、店舗内の4つの役割（アクター）に応じた画面とワークフローを提供します。


[客席: CUST] ──(注文送信)──> [バックエンド API] ──(SSE配信)──> [厨房: KDS]  
　　　│　　　　　　　　　　　　　　　　  │  
(在庫/原価計算) 　　　　　　　　　　　(調理完了)  
　　　│　　　　　　　　　　　　　　　　│  
[本部/店長: ADMIN] <─────── (売上・在庫反映) <─────── [レジ: POS]  


| 画面 / ロール | URL | 主な機能 |
| --- | --- | --- |
| **客席セルフオーダー**<br>(Customer) | `/cust` |・カテゴリ別メニュー閲覧・注文カート<br>・トッピング・セット・お好み（麺の硬さ・味の濃さ等）の複数/単一選択<br>・リアルタイム売り切れ表示 |  
| **厨房ディスプレイ**<br>(KDS: Kitchen) | `/kds` | ・SSE（Server-Sent Events）による注文の即時受信<br>・調理ステータス管理（未調理 ➔ 調理中 ➔ 提供済 ➔ キャンセル）<br>・経過時間表示による提供遅延防止 |  
| **POSレジ・会計**<br>(Cashier) | `/pos` |・テーブルごとの注文合算・未会計伝票管理<br>・値引き・割引対応、注文商品の個別取消<br>・現金決済（お釣り計算）＆ Stripe連携によるクレジットカード決済 |  
| **管理ダッシュボード**<br>(Admin) | `/admin` |・日別/月別の売上・原価・粗利・客単価KPIダッシュボード<br>・メニュー・カテゴリ・オプショングループのマスタ管理<br>・**FIFO（先入れ先出し）ロット別在庫管理**・廃棄ロス登録<br>・商品/オプションと原材料の紐付け（レシピ/BOM管理） |  

---

##  技術的アピールポイント（設計と工夫）

### 1. FIFO（先入れ先出し）方式によるリアルタイム原価・在庫管理
- **課題**: 飲食店では同一原材料でも仕入れ時期や仕入れ値が変動するため、単純な平均原価では正確な粗利を追跡できない。
- **実装**:
    - 原材料を入荷ロット単位（`InventoryLot`）で管理し、注文が入った瞬間に「賞味期限が最も近いアクティブなロット」から順次必要量を減算。
    - 注文明細（`OrderItem`）に対して、その時消費されたロットの単価に基づき**正確な実際原価（`cost_price`）を記録**。
    - レシピマスタ構造（商品 ➔ 原材料、トッピング ➔
  原材料）を持たせ、ラーメン本体だけでなく「麺増量」「味玉追加」といったオプションに対しても正確に在庫減算と原価反映を実現。

### 2. トランザクションと排他制御（同時注文時の競合防止）
- **課題**:
  限定ラーメンや残り少ない原材料に対して、複数テーブルから同時に注文が送信された場合の二重引き当て（在庫のマイナスや不整合）を防ぐ必要がある。
- **実装**:
    - `SQLAlchemy` の `with_for_update()` を用いた **行レベルの排他ロック（Pessimistic Locking）** を採用。
    - 商品および在庫ロットの引き当て処理を1つのDBトランザクション内でアトミックに実行し、在庫不足時は安全にロールバック。

### 3. Server-Sent Events (SSE) による軽量なリアルタイム通信
- **課題**: 厨房画面（KDS）において、ポーリングによるサーバー負荷や通信遅延を抑えつつ、注文を即座に厨房スタッフに知らせたい。
- **実装**:
    - 双方向通信が不要なユースケースであるため、WebSocketよりもオーバーヘッドが小さくHTTP/2親和性の高い **Server-Sent Events (SSE)** を採用。
    - `asyncio.Queue` を利用したPub/Subイベントブロードキャスターを構築し、注文発生・調理状態変更時に瞬時に接続クライアントへ通知。

### 4. PostgreSQL 部分インデックス（Partial Index）と N+1 問題の排除
- **課題**: 注文履歴が増大するにつれ、アクティブな注文（未提供・未会計）を頻繁に走査するKDSやPOS画面のクエリパフォーマンスが劣化する懸念。
- **実装**:
    - `status != 'paid'` や `status NOT IN ('served', 'cancelled')` に限定した **部分インデックス（Partial Index）** を設計し、検索対象レコード数を最小化。
    - ORM取得時に `joinedload` / `selectinload` を適切に使い分け、注文 ➔ 明細 ➔ オプションの多段リレーションにおける **N+1クエリ問題を撲滅** 。

### 5. ロールベースアクセス制御 (RBAC) とJWT認証
- **実装**:
    - 店舗運用を想定し、「管理者（admin）」「レジ担当（cashier）」「厨房スタッフ（kitchen）」の権限を分離。
    - バックエンドでは FastAPI の Depends デコレータを用いたカスタム権限制御、フロントエンドでは Next.js コンポーネントおよびルーティング保護を実装。

### 6. テスト駆動と品質保証（Pytest & Playwright E2E）
- **バックエンドテスト**:
    - 在庫引き当てフロー、例外処理、FIFO計算ロジックを `pytest` / `pytest-asyncio` で単体・統合テスト網羅。- **E2Eテスト** :
    - `Playwright` により、「客席からの注文 ➔ 厨房画面での即時反映・ステータス更新 ➔ POSレジでの決済完了」という **店舗運営のコア業務シナリオを自動テスト化** 。

---

##  使用技術スタック

### フロントエンド
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Payment**: Stripe Elements (`@stripe/react-stripe-js`, `@stripe/stripe-js`)
- **Testing**: Playwright (E2Eテスト)

### バックエンド
- **Framework**: FastAPI (Python 3.11+)
- **ORM / Migration**: SQLAlchemy 2.0 / Alembic
- **Database**: PostgreSQL 15
- **Authentication**: PyJWT (ロールベース権限制御)
- **Asynchronous / Streaming**: asyncio, Server-Sent Events (SSE)
- **Testing**: Pytest, Pytest-asyncio

### インフラ・開発環境
- **Container**: Docker / Docker Compose
- **DB Tool**: pgAdmin 4
- **Date/Time**: Asia/Tokyo (JST) 統一管理

---

##  ER図・データモデル概要

主要なテーブル構造：


       Diagram (unsupported type)                                                                                                                          
      ──────────────────────────────                                                                                                                         
      erDiagram
          Category ||--o{ Product : contains                                                                                                                 
          Product ||--o{ ProductOptionGroup : has                                                                                                            
          OptionGroup ||--o{ ProductOptionGroup : belongs                                                                                                    
          OptionGroup ||--o{ Option : contains                                                                                                               
          Product ||--o{ ProductInventoryItem : recipe                                                                                                       
          Option ||--o{ OptionInventoryItem : recipe                                                                                                         
          InventoryItem ||--o{ ProductInventoryItem : consumed_by                                                                                            
          InventoryItem ||--o{ OptionInventoryItem : consumed_by                                                                                             
          InventoryItem ||--o{ InventoryLot : lots                                                                                                           

          Order ||--o{ OrderItem : details                                                                                                                   
          Product ||--o{ OrderItem : ordered_as                                                                                                              
          OrderItem ||--o{ OrderItemOption : has_options                                                                                                     
          Option ||--o{ OrderItemOption : chosen                                                                                                             

          Order {
              int id PK
              int table_number
              string status "pending / served / paid"                                                                                                        
              int total_price
              string payment_method                                                                                                                          
              datetime created_at                                                                                                                            
              datetime paid_at
          }

          InventoryLot {
              int id PK
              int inventory_item_id FK                                                                                                                       
              date expiration_date                                                                                                                           
              decimal current_quantity                                                                                                                       
              decimal unit_cost
              string status "active / expired / empty"                                                                                                       
          }


---

##  ローカル環境構築・起動手順

Docker Compose を利用することで、ワンコマンドで全環境（フロントエンド、バックエンド、DB、pgAdmin）が立ち上がります。

### 1. リポジトリのクローン
```bash
git clone https://github.com/<your-username>/ramen-order-system.git
cd ramen-order-system
```

### 2. 環境変数ファイルの設定

    # バックエンド環境変数の準備
    cp backend/.env.example backend/.env
    # 必要に応じて Stripe APIキー 等を設定

### 3. Docker コンテナのビルド・起動

    docker-compose up --build -d

### 4. 各サービスへのアクセス

  起動完了後、ブラウザから各エンドポイントにアクセス可能です。

* 客席セルフオーダー: http://localhost:3000/cust
* 厨房ディスプレイ (KDS): http://localhost:3000/kds
* POSレジ: http://localhost:3000/pos
* 管理画面: http://localhost:3000/admin
* FastAPI Swagger ドキュメント: http://localhost:8000/docs
* pgAdmin: http://localhost:5050  
──────
##  テストの実行

### バックエンドテスト (Pytest)

    docker-compose exec web pytest

### E2Eテスト (Playwright)

    cd frontend
    npx playwright test