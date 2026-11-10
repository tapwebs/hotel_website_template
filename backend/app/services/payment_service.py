import csv
import io
import random
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.core.errors import AppException, NotFoundException, ValidationException
from backend.app.models.folio import MasterFolio, Payment, ReconciliationBatch
from backend.app.models.user import User
from backend.app.schemas.folio import (
    ProcessPaymentPayload,
    ReconciliationItemResponse,
    ReconciliationReportResponse,
)
from backend.app.services.folio_service import FolioService
from backend.app.services.payment_providers import (
    PaymentConfigurationError,
    PaymentProvider,
    PaymentProviderError,
    PaymentRequest,
    PaymentResult,
    RefundRequest,
    RefundResult,
    SettlementRecord,
    get_payment_provider,
)


class PaymentService:
    @staticmethod
    def get_active_provider_info() -> Dict[str, Any]:
        """Returns details about currently configured payment provider."""
        provider_name = (settings.PAYMENT_PROVIDER or "demo").lower()
        is_demo = provider_name in ("demo", "local")

        config_valid = True
        config_error = None
        try:
            prov = get_payment_provider(provider_name)
            prov.validate_configuration()
        except PaymentConfigurationError as e:
            config_valid = False
            config_error = e.message

        from backend.app.services.guest_dining_service import gateway
        key_id = (settings.RAZORPAY_KEY_ID or "").strip()
        rzp_ready = bool(key_id and (settings.RAZORPAY_KEY_SECRET or "").strip())
        return {
            "activeProvider": provider_name.upper(),
            "isDemo": is_demo,
            "configurationValid": config_valid,
            "configurationError": config_error,
            "supportedProviders": ["DEMO", "RAZORPAY", "BANK"],
            # Read-only facts for Settings > Payments. Keys live in server env vars and are never sent in full.
            "razorpay": {
                "configured": rzp_ready,
                "mode": "TEST" if key_id.startswith("rzp_test_") else ("PRODUCTION" if rzp_ready else None),
                "keyIdMasked": f"{key_id[:9]}…{key_id[-4:]}" if len(key_id) > 13 else ("•" * len(key_id)),
                "webhookConfigured": bool((settings.RAZORPAY_WEBHOOK_SECRET or "").strip()),
            },
            "guestOnlinePayment": gateway(),
        }

    @staticmethod
    async def process_payment(
        db: AsyncSession,
        property_id: str,
        payload: ProcessPaymentPayload,
        current_user: Optional[User] = None
    ) -> PaymentResult:
        if payload.amount_paise <= 0:
            raise ValidationException("Payment amount must be greater than zero.")

        stmt = select(MasterFolio).where(
            MasterFolio.property_id == property_id,
            MasterFolio.folio_id == payload.folio_id
        )
        folio = (await db.execute(stmt)).scalar_one_or_none()
        if not folio:
            raise NotFoundException("Master folio not found.")

        # Idempotency check: if request has idempotency_key that matches existing payment, return it
        if payload.idempotency_key:
            existing_payment = (await db.execute(
                select(Payment).where(
                    Payment.folio_id == folio.folio_id,
                    Payment.transaction_ref == payload.idempotency_key
                )
            )).scalar_one_or_none()
            if existing_payment:
                return PaymentResult(
                    status=existing_payment.status,
                    provider=existing_payment.provider,
                    transaction_ref=existing_payment.transaction_ref,
                    receipt_number=existing_payment.receipt_number,
                    amount_minor=existing_payment.amount_minor,
                    currency=existing_payment.currency,
                    message="Idempotent replay: payment already recorded",
                    is_demo=(existing_payment.provider == "DEMO")
                )

        # Get active provider and initiate payment
        provider = get_payment_provider()
        provider.validate_configuration()

        payment_req = PaymentRequest(
            folio_id=folio.folio_id,
            amount_minor=payload.amount_paise,
            currency="INR",
            payment_method=payload.payment_method,
            idempotency_key=payload.idempotency_key,
            payer_name=payload.payer_name,
            payer_upi=payload.payer_upi,
            card_last4=payload.card_last4,
            simulation_outcome=payload.simulation_outcome
        )

        result = await provider.initiate_payment(payment_req)

        # Apply confirmed payment only if SUCCESS
        if result.status == "SUCCESS":
            await FolioService.apply_confirmed_payment(
                db=db,
                property_id=property_id,
                folio_id=folio.folio_id,
                amount_paise=result.amount_minor,
                payment_method=payload.payment_method,
                provider=result.provider,
                transaction_ref=result.transaction_ref,
                receipt_number=result.receipt_number,
                card_last4=payload.card_last4,
                upi_id=payload.payer_upi,
                is_demo=result.is_demo
            )
        else:
            # Persist failed/cancelled payment record for financial audit trail without crediting folio
            failed_pay = Payment(
                property_id=property_id,
                folio_id=folio.folio_id,
                transaction_ref=result.transaction_ref,
                receipt_number=result.receipt_number or f"{'DEMO-' if result.is_demo else ''}FAIL-{random.randint(100, 999)}",
                amount_minor=result.amount_minor,
                currency=result.currency or "INR",
                payment_method=payload.payment_method,
                provider="DEMO" if result.is_demo else result.provider,
                status=result.status,
                card_last4=payload.card_last4,
                upi_id=payload.payer_upi
            )
            db.add(failed_pay)
            await db.commit()

        return result

    @staticmethod
    async def process_refund(
        db: AsyncSession,
        property_id: str,
        payment_id: str,
        amount_paise: int,
        reason: Optional[str] = None,
        simulation_outcome: Optional[str] = None
    ) -> dict:
        return await FolioService.process_refund(
            db=db,
            property_id=property_id,
            payment_id=payment_id,
            amount_paise=amount_paise,
            reason=reason,
            simulation_outcome=simulation_outcome
        )

    @staticmethod
    async def reconcile_transactions(
        db: AsyncSession,
        property_id: str,
        external_records: Optional[List[SettlementRecord]] = None,
        batch_reference: Optional[str] = None
    ) -> ReconciliationReportResponse:
        """
        Compares persisted HMS payment records with gateway/bank settlement records.
        Identifies matched, amount-mismatch, fee difference, and missing entries.
        """
        # Fetch HMS Payments for this property
        p_stmt = (
            select(Payment)
            .where(Payment.property_id == property_id)
            .options(selectinload(Payment.folio))
            .order_by(Payment.created_at.desc())
        )
        hms_payments = (await db.execute(p_stmt)).scalars().all()
        hms_by_ref = {p.transaction_ref: p for p in hms_payments}

        # If external settlement records not provided, fetch from provider
        provider = get_payment_provider()
        provider.validate_configuration()

        settlement_feed = external_records
        if settlement_feed is None:
            settlement_feed = await provider.get_settlement_records()

        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        batch_id = batch_reference or f"BATCH-{provider.provider_name.upper()}-{today_str.replace('-', '')}"

        # Reconciliation matching logic
        matched_items: List[ReconciliationItemResponse] = []
        matched_hms_refs = set()
        matched_count = 0
        discrepancy_count = 0

        total_settled_paise = 0
        total_fees_paise = 0
        total_payout_paise = 0

        for rec in settlement_feed:
            total_settled_paise += rec.amount_minor
            total_fees_paise += (rec.fee_minor + rec.tax_minor)
            total_payout_paise += rec.net_payout_minor

            # Attempt match by transaction_ref
            hms_match = hms_by_ref.get(rec.transaction_ref)
            if not hms_match:
                # Try matching by folio_id or other criteria
                for p in hms_payments:
                    if p.transaction_ref.endswith(rec.transaction_ref) or rec.transaction_ref.endswith(p.transaction_ref):
                        hms_match = p
                        break

            if hms_match:
                matched_hms_refs.add(hms_match.transaction_ref)
                hms_amount = hms_match.amount_minor

                if hms_amount == rec.amount_minor:
                    match_status = "MATCHED"
                    disc_note = f"Fully reconciled with {rec.provider} settlement"
                    matched_count += 1
                else:
                    match_status = "AMOUNT_MISMATCH"
                    disc_note = f"Amount mismatch: HMS recorded ₹{hms_amount/100:.2f}, Gateway settled ₹{rec.amount_minor/100:.2f}"
                    discrepancy_count += 1

                matched_items.append(ReconciliationItemResponse(
                    settlementId=rec.settlement_id,
                    provider=rec.provider,
                    transactionRef=rec.transaction_ref,
                    folioId=hms_match.folio_id,
                    hmsAmountPaise=hms_amount,
                    settlementAmountPaise=rec.amount_minor,
                    feePaise=rec.fee_minor,
                    taxPaise=rec.tax_minor,
                    netPayoutPaise=rec.net_payout_minor,
                    matchStatus=match_status,
                    discrepancyNote=disc_note
                ))
            else:
                discrepancy_count += 1
                matched_items.append(ReconciliationItemResponse(
                    settlementId=rec.settlement_id,
                    provider=rec.provider,
                    transactionRef=rec.transaction_ref,
                    folioId=rec.folio_id,
                    hmsAmountPaise=None,
                    settlementAmountPaise=rec.amount_minor,
                    feePaise=rec.fee_minor,
                    taxPaise=rec.tax_minor,
                    netPayoutPaise=rec.net_payout_minor,
                    matchStatus="MISSING_IN_HMS",
                    discrepancyNote="Settlement entry exists in gateway feed but no matching HMS payment found"
                ))

        # Check for HMS payments missing in gateway settlement feed
        for ref, p in hms_by_ref.items():
            if ref not in matched_hms_refs and p.status == "SUCCESS":
                discrepancy_count += 1
                matched_items.append(ReconciliationItemResponse(
                    settlementId=f"PENDING-{ref}",
                    provider=p.provider,
                    transactionRef=ref,
                    folioId=p.folio_id,
                    hmsAmountPaise=p.amount_minor,
                    settlementAmountPaise=0,
                    feePaise=0,
                    taxPaise=0,
                    netPayoutPaise=0,
                    matchStatus="PENDING",
                    discrepancyNote="HMS payment recorded as SUCCESS but settlement pending from provider"
                ))

        total_hms_payments_paise = sum(p.amount_minor for p in hms_payments if p.status == "SUCCESS")

        # Persist audit record in payment_reconciliations table
        existing_batch = (await db.execute(
            select(ReconciliationBatch).where(
                ReconciliationBatch.property_id == property_id,
                ReconciliationBatch.batch_reference == batch_id
            )
        )).scalar_one_or_none()

        discrepancies_list = [
            item.model_dump() for item in matched_items if item.matchStatus != "MATCHED"
        ]

        if not existing_batch:
            batch_record = ReconciliationBatch(
                property_id=property_id,
                batch_reference=batch_id,
                provider=provider.provider_name.upper(),
                settlement_date=today_str,
                status="COMPLETED",
                total_records=len(matched_items),
                matched_count=matched_count,
                discrepancy_count=discrepancy_count,
                total_settled_minor=total_settled_paise,
                total_fees_minor=total_fees_paise,
                total_payout_minor=total_payout_paise,
                discrepancies=discrepancies_list
            )
            db.add(batch_record)
            await db.commit()
        else:
            # Update existing batch to maintain audit trail without duplicating
            existing_batch.matched_count = matched_count
            existing_batch.discrepancy_count = discrepancy_count
            existing_batch.total_records = len(matched_items)
            existing_batch.total_settled_minor = total_settled_paise
            existing_batch.total_fees_minor = total_fees_paise
            existing_batch.total_payout_minor = total_payout_paise
            existing_batch.discrepancies = discrepancies_list
            await db.commit()

        return ReconciliationReportResponse(
            batchId=batch_id,
            provider=provider.provider_name.upper(),
            settlementDate=today_str,
            totalHmsPaymentsPaise=total_hms_payments_paise,
            totalSettledPaise=total_settled_paise,
            totalFeesPaise=total_fees_paise,
            totalPayoutPaise=total_payout_paise,
            matchedCount=matched_count,
            discrepancyCount=discrepancy_count,
            status="COMPLETED",
            isDemo=provider.is_demo,
            items=matched_items
        )

    @staticmethod
    async def reconcile_from_csv(
        db: AsyncSession,
        property_id: str,
        csv_text: str
    ) -> ReconciliationReportResponse:
        """Parses bank/gateway settlement CSV and reconciles against HMS payments."""
        reader = csv.DictReader(io.StringIO(csv_text.strip()))
        records: List[SettlementRecord] = []

        for row in reader:
            txn_ref = row.get("transaction_ref") or row.get("Transaction Ref") or row.get("txn_ref") or row.get("UTR") or ""
            amount_str = row.get("amount") or row.get("Amount") or row.get("amount_paise") or "0"
            fee_str = row.get("fee") or row.get("Fee") or "0"
            settlement_id = row.get("settlement_id") or row.get("Settlement ID") or f"SETTLE-CSV-{uuid.uuid4().hex[:6].upper()}"

            # Amount in paise
            try:
                if "." in amount_str:
                    amount_paise = int(round(float(amount_str) * 100))
                else:
                    amount_paise = int(amount_str)
            except ValueError:
                amount_paise = 0

            try:
                if "." in fee_str:
                    fee_paise = int(round(float(fee_str) * 100))
                else:
                    fee_paise = int(fee_str)
            except ValueError:
                fee_paise = 0

            records.append(SettlementRecord(
                settlement_id=settlement_id,
                provider="BANK_CSV",
                provider_transaction_id=settlement_id,
                transaction_ref=txn_ref.strip(),
                amount_minor=amount_paise,
                fee_minor=fee_paise,
                tax_minor=0,
                net_payout_minor=max(0, amount_paise - fee_paise),
                settlement_date=row.get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                status="SETTLED",
                is_demo=False
            ))

        batch_ref = f"CSV-IMPORT-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
        return await PaymentService.reconcile_transactions(
            db=db,
            property_id=property_id,
            external_records=records,
            batch_reference=batch_ref
        )

    @staticmethod
    async def export_payments_csv(db: AsyncSession, property_id: str) -> str:
        """Exports all payments in standard banking reconciliation CSV format."""
        stmt = (
            select(Payment)
            .where(Payment.property_id == property_id)
            .options(selectinload(Payment.folio))
            .order_by(Payment.created_at.desc())
        )
        payments = (await db.execute(stmt)).scalars().all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Payment ID",
            "Transaction Ref",
            "Folio Number",
            "Room Number",
            "Amount (INR)",
            "Payment Method",
            "Provider",
            "Status",
            "Created At",
            "Receipt Number"
        ])

        for p in payments:
            folio_num = p.folio.folio_number if p.folio else "N/A"
            room_num = p.folio.room_number if p.folio else "N/A"
            amount_inr = f"{p.amount_minor / 100:.2f}"
            dt_str = p.created_at.strftime("%Y-%m-%d %H:%M:%S") if p.created_at else ""

            writer.writerow([
                p.payment_id,
                p.transaction_ref,
                folio_num,
                room_num,
                amount_inr,
                p.payment_method,
                p.provider,
                p.status,
                dt_str,
                p.receipt_number
            ])

        return output.getvalue()
