"""add external_booking_ref to reservations (website sync)

Revision ID: b7c8d9e0f1a2
Revises: a1b2c3d4e5f6
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b7c8d9e0f1a2'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('reservations') as batch:
        batch.add_column(sa.Column('external_booking_ref', sa.String(length=64), nullable=True))
        batch.create_index('ix_reservations_external_booking_ref', ['external_booking_ref'], unique=True)


def downgrade() -> None:
    with op.batch_alter_table('reservations') as batch:
        batch.drop_index('ix_reservations_external_booking_ref')
        batch.drop_column('external_booking_ref')
