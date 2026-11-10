from typing import Any, Dict, Optional
from pydantic import BaseModel


class SettingsPayload(BaseModel):
    settings: Dict[str, Any]


class SettingsResponse(BaseModel):
    property_id: str
    current_business_date: str
    night_audit_status: str
    settings: Dict[str, Any]
