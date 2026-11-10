from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from backend.app.core.database import Base
from backend.app.models.base import generate_uuid, utc_now


class HousekeepingTask(Base):
    __tablename__ = "housekeeping_tasks"

    task_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    room_id = Column(String(50), ForeignKey("rooms.room_id", ondelete="CASCADE"), nullable=False, index=True)
    task_type = Column(String(50), default="FULL_TURNOVER", nullable=False)  # FULL_TURNOVER, STAYOVER_CLEAN, TOUCH_UP, DEEP_CLEAN, INSPECTION
    status = Column(String(30), default="DIRTY", nullable=False)  # DIRTY, CLEANING, CLEANED, INSPECTED
    priority = Column(String(20), default="MEDIUM", nullable=False)  # LOW, MEDIUM, HIGH, VIP
    assigned_to_staff_id = Column(String(50), nullable=True)
    assigned_to_staff_name = Column(String(100), nullable=True)
    notes = Column(String(500), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    inspected_at = Column(DateTime(timezone=True), nullable=True)
    inspected_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class MaintenanceTicket(Base):
    __tablename__ = "maintenance_tickets"

    ticket_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    ticket_number = Column(String(50), unique=True, nullable=False, index=True)
    room_id = Column(String(50), ForeignKey("rooms.room_id", ondelete="SET NULL"), nullable=True, index=True)
    location_area = Column(String(100), nullable=True)
    category = Column(String(50), default="HVAC", nullable=False)  # PLUMBING, ELECTRICAL, HVAC, CARPENTRY, APPLIANCE, STRUCTURAL
    priority = Column(String(20), default="MEDIUM", nullable=False)  # CRITICAL, HIGH, MEDIUM, LOW
    status = Column(String(30), default="OPEN", nullable=False)  # OPEN, IN_PROGRESS, WAITING_PARTS, RESOLVED, CLOSED
    title = Column(String(200), nullable=False)
    description = Column(String(1000), nullable=False)
    reported_by = Column(String(100), nullable=False)
    reported_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    assigned_technician = Column(String(100), nullable=True)
    photo_url = Column(String(500), nullable=True)
    blocks_room_from_sale = Column(Boolean, default=False, nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_notes = Column(String(1000), nullable=True)
