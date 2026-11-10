from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_property_context, require_permission
from backend.app.core.rbac import Permission
from backend.app.models.user import User
from backend.app.schemas.operations import (
    MaintenanceStatusUpdateRequest,
    MaintenanceTicketCreateRequest,
    MaintenanceTicketResponse
)
from backend.app.services.operations_service import OperationsService

router = APIRouter(prefix="/maintenance", tags=["Maintenance & Engineering"])


@router.get("/tickets", response_model=List[MaintenanceTicketResponse], summary="List Maintenance Tickets")
async def get_tickets(
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.MANAGE_MAINTENANCE.value)),
    db: AsyncSession = Depends(get_db)
):
    return await OperationsService.get_maintenance_tickets(db, property_id, status=status, limit=limit, offset=offset)


@router.post("/tickets", response_model=MaintenanceTicketResponse, summary="Create Maintenance Ticket")
async def create_ticket(
    request: MaintenanceTicketCreateRequest,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.MANAGE_MAINTENANCE.value)),
    db: AsyncSession = Depends(get_db)
):
    if not request.reported_by or request.reported_by == "Engineering Staff":
        request.reported_by = current_user.full_name or current_user.email or "Engineering Staff"
    return await OperationsService.create_maintenance_ticket(db, property_id, request)


@router.get("/tickets/{ticket_id}", response_model=MaintenanceTicketResponse, summary="Get Maintenance Ticket Details")
async def get_ticket(
    ticket_id: str,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.MANAGE_MAINTENANCE.value)),
    db: AsyncSession = Depends(get_db)
):
    return await OperationsService.get_maintenance_ticket(db, property_id, ticket_id)


@router.patch("/tickets/{ticket_id}/status", response_model=MaintenanceTicketResponse, summary="Update Ticket Status")
async def update_ticket_status(
    ticket_id: str,
    update_data: MaintenanceStatusUpdateRequest,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.MANAGE_MAINTENANCE.value)),
    db: AsyncSession = Depends(get_db)
):
    return await OperationsService.update_maintenance_ticket(db, property_id, ticket_id, update_data)
