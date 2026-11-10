import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class RoomAmenity(BaseModel):
    id: str
    name: str
    icon: str


class CancellationPolicy(BaseModel):
    type: str
    freeCancellationHoursBefore: int = Field(24, serialization_alias="freeCancellationHoursBefore")
    description: str

    model_config = ConfigDict(populate_by_name=True)


class RatePlanResponse(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str] = ""
    inclusions: List[str] = Field(default_factory=list)
    basePricePerNightPaise: int = Field(..., serialization_alias="basePricePerNightPaise")
    totalNetPaise: int = Field(0, serialization_alias="totalNetPaise")
    taxPaise: int = Field(0, serialization_alias="taxPaise")
    totalGrossPaise: int = Field(0, serialization_alias="totalGrossPaise")
    mealPlan: str = Field("ROOM_ONLY", serialization_alias="mealPlan")
    cancellationPolicy: Dict[str, Any] = Field(default_factory=dict, serialization_alias="cancellationPolicy")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class RoomCategoryResponse(BaseModel):
    id: str
    code: str
    name: str
    tagline: Optional[str] = ""
    description: Optional[str] = ""
    maxAdults: int = Field(..., serialization_alias="maxAdults")
    maxChildren: int = Field(..., serialization_alias="maxChildren")
    maxTotalOccupancy: int = Field(..., serialization_alias="maxTotalOccupancy")
    bedType: str = Field("1 King Bed", serialization_alias="bedType")
    roomSizeSqFt: int = Field(450, serialization_alias="roomSizeSqFt")
    viewType: str = Field("Garden View", serialization_alias="viewType")
    heroImage: Optional[str] = Field(None, serialization_alias="heroImage")
    galleryImages: List[str] = Field(default_factory=list, serialization_alias="galleryImages")
    amenities: List[Dict[str, Any]] = Field(default_factory=list)
    availableUnits: int = Field(1, serialization_alias="availableUnits")
    startingPricePerNightPaise: int = Field(..., serialization_alias="startingPricePerNightPaise")
    ratePlans: List[RatePlanResponse] = Field(default_factory=list, serialization_alias="ratePlans")
    featured: bool = False

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class PhysicalRoomResponse(BaseModel):
    id: str
    roomNumber: str = Field(..., serialization_alias="roomNumber")
    roomTypeId: str = Field(..., serialization_alias="roomTypeId")
    roomTypeName: str = Field(..., serialization_alias="roomTypeName")
    floor: int
    wing: Optional[str] = None
    occupancyStatus: str = Field(..., serialization_alias="occupancyStatus")
    housekeepingStatus: str = Field(..., serialization_alias="housekeepingStatus")
    maintenanceStatus: str = Field("OPERATIONAL", serialization_alias="maintenanceStatus")
    currentStayId: Optional[str] = Field(None, serialization_alias="currentStayId")
    currentGuestName: Optional[str] = Field(None, serialization_alias="currentGuestName")
    assignedHousekeeper: Optional[str] = Field(None, serialization_alias="assignedHousekeeper")
    activeMaintenanceTicketId: Optional[str] = Field(None, serialization_alias="activeMaintenanceTicketId")
    notes: Optional[str] = None
    lockStatus: Optional[str] = Field("LOCKED", serialization_alias="lockStatus")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class RoomCreateRequest(BaseModel):
    room_type_id: str = Field(..., min_length=1, max_length=50)
    room_numbers: List[str] = Field(..., min_length=1, max_length=200)
    floor_number: Optional[int] = Field(None, ge=0, le=100)  # default: taken from the number (101 -> 1)
    wing: Optional[str] = Field(None, max_length=50)

    @field_validator("room_numbers")
    @classmethod
    def _clean_numbers(cls, v: List[str]) -> List[str]:
        out: List[str] = []
        for n in v:
            n = n.strip().upper()
            if not re.fullmatch(r"[A-Z0-9]{1,20}", n):
                raise ValueError(f"Room number {n!r} can only use letters and digits (no spaces or dashes).")
            if n not in out:
                out.append(n)
        return out


class RoomCreateResult(BaseModel):
    created: List[PhysicalRoomResponse]
    skipped: List[str] = Field(default_factory=list)  # numbers that already exist


class RoomStatusUpdateRequest(BaseModel):
    clean_status: Optional[str] = None
    occupancy_status: Optional[str] = None
    maintenance_status: Optional[str] = None
    assigned_housekeeper: Optional[str] = None
    notes: Optional[str] = None
