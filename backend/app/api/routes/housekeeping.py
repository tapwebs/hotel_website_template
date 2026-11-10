from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_property_context, require_permission
from backend.app.core.rbac import Permission
from backend.app.models.user import User
from backend.app.schemas.operations import HousekeepingStatusUpdateRequest, HousekeepingTaskResponse
from backend.app.services.operations_service import OperationsService

router = APIRouter(prefix="/housekeeping", tags=["Housekeeping Operations"])


@router.get("/tasks", response_model=List[HousekeepingTaskResponse], summary="List Housekeeping Cleaning Tasks")
async def get_tasks(
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.MANAGE_HOUSEKEEPING.value)),
    db: AsyncSession = Depends(get_db)
):
    return await OperationsService.get_housekeeping_tasks(db, property_id, status=status, limit=limit, offset=offset)


@router.patch("/tasks/{task_id}/status", response_model=HousekeepingTaskResponse, summary="Update Cleaning Task Status")
async def update_task_status(
    task_id: str,
    update_data: HousekeepingStatusUpdateRequest,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.UPDATE_CLEANING_STATUS.value)),
    db: AsyncSession = Depends(get_db)
):
    return await OperationsService.update_housekeeping_task(db, property_id, task_id, update_data)
