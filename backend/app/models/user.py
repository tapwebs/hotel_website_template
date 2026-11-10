from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, JSON
from sqlalchemy.orm import relationship
from backend.app.core.database import Base
from backend.app.models.base import generate_uuid, utc_now


class User(Base):
    __tablename__ = "users"

    user_id = Column(String(50), primary_key=True, default=generate_uuid)
    org_id = Column(String(50), ForeignKey("organizations.org_id", ondelete="RESTRICT"), nullable=False)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="SET NULL"), nullable=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(100), nullable=False)
    phone_number = Column(String(30), nullable=True)
    password_hash = Column(String(255), nullable=False)
    role_code = Column(String(50), nullable=False, default="ROLE_WAITER")
    account_type = Column(String(50), nullable=True, default=None)
    job_role = Column(String(50), nullable=True, default=None)
    permissions = Column(JSON, default=list, nullable=False)
    management_scope = Column(JSON, default=list, nullable=False)
    avatar_url = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    token_version = Column(Integer, default=1, nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
