"""Create night_audit_runs table for audit lifecycle and rollover tracking

Revision ID: e0f1a2b3c4d5
Revises: d9e0f1a2b3c4
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e0f1a2b3c4d5'
down_revision: Union[str, None] = 'd9e0f1a2b3c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = set(insp.get_table_names())

    if 'night_audit_runs' not in tables:
        op.create_table(
            'night_audit_runs',
            sa.Column('run_id', sa.String(length=50), nullable=False),
            sa.Column('property_id', sa.String(length=50), nullable=False),
            sa.Column('business_date', sa.String(length=10), nullable=False),
            sa.Column('status', sa.String(length=30), server_default='IN_PROGRESS', nullable=False),
            sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('performed_by', sa.String(length=100), server_default='SYSTEM', nullable=False),
            sa.Column('new_business_date', sa.String(length=10), nullable=True),
            sa.Column('steps_completed', sa.JSON(), nullable=False),
            sa.Column('room_charges_posted', sa.Integer(), server_default='0', nullable=False),
            sa.Column('total_charges_minor', sa.BigInteger(), server_default='0', nullable=False),
            sa.Column('total_tax_minor', sa.BigInteger(), server_default='0', nullable=False),
            sa.Column('flash_report_snapshot', sa.JSON(), nullable=True),
            sa.Column('error_message', sa.String(length=500), nullable=True),
            sa.Column('idempotency_key', sa.String(length=100), nullable=True),
            sa.ForeignKeyConstraint(['property_id'], ['properties.property_id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('run_id'),
            sa.UniqueConstraint('property_id', 'business_date', name='uq_night_audit_property_date')
        )
        op.create_index('ix_night_audit_runs_property_id', 'night_audit_runs', ['property_id'])
        op.create_index('ix_night_audit_runs_business_date', 'night_audit_runs', ['business_date'])
        op.create_index('ix_night_audit_runs_idempotency_key', 'night_audit_runs', ['idempotency_key'])


def downgrade() -> None:
    op.drop_index('ix_night_audit_runs_idempotency_key', table_name='night_audit_runs')
    op.drop_index('ix_night_audit_runs_business_date', table_name='night_audit_runs')
    op.drop_index('ix_night_audit_runs_property_id', table_name='night_audit_runs')
    op.drop_table('night_audit_runs')
