from typing import List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_property_context, require_any_permission, require_permission, require_roles
from backend.app.core.rbac import Permission
from backend.app.models.user import User
from backend.app.schemas.room import PhysicalRoomResponse, RoomCreateRequest, RoomCreateResult, RoomStatusUpdateRequest
from backend.app.services.room_service import RoomService

router = APIRouter(prefix="/rooms", tags=["Rooms Inventory"])


@router.get("", response_model=List[PhysicalRoomResponse], summary="List Physical Rooms")
async def get_rooms(
    floor: Optional[int] = None,
    clean_status: Optional[str] = None,
    occupancy_status: Optional[str] = None,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_any_permission([
        Permission.VIEW_DASHBOARD.value,
        Permission.VIEW_FRONT_DESK.value,
        Permission.VIEW_RESERVATIONS.value,
        Permission.MANAGE_HOUSEKEEPING.value,
        Permission.MANAGE_MAINTENANCE.value
    ])),
    db: AsyncSession = Depends(get_db)
):
    return await RoomService.get_physical_rooms(
        db,
        property_id,
        floor=floor,
        clean_status=clean_status,
        occupancy_status=occupancy_status
    )


@router.post("", response_model=RoomCreateResult, status_code=201, summary="Add one or more rooms")
async def create_rooms(
    body: RoomCreateRequest,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.MANAGE_SETTINGS.value)),
    db: AsyncSession = Depends(get_db),
):
    return await RoomService.create_rooms(db, property_id, body)


@router.post("/types/setup", summary="Create the standard room types if missing")
async def setup_room_types(
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.MANAGE_SETTINGS.value)),
    db: AsyncSession = Depends(get_db),
):
    # Imported here: the seed module loads every model and is only needed for this one call.
    from backend.app.seed.production_setup import ensure_room_types
    types = await ensure_room_types(db, property_id)
    await db.commit()
    return [{"id": t.room_type_id, "code": t.code, "name": t.name} for t in types.values()]


class RoomTypeRateBody(BaseModel):
    rate: int = Field(..., ge=100, le=1_000_000, description="Rupees per night")


@router.put("/types/{room_type_id}/rate", summary="Set a room type's nightly rate (super admin)")
async def set_room_type_rate(
    room_type_id: str,
    body: RoomTypeRateBody,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_roles([])),  # super admin only
    db: AsyncSession = Depends(get_db),
):
    """One rate for the room type: HMS bookings, walk-ins and the website all use it."""
    from backend.app.core.errors import NotFoundException
    from backend.app.core.config import settings
    from backend.app.models.base import utc_now
    from backend.app.models.room import RatePlan, RoomType
    from backend.app.models.website import WebsiteRoomRate

    rt = (await db.execute(select(RoomType).where(RoomType.room_type_id == room_type_id, RoomType.property_id == property_id))).scalar_one_or_none()
    if not rt:
        raise NotFoundException("Room type not found")
    minor = body.rate * 100
    rt.base_rate_minor = minor
    for plan in (await db.execute(select(RatePlan).where(RatePlan.room_type_id == rt.room_type_id))).scalars():
        plan.base_price_minor = minor
    # The public website quotes from its own per-room override; keep it in step.
    pairs = (p.split(":", 1) for p in settings.WEBSITE_ROOM_MAP.split(",") if ":" in p)
    for web_id, code in pairs:
        if code.strip() == rt.code:
            row = await db.get(WebsiteRoomRate, web_id.strip())
            if row:
                row.rate, row.updated_at = body.rate, utc_now()
            else:
                db.add(WebsiteRoomRate(room_id=web_id.strip(), rate=body.rate))
    await db.commit()
    return {"id": rt.room_type_id, "code": rt.code, "name": rt.name, "rate": body.rate}


@router.patch("/{room_id}/status", response_model=PhysicalRoomResponse, summary="Update Room Status")
async def update_room_status(
    room_id: str,
    update_data: RoomStatusUpdateRequest,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_any_permission([
        Permission.OVERRIDE_ROOM_STATUS.value,
        Permission.UPDATE_CLEANING_STATUS.value
    ])),
    db: AsyncSession = Depends(get_db)
):
    return await RoomService.update_room_status(db, property_id, room_id, update_data)
