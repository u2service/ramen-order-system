"""add partial indexes for orders and order_items

Revision ID: add_partial_indexes
Revises: 83d12cecf5f5
Create Date: 2026-10-11
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'add_partial_indexes'
down_revision = '83d12cecf5f5'
branch_labels = None
depends_on = None

def upgrade():
    # 1. orders: 未完了・未会計注文の部分インデックス (KDS, POS卓一覧用)
    op.create_index(
        'idx_orders_active',
        'orders',
        ['id', 'table_number', 'created_at'],
        unique=False,
        postgresql_where="status NOT IN ('completed', 'served', 'paid', 'cancelled')"
    )

    # 2. orders: 卓番号別 未払い注文の部分インデックス (POS会計伝票用)
    op.create_index(
        'idx_orders_unpaid_by_table',
        'orders',
        ['table_number'],
        unique=False,
        postgresql_where="paid_at IS NULL AND status != 'cancelled'"
    )

    # 3. order_items: 未完了明細の部分インデックス
    op.create_index(
        'idx_order_items_active',
        'order_items',
        ['order_id'],
        unique=False,
        postgresql_where="status NOT IN ('completed', 'served', 'cancelled')"
    )

def downgrade():
    op.drop_index('idx_order_items_active', table_name='order_items')
    op.drop_index('idx_orders_unpaid_by_table', table_name='orders')
    op.drop_index('idx_orders_active', table_name='orders')