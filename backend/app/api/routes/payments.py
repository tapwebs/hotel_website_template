from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, Query, Response, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_property_context, require_permission
from backend.app.core.rbac import Permission
from backend.app.models.user import User
from backend.app.schemas.folio import (
    PaymentTransactionResponse,
    ProcessPaymentPayload,
    ReconciliationReportResponse,
)
from backend.app.services.folio_service import FolioService
from backend.app.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["Payments Ledger"])


class RefundRequest(BaseModel):
    payment_id: str
    amount_paise: int
    reason: Optional[str] = "Guest requested refund"
    simulation_outcome: Optional[str] = None  # For demo simulation: SUCCESS, FAILED


class RefundResponse(BaseModel):
    status: str
    message: str
    refundAmountPaise: int
    paymentId: str
    refundRef: Optional[str] = None
    isDemo: bool = False


class CSVImportPayload(BaseModel):
    csv_content: str


@router.get("", response_model=List[PaymentTransactionResponse], summary="List Payment Transactions")
async def get_payments(
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.PROCESS_PAYMENTS.value)),
    db: AsyncSession = Depends(get_db)
):
    return await FolioService.get_all_payments(db, property_id, limit=limit, offset=offset)


@router.get("/provider-status", summary="Get Active Payment Provider Status")
async def get_provider_status(
    current_user: User = Depends(require_permission(Permission.PROCESS_PAYMENTS.value))
):
    return PaymentService.get_active_provider_info()


@router.post("/process", summary="Process Payment via Unified Payment Architecture")
async def process_payment(
    payload: ProcessPaymentPayload,
    idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.PROCESS_PAYMENTS.value)),
    db: AsyncSession = Depends(get_db)
):
    if idempotency_key and not payload.idempotency_key:
        payload.idempotency_key = idempotency_key

    result = await PaymentService.process_payment(db, property_id, payload, current_user=current_user)
    return result.model_dump()


@router.post("/refund", response_model=RefundResponse, summary="Authorize & Process Payment Refund")
async def process_refund(
    request: RefundRequest,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.AUTHORIZE_REFUND.value)),
    db: AsyncSession = Depends(get_db)
):
    result = await PaymentService.process_refund(
        db=db,
        property_id=property_id,
        payment_id=request.payment_id,
        amount_paise=request.amount_paise,
        reason=request.reason,
        simulation_outcome=request.simulation_outcome
    )
    return RefundResponse(**result)


@router.get("/reconciliation", response_model=ReconciliationReportResponse, summary="Run or View Payment Gateway Reconciliation")
async def get_reconciliation(
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.PROCESS_PAYMENTS.value)),
    db: AsyncSession = Depends(get_db)
):
    return await PaymentService.reconcile_transactions(db, property_id)


@router.post("/reconciliation/demo", response_model=ReconciliationReportResponse, summary="Run Demo Provider Reconciliation")
async def reconcile_demo(
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.PROCESS_PAYMENTS.value)),
    db: AsyncSession = Depends(get_db)
):
    return await PaymentService.reconcile_transactions(db, property_id)


@router.post("/reconciliation/import-csv", response_model=ReconciliationReportResponse, summary="Import Bank/Gateway Settlement CSV")
async def import_settlement_csv(
    payload: CSVImportPayload,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.PROCESS_PAYMENTS.value)),
    db: AsyncSession = Depends(get_db)
):
    return await PaymentService.reconcile_from_csv(db, property_id, payload.csv_content)


@router.get("/export-csv", summary="Export Payment Transactions CSV")
async def export_payments_csv(
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.PROCESS_PAYMENTS.value)),
    db: AsyncSession = Depends(get_db)
):
    csv_data = await PaymentService.export_payments_csv(db, property_id)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="dream_heavens_payments.csv"'}
    )
