from typing import List, Optional
from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_property_context, require_permission
from backend.app.core.errors import NotFoundException
from backend.app.core.rbac import Permission
from backend.app.models.user import User
from backend.app.schemas.folio import MasterFolioResponse, PostChargeRequest, RecordPaymentRequest, TaxInvoiceResponse
from backend.app.services.folio_service import FolioService

router = APIRouter(prefix="/folios", tags=["Master Folios"])


@router.get("", response_model=List[MasterFolioResponse], summary="List Master Folios")
async def get_folios(
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.VIEW_FOLIO.value)),
    db: AsyncSession = Depends(get_db)
):
    return await FolioService.get_all_folios(db, property_id, status=status, limit=limit, offset=offset)


@router.get("/{folio_id}", response_model=MasterFolioResponse, summary="Get Master Folio Details")
async def get_folio(
    folio_id: str,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.VIEW_FOLIO.value)),
    db: AsyncSession = Depends(get_db)
):
    folio = await FolioService.get_folio_by_id(db, property_id, folio_id)
    if not folio:
        raise NotFoundException("Master folio not found.")
    return folio


@router.get("/{folio_id}/invoice", response_model=TaxInvoiceResponse, summary="Get Official GST Tax Invoice for Folio")
async def get_folio_invoice(
    folio_id: str,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.VIEW_FOLIO.value)),
    db: AsyncSession = Depends(get_db)
):
    return await FolioService.generate_tax_invoice(db, property_id, folio_id)



@router.post("/charges", response_model=MasterFolioResponse, summary="Post Charge to Master Folio")
async def post_charge(
    request: PostChargeRequest,
    idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.POST_CHARGES.value)),
    db: AsyncSession = Depends(get_db)
):
    if idempotency_key and not request.reference_number:
        request.reference_number = idempotency_key
    return await FolioService.post_charge(db, property_id, request)


@router.post("/payments", response_model=MasterFolioResponse, summary="Record Folio Payment Settlement")
async def record_payment(
    request: RecordPaymentRequest,
    idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.PROCESS_PAYMENTS.value)),
    db: AsyncSession = Depends(get_db)
):
    if idempotency_key and not request.transaction_ref:
        request.transaction_ref = idempotency_key
    return await FolioService.record_payment(db, property_id, request)
