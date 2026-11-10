from sqlalchemy import Column, String, Integer, BigInteger, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.core.database import Base
from backend.app.models.base import generate_uuid, utc_now


class RoomHold(Base):
    __tablename__ = "room_holds"

    hold_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    room_type_id = Column(String(50), ForeignKey("room_types.room_type_id", ondelete="CASCADE"), nullable=False, index=True)
    rate_plan_id = Column(String(50), ForeignKey("rate_plans.rate_plan_id", ondelete="CASCADE"), nullable=False)
    checkin_date = Column(String(10), nullable=False)  # YYYY-MM-DD
    checkout_date = Column(String(10), nullable=False)  # YYYY-MM-DD
    nights = Column(Integer, default=1, nullable=False)
    rooms_count = Column(Integer, default=1, nullable=False)
    adults = Column(Integer, default=2, nullable=False)
    children = Column(Integer, default=0, nullable=False)
    pricing_summary = Column(JSON, default=dict, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class Reservation(Base):
    __tablename__ = "reservations"

    reservation_id = Column(String(50), primary_key=True, default=generate_uuid)
    booking_reference = Column(String(50), unique=True, nullable=False, index=True)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    guest_id = Column(String(50), ForeignKey("guest_profiles.guest_id", ondelete="RESTRICT"), nullable=False, index=True)
    source = Column(String(50), default="DIRECT_WEB", nullable=False)
    status = Column(String(30), default="CONFIRMED", nullable=False, index=True)  # PENDING, CONFIRMED, CANCELLED, NO_SHOW, COMPLETED
    checkin_date = Column(String(10), nullable=False, index=True)
    checkout_date = Column(String(10), nullable=False, index=True)
    nights = Column(Integer, default=1, nullable=False)
    rooms_count = Column(Integer, default=1, nullable=False)
    total_amount_minor = Column(BigInteger, default=0, nullable=False)
    paid_amount_minor = Column(BigInteger, default=0, nullable=False)
    balance_amount_minor = Column(BigInteger, default=0, nullable=False)
    payment_status = Column(String(30), default="UNPAID", nullable=False)  # UNPAID, PARTIALLY_PAID, PAID, REFUNDED
    special_requests = Column(String(1000), nullable=True)
    master_folio_id = Column(String(50), nullable=True)
    external_booking_ref = Column(String(64), unique=True, nullable=True, index=True)  # website bookingRef
    version_id = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    rooms = relationship("ReservationRoom", back_populates="reservation", cascade="all, delete-orphan")
    guest = relationship("GuestProfile", foreign_keys=[guest_id])


class ReservationRoom(Base):
    __tablename__ = "reservation_rooms"

    reservation_room_id = Column(String(50), primary_key=True, default=generate_uuid)
    reservation_id = Column(String(50), ForeignKey("reservations.reservation_id", ondelete="CASCADE"), nullable=False, index=True)
    room_type_id = Column(String(50), ForeignKey("room_types.room_type_id", ondelete="RESTRICT"), nullable=False)
    assigned_room_id = Column(String(50), ForeignKey("rooms.room_id", ondelete="SET NULL"), nullable=True)
    rate_plan_id = Column(String(50), ForeignKey("rate_plans.rate_plan_id", ondelete="RESTRICT"), nullable=False)
    checkin_date = Column(String(10), nullable=False)
    checkout_date = Column(String(10), nullable=False)
    nights = Column(Integer, default=1, nullable=False)
    adults = Column(Integer, default=2, nullable=False)
    children = Column(Integer, default=0, nullable=False)
    rate_per_night_minor = Column(BigInteger, nullable=False)
    total_gross_minor = Column(BigInteger, nullable=False)

    reservation = relationship("Reservation", back_populates="rooms")
    stay = relationship("Stay", back_populates="reservation_room", uselist=False)


class Stay(Base):
    __tablename__ = "stays"

    stay_id = Column(String(50), primary_key=True, default=generate_uuid)
    reservation_room_id = Column(String(50), ForeignKey("reservation_rooms.reservation_room_id", ondelete="CASCADE"), unique=True, nullable=False)
    room_id = Column(String(50), ForeignKey("rooms.room_id", ondelete="RESTRICT"), nullable=False)
    checkin_timestamp = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    checkout_timestamp = Column(DateTime(timezone=True), nullable=True)
    qr_access_token = Column(String(100), unique=True, nullable=False, default=generate_uuid)
    status = Column(String(30), default="SCHEDULED", nullable=False, index=True)  # SCHEDULED, CHECKED_IN, CHECKED_OUT

    reservation_room = relationship("ReservationRoom", back_populates="stay")
