    # 🍜 ラーメン店向けリアルタイム注文・店舗運営管理システム

    [![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js)](https://nextjs.org/)
    [![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
    [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
    [![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker)](https://www.docker.com/)
    [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
    [![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python)](https://www.python.org/)
    [![CI](https://img.shields.io/badge/GitHub_Actions-CI-2088FF?style=flat&logo=githubactions)](https://github.com/)

    飲食店舗における「**店頭受付・セルフ注文・厨房調理・POS会計・先入れ先出し（FIFO）原価管理**」を一気通貫でDX化するフルスタックWebアプリケーションです。

    店頭端末での自動配席・QRコード発券から、厨房ディスプレイ（KDS）へのリアルタイム注文配信、POSレジでの会計、さらに仕入れロット別のFIFOに基づいた精密な原価・賞味期限管理までを一元管理します。

    ---

    ## 📌 目次
    - [システム全体像・業務フロー](#-システム全体像業務フロー)
    - [画面一覧・提供機能](#-画面一覧提供機能)
    - [技術的アピールポイント（設計と工夫）](#-技術的アピールポイント設計と工夫)
    - [使用技術スタック](#-使用技術スタック)
    - [ER図・データモデル設計](#-er図データモデル設計)
    - [ローカル環境構築・起動手順](#-ローカル環境構築起動手順)
    - [テスト・CI/CD](#-テストcicd)

    ---

    ## 🔄 システム全体像・業務フロー

    本システムは、店舗内の5つのロール・端末がリアルタイムに連携し、ホールスタッフの工数削減とデータドリブンな店舗運営を実現します。


    ┌─────────────────────────────────────────────────────────┐                                                      ┌────────────────────────────┐                                                              
    │                                                         │                                                      │                            │                                                              
    │                    Customer([来店客])                   │               売上・粗利KPI─/─レシピBOM─/─ロット管理─┤     管理画面 (/admin)      │                                                              
    │                                                         │                           │                          │                            │                                                              
    └────────────────────────────┬────────────────────────────┘                           │                          └────────────────────────────┘                                                              
                           人数入力                                                       │                                                                                                                      
                                 ▼                                                        │                                                                                                                      
    ┌─────────────────────────────────────────────────────────┐                           │                                                                                                                      
    │                                                         │                           │                                                                                                                      
    │               店頭受付発券機 (/reception)               ├──────────────────ワンタイムQRコード発券─────────────────────────────┐                                                                            
    │                                                         │                           │                                         │                                                                            
    └────────────────────────────┬────────────────────────────┘                           │                                         │                                                                            
      最適卓の自動判定 & ローテーション配席                                               │                                         │                                                                            
                                 ▼────────────────────────────────────────────────────────┘                                         ▼                                                                            
    ┌─────────────────────────────────────────────────────────┐                                                      ┌────────────────────────────┐                                                              
    │                                                         │                                                      │                            │                                                              
    │                       (PostgreSQL)                      │◄───────────────────────注文送信─&─排他在庫引当───────┤ 客席セルフオーダー (/cust) │                                                              
    │                                                         │                           │                          │                            │                                                              
    └─────────────────────────────────────────────────────────┘                           │                          └──────────────┬─────────────┘                                                              
                FIFOロット減算・原価記録                          セッションクローズ・追加注文遮断                              退店時                                                                           
                                 ▼────────────────────────────────────────────────────────┤                                         ▼                                                                            
    ┌────────────────────────────┴────────────────────────────┐                           │                          ┌────────────────────────────┐                                                              
    │                                                         │                           │                          │                            │                                                              
    │                   FastAPI バックエンド                  ├◄──────────現金─/─Stripeクレカ決済────────────────────┤    POSレジ・会計 (/pos)    │                                                              
    │                                                         │                           │                          │                            │                                                              
    └────────────────────────────┬────────────────────────────┘                           │                          └────────────────────────────┘                                                              
               SSE (Server-Sent Events) 即時通知                               調理中 ➔ 提供済                                                                                                                   
                                 ▼                                                        │                                                                                                                      
    ┌─────────────────────────────────────────────────────────┐                           │                                                                                                                      
    │                                                         │                           │                                                                                                                      
    │                 厨房ディスプレイ (/kds)                 ├───────────────────────────┘                                                                                                                      
    │                                                         │                                                                                                                                                  
    └─────────────────────────────────────────────────────────┘                                                                                                                                                  


    ---

    ## 🖥 画面一覧・提供機能

    | 画面 / ロール | URL | 主な機能 |
    | --- | --- | --- |
    | **店頭受付・発券機**<br>(Reception) | `/reception` |
    ・来店人数に応じた**最適テーブル種別の自動判定**（カウンター/テーブル/大型席）<br>・偏りを防ぐ**稼働ローテーション配席**（最終利用日時順）<br>・注文用ワンタイムQRコードの発行、満席時の案内制御 |
    | **客席セルフオーダー**<br>(Customer) | `/cust` |
    ・QRコードから引き継いだトークン認証・セッション検証<br>・カテゴリ別メニュー閲覧、麺の硬さ・味の濃さ・トッピングのカスタマイズ<br>・リアルタイム売り切れ表示、**会計完了後の追加注文自動ブロック** |
    | **厨房ディスプレイ**<br>(KDS: Kitchen) | `/kds` | ・**SSE（Server-Sent Events）**による注文の即時受信・音/視覚通知<br>・調理ステータス管理（未調理 ➔ 調理中 ➔ 提供済 ➔
    キャンセル）<br>・注文経過時間タイマー表示による提供遅延防止 |
    | **POSレジ・会計**<br>(Cashier) | `/pos` | ・卓ごとの未会計伝票管理・合算会計<br>・現金決済（お釣り計算）＆ **Stripe Elements 連携によるクレジットカード決済**<br>・値引き・割引対応、注文の個別取消 |
    | **管理ダッシュボード**<br>(Admin) | `/admin` |
    ・日別/月別の売上・原価・粗利・客単価KPIダッシュボード<br>・商品/カテゴリ/オプショングループのマスタ管理<br>・**FIFOロット別在庫管理**・賞味期限切れ廃棄ロス登録<br>・多階層**レシピ（BOM）管理**（ラーメ
    ン・サイド・セット・オプション連動） |

    ---

    ## 💡 技術的アピールポイント（設計と工夫）

    ### 1. FIFO（先入れ先出し）方式によるリアルタイム原価・在庫管理
    - **課題**: 飲食店では同一原材料でも仕入れ時期によって仕入単価が変動するため、月次平均原価では「その注文でいくらの利益が出たか」をリアルタイムに把握できない。
    - **実装**:
      - 原材料を入荷ロット単位（`InventoryLot`）で保持。注文確定時に「賞味期限が最も近いアクティブなロット」から順次必要量を消費。
      - 注文明細（`OrderItem`）に対し、その時引き当てられたロットの単価に基づき**正確な実際原価（`cost_price`）を記録**。
      - ラーメン本体だけでなく「サイドメニュー」「セットメニュー」「味玉や麺大盛りなどのオプション」に対しても正確に原材料（BOM）を消費する構造を構築。

    ### 2. トランザクション分離と行レベル排他制御（同時注文の整合性保証）
    - **課題**: 限定メニューや残数の少ない原材料に対し、複数テーブルから同時に注文が送信された際の二重引き当て（在庫のマイナスや不整合）の防止。
    - **実装**:
      - `SQLAlchemy` の `with_for_update()` を用いた **悲観的ロック（Pessimistic Locking）** を採用。
      - 在庫ロットの残数確認と減算処理を同一DBトランザクション内でアトミックに実行し、残数不足時はロールバックしてユーザーへ即時エラーを通知。

    ### 3. 店頭受付の自動配席アルゴリズム & ワンタイム卓セッション制御
    - **課題**: 席案内の属人化による特定テーブルの過度な消耗や、退店・会計後のQRコードからの不正注文・誤注文の防止。
    - **実装**:
      - 人数（1〜2名: カウンター / 3〜4名: テーブル / 5名以上: 大テーブル）に応じた最適座席を自動選択。
      - テーブルマスタに `last_used_at` を持たせ、**直近で最も使われていない空き卓から優先案内するローテーション配席アルゴリズム**を実装。
      - 暗号学的に安全な擬似乱数トークン（`secrets.token_urlsafe`）による `TableSession` を発行。POSレジで会計が完了した瞬間にセッションをクローズし、同一URLからの追加注文を確実に遮断。

    ### 4. Server-Sent Events (SSE) による軽量なリアルタイムプッシュ通信
    - **課題**: 厨房画面（KDS）において、ポーリングによるサーバー負荷や通信遅延を抑えつつ、注文発生を即座に厨房スタッフに知らせたい。
    - **実装**:
      - 双方向通信が不要な厨房表示の要件に対し、WebSocketよりオーバーヘッドが小さくHTTP/2親和性の高い **Server-Sent Events (SSE)** を採用。
      - バックエンドで `asyncio.Queue` を利用したPub/Subイベントブロードキャスターを実装し、注文登録やステータス変更を即座に接続クライアントへストリーミング配信。

    ### 5. PostgreSQL 部分インデックス（Partial Index）と N+1 問題の排除
    - **課題**: 注文履歴が増大するにつれ、アクティブな注文（未提供・未会計）を走査するKDSやPOS画面のクエリパフォーマンスが低下する懸念。
    - **実装**:
      - `status != 'paid'` や `status NOT IN ('served', 'cancelled')` に限定した **PostgreSQL 部分インデックス（Partial Index）** を設計し、インデックスサイズとスキャンコストを最小化。
      - ORM取得時に `joinedload`（1対1 / 多対1）と `selectinload`（1対多）を使い分け、注文 ➔ 明細 ➔ オプションの多段リレーションにおける **N+1クエリ問題を完全に排除**。

    ### 6. ロールベースアクセス制御 (RBAC) とJWT認証
    - **実装**:
      - 店舗運用に即し、「管理者（admin）」「レジ担当（cashier）」「厨房スタッフ（kitchen）」の3つの権限ロールを定義。
      - バックエンドでは FastAPI の Depends デコレータを用いた権限制御、フロントエンドでは Next.js コンポーネントおよびルーティング保護（`ProtectedRoute`）を実装。

    ### 7. テスト自動化と CI/CD パイプライン（品質保証）
    - **バックエンドテスト**:
      - 認証フロー、在庫引き当て、FIFO計算ロジック、異常系エラーハンドリングを `pytest` / `pytest-asyncio` で網羅。
    - **E2Eテスト**:
      - `Playwright` により、「セッショントークン発行 ➔ 卓上注文 ➔ KDS調理ステータス更新 ➔ POS現金決済」という**店舗運営のコア業務シナリオを一気通貫で自動テスト化**。
    - **GitHub Actions (CI)**:
      - Pull Request 作成時に、バックエンド（flake8・pytest）とフロントエンド（ESLint・TypeScript型チェック）の自動パイプラインが稼働し、コード品質を常時担保。

    ---

    ## 🛠 使用技術スタック

    ### フロントエンド
    - **Framework**: Next.js 15 (App Router)
    - **Language**: TypeScript 5.x
    - **Styling**: Tailwind CSS
    - **Icons**: Lucide React
    - **QR Code**: qrcode.react
    - **Payment**: Stripe Elements (`@stripe/react-stripe-js`, `@stripe/stripe-js`)
    - **Testing**: Playwright (E2Eテスト)

    ### バックエンド
    - **Framework**: FastAPI (Python 3.11+)
    - **ORM / Migration**: SQLAlchemy 2.0 / Alembic
    - **Database**: PostgreSQL 15
    - **Authentication**: PyJWT (ロールベース権限制御)
    - **Real-time / Async**: asyncio, Server-Sent Events (SSE)
    - **Testing / Lint**: Pytest, Pytest-asyncio, flake8

    ### インフラ・DevOps
    - **Container**: Docker / Docker Compose
    - **CI/CD**: GitHub Actions
    - **DB Management**: pgAdmin 4
    - **Timezone**: Asia/Tokyo (JST) 統一管理

    ---

    ## 🗄 ER図・データモデル設計


      📊 Diagram (unsupported type)                                                                                                                                                                              
      ──────────────────────────────                                                                                                                                                                             
      erDiagram
          TableMaster ||--o{ TableSession : has                                                                                                                                                                  
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

          TableMaster {
              int id PK
              int table_number UK                                                                                                                                                                                
              string table_type "counter / table / large_table"                                                                                                                                                  
              int capacity
              boolean is_active
              datetime last_used_at "ローテーション配席用"                                                                                                                                                       
          }

          TableSession {
              int id PK
              int table_number FK                                                                                                                                                                                
              string session_token UK                                                                                                                                                                            
              boolean is_active "会計完了時にfalseへ"                                                                                                                                                            
              datetime created_at                                                                                                                                                                                
              datetime closed_at
          }

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

    ## 🚀 ローカル環境構築・起動手順

    Docker Compose を利用することで、ワンコマンドで全コンテナ（フロントエンド、バックエンド、PostgreSQL、pgAdmin）が立ち上がります。

    ### 1. リポジトリのクローン
    ```bash
    git clone https://github.com/<your-username>/ramen-order-system.git
    cd ramen-order-system

  ### 2. 環境変数ファイルの設定

    cp backend/.env.example backend/.env
    # 必要に応じて Stripe APIキー 等を設定

  ### 3. Docker コンテナのビルド・起動

    docker-compose up --build -d

  ### 4. 卓マスタの初期データ投入（初回のみ）

    docker-compose exec web python -m app.seed_tables

  ### 5. 各サービスへのアクセス

  起動完了後、ブラウザから各エンドポイントにアクセス可能です。

  • 店頭受付・発券機: http://localhost:3000/reception
  • 客席セルフオーダー: http://localhost:3000/cust (発券QRコードまたは直接指定)
  • 厨房ディスプレイ (KDS): http://localhost:3000/kds
  • POSレジ・会計: http://localhost:3000/pos
  • 管理ダッシュボード: http://localhost:3000/admin
  • FastAPI Swagger ドキュメント: http://localhost:8000/docs
  • pgAdmin 4: http://localhost:5050
  ──────
  ## 🧪 テスト・CI/CD

  ### バックエンドテスト (Pytest)

    docker-compose exec web pytest

  ### E2Eテスト (Playwright)

    cd frontend
    npx playwright test

  ### CI (GitHub Actions)

  GitHub リポジトリへの Pull Request 作成時に以下が自動実行されます：

  1. Backend: Python 3.11 環境での flake8（重大構文エラーチェック）＋ pytest（インメモリSQLite）
  2. Frontend: Node.js 20 環境での npm run lint（ESLint）＋ TypeScript型検査（tsc --noEmit