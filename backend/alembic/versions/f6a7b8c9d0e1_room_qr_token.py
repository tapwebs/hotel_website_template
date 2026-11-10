"""Permanent in-room ordering QR per room

rooms.qr_token: printed once and placed in the room. Scanning it charges whoever is checked in at that moment,
so the QR keeps working across guests; resetting it retires the printed copy.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
"""
import uuid
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('rooms') as b:
        b.add_column(sa.Column('qr_token', sa.String(64), nullable=True))
    conn = op.get_bind()
    for (room_id,) in conn.execute(sa.text("SELECT room_id FROM rooms")).fetchall():
        conn.execute(sa.text("UPDATE rooms SET qr_token = :t WHERE room_id = :r"), {"t": str(uuid.uuid4()), "r": room_id})
    op.create_index('ix_rooms_qr_token', 'rooms', ['qr_token'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_rooms_qr_token', table_name='rooms')
    with op.batch_alter_table('rooms') as b:
        b.drop_column('qr_token')
