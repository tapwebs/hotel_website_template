from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Integer, BigInteger, UniqueConstraint
from backend.app.core.database import Base
from backend.app.models.base import generate_uuid, utc_now


class AuditLog(Base):
    __tablename__ = "audit_logs"

    audit_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    actor_user_id = Column(String(50), nullable=False)
    actor_username = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False)
    entity_table = Column(String(100), nullable=False)
    entity_id = Column(String(50), nullable=False)
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    justification_reason = Column(String(500), nullable=True)
    ip_address = Column(String(50), default="127.0.0.1", nullable=False)
    recorded_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class NightAuditRun(Base):
    __tablename__ = "night_audit_runs"

    run_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    business_date = Column(String(10), nullable=False, index=True)  # Business date closed, e.g. "2026-10-20"
    status = Column(String(30), nullable=False, default="IN_PROGRESS")  # "IN_PROGRESS", "COMPLETED", "FAILED"
    started_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    performed_by = Column(String(100), nullable=False, default="SYSTEM")
    new_business_date = Column(String(10), nullable=True)  # "2026-10-21"
    steps_completed = Column(JSON, default=list, nullable=False)
    room_charges_posted = Column(Integer, default=0, nullable=False)
    total_charges_minor = Column(BigInteger, default=0, nullable=False)
    total_tax_minor = Column(BigInteger, default=0, nullable=False)
    flash_report_snapshot = Column(JSON, nullable=True)
    error_message = Column(String(500), nullable=True)
    idempotency_key = Column(String(100), nullable=True, index=True)

    __table_args__ = (
        UniqueConstraint("property_id", "business_date", name="uq_night_audit_property_date"),
    )
