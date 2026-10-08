from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import date, datetime, timezone

from app.database import get_db
from app import models
from app.schemas import (
    InventoryItemCreateSchema,
    InventoryItemUpdateSchema,
    InventoryItemResponseSchema,
    InventoryLotCreateSchema,
    InventoryLotResponseSchema,
    ProductRecipeSyncSchema,
    OptionRecipeSyncSchema,
    RecipeItemResponseSchema
)

router = APIRouter(prefix="/inventory", tags=["inventory"])

# --- 在庫品目マスタ (InventoryItems) API ---

@router.get("/items", response_model=List[InventoryItemResponseSchema])
def get_inventory_items(db: Session = Depends(get_db)):
    items = db.query(models.InventoryItem).all()
    result = []
    
    for item in items:
        stock_sum = db.query(func.coalesce(func.sum(models.InventoryLot.current_quantity), 0))\
            .filter(
                models.InventoryLot.inventory_item_id == item.id,
                models.InventoryLot.status == 'active'
            ).scalar()
        
        result.append(InventoryItemResponseSchema(
            id=item.id,
            name=item.name,
            unit=item.unit,
            zaiko_alert=float(item.zaiko_alert),
            current_stock=float(stock_sum)
        ))
    return result

@router.post("/items", response_model=InventoryItemResponseSchema, status_code=status.HTTP_201_CREATED)
def create_inventory_item(item_in: InventoryItemCreateSchema, db: Session = Depends(get_db)):
    db_item = models.InventoryItem(
        name=item_in.name,
        unit=item_in.unit,
        zaiko_alert=item_in.zaiko_alert
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    return InventoryItemResponseSchema(
        id=db_item.id,
        name=db_item.name,
        unit=db_item.unit,
        zaiko_alert=float(db_item.zaiko_alert),
        current_stock=0.0
    )

@router.put("/items/{item_id}", response_model=InventoryItemResponseSchema)
def update_inventory_item(item_id: int, item_in: InventoryItemUpdateSchema, db: Session = Depends(get_db)):
    db_item = db.query(models.InventoryItem).filter(models.InventoryItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    db_item.name = item_in.name
    db_item.unit = item_in.unit
    db_item.zaiko_alert = item_in.zaiko_alert
    db.commit()
    db.refresh(db_item)

    stock_sum = db.query(func.coalesce(func.sum(models.InventoryLot.current_quantity), 0))\
        .filter(models.InventoryLot.inventory_item_id == db_item.id, models.InventoryLot.status == 'active').scalar()

    return InventoryItemResponseSchema(
        id=db_item.id,
        name=db_item.name,
        unit=db_item.unit,
        zaiko_alert=float(db_item.zaiko_alert),
        current_stock=float(stock_sum)
    )


# --- 入荷ロット (InventoryLots) API ---

@router.get("/lots", response_model=List[InventoryLotResponseSchema])
def get_inventory_lots(db: Session = Depends(get_db)):
    lots = db.query(models.InventoryLot).order_by(models.InventoryLot.id.desc()).all()
    today = date.today()
    result = []
    
    for lot in lots:
        # 既に廃棄済みのロットは自動ステータス更新を行わない
        if lot.status != "discarded" and getattr(lot, "is_discarded", False) is False:

            current_status = lot.status
            if lot.current_quantity <= 0:
                current_status = "depleted"
            elif lot.expiration_date < today:
                current_status = "expired"

            if current_status != lot.status:
                lot.status = current_status
                db.commit()

        item_name = lot.inventory_item.name if lot.inventory_item else ""
        item_unit = lot.inventory_item.unit if lot.inventory_item else ""

        result.append(InventoryLotResponseSchema(
            id=lot.id,
            inventory_item_id=lot.inventory_item_id,
            inventory_item_name=item_name,
            unit=item_unit,
            received_date=lot.received_date,
            expiration_date=lot.expiration_date,
            initial_quantity=float(lot.initial_quantity),
            current_quantity=float(lot.current_quantity),
            total_cost=float(lot.total_cost),
            unit_cost=float(lot.unit_cost),
            status=lot.status,
            is_discarded=getattr(lot, "is_discarded", False),
            discarded_at=getattr(lot, "discarded_at", None)
        ))
    return result

@router.post("/lots", response_model=InventoryLotResponseSchema, status_code=status.HTTP_201_CREATED)
def create_inventory_lot(lot_in: InventoryLotCreateSchema, db: Session = Depends(get_db)):
    item = db.query(models.InventoryItem).filter(models.InventoryItem.id == lot_in.inventory_item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    unit_cost = lot_in.total_cost / lot_in.initial_quantity if lot_in.initial_quantity > 0 else 0

    db_lot = models.InventoryLot(
        inventory_item_id=lot_in.inventory_item_id,
        received_date=lot_in.received_date,
        expiration_date=lot_in.expiration_date,
        initial_quantity=lot_in.initial_quantity,
        current_quantity=lot_in.initial_quantity,
        total_cost=lot_in.total_cost,
        unit_cost=unit_cost,
        status="active",
        is_discarded=False,
        discarded_at=None
    )
    db.add(db_lot)
    db.commit()
    db.refresh(db_lot)

    return InventoryLotResponseSchema(
        id=db_lot.id,
        inventory_item_id=db_lot.inventory_item_id,
        inventory_item_name=item.name,
        unit=item.unit,
        received_date=db_lot.received_date,
        expiration_date=db_lot.expiration_date,
        initial_quantity=float(db_lot.initial_quantity),
        current_quantity=float(db_lot.current_quantity),
        total_cost=float(db_lot.total_cost),
        unit_cost=float(db_lot.unit_cost),
        status=db_lot.status,
        is_discarded=db_lot.is_discarded,
        discarded_at=db_lot.discarded_at
    )

# --- 入荷ロットの更新 (PUT) ---
@router.put("/lots/{lot_id}", response_model=InventoryLotResponseSchema)
def update_inventory_lot(lot_id: int, lot_in: InventoryLotCreateSchema, db: Session = Depends(get_db)):
    db_lot = db.query(models.InventoryLot).filter(models.InventoryLot.id == lot_id).first()
    if not db_lot:
        raise HTTPException(status_code=404, detail="Inventory lot not found")

    item = db.query(models.InventoryItem).filter(models.InventoryItem.id == lot_in.inventory_item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    unit_cost = lot_in.total_cost / lot_in.initial_quantity if lot_in.initial_quantity > 0 else 0

    # 数量の変化に合わせて current_quantity や status も調整
    # --- 修正箇所：どちらも float に変換してから引き算する ---
    qty_diff = float(lot_in.initial_quantity) - float(db_lot.initial_quantity)
    new_current_quantity = float(db_lot.current_quantity) + qty_diff
    if new_current_quantity < 0:
        new_current_quantity = 0

    db_lot.inventory_item_id = lot_in.inventory_item_id
    db_lot.received_date = lot_in.received_date
    db_lot.expiration_date = lot_in.expiration_date
    db_lot.initial_quantity = lot_in.initial_quantity
    db_lot.current_quantity = new_current_quantity
    db_lot.total_cost = lot_in.total_cost
    db_lot.unit_cost = unit_cost

    # ステータス更新
    # expiration_date が str 型の場合は date 型に変換して比較する
    exp_date = (
        datetime.strptime(lot_in.expiration_date, "%Y-%m-%d").date()
        if isinstance(lot_in.expiration_date, str)
        else lot_in.expiration_date
    )

    if getattr(db_lot, "is_discarded", False):
        db_lot.status = "discarded"
    elif db_lot.current_quantity <= 0:
        db_lot.status = "depleted"
    elif exp_date < date.today():
        db_lot.status = "expired"
    else:
        db_lot.status = "active"

    db.commit()
    db.refresh(db_lot)

    return InventoryLotResponseSchema(
        id=db_lot.id,
        inventory_item_id=db_lot.inventory_item_id,
        inventory_item_name=item.name,
        unit=item.unit,
        received_date=db_lot.received_date,
        expiration_date=db_lot.expiration_date,
        initial_quantity=float(db_lot.initial_quantity),
        current_quantity=float(db_lot.current_quantity),
        total_cost=float(db_lot.total_cost),
        unit_cost=float(db_lot.unit_cost),
        status=db_lot.status,
        is_discarded=getattr(db_lot, "is_discarded", False),
        discarded_at=getattr(db_lot, "discarded_at", None)
    )

# --- 入荷ロットの削除・廃棄 (DELETE) ---
@router.delete("/lots/{lot_id}", status_code=status.HTTP_200_OK)
def delete_inventory_lot(lot_id: int, db: Session = Depends(get_db)):
    db_lot = db.query(models.InventoryLot).filter(models.InventoryLot.id == lot_id).first()
    if not db_lot:
        raise HTTPException(status_code=404, detail="Inventory lot not found")

    # 物理削除 (db.delete) は行わず、ステータスとフラグを更新して永続保持する
    db_lot.status = "discarded"
    db_lot.is_discarded = True
    db_lot.discarded_at = datetime.now(timezone.utc)

    db.commit()

    return {"status": "ok", "message": f"Lot {lot_id} marked as discarded"}

# ----------------------------------------------------
# 3. 商品レシピ (ProductInventoryItem) API
# ----------------------------------------------------

@router.get("/recipes/products/{product_id}", response_model=List[RecipeItemResponseSchema])
def get_product_recipe(product_id: int, db: Session = Depends(get_db)):
    """指定した商品のレシピ（消費材料一覧）を取得"""
    recipes = db.query(models.ProductInventoryItem)\
        .filter(models.ProductInventoryItem.product_id == product_id).all()
    
    result = []
    for r in recipes:
        item = db.query(models.InventoryItem).filter(models.InventoryItem.id == r.inventory_item_id).first()
        if item:
            result.append(RecipeItemResponseSchema(
                inventory_item_id=item.id,
                inventory_item_name=item.name,
                unit=item.unit,
                consumed_quantity=float(r.consumed_quantity)
            ))
    return result

@router.post("/recipes/products/sync", status_code=status.HTTP_200_OK)
def sync_product_recipe(data: ProductRecipeSyncSchema, db: Session = Depends(get_db)):
    """指定した商品のレシピを一括更新（全削除して再登録）"""
    product = db.query(models.Product).filter(models.Product.id == data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # 既存のレシピを一度クリア
    db.query(models.ProductInventoryItem)\
        .filter(models.ProductInventoryItem.product_id == data.product_id).delete()

    # 新しいレシピを登録
    for r in data.recipes:
        item = db.query(models.InventoryItem).filter(models.InventoryItem.id == r.inventory_item_id).first()
        if not item:
            continue
        db_recipe = models.ProductInventoryItem(
            product_id=data.product_id,
            inventory_item_id=r.inventory_item_id,
            consumed_quantity=r.consumed_quantity
        )
        db.add(db_recipe)

    db.commit()
    return {"status": "ok", "message": f"Product {data.product_id} recipe updated successfully"}


# ----------------------------------------------------
# 4. オプションレシピ (OptionInventoryItem) API
# ----------------------------------------------------

@router.get("/recipes/options/{option_id}", response_model=List[RecipeItemResponseSchema])
def get_option_recipe(option_id: int, db: Session = Depends(get_db)):
    """指定したトッピング/オプションのレシピを取得"""
    recipes = db.query(models.OptionInventoryItem)\
        .filter(models.OptionInventoryItem.option_id == option_id).all()
    
    result = []
    for r in recipes:
        item = db.query(models.InventoryItem).filter(models.InventoryItem.id == r.inventory_item_id).first()
        if item:
            result.append(RecipeItemResponseSchema(
                inventory_item_id=item.id,
                inventory_item_name=item.name,
                unit=item.unit,
                consumed_quantity=float(r.consumed_quantity)
            ))
    return result

@router.post("/recipes/options/sync", status_code=status.HTTP_200_OK)
def sync_option_recipe(data: OptionRecipeSyncSchema, db: Session = Depends(get_db)):
    """指定したオプションのレシピを一括更新"""
    option = db.query(models.Option).filter(models.Option.id == data.option_id).first()
    if not option:
        raise HTTPException(status_code=404, detail="Option not found")

    db.query(models.OptionInventoryItem)\
        .filter(models.OptionInventoryItem.option_id == data.option_id).delete()

    for r in data.recipes:
        item = db.query(models.InventoryItem).filter(models.InventoryItem.id == r.inventory_item_id).first()
        if not item:
            continue
        db_recipe = models.OptionInventoryItem(
            option_id=data.option_id,
            inventory_item_id=r.inventory_item_id,
            consumed_quantity=r.consumed_quantity
        )
        db.add(db_recipe)

    db.commit()
    return {"status": "ok", "message": f"Option {data.option_id} recipe updated successfully"}

def process_inventory_deduction(db: Session, product_id: int, option_ids: list[int], quantity: int):
    """
    商品およびオプションのレシピに基づき、指定数量分の在庫をFIFOで減算する
    """
    # 1. 商品のレシピ取得 & 減算計算
    product_recipes = db.query(models.ProductInventoryItem)\
        .filter(models.ProductInventoryItem.product_id == product_id).all()
    
    for recipe in product_recipes:
        total_consume = float(recipe.consumed_quantity) * quantity
        consume_from_lots(db, recipe.inventory_item_id, total_consume)

    # 2. 選択されたオプションのレシピ取得 & 減算計算
    if option_ids:
        for opt_id in option_ids:
            option_recipes = db.query(models.OptionInventoryItem)\
                .filter(models.OptionInventoryItem.option_id == opt_id).all()
            
            for recipe in option_recipes:
                total_consume = float(recipe.consumed_quantity) * quantity
                consume_from_lots(db, recipe.inventory_item_id, total_consume)


def consume_from_lots(db: Session, inventory_item_id: int, quantity_to_consume: float):
    """
    指定された在庫品目を、有効なロットから古い順(FIFO)に減算する
    """
    if quantity_to_consume <= 0:
        return

    # 有効(active)かつ残量があるロットを仕入日・ID順に取得
    # 廃棄済み(is_discarded=True)のロットは引き当て対象から除外される
    lots = db.query(models.InventoryLot).filter(
        models.InventoryLot.inventory_item_id == inventory_item_id,
        models.InventoryLot.status == "active",
        models.InventoryLot.current_quantity > 0
    ).order_by(models.InventoryLot.received_date.asc(), models.InventoryLot.id.asc()).all()

    remaining = quantity_to_consume

    for lot in lots:
        if remaining <= 0:
            break

        current_qty = float(lot.current_quantity)

        if current_qty <= remaining:
            # ロット全量を消費して使い切りにする
            remaining -= current_qty
            lot.current_quantity = 0
            lot.status = "depleted"
        else:
            # ロットの一部を消費
            lot.current_quantity = current_qty - remaining
            remaining = 0

    db.flush()  # トランザクション内で仮反映