"""SQLAlchemy models for the 'website' schema.

These models directly mirror the PostgreSQL 'website' schema created by the Fastify backend migrations:
- 0001_init.sql: website.users, website.sessions, website.room_rates
- 0002_account_bookings.sql: website.bookings, user profile extensions
- 0003_qr_hub.sql: website.qr_organizations, website.qr_links, website.qr_placements,
                    website.qr_offers, website.qr_visits, website.qr_clicks, website.qr_settings
- 0004_admin_tools.sql: website.activity_log
- 0005_google_auth.sql: website.users (google_sub)

Preserves exact data structures, column types, foreign keys, and unique constraints.
"""
import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from sqlalchemy.types import CHAR, TypeDecorator
from backend.app.core.database import Base
from backend.app.models.base import generate_uuid, utc_now


class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses PostgreSQL's UUID type, otherwise uses CHAR(36).
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=False))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return str(value)


SCHEMA = "website"


class WebsiteUser(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": SCHEMA}

    id = Column(GUID, primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(40), nullable=True)
    password_hash = Column(String(255), nullable=True)
    role = Column(String(20), default="guest", nullable=False)  # guest, staff, admin
    status = Column(String(20), default="active", nullable=False)  # active, disabled
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    external_hms_id = Column(String(100), nullable=True)
    external_pos_id = Column(String(100), nullable=True)

    # Profile Fields
    country = Column(String(80), nullable=True)
    address_line1 = Column(String(120), nullable=True)
    address_line2 = Column(String(120), nullable=True)
    city = Column(String(80), nullable=True)
    state = Column(String(80), nullable=True)
    postcode = Column(String(20), nullable=True)
    preferences = Column(
        JSON,
        default=lambda: {"bed": "no_preference", "dietary": "no_preference", "notes": ""},
        nullable=False,
    )
    marketing_opt_in = Column(Boolean, default=False, nullable=False)
    marketing_opt_in_at = Column(DateTime(timezone=True), nullable=True)

    # Google Auth
    google_sub = Column(String(255), unique=True, nullable=True, index=True)

    sessions = relationship("WebsiteSession", back_populates="user", cascade="all, delete-orphan")
    bookings = relationship("WebsiteBooking", back_populates="user")


class WebsiteSession(Base):
    __tablename__ = "sessions"
    __table_args__ = {"schema": SCHEMA}

    token_hash = Column(String(64), primary_key=True)  # SHA-256 of the random session token
    user_id = Column(GUID, ForeignKey(f"{SCHEMA}.users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    user = relationship("WebsiteUser", back_populates="sessions")


class WebsiteBooking(Base):
    __tablename__ = "bookings"
    __table_args__ = {"schema": SCHEMA}

    id = Column(GUID, primary_key=True, default=generate_uuid)
    reference = Column(String(20), unique=True, nullable=False, index=True)
    user_id = Column(GUID, ForeignKey(f"{SCHEMA}.users.id", ondelete="SET NULL"), nullable=True, index=True)
    client_request_id = Column(GUID, nullable=True)
    room_id = Column(String(50), nullable=False)
    room_name = Column(String(100), nullable=False)
    room_count = Column(Integer, default=1, nullable=False)
    check_in = Column(Date, nullable=False)
    check_out = Column(Date, nullable=False)
    nights = Column(Integer, nullable=False)
    adults = Column(Integer, default=1, nullable=False)
    children = Column(Integer, default=0, nullable=False)
    extra_bed = Column(Boolean, default=False, nullable=False)
    special_requests = Column(String(500), nullable=True)
    rate_per_night = Column(Integer, nullable=False)
    total_amount = Column(Integer, nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    payment_status = Column(String(20), default="unpaid", nullable=False)
    status = Column(String(20), default="confirmed", nullable=False)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    external_hms_booking_id = Column(String(100), nullable=True)
    external_pos_folio_id = Column(String(100), nullable=True)

    user = relationship("WebsiteUser", back_populates="bookings")


class WebsiteRoomRate(Base):
    __tablename__ = "room_rates"
    __table_args__ = {"schema": SCHEMA}

    room_id = Column(String(50), primary_key=True)
    rate = Column(Integer, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)


class WebsiteActivityLog(Base):
    __tablename__ = "activity_log"
    __table_args__ = {"schema": SCHEMA}

    id = Column(GUID, primary_key=True, default=generate_uuid)
    at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    actor_id = Column(GUID, ForeignKey(f"{SCHEMA}.users.id", ondelete="SET NULL"), nullable=True)
    actor_name = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False)
    target = Column(String(255), default="", nullable=False)
    detail = Column(String(1000), default="", nullable=False)


class QrOrganization(Base):
    __tablename__ = "qr_organizations"
    __table_args__ = {"schema": SCHEMA}

    id = Column(GUID, primary_key=True, default=generate_uuid)
    slug = Column(String(60), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=False)
    category = Column(String(50), default="Hotel", nullable=False)
    description = Column(String(1000), nullable=True)
    description_hi = Column(String(1000), nullable=True)
    phone = Column(String(40), nullable=True)
    whatsapp = Column(String(40), nullable=True)
    email = Column(String(254), nullable=True)
    address = Column(String(300), nullable=True)
    maps_url = Column(String(2000), nullable=True)
    website_url = Column(String(2000), nullable=True)
    review_url = Column(String(2000), nullable=True)
    profile_image = Column(String(2000), nullable=True)
    logo = Column(String(2000), nullable=True)
    theme = Column(JSON, default=dict, nullable=False)
    wifi_ssid = Column(String(64), nullable=True)
    wifi_password = Column(String(128), nullable=True)
    wifi_visible = Column(Boolean, default=False, nullable=False)
    qr_status = Column(String(20), default="draft", nullable=False)  # active, inactive, draft
    status = Column(String(20), default="published", nullable=False)  # published, unpublished, archived
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    links = relationship("QrLink", back_populates="organization", cascade="all, delete-orphan", order_by="QrLink.sort_order")
    placements = relationship("QrPlacement", back_populates="organization", cascade="all, delete-orphan")
    offers = relationship("QrOffer", back_populates="organization", cascade="all, delete-orphan")
    visits = relationship("QrVisit", back_populates="organization", cascade="all, delete-orphan")
    clicks = relationship("QrClick", back_populates="organization", cascade="all, delete-orphan")


class QrLink(Base):
    __tablename__ = "qr_links"
    __table_args__ = {"schema": SCHEMA}

    id = Column(GUID, primary_key=True, default=generate_uuid)
    organization_id = Column(GUID, ForeignKey(f"{SCHEMA}.qr_organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(100), nullable=False)
    title_hi = Column(String(100), nullable=True)
    destination_url = Column(String(2000), nullable=False)
    category = Column(String(40), default="Explore", nullable=False)
    icon = Column(String(40), nullable=True)
    description = Column(String(300), nullable=True)
    description_hi = Column(String(300), nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    is_featured = Column(Boolean, default=False, nullable=False)
    status = Column(String(20), default="active", nullable=False)  # active, disabled
    show_from = Column(DateTime(timezone=True), nullable=True)
    show_until = Column(DateTime(timezone=True), nullable=True)
    hours = Column(JSON, nullable=True)
    click_count = Column(Integer, default=0, nullable=False)
    last_clicked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    organization = relationship("QrOrganization", back_populates="links")


class QrPlacement(Base):
    __tablename__ = "qr_placements"
    __table_args__ = {"schema": SCHEMA}

    id = Column(GUID, primary_key=True, default=generate_uuid)
    organization_id = Column(GUID, ForeignKey(f"{SCHEMA}.qr_organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(40), nullable=False)
    label = Column(String(80), nullable=False)
    kind = Column(String(20), default="other", nullable=False)  # room, table, lobby, hall, desk, other
    status = Column(String(20), default="active", nullable=False)  # active, disabled
    room_id = Column(String(50), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    organization = relationship("QrOrganization", back_populates="placements")


class QrOffer(Base):
    __tablename__ = "qr_offers"
    __table_args__ = {"schema": SCHEMA}

    id = Column(GUID, primary_key=True, default=generate_uuid)
    organization_id = Column(GUID, ForeignKey(f"{SCHEMA}.qr_organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(String(300), nullable=False)
    text_hi = Column(String(300), nullable=True)
    link_url = Column(String(2000), nullable=True)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    organization = relationship("QrOrganization", back_populates="offers")


class QrVisit(Base):
    __tablename__ = "qr_visits"
    __table_args__ = {"schema": SCHEMA}

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    organization_id = Column(GUID, ForeignKey(f"{SCHEMA}.qr_organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    placement_id = Column(GUID, ForeignKey(f"{SCHEMA}.qr_placements.id", ondelete="SET NULL"), nullable=True, index=True)
    source = Column(String(20), nullable=False)  # scan, direct
    device_type = Column(String(50), default="unknown", nullable=False)
    browser = Column(String(50), default="unknown", nullable=False)
    os = Column(String(50), default="unknown", nullable=False)
    referrer_host = Column(String(255), nullable=True)
    visited_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    organization = relationship("QrOrganization", back_populates="visits")
    placement = relationship("QrPlacement")


class QrClick(Base):
    __tablename__ = "qr_clicks"
    __table_args__ = {"schema": SCHEMA}

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    organization_id = Column(GUID, ForeignKey(f"{SCHEMA}.qr_organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    link_id = Column(GUID, ForeignKey(f"{SCHEMA}.qr_links.id", ondelete="CASCADE"), nullable=True, index=True)
    is_review = Column(Boolean, default=False, nullable=False)
    placement_id = Column(GUID, ForeignKey(f"{SCHEMA}.qr_placements.id", ondelete="SET NULL"), nullable=True, index=True)
    device_type = Column(String(50), default="unknown", nullable=False)
    browser = Column(String(50), default="unknown", nullable=False)
    referrer_host = Column(String(255), nullable=True)
    clicked_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    organization = relationship("QrOrganization", back_populates="clicks")
    link = relationship("QrLink")
    placement = relationship("QrPlacement")


class QrSetting(Base):
    __tablename__ = "qr_settings"
    __table_args__ = {"schema": SCHEMA}

    key = Column(String(100), primary_key=True)
    value = Column(JSON, nullable=False)
