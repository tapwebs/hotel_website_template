from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.core.database import Base
from backend.app.models.base import generate_uuid, utc_now
from backend.app.core.timezone import get_kolkata_calendar_date


class Organization(Base):
    __tablename__ = "organizations"

    org_id = Column(String(50), primary_key=True, default=generate_uuid)
    name = Column(String(150), nullable=False)
    legal_entity_name = Column(String(200), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    properties = relationship("Property", back_populates="organization", cascade="all, delete-orphan")


class Property(Base):
    __tablename__ = "properties"

    property_id = Column(String(50), primary_key=True, default=generate_uuid)
    org_id = Column(String(50), ForeignKey("organizations.org_id", ondelete="RESTRICT"), nullable=False)
    code = Column(String(30), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    address_line1 = Column(String(255), nullable=False)
    city = Column(String(100), nullable=False)
    state_code = Column(String(10), nullable=False)
    postal_code = Column(String(20), nullable=False)
    country_code = Column(String(10), default="IN", nullable=False)
    gstin = Column(String(20), nullable=True)
    currency = Column(String(10), default="INR", nullable=False)
    timezone = Column(String(50), default="Asia/Kolkata", nullable=False)
    phone = Column(String(30), nullable=True)
    email = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    organization = relationship("Organization", back_populates="properties")
    settings = relationship("PropertySettings", back_populates="property", uselist=False, cascade="all, delete-orphan")


class PropertySettings(Base):
    __tablename__ = "property_settings"

    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), primary_key=True)
    current_business_date = Column(String(10), default=get_kolkata_calendar_date, nullable=False)
    night_audit_status = Column(String(30), default="IDLE", nullable=False)
    settings_json = Column(JSON, default=dict, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    property = relationship("Property", back_populates="settings")
