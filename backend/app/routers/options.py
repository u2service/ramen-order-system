from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

from app.database import get_db
from app.models import OptionGroup, Option, ProductOptionGroup, Product
from app.schemas import (
    OptionGroupCreateSchema,
    OptionGroupResponseSchema,
    OptionCreateSchema,
    OptionResponseSchema,
    ProductOptionGroupSyncSchema,
)

router = APIRouter(prefix="/admin", tags=["admin-options"])

# ==========================================
# 1. オプショングループ API
# ==========================================

@router.get("/option-groups", response_model=List[OptionGroupResponseSchema])
def get_option_groups(db: Session = Depends(get_db)):
    """全オプショングループ（属する選択肢を含む）を取得"""
    return db.query(OptionGroup).all()

@router.post("/option-groups", response_model=OptionGroupResponseSchema, status_code=status.HTTP_201_CREATED)
def create_option_group(data: OptionGroupCreateSchema, db: Session = Depends(get_db)):
    """オプショングループを新規作成"""
    group = OptionGroup(**data.model_dump())
    db.add(group)
    db.commit()
    db.refresh(group)
    return group

@router.delete("/option-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_option_group(group_id: int, db: Session = Depends(get_db)):
    """オプショングループを削除"""
    group = db.query(OptionGroup).filter(OptionGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Option group not found")
    
    # 関連する選択肢も併せて削除
    db.query(Option).filter(Option.option_group_id == group_id).delete()
    # 商品との紐付けも削除
    db.query(ProductOptionGroup).filter(ProductOptionGroup.option_group_id == group_id).delete()
    
    db.delete(group)
    db.commit()
    return None

@router.put("/option-groups/{group_id}", response_model=OptionGroupResponseSchema)
def update_option_group(
    group_id: int, 
    data: OptionGroupCreateSchema, 
    db: Session = Depends(get_db)
):
    """オプショングループ情報を更新"""
    group = db.query(OptionGroup).filter(OptionGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Option group not found")

    # リクエストデータでフィールドを更新
    for key, value in data.model_dump().items():
        setattr(group, key, value)

    db.commit()
    db.refresh(group)
    return group

# ==========================================
# 2. オプション選択肢 API
# ==========================================

@router.post("/options", response_model=OptionResponseSchema, status_code=status.HTTP_201_CREATED)
def create_option(data: OptionCreateSchema, db: Session = Depends(get_db)):
    """指定グループに選択肢を追加"""
    group = db.query(OptionGroup).filter(OptionGroup.id == data.option_group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Target OptionGroup not found")

    option = Option(**data.model_dump())
    db.add(option)
    db.commit()
    db.refresh(option)
    return option

# ★ PUT: 無効化 / 有効化（ステータス変更・編集）
@router.put("/options/{option_id}", response_model=OptionResponseSchema)
def update_option(
    option_id: int, 
    data: OptionCreateSchema, 
    db: Session = Depends(get_db)
):
    """選択肢の情報を更新（is_active の切り替え等）"""
    option = db.query(Option).filter(Option.id == option_id).first()
    if not option:
        raise HTTPException(status_code=404, detail="Option not found")

    for key, value in data.model_dump().items():
        setattr(option, key, value)

    db.commit()
    db.refresh(option)
    return option

# ★ DELETE: DBからの完全削除
@router.delete("/options/{option_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_option(option_id: int, db: Session = Depends(get_db)):
    """選択肢を削除（注文履歴がある場合は自動で非有効化）"""
    option = db.query(Option).filter(Option.id == option_id).first()
    if not option:
        raise HTTPException(status_code=404, detail="Option not found")
    
    try:
        # まず物理削除を試みる
        db.delete(option)
        db.commit()
    except IntegrityError:
        # 過去の注文データ等と紐づいていて物理削除できない場合はロールバックして無効化する
        db.rollback()
        option = db.query(Option).filter(Option.id == option_id).first()
        if option:
            option.is_active = False
            db.commit()

    return None

# ==========================================
# 3. 商品 × オプショングループ 紐付け API
# ==========================================

@router.post("/product-option-groups/sync")
def sync_product_option_groups(data: ProductOptionGroupSyncSchema, db: Session = Depends(get_db)):
    """特定の対象商品に対するオプショングループ紐付けを更新"""
    product = db.query(Product).filter(Product.id == data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # 既存の紐付けを一括削除
    db.query(ProductOptionGroup).filter(ProductOptionGroup.product_id == data.product_id).delete()

    # 新しい紐付けを一括登録
    new_links = [
        ProductOptionGroup(product_id=data.product_id, option_group_id=gid)
        for gid in data.option_group_ids
    ]
    db.add_all(new_links)
    db.commit()

    return {"status": "success", "product_id": data.product_id, "synced_groups": data.option_group_ids}
