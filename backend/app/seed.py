from app.database import SessionLocal, engine, Base
from app.models import Category, Product, OptionGroup, Option, ProductOptionGroup

# テーブル作成
Base.metadata.create_all(bind=engine)
db = SessionLocal()

print("既存データを削除中...")
# トランザクション・外部キー順にクリア
db.query(ProductOptionGroup).delete()
db.query(Option).delete()
db.query(OptionGroup).delete()
db.query(Product).delete()
db.query(Category).delete()
db.commit()

print("初期データを投入します...")

# 1. カテゴリ作成
cat_ramen = Category(name="ラーメン", sort_order=1)
cat_side = Category(name="サイド", sort_order=2)
db.add_all([cat_ramen, cat_side])
db.commit()

# 2. オプショングループ作成
grp_topping = OptionGroup(name="トッピング", is_required=False, is_multiple_choice=True)
grp_noodle = OptionGroup(name="麺のかたさ", is_required=True, is_multiple_choice=False)
db.add_all([grp_topping, grp_noodle])
db.commit()

# 3. オプション選択肢作成
opt_ajitama = Option(name="味玉", price=100, option_group_id=grp_topping.id)
opt_chashu = Option(name="チャーシュー増し", price=200, option_group_id=grp_topping.id)
opt_katame = Option(name="麺かため", price=0, option_group_id=grp_noodle.id)
opt_futsu = Option(name="麺ふつう", price=0, option_group_id=grp_noodle.id)
db.add_all([opt_ajitama, opt_chashu, opt_katame, opt_futsu])
db.commit()

# 4. 商品作成
p1 = Product(name="豚骨ラーメン", price=800, category_id=cat_ramen.id, is_active=True, is_sold_out=False)
p2 = Product(name="醤油ラーメン", price=750, category_id=cat_ramen.id, is_active=True, is_sold_out=False)
p3 = Product(name="餃子(5個)", price=350, category_id=cat_side.id, is_active=True, is_sold_out=False)
p4 = Product(name="ライス", price=150, category_id=cat_side.id, is_active=True, is_sold_out=False)
db.add_all([p1, p2, p3, p4])
db.commit()

# 5. 商品とオプショングループの紐付け
p1_grp1 = ProductOptionGroup(product_id=p1.id, option_group_id=grp_topping.id)
p1_grp2 = ProductOptionGroup(product_id=p1.id, option_group_id=grp_noodle.id)
p2_grp1 = ProductOptionGroup(product_id=p2.id, option_group_id=grp_topping.id)
p2_grp2 = ProductOptionGroup(product_id=p2.id, option_group_id=grp_noodle.id)
db.add_all([p1_grp1, p1_grp2, p2_grp1, p2_grp2])
db.commit()

print("シードデータの投入が完了しました！")
db.close()