from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    username_or_email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class PropertyBrief(BaseModel):
    propertyId: str = Field(..., serialization_alias="propertyId")
    propertyName: str = Field(..., serialization_alias="propertyName")
    city: str
    currency: str

    model_config = ConfigDict(populate_by_name=True)


class UserSessionResponse(BaseModel):
    userId: str = Field(..., serialization_alias="userId")
    fullName: str = Field(..., serialization_alias="fullName")
    email: str
    avatarUrl: Optional[str] = Field(None, serialization_alias="avatarUrl")
    role: str
    accountType: Optional[str] = Field(None, serialization_alias="accountType")
    jobRole: Optional[str] = Field(None, serialization_alias="jobRole")
    permissions: List[str]
    organizationId: str = Field(..., serialization_alias="organizationId")
    organizationName: str = Field(..., serialization_alias="organizationName")
    activePropertyId: str = Field(..., serialization_alias="activePropertyId")
    activePropertyName: str = Field(..., serialization_alias="activePropertyName")
    availableProperties: List[PropertyBrief] = Field(default_factory=list, serialization_alias="availableProperties")
    managementScope: List[str] = Field(default_factory=list, serialization_alias="managementScope")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class SwitchPropertyRequest(BaseModel):
    property_id: str
