"""F&B TapMenu port: menu/table/order extensions, categories, sections, shifts, coupons, reservations, dining sessions

Revision ID: f1a2b3c4d5e6
Revises: e0f1a2b3c4d5
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e0f1a2b3c4d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MENU_COLS = [
    sa.Column('image_url', sa.Text(), nullable=True),
    sa.Column('tags', sa.JSON(), nullable=False, server_default='[]'),
    sa.Column('kcal', sa.Integer(), nullable=True),
    sa.Column('original_price_minor', sa.BigInteger(), nullable=True),
    sa.Column('dietary_type', sa.String(20), nullable=False, server_default='veg'),
    sa.Column('variants', sa.JSON(), nullable=False, server_default='[]'),
    sa.Column('add_ons', sa.JSON(), nullable=False, server_default='[]'),
    sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
]
TABLE_COLS = [
    sa.Column('section_id', sa.String(50), nullable=True),
    sa.Column('seated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('qr_token', sa.String(64), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
]
ORDER_COLS = [
    sa.Column('is_rush', sa.Boolean(), nullable=False, server_default=sa.false()),
    sa.Column('estimated_prep_minutes', sa.Integer(), nullable=False, server_default='15'),
    sa.Column('kot_printed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('void_reason', sa.String(200), nullable=True),
    sa.Column('tax_percent', sa.Integer(), nullable=False, server_default='5'),
    sa.Column('discount_minor', sa.BigInteger(), nullable=False, server_default='0'),
    sa.Column('coupon_code', sa.String(50), nullable=True),
    sa.Column('payment_method', sa.String(20), nullable=True),
    sa.Column('split_amounts', sa.JSON(), nullable=True),
    sa.Column('tendered_minor', sa.BigInteger(), nullable=True),
    sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('customer_phone', sa.String(20), nullable=True),
    sa.Column('tracking_token_hash', sa.String(64), nullable=True),
    sa.Column('counter_code', sa.String(6), nullable=True),
    sa.Column('shift_id', sa.String(50), nullable=True),
    sa.Column('review_rating', sa.Integer(), nullable=True),
    sa.Column('review_comment', sa.Text(), nullable=True),
    sa.Column('game_played', sa.Boolean(), nullable=False, server_default=sa.false()),
    sa.Column('spin_result', sa.JSON(), nullable=True),
]


def upgrade() -> None:
    with op.batch_alter_table('menu_items') as b:
        for c in MENU_COLS:
            b.add_column(c)
    with op.batch_alter_table('pos_tables') as b:
        for c in TABLE_COLS:
            b.add_column(c)
        b.create_index('ix_pos_tables_qr_token', ['qr_token'], unique=True)
    with op.batch_alter_table('pos_orders') as b:
        for c in ORDER_COLS:
            b.add_column(c)
        b.create_index('ix_pos_orders_tracking_token_hash', ['tracking_token_hash'])
        b.create_index('ix_pos_orders_counter_code', ['counter_code'])

    prop = lambda: sa.Column('property_id', sa.String(50), sa.ForeignKey('properties.property_id', ondelete='CASCADE'), nullable=False, index=True)
    op.create_table('pos_sections', sa.Column('section_id', sa.String(50), primary_key=True), prop(),
                    sa.Column('name', sa.String(80), nullable=False), sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'))
    op.create_table('menu_categories', sa.Column('category_id', sa.String(50), primary_key=True), prop(),
                    sa.Column('name', sa.String(50), nullable=False), sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'))
    op.create_table(
        'pos_shifts', sa.Column('shift_id', sa.String(50), primary_key=True), prop(),
        sa.Column('opened_by', sa.String(50), nullable=False), sa.Column('closed_by', sa.String(50), nullable=True),
        sa.Column('opening_float_minor', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('closing_cash_minor', sa.BigInteger(), nullable=True), sa.Column('expected_cash_minor', sa.BigInteger(), nullable=True),
        sa.Column('variance_minor', sa.BigInteger(), nullable=True), sa.Column('status', sa.String(10), nullable=False, server_default='OPEN'),
        sa.Column('opened_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        'pos_coupons', sa.Column('coupon_id', sa.String(50), primary_key=True), prop(),
        sa.Column('code', sa.String(50), nullable=False, index=True), sa.Column('kind', sa.String(10), nullable=False, server_default='PERCENT'),
        sa.Column('value', sa.Integer(), nullable=False), sa.Column('min_order_minor', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('max_discount_minor', sa.BigInteger(), nullable=True), sa.Column('description', sa.String(200), nullable=False, server_default=''),
        sa.Column('categories', sa.JSON(), nullable=False, server_default='[]'), sa.Column('single_use', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True), sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()), sa.Column('source', sa.String(20), nullable=False, server_default='ADMIN'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        'table_reservations', sa.Column('reservation_id', sa.String(50), primary_key=True), prop(),
        sa.Column('table_id', sa.String(50), nullable=True), sa.Column('guest_name', sa.String(100), nullable=False),
        sa.Column('phone', sa.String(20), nullable=True), sa.Column('party_size', sa.Integer(), nullable=False, server_default='2'),
        sa.Column('reserved_for', sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column('duration_minutes', sa.Integer(), nullable=False, server_default='90'), sa.Column('room_number', sa.String(20), nullable=True),
        sa.Column('notes', sa.String(300), nullable=True), sa.Column('status', sa.String(20), nullable=False, server_default='BOOKED'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        'dining_sessions', sa.Column('id_hash', sa.String(64), primary_key=True), sa.Column('property_id', sa.String(50), nullable=False, index=True),
        sa.Column('kind', sa.String(10), nullable=False), sa.Column('table_id', sa.String(50), nullable=True),
        sa.Column('stay_id', sa.String(50), nullable=True), sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    for t in ('dining_sessions', 'table_reservations', 'pos_coupons', 'pos_shifts', 'menu_categories', 'pos_sections'):
        op.drop_table(t)
    with op.batch_alter_table('pos_orders') as b:
        b.drop_index('ix_pos_orders_counter_code')
        b.drop_index('ix_pos_orders_tracking_token_hash')
        for c in reversed(ORDER_COLS):
            b.drop_column(c.name)
    with op.batch_alter_table('pos_tables') as b:
        b.drop_index('ix_pos_tables_qr_token')
        for c in reversed(TABLE_COLS):
            b.drop_column(c.name)
    with op.batch_alter_table('menu_items') as b:
        for c in reversed(MENU_COLS):
            b.drop_column(c.name)
