"""add_account_type_and_job_role_to_users

Revision ID: b1c2d3e4f5a6
Revises: a2b3c4d5e6f7
Create Date: 2026-10-23 15:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'a2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add canonical account_type and job_role columns
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('account_type', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('job_role', sa.String(length=50), nullable=True))
        batch_op.create_index('ix_users_account_type', ['account_type'])

    # 2. Backfill existing legacy users with canonical mappings
    conn = op.get_bind()

    # Platform Super Admin
    conn.execute(sa.text(
        "UPDATE users SET account_type = 'PLATFORM_ADMIN', job_role = NULL "
        "WHERE role_code = 'ROLE_PLATFORM_SUPER_ADMIN' AND account_type IS NULL"
    ))

    # Hotel Owner
    conn.execute(sa.text(
        "UPDATE users SET account_type = 'OWNER', job_role = NULL "
        "WHERE role_code = 'ROLE_SUPER_ADMIN' AND account_type IS NULL"
    ))

    # Hotel Manager / Administrators
    conn.execute(sa.text(
        "UPDATE users SET account_type = 'MANAGER', job_role = NULL "
        "WHERE role_code IN ('ROLE_GENERAL_MANAGER', 'ROLE_ACCOUNTANT', 'ROLE_CHANNEL_MANAGER') "
        "AND account_type IS NULL"
    ))

    # Receptionist (Front Desk, Reservations, Night Auditor)
    conn.execute(sa.text(
        "UPDATE users SET account_type = 'STAFF', job_role = 'RECEPTIONIST' "
        "WHERE role_code IN ('ROLE_FRONT_DESK', 'ROLE_RESERVATIONS', 'ROLE_NIGHT_AUDITOR') "
        "AND account_type IS NULL"
    ))

    # Waiter (Restaurant POS & POS Cashier)
    conn.execute(sa.text(
        "UPDATE users SET account_type = 'STAFF', job_role = 'WAITER' "
        "WHERE role_code IN ('ROLE_RESTAURANT_POS', 'ROLE_POS_CASHIER') AND account_type IS NULL"
    ))

    # Kitchen Staff
    conn.execute(sa.text(
        "UPDATE users SET account_type = 'STAFF', job_role = 'KITCHEN_STAFF' "
        "WHERE role_code = 'ROLE_KITCHEN_STAFF' AND account_type IS NULL"
    ))

    # Housekeeping
    conn.execute(sa.text(
        "UPDATE users SET account_type = 'STAFF', job_role = 'HOUSEKEEPING' "
        "WHERE role_code = 'ROLE_HOUSEKEEPING' AND account_type IS NULL"
    ))

    # Maintenance
    conn.execute(sa.text(
        "UPDATE users SET account_type = 'STAFF', job_role = 'MAINTENANCE' "
        "WHERE role_code = 'ROLE_MAINTENANCE' AND account_type IS NULL"
    ))

    # Fallback default for any remaining unspecified records
    conn.execute(sa.text(
        "UPDATE users SET account_type = 'STAFF', job_role = 'RECEPTIONIST' "
        "WHERE account_type IS NULL"
    ))


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_index('ix_users_account_type')
        batch_op.drop_column('job_role')
        batch_op.drop_column('account_type')
