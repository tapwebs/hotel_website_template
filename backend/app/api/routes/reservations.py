from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_property_context, require_permission
from backend.app.core.errors import NotFoundException
from backend.app.core.rbac import Permission
from backend.app.models.user import User
from backend.app.schemas.reservation import (
    ConfirmBookingRequest,
    ConfirmedBookingResponse,
    ReservationResponse
)
from backend.app.services.reservation_service import ReservationService

router = APIRouter(prefix="/reservations", tags=["Reservations"])


@router.post("/confirm", response_model=ConfirmedBookingResponse, summary="Confirm Reservation from Hold")
async def confirm_booking(
    request: ConfirmBookingRequest,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.CREATE_RESERVATIONS.value)),
    db: AsyncSession = Depends(get_db)
):
    return await ReservationService.confirm_booking(db, property_id, request)


@router.get("", response_model=List[ReservationResponse], summary="List Reservations")
async def get_reservations(
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.VIEW_RESERVATIONS.value)),
    db: AsyncSession = Depends(get_db)
):
    return await ReservationService.get_all_reservations(db, property_id, status=status, search=search, limit=limit, offset=offset)


@router.get("/{id_or_ref}", response_model=ReservationResponse, summary="Get Reservation by ID or Reference")
async def get_reservation(
    id_or_ref: str,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.VIEW_RESERVATIONS.value)),
    db: AsyncSession = Depends(get_db)
):
    res = await ReservationService.get_reservation_by_id(db, property_id, id_or_ref)
    if not res:
        raise NotFoundException("Reservation not found.")
    return res


@router.post("/{id_or_ref}/confirm", response_model=ReservationResponse, summary="Confirm Reservation")
async def confirm_reservation(
    id_or_ref: str,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.MANAGE_RESERVATIONS.value)),
    db: AsyncSession = Depends(get_db)
):
    return await ReservationService.confirm_reservation(db, property_id, id_or_ref)


@router.post("/{id_or_ref}/reject", response_model=ReservationResponse, summary="Reject Pending Reservation")
async def reject_reservation(
    id_or_ref: str,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.MANAGE_RESERVATIONS.value)),
    db: AsyncSession = Depends(get_db)
):
    return await ReservationService.reject_reservation(db, property_id, id_or_ref)


@router.post("/{id_or_ref}/cancel", response_model=ReservationResponse, summary="Cancel Reservation")
async def cancel_reservation(
    id_or_ref: str,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.MANAGE_RESERVATIONS.value)),
    db: AsyncSession = Depends(get_db)
):
    return await ReservationService.cancel_reservation(db, property_id, id_or_ref)


@router.post("/{id_or_ref}/no-show", response_model=ReservationResponse, summary="Mark Reservation as NO-SHOW")
async def mark_reservation_no_show(
    id_or_ref: str,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.MANAGE_RESERVATIONS.value)),
    db: AsyncSession = Depends(get_db)
):
    return await ReservationService.mark_reservation_no_show(db, property_id, id_or_ref)

