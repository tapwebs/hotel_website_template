"""Add performance and lookup indexes for folios, operations, and POS

Revision ID: d9e0f1a2b3c4
Revises: c8d9e0f1a2b3
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd9e0f1a2b3c4'
down_revision: Union[str, None] = 'c8d9e0f1a2b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    existing_indexes = set()
    for table_name in ['master_folios', 'folio_line_items', 'housekeeping_tasks', 'maintenance_tickets', 'menu_items']:
        for idx in insp.get_indexes(table_name):
            existing_indexes.add(idx['name'])

    with op.batch_alter_table('master_folios') as b:
        if 'ix_master_folios_stay_id' not in existing_indexes:
            b.create_index('ix_master_folios_stay_id', ['stay_id'])

    with op.batch_alter_table('housekeeping_tasks') as b:
        if 'ix_housekeeping_tasks_property_status' not in existing_indexes:
            b.create_index('ix_housekeeping_tasks_property_status', ['property_id', 'status'])

    with op.batch_alter_table('maintenance_tickets') as b:
        if 'ix_maintenance_tickets_property_status' not in existing_indexes:
            b.create_index('ix_maintenance_tickets_property_status', ['property_id', 'status'])

    with op.batch_alter_table('menu_items') as b:
        if 'ix_menu_items_prop_active_avail' not in existing_indexes:
            b.create_index('ix_menu_items_prop_active_avail', ['property_id', 'is_active', 'is_available'])


def downgrade() -> None:
    with op.batch_alter_table('menu_items') as b:
        b.drop_index('ix_menu_items_prop_active_avail')
    with op.batch_alter_table('maintenance_tickets') as b:
        b.drop_index('ix_maintenance_tickets_property_status')
    with op.batch_alter_table('housekeeping_tasks') as b:
        b.drop_index('ix_housekeeping_tasks_property_status')
    with op.batch_alter_table('master_folios') as b:
        b.drop_index('ix_master_folios_stay_id')
