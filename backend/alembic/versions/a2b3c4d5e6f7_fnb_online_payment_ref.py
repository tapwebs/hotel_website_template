"""F&B: gateway reference for guest online payments

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('pos_orders') as b:
        b.add_column(sa.Column('payment_ref', sa.String(120), nullable=True))
        b.create_index('ix_pos_orders_payment_ref', ['payment_ref'])


def downgrade() -> None:
    with op.batch_alter_table('pos_orders') as b:
        b.drop_index('ix_pos_orders_payment_ref')
        b.drop_column('payment_ref')
