"""dining_sessions.room_id for room QR sessions with no checked-in guest

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('dining_sessions', sa.Column('room_id', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('dining_sessions', 'room_id')
