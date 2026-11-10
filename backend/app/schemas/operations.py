from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class HousekeepingTaskResponse(BaseModel):
    id: str
    roomId: str = Field(..., serialization_alias="roomId")
    roomNumber: str = Field(..., serialization_alias="roomNumber")
    roomTypeName: str = Field(..., serialization_alias="roomTypeName")
    floor: int
    taskType: str = Field(..., serialization_alias="taskType")
    status: str
    priority: str
    assignedToStaffId: Optional[str] = Field(None, serialization_alias="assignedToStaffId")
    assignedToStaffName: Optional[str] = Field(None, serialization_alias="assignedToStaffName")
    startedAt: Optional[str] = Field(None, serialization_alias="startedAt")
    completedAt: Optional[str] = Field(None, serialization_alias="completedAt")
    inspectedAt: Optional[str] = Field(None, serialization_alias="inspectedAt")
    inspectedBy: Optional[str] = Field(None, serialization_alias="inspectedBy")
    notes: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class HousekeepingStatusUpdateRequest(BaseModel):
    status: str  # DIRTY, CLEANING, CLEANED, INSPECTED
    notes: Optional[str] = None
    assigned_to_staff_id: Optional[str] = None
    assigned_to_staff_name: Optional[str] = None


class MaintenanceTicketResponse(BaseModel):
    id: str
    ticketNumber: str = Field(..., serialization_alias="ticketNumber")
    roomId: Optional[str] = Field(None, serialization_alias="roomId")
    roomNumber: Optional[str] = Field(None, serialization_alias="roomNumber")
    locationArea: Optional[str] = Field(None, serialization_alias="locationArea")
    category: str
    priority: str
    status: str
    title: str
    description: str
    reportedBy: str = Field(..., serialization_alias="reportedBy")
    reportedAt: str = Field(..., serialization_alias="reportedAt")
    assignedTechnician: Optional[str] = Field(None, serialization_alias="assignedTechnician")
    photoUrl: Optional[str] = Field(None, serialization_alias="photoUrl")
    blocksRoomFromSale: bool = Field(False, serialization_alias="blocksRoomFromSale")
    resolvedAt: Optional[str] = Field(None, serialization_alias="resolvedAt")
    resolutionNotes: Optional[str] = Field(None, serialization_alias="resolutionNotes")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class MaintenanceTicketCreateRequest(BaseModel):
    room_id: Optional[str] = None
    room_number: Optional[str] = None
    location_area: Optional[str] = None
    category: str = "HVAC"
    priority: str = "MEDIUM"
    title: str
    description: Optional[str] = ""
    reported_by: Optional[str] = "Engineering Staff"
    assigned_technician: Optional[str] = None
    blocks_room_from_sale: bool = False


class MaintenanceStatusUpdateRequest(BaseModel):
    status: Optional[str] = None  # OPEN, ASSIGNED, IN_PROGRESS, ON_HOLD, WAITING_PARTS, RESOLVED, CLOSED, CANCELLED
    assigned_technician: Optional[str] = None
    resolution_notes: Optional[str] = None
    priority: Optional[str] = None
    blocks_room_from_sale: Optional[bool] = None
