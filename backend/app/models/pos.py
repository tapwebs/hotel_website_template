from sqlalchemy import Index, Column, String, Integer, BigInteger, Boolean, DateTime, ForeignKey, JSON, Text
from backend.app.core.database import Base
from backend.app.models.base import generate_uuid, utc_now


class POSSection(Base):
    __tablename__ = "pos_sections"

    section_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(80), nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)


class POSTable(Base):
    __tablename__ = "pos_tables"

    table_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    table_number = Column(String(20), nullable=False)
    section = Column(String(50), default="MAIN_DINING", nullable=False)  # section name (kept for compatibility)
    section_id = Column(String(50), nullable=True)
    capacity = Column(Integer, default=4, nullable=False)
    status = Column(String(30), default="AVAILABLE", nullable=False)  # AVAILABLE, SEATED, ORDERED, BILLED, CLEANING, MAINTENANCE
    active_order_id = Column(String(50), nullable=True)
    active_order_total_minor = Column(BigInteger, default=0, nullable=False)
    seated_minutes = Column(Integer, default=0, nullable=False)  # legacy; the API derives it from seated_at
    seated_at = Column(DateTime(timezone=True), nullable=True)
    qr_token = Column(String(64), unique=True, nullable=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)


class MenuCategory(Base):
    __tablename__ = "menu_categories"

    category_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(50), nullable=False)  # stored upper-case, matches MenuItem.category
    sort_order = Column(Integer, default=0, nullable=False)


class MenuItem(Base):
    __tablename__ = "menu_items"

    item_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(50), nullable=False)  # STARTERS, MAINS, TANDOOR, BEVERAGES, DESSERTS
    name = Column(String(150), nullable=False)
    description = Column(String(500), nullable=True)
    price_minor = Column(BigInteger, nullable=False)  # in paise
    is_veg = Column(Boolean, default=True, nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)
    station = Column(String(50), default="MAIN_KITCHEN", nullable=False)  # always MAIN_KITCHEN: the restaurant has one station
    preparation_time_minutes = Column(Integer, default=15, nullable=False)
    modifiers = Column(JSON, default=list, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)  # soft delete; is_available is the kitchen's "86" switch
    # TapMenu port
    image_url = Column(Text, nullable=True)
    tags = Column(JSON, default=list, nullable=False)  # bestseller, chef, trending, ...
    kcal = Column(Integer, nullable=True)
    original_price_minor = Column(BigInteger, nullable=True)  # strike-through MRP
    dietary_type = Column(String(20), default="veg", nullable=False)  # veg, non-veg, egg, vegan
    variants = Column(JSON, default=list, nullable=False)  # [{id, name, pricePaise, isDefault}]
    add_ons = Column(JSON, default=list, nullable=False)  # [{id, name, pricePaise}]
    sort_order = Column(Integer, default=0, nullable=False)
    tax_percent = Column(Integer, nullable=True)  # GST rate for this dish; None = the restaurant's default rate


class POSOrder(Base):
    __tablename__ = "pos_orders"
    __table_args__ = (Index("uq_pos_orders_client_request", "property_id", "client_request_id", unique=True),)

    order_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    order_type = Column(String(30), default="DINE_IN", nullable=False)  # DINE_IN, ROOM_SERVICE, TAKEAWAY, COUNTER
    table_id = Column(String(50), nullable=True)
    table_number = Column(String(20), nullable=True)
    room_number = Column(String(20), nullable=True)
    stay_id = Column(String(50), nullable=True)
    guest_name = Column(String(100), nullable=True)
    items = Column(JSON, default=list, nullable=False)
    subtotal_minor = Column(BigInteger, default=0, nullable=False)
    tax_minor = Column(BigInteger, default=0, nullable=False)
    total_minor = Column(BigInteger, default=0, nullable=False)
    status = Column(String(30), default="QUEUED", nullable=False, index=True)  # AWAITING_PAYMENT, PENDING_ACCEPTANCE, QUEUED, PREPARING, READY, DELIVERED, BILLED, CANCELLED
    elapsed_minutes = Column(Integer, default=0, nullable=False)  # legacy; the API derives elapsed time from created_at
    source = Column(String(20), default="STAFF", nullable=False)  # STAFF, GUEST_QR, TABLE_QR
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    # TapMenu port
    is_rush = Column(Boolean, default=False, nullable=False)
    estimated_prep_minutes = Column(Integer, default=15, nullable=False)
    kot_printed_at = Column(DateTime(timezone=True), nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)  # guest order accepted by a captain/waiter/admin
    accepted_by = Column(String(50), nullable=True)
    round_off_minor = Column(BigInteger, default=0, nullable=False)  # already included in total_minor
    kot_seq = Column(Integer, default=1, nullable=False)  # KOT round: +1 each time items are added or cancelled
    kot_printed_seq = Column(Integer, default=0, nullable=False)  # highest round the kitchen printed
    voided_items = Column(JSON, nullable=True)  # cancelled lines: [{lineId, name, quantity, reason, by, at, seq, noSlip}]
    void_reason = Column(String(200), nullable=True)
    tax_percent = Column(Integer, default=5, nullable=False)
    discount_minor = Column(BigInteger, default=0, nullable=False)
    coupon_code = Column(String(50), nullable=True)
    payment_method = Column(String(20), nullable=True)  # CASH, UPI, CARD, SPLIT, ROOM
    split_amounts = Column(JSON, nullable=True)  # {"cash": paise, "digital": paise}
    tendered_minor = Column(BigInteger, nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    customer_phone = Column(String(20), nullable=True)
    tracking_token_hash = Column(String(64), nullable=True, index=True)
    counter_code = Column(String(6), nullable=True, index=True)
    shift_id = Column(String(50), nullable=True)
    review_rating = Column(Integer, nullable=True)
    review_comment = Column(Text, nullable=True)
    game_played = Column(Boolean, default=False, nullable=False)
    spin_result = Column(JSON, nullable=True)
    payment_ref = Column(String(120), nullable=True, index=True)  # gateway order id, then "order_id|payment_id" once verified
    client_request_id = Column(String(64), nullable=True)  # guest's per-basket key: a retried submit returns the same order
    receipt_sent_at = Column(DateTime(timezone=True), nullable=True)  # server-sent (WhatsApp/SMS) receipt went out


class POSShift(Base):
    __tablename__ = "pos_shifts"

    shift_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    opened_by = Column(String(50), nullable=False)
    closed_by = Column(String(50), nullable=True)
    opening_float_minor = Column(BigInteger, default=0, nullable=False)
    closing_cash_minor = Column(BigInteger, nullable=True)
    expected_cash_minor = Column(BigInteger, nullable=True)
    variance_minor = Column(BigInteger, nullable=True)
    status = Column(String(10), default="OPEN", nullable=False)  # OPEN, CLOSED
    opened_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    closed_at = Column(DateTime(timezone=True), nullable=True)


class POSCoupon(Base):
    __tablename__ = "pos_coupons"

    coupon_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False, index=True)
    kind = Column(String(10), default="PERCENT", nullable=False)  # PERCENT, FLAT
    value = Column(Integer, nullable=False)  # percent, or paise for FLAT
    min_order_minor = Column(BigInteger, default=0, nullable=False)
    max_discount_minor = Column(BigInteger, nullable=True)
    description = Column(String(200), default="", nullable=False)
    categories = Column(JSON, default=list, nullable=False)  # empty = whole order
    single_use = Column(Boolean, default=False, nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    source = Column(String(20), default="ADMIN", nullable=False)  # ADMIN, SPIN, GAME
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class TableReservation(Base):
    __tablename__ = "table_reservations"

    reservation_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    table_id = Column(String(50), nullable=True)
    guest_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    party_size = Column(Integer, default=2, nullable=False)
    reserved_for = Column(DateTime(timezone=True), nullable=False, index=True)
    duration_minutes = Column(Integer, default=90, nullable=False)
    room_number = Column(String(20), nullable=True)  # in-house guest
    notes = Column(String(300), nullable=True)
    status = Column(String(20), default="BOOKED", nullable=False)  # BOOKED, SEATED, CANCELLED, NO_SHOW, COMPLETED
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class DiningSession(Base):
    """A guest's ordering session after scanning a table QR or a room card. Only the hash of the session id is stored."""
    __tablename__ = "dining_sessions"

    id_hash = Column(String(64), primary_key=True)
    property_id = Column(String(50), nullable=False, index=True)
    kind = Column(String(10), nullable=False)  # TABLE, ROOM
    table_id = Column(String(50), nullable=True)
    stay_id = Column(String(50), nullable=True)
    room_id = Column(String(50), nullable=True)  # room QR scanned while nobody was checked in
    expires_at = Column(DateTime(timezone=True), nullable=False)
