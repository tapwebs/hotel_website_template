from typing import List, Optional
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_property_context, require_permission
from backend.app.core.errors import NotFoundException
from backend.app.core.rbac import Permission
from backend.app.core.ratelimit import get_client_ip, hit
from backend.app.schemas.reservation import HoldCreateRequest, RoomHoldResponse
from backend.app.schemas.room import RoomCategoryResponse
from backend.app.services.availability_service import AvailabilityService
from backend.app.services.room_service import RoomService

router = APIRouter(prefix="/availability", tags=["Availability & Booking Engine"])


@router.get("/categories", response_model=List[RoomCategoryResponse], summary="Search Available Room Categories")
async def get_categories(
    check_in: Optional[str] = None,
    check_out: Optional[str] = None,
    adults: Optional[int] = 2,
    children: Optional[int] = 0,
    rooms_count: Optional[int] = 1,
    property_id: str = Depends(get_property_context),
    db: AsyncSession = Depends(get_db)
):
    return await RoomService.get_categories_cached(db, property_id)


@router.get("/categories/{category_id}", response_model=RoomCategoryResponse, summary="Get Category Details")
async def get_category(
    category_id: str,
    property_id: str = Depends(get_property_context),
    db: AsyncSession = Depends(get_db)
):
    cat = await RoomService.get_category_by_id(db, property_id, category_id)
    if not cat:
        raise NotFoundException("Room category not found.")
    return cat


@router.post("/hold", response_model=RoomHoldResponse, summary="Create Room Inventory Hold")
async def create_hold(
    request: HoldCreateRequest,
    req: Request,
    property_id: str = Depends(get_property_context),
    current_user=Depends(require_permission(Permission.CREATE_RESERVATIONS.value)),
    db: AsyncSession = Depends(get_db)
):
    ip = get_client_ip(req)
    hit(f"hold:ip:{ip}", limit=10, window_seconds=600)
    return await AvailabilityService.create_hold(db, property_id, request)
