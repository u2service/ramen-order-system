from app.database import SessionLocal, engine, Base
from app.models import TableMaster

def seed_tables():
    # テーブルが存在しない場合は作成
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # すでにデータが存在するか確認
        existing_tables = db.query(TableMaster).all()
        if existing_tables:
            print("すでに TableMaster にデータが存在するため、スキップします。")
            return

        tables_data = [
            # カウンター席（1〜2名用）: 卓1 〜 卓4
            {"table_number": 1, "table_type": "counter", "capacity": 2},
            {"table_number": 2, "table_type": "counter", "capacity": 2},
            {"table_number": 3, "table_type": "counter", "capacity": 2},
            {"table_number": 4, "table_type": "counter", "capacity": 2},
            # テーブル席（3〜4名用）: 卓5 〜 卓8
            {"table_number": 5, "table_type": "table", "capacity": 4},
            {"table_number": 6, "table_type": "table", "capacity": 4},
            {"table_number": 7, "table_type": "table", "capacity": 4},
            {"table_number": 8, "table_type": "table", "capacity": 4},
            # 大型テーブル / 座敷（5名以上用）: 卓9 〜 卓10
            {"table_number": 9, "table_type": "large_table", "capacity": 6},
            {"table_number": 10, "table_type": "large_table", "capacity": 6},
        ]

        for data in tables_data:
            table = TableMaster(**data)
            db.add(table)

        db.commit()
        print("卓マスタ（10卓分）の初期データを正常に登録しました！")
    except Exception as e:
        db.rollback()
        print(f"エラーが発生しました: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_tables()