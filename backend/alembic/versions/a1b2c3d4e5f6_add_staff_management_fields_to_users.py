"""add_staff_management_fields_to_users

Revision ID: a1b2c3d4e5f6
Revises: 09cccfaccfd7
Create Date: 2026-09-30 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '09cccfaccfd7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('phone_number', sa.String(length=30), nullable=True))
    op.add_column('users', sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('management_scope', sa.JSON(), server_default='[]', nullable=False))
    op.add_column('users', sa.Column('token_version', sa.Integer(), server_default='1', nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'token_version')
    op.drop_column('users', 'management_scope')
    op.drop_column('users', 'last_login_at')
    op.drop_column('users', 'phone_number')
