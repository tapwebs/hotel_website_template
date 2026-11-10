"""F&B: order table/source/notes/updated_at, menu soft delete

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c8d9e0f1a2b3'
down_revision: Union[str, None] = 'b7c8d9e0f1a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('pos_orders') as b:
        b.add_column(sa.Column('table_id', sa.String(length=50), nullable=True))
        b.add_column(sa.Column('source', sa.String(length=20), nullable=False, server_default='STAFF'))
        b.add_column(sa.Column('notes', sa.Text(), nullable=True))
        b.add_column(sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
        b.create_index('ix_pos_orders_status', ['status'])
    with op.batch_alter_table('menu_items') as b:
        b.add_column(sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    with op.batch_alter_table('menu_items') as b:
        b.drop_column('is_active')
    with op.batch_alter_table('pos_orders') as b:
        b.drop_index('ix_pos_orders_status')
        for c in ('updated_at', 'notes', 'source', 'table_id'):
            b.drop_column(c)
