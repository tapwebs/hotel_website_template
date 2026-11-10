from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_user, get_property_context, require_permission
from backend.app.core.rbac import Permission
from backend.app.models.user import User
from backend.app.schemas.reservation import CheckInRequest, CheckOutRequest, RoomMoveRequest, WalkInCheckInRequest
from backend.app.services.front_desk_service import FrontDeskService

router = APIRouter(prefix="/front-desk", tags=["Front Desk & Stays"])


@router.get("/business-date", summary="Get Current Hotel Business Date")
async def get_business_date(
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await FrontDeskService.get_business_date(db, property_id)



@router.post("/walk-in", summary="Front Desk Fast Walk-In Check-In")
async def walk_in_check_in(
    request: WalkInCheckInRequest,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.PERFORM_CHECK_IN.value)),
    db: AsyncSession = Depends(get_db)
):
    return await FrontDeskService.walk_in_check_in(db, property_id, request)


@router.post("/check-in", summary="Guest Check-In")
async def check_in(
    request: CheckInRequest,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.PERFORM_CHECK_IN.value)),
    db: AsyncSession = Depends(get_db)
):
    return await FrontDeskService.check_in_guest(db, property_id, request)


@router.post("/check-out", summary="Guest Check-Out & Folio Finalization")
async def check_out(
    request: CheckOutRequest,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.PERFORM_CHECK_OUT.value)),
    db: AsyncSession = Depends(get_db)
):
    return await FrontDeskService.check_out_guest(db, property_id, request)


@router.post("/room-move", summary="In-Stay Room Move")
async def room_move(
    request: RoomMoveRequest,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.MOVE_ROOMS.value)),
    db: AsyncSession = Depends(get_db)
):
    return await FrontDeskService.move_room(db, property_id, request)
