from sqlalchemy import Column, String, Integer, BigInteger, Boolean, DateTime, ForeignKey, JSON, Date, UniqueConstraint
from sqlalchemy.orm import relationship
from backend.app.core.database import Base
from backend.app.models.base import generate_uuid, utc_now


class RoomType(Base):
    __tablename__ = "room_types"

    room_type_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)
    tagline = Column(String(255), nullable=True)
    description = Column(String(1000), nullable=True)
    base_adults = Column(Integer, default=2, nullable=False)
    max_adults = Column(Integer, default=3, nullable=False)
    max_children = Column(Integer, default=2, nullable=False)
    max_occupancy = Column(Integer, default=4, nullable=False)
    bed_type = Column(String(100), default="1 King Bed", nullable=False)
    room_size_sqft = Column(Integer, default=450, nullable=False)
    view_type = Column(String(100), default="Garden View", nullable=False)
    hero_image = Column(String(500), nullable=True)
    gallery_images = Column(JSON, default=list, nullable=False)
    amenities = Column(JSON, default=list, nullable=False)
    base_rate_minor = Column(BigInteger, default=450000, nullable=False)  # in paise
    featured = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("property_id", "code", name="uq_room_types_property_code"),
    )

    rate_plans = relationship("RatePlan", back_populates="room_type", cascade="all, delete-orphan")
    rooms = relationship("Room", back_populates="room_type")


class RatePlan(Base):
    __tablename__ = "rate_plans"

    rate_plan_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    room_type_id = Column(String(50), ForeignKey("room_types.room_type_id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    inclusions = Column(JSON, default=list, nullable=False)
    meal_plan = Column(String(50), default="ROOM_ONLY", nullable=False)
    base_price_minor = Column(BigInteger, nullable=False)  # in paise
    cancellation_policy = Column(JSON, default=dict, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    room_type = relationship("RoomType", back_populates="rate_plans")


class Room(Base):
    __tablename__ = "rooms"

    room_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    room_type_id = Column(String(50), ForeignKey("room_types.room_type_id", ondelete="RESTRICT"), nullable=False, index=True)
    room_number = Column(String(20), nullable=False)
    floor_number = Column(Integer, default=1, nullable=False)
    wing = Column(String(50), nullable=True)
    clean_status = Column(String(30), default="CLEAN", nullable=False, index=True)  # CLEAN, DIRTY, CLEANING, INSPECTED, TOUCH_UP
    occupancy_status = Column(String(30), default="VACANT", nullable=False, index=True)  # VACANT, OCCUPIED, OUT_OF_ORDER, OUT_OF_SERVICE
    maintenance_status = Column(String(30), default="OPERATIONAL", nullable=False, index=True)
    lock_status = Column(String(20), default="LOCKED", nullable=True)  # LOCKED, UNLOCKED, DND
    assigned_housekeeper = Column(String(100), nullable=True)
    current_guest_name = Column(String(100), nullable=True)
    current_stay_id = Column(String(50), nullable=True)
    active_maintenance_ticket_id = Column(String(50), nullable=True)
    notes = Column(String(500), nullable=True)
    # Permanent in-room ordering QR (printed once and placed in the room). It is not tied to any guest: scanning it charges
    # whoever is checked in to this room at that moment. Reset it to make the printed QR stop working.
    qr_token = Column(String(64), unique=True, index=True, nullable=True, default=generate_uuid)
    version_id = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("property_id", "room_number", name="uq_rooms_property_room_number"),
    )

    room_type = relationship("RoomType", back_populates="rooms")


class DailyInventory(Base):
    __tablename__ = "daily_inventory"

    inventory_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    room_type_id = Column(String(50), ForeignKey("room_types.room_type_id", ondelete="CASCADE"), nullable=False, index=True)
    business_date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    total_rooms = Column(Integer, default=0, nullable=False)
    ooo_rooms = Column(Integer, default=0, nullable=False)
    oos_rooms = Column(Integer, default=0, nullable=False)
    reserved_rooms = Column(Integer, default=0, nullable=False)
    occupied_rooms = Column(Integer, default=0, nullable=False)
    held_rooms = Column(Integer, default=0, nullable=False)
    available_rooms = Column(Integer, default=0, nullable=False)
    version_id = Column(Integer, default=1, nullable=False)

    __table_args__ = (
        UniqueConstraint("property_id", "room_type_id", "business_date", name="uq_daily_inv_lookup"),
    )
