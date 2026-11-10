"""Six-role model, one kitchen station, guest-order acceptance and bill round-off

- Users on retired roles (front desk, housekeeping, maintenance, POS, night auditor, ...) become Waiter; accountants become
  Staff/Accountant (they were previously stored as Manager accounts).
- Every menu item moves to the single MAIN_KITCHEN station.
- pos_orders gets accepted_at / accepted_by (guest orders wait for a captain or waiter) and round_off_minor.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RETIRED = ("ROLE_FRONT_DESK", "ROLE_RESERVATIONS", "ROLE_HOUSEKEEPING", "ROLE_MAINTENANCE", "ROLE_RESTAURANT_POS",
           "ROLE_NIGHT_AUDITOR", "ROLE_CHANNEL_MANAGER", "ROLE_POS_CASHIER")


def upgrade() -> None:
    with op.batch_alter_table('pos_orders') as b:
        b.add_column(sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True))
        b.add_column(sa.Column('accepted_by', sa.String(50), nullable=True))
        b.add_column(sa.Column('round_off_minor', sa.BigInteger(), nullable=False, server_default='0'))

    users = sa.table('users', sa.column('role_code', sa.String), sa.column('account_type', sa.String), sa.column('job_role', sa.String),
                     sa.column('permissions', sa.JSON))
    # Users carry a stored copy of their old role's permissions; clear it so a former receptionist does not keep front-desk access.
    op.execute(users.update().where(users.c.role_code.in_(RETIRED))
               .values(role_code='ROLE_WAITER', account_type='STAFF', job_role='WAITER', permissions=[]))
    op.execute(users.update().where(users.c.role_code == 'ROLE_ACCOUNTANT').values(account_type='STAFF', job_role='ACCOUNTANT'))
    op.execute(users.update().where(users.c.role_code == 'ROLE_KITCHEN_STAFF').values(account_type='STAFF', job_role='KITCHEN_STAFF'))
    # Staff whose job preset no longer exists (receptionist, housekeeping, maintenance) become waiters.
    op.execute(users.update().where(users.c.account_type == 'STAFF', users.c.job_role.notin_(('CAPTAIN', 'WAITER', 'KITCHEN_STAFF', 'ACCOUNTANT')))
               .values(role_code='ROLE_WAITER', job_role='WAITER', permissions=[]))

    # Departments are now just the restaurant and accounts; admins keep authority over both.
    scoped = sa.table('users', sa.column('account_type', sa.String), sa.column('management_scope', sa.JSON))
    op.execute(scoped.update().where(scoped.c.account_type == 'MANAGER').values(management_scope=['RESTAURANT_POS', 'ACCOUNTANT']))

    menu = sa.table('menu_items', sa.column('station', sa.String))
    op.execute(menu.update().values(station='MAIN_KITCHEN'))


def downgrade() -> None:
    # Role and station changes are not reversed: the previous assignments are not recoverable.
    with op.batch_alter_table('pos_orders') as b:
        b.drop_column('round_off_minor')
        b.drop_column('accepted_by')
        b.drop_column('accepted_at')
