from sqlalchemy import Column, String, Integer, BigInteger, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.core.database import Base
from backend.app.models.base import generate_uuid, utc_now


class GuestProfile(Base):
    __tablename__ = "guest_profiles"

    guest_id = Column(String(50), primary_key=True, default=generate_uuid)
    org_id = Column(String(50), ForeignKey("organizations.org_id", ondelete="RESTRICT"), nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    full_name = Column(String(200), nullable=False)
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(30), nullable=False, index=True)
    nationality = Column(String(50), default="Indian", nullable=False)
    vip_tier = Column(String(20), default="REGULAR", nullable=False)  # REGULAR, SILVER, GOLD, PLATINUM
    total_stays = Column(Integer, default=0, nullable=False)
    total_spent_minor = Column(BigInteger, default=0, nullable=False)
    preferences = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    documents = relationship("GuestDocument", back_populates="guest", cascade="all, delete-orphan")


class GuestDocument(Base):
    __tablename__ = "guest_documents"

    document_id = Column(String(50), primary_key=True, default=generate_uuid)
    guest_id = Column(String(50), ForeignKey("guest_profiles.guest_id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String(50), nullable=False)
    property_id = Column(String(50), nullable=False)
    document_type = Column(String(50), nullable=False)  # AADHAAR, PASSPORT, DRIVING_LICENSE, NATIONAL_ID, VISA
    document_number_masked = Column(String(100), nullable=False)
    issuing_country = Column(String(50), default="India", nullable=False)
    s3_key = Column(String(255), nullable=True)
    presigned_view_url = Column(String(1000), nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    verified_by = Column(String(100), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    guest = relationship("GuestProfile", back_populates="documents")
