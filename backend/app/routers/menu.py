from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Category, Product, OptionGroup
from app.schemas import MenuResponseSchema

router = APIRouter(prefix="/menu", tags=["menu"])

@router.get("", response_model=MenuResponseSchema)
def get_menu(db: Session = Depends(get_db)):
    """
    有効なカテゴリ、商品、オプション一覧を取得するAPI[cite: 2]
    - is_active = False の非表示商品は除外[cite: 2]
    - Option.is_active = False の非表示選択肢を除外
    - urikire_flag = True の商品は売り切れ表示としてフラグを含めて返却[cite: 2]
    - ソート順: ① 販売中が優先 ➔ ② sort_order 順[cite: 5]
    """

    print("ここまで来た")
    
    categories = (
        db.query(Category)
        .order_by(Category.sort_order.asc(), Category.id.asc())
        .all()
    )

    result_categories = []
    for category in categories:
        # 有効(is_active=True)な商品のみ取得[cite: 2]
        active_products = (
            db.query(Product)
            .options(joinedload(Product.option_groups).joinedload(OptionGroup.options))
            .filter(Product.category_id == category.id, Product.is_active == True)
            .order_by(
                Product.urikire_flag.asc(),  # False(販売中)が先、True(売り切れ)が後[cite: 5]
                Product.sort_order.asc(),    # 指定した並び順の昇順[cite: 5]
                Product.id.asc()             # sort_orderが同じ場合[cite: 5]
            )
            .all()
        )

        # 商品に紐づくオプショングループ内の options のうち、is_active == True のものだけを抽出
        formatted_products = []
        for product in active_products:
            formatted_option_groups = []
            for group in product.option_groups:
                # ★ is_active が True のオプションのみに絞り込み
                active_options = [opt for opt in group.options if opt.is_active]
                
                formatted_option_groups.append({
                    "id": group.id,
                    "name": group.name,
                    "is_required": group.is_required,
                    "multi_flag": group.multi_flag,
                    "options": active_options
                })

            formatted_products.append({
                "id": product.id,
                "name": product.name,
                "price": product.price,
                "image_url": product.image_url, 
                "sort_order": product.sort_order,
                "urikire_flag": product.urikire_flag,
                "is_active": product.is_active,
                "option_groups": formatted_option_groups
            })

        category_data = {
            "id": category.id,
            "name": category.name,
            "image_url": category.image_url,
            "sort_order": category.sort_order,
            "products": formatted_products
        }
        result_categories.append(category_data)

    return {"categories": result_categories}