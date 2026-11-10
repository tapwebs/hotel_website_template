"""Composite indexes for the polled POS order lists (kitchen board, pending, recent history)

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    existing_indexes = {idx['name'] for idx in sa.inspect(op.get_bind()).get_indexes('pos_orders')}
    with op.batch_alter_table('pos_orders') as b:
        if 'ix_pos_orders_property_status_created' not in existing_indexes:
            b.create_index('ix_pos_orders_property_status_created', ['property_id', 'status', 'created_at'])
        if 'ix_pos_orders_property_created' not in existing_indexes:
            b.create_index('ix_pos_orders_property_created', ['property_id', 'created_at'])


def downgrade() -> None:
    with op.batch_alter_table('pos_orders') as b:
        b.drop_index('ix_pos_orders_property_created')
        b.drop_index('ix_pos_orders_property_status_created')
