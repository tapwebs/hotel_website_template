from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_property_context, require_permission
from backend.app.core.rbac import Permission
from backend.app.models.user import User
from backend.app.schemas.reports import (
    DashboardKPIsResponse,
    ManagerFlashReportResponse,
    NightAuditStepResponse,
    NightAuditExecuteRequest,
    NightAuditExecuteResponse,
    NightAuditStatusResponse,
    FnbAnalyticsResponse,
)
from backend.app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["Reports & Dashboards"])


@router.get("/dashboard-kpis", response_model=DashboardKPIsResponse, summary="Get Live Dashboard KPIs")
async def get_dashboard_kpis(
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD.value)),
    db: AsyncSession = Depends(get_db)
):
    return await ReportService.get_dashboard_kpis(db, property_id)


@router.get("/night-audit/status", response_model=NightAuditStatusResponse, summary="Get Night Audit Status & Readiness")
async def get_night_audit_status(
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.EXECUTE_NIGHT_AUDIT.value)),
    db: AsyncSession = Depends(get_db)
):
    return await ReportService.get_night_audit_status(db, property_id)


@router.get("/night-audit/steps", response_model=List[NightAuditStepResponse], summary="Get Night Audit Checklist Steps")
async def get_night_audit_steps(
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.EXECUTE_NIGHT_AUDIT.value)),
    db: AsyncSession = Depends(get_db)
):
    return await ReportService.get_night_audit_steps(db, property_id)


@router.post("/night-audit/rollover", response_model=NightAuditExecuteResponse, summary="Execute Night Audit Rollover")
async def execute_rollover(
    request: Optional[NightAuditExecuteRequest] = None,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.EXECUTE_NIGHT_AUDIT.value)),
    db: AsyncSession = Depends(get_db)
):
    return await ReportService.execute_rollover(db, property_id, request, current_user)


@router.get("/flash-report", response_model=ManagerFlashReportResponse, summary="Get Manager Flash Report (active day, or a past business date)")
async def get_flash_report(
    business_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.VIEW_FINANCIAL_REPORTS.value)),
    db: AsyncSession = Depends(get_db)
):
    return await ReportService.get_flash_report(db, property_id, business_date)


@router.get("/night-audit/history", response_model=List[Dict[str, Any]], summary="Past night audit runs")
async def get_night_audit_history(
    limit: int = Query(30, ge=1, le=120),
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.EXECUTE_NIGHT_AUDIT.value)),
    db: AsyncSession = Depends(get_db)
):
    return await ReportService.get_night_audit_history(db, property_id, limit)


@router.get("/fnb-analytics", response_model=FnbAnalyticsResponse, summary="Get F&B Analytics Dashboard")
async def get_fnb_analytics(
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.VIEW_FINANCIAL_REPORTS.value)),
    db: AsyncSession = Depends(get_db)
):
    return await ReportService.get_fnb_analytics(db, property_id)
