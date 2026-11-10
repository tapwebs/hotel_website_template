"""F&B: idempotent guest orders, per-dish GST rate, server-sent receipt marker

Revision ID: c3d4e5f6a7b8
Revises: b1c2d3e4f5a6
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('pos_orders') as b:
        b.add_column(sa.Column('client_request_id', sa.String(64), nullable=True))
        b.add_column(sa.Column('receipt_sent_at', sa.DateTime(timezone=True), nullable=True))
        b.create_index('uq_pos_orders_client_request', ['property_id', 'client_request_id'], unique=True)
    with op.batch_alter_table('menu_items') as b:
        b.add_column(sa.Column('tax_percent', sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('menu_items') as b:
        b.drop_column('tax_percent')
    with op.batch_alter_table('pos_orders') as b:
        b.drop_index('uq_pos_orders_client_request')
        b.drop_column('receipt_sent_at')
        b.drop_column('client_request_id')
