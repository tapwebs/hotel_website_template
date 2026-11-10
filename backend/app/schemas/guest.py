from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class GuestKYCDocumentResponse(BaseModel):
    id: str
    documentType: str = Field(..., serialization_alias="documentType")
    documentNumberMasked: str = Field(..., serialization_alias="documentNumberMasked")
    issuingCountry: str = Field(..., serialization_alias="issuingCountry")
    verified: bool
    verifiedAt: Optional[str] = Field(None, serialization_alias="verifiedAt")
    verifiedBy: Optional[str] = Field(None, serialization_alias="verifiedBy")
    presignedViewUrl: Optional[str] = Field(None, serialization_alias="presignedViewUrl")
    presignedUrlExpiresAt: Optional[str] = Field(None, serialization_alias="presignedUrlExpiresAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class PastReservationBrief(BaseModel):
    id: str
    bookingReference: str = Field(..., serialization_alias="bookingReference")
    dates: str
    roomType: str = Field(..., serialization_alias="roomType")
    spentPaise: int = Field(0, serialization_alias="spentPaise")

    model_config = ConfigDict(populate_by_name=True)


class GuestProfileResponse(BaseModel):
    id: str
    organizationId: str = Field(..., serialization_alias="organizationId")
    fullName: str = Field(..., serialization_alias="fullName")
    firstName: str = Field(..., serialization_alias="firstName")
    lastName: str = Field(..., serialization_alias="lastName")
    email: Optional[str] = ""
    phone: str
    nationality: str = "Indian"
    vipTier: str = Field("REGULAR", serialization_alias="vipTier")
    totalStays: int = Field(0, serialization_alias="totalStays")
    totalSpentPaise: int = Field(0, serialization_alias="totalSpentPaise")
    preferences: Dict[str, Any] = Field(default_factory=dict)
    kycDocuments: List[GuestKYCDocumentResponse] = Field(default_factory=list, serialization_alias="kycDocuments")
    pastReservations: List[PastReservationBrief] = Field(default_factory=list, serialization_alias="pastReservations")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class GuestCreateRequest(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: str
    nationality: Optional[str] = "Indian"
    vip_tier: Optional[str] = "REGULAR"
    preferences: Optional[Dict[str, Any]] = None


class GuestUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    nationality: Optional[str] = None
    vip_tier: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None
