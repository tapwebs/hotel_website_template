"""Running orders: add items after the KOT, cancel single items, KOT rounds

- kot_seq: bumped each time items are added or cancelled on a sent order (1 = the original order)
- kot_printed_seq: the highest round the kitchen has printed (0 = nothing printed yet)
- voided_items: cancelled lines with reason, who and when (they no longer appear in items)

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('pos_orders') as b:
        b.add_column(sa.Column('kot_seq', sa.Integer(), nullable=False, server_default='1'))
        b.add_column(sa.Column('kot_printed_seq', sa.Integer(), nullable=False, server_default='0'))
        b.add_column(sa.Column('voided_items', sa.JSON(), nullable=True))
    orders = sa.table('pos_orders', sa.column('kot_printed_at', sa.DateTime), sa.column('kot_printed_seq', sa.Integer))
    op.execute(orders.update().where(orders.c.kot_printed_at.isnot(None)).values(kot_printed_seq=1))


def downgrade() -> None:
    with op.batch_alter_table('pos_orders') as b:
        b.drop_column('voided_items')
        b.drop_column('kot_printed_seq')
        b.drop_column('kot_seq')
