from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.core.dependencies import require_any_permission, require_permission
from backend.app.core.errors import NotFoundException
from backend.app.core.rbac import Permission
from backend.app.models.user import User
from backend.app.schemas.guest import GuestCreateRequest, GuestProfileResponse
from backend.app.services.guest_service import GuestService

router = APIRouter(prefix="/guests", tags=["Guests CRM"])


@router.get("", response_model=List[GuestProfileResponse], summary="List Guest Profiles")
async def get_guests(
    search: Optional[str] = None,
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_permission(Permission.VIEW_GUEST_PROFILES.value)),
    db: AsyncSession = Depends(get_db)
):
    org_id = current_user.org_id if current_user else settings.DEFAULT_ORG_ID
    return await GuestService.get_all_guests(db, org_id, search=search, limit=limit, offset=offset)


@router.get("/{guest_id}", response_model=GuestProfileResponse, summary="Get Guest Profile by ID")
async def get_guest(
    guest_id: str,
    current_user: User = Depends(require_permission(Permission.VIEW_GUEST_PROFILES.value)),
    db: AsyncSession = Depends(get_db)
):
    org_id = current_user.org_id if current_user else settings.DEFAULT_ORG_ID
    guest = await GuestService.get_guest_by_id(db, org_id, guest_id)
    if not guest:
        raise NotFoundException("Guest profile not found.")
    return guest


@router.post("", response_model=GuestProfileResponse, summary="Create Guest Profile")
async def create_guest(
    request: GuestCreateRequest,
    current_user: User = Depends(require_any_permission([
        Permission.VIEW_GUEST_PROFILES.value,
        Permission.CREATE_RESERVATIONS.value,
        Permission.PERFORM_CHECK_IN.value
    ])),
    db: AsyncSession = Depends(get_db)
):
    org_id = current_user.org_id if current_user else settings.DEFAULT_ORG_ID
    return await GuestService.create_guest(db, org_id, request)
