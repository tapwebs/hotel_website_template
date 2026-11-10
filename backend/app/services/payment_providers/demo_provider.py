import random
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from backend.app.services.payment_providers.base import (
    PaymentProvider,
    PaymentProviderError,
    PaymentRequest,
    PaymentResult,
    RefundRequest,
    RefundResult,
    SettlementRecord,
)


class DemoPaymentProvider(PaymentProvider):
    @property
    def provider_name(self) -> str:
        return "demo"

    @property
    def is_demo(self) -> bool:
        return True

    def validate_configuration(self) -> bool:
        """Demo provider never requires external credentials and is always valid."""
        return True

    async def initiate_payment(self, request: PaymentRequest) -> PaymentResult:
        outcome = (request.simulation_outcome or "SUCCESS").upper()

        # Deterministic simulation handling
        if outcome == "PROVIDER_ERROR":
            raise PaymentProviderError(
                "Simulated Demo Gateway timeout: upstream bank connection timed out (DEMO_GATEWAY_TIMEOUT)",
                details={"provider": "demo", "simulation": "PROVIDER_ERROR"}
            )

        txn_ref = request.idempotency_key or f"DEMO-TXN-{uuid.uuid4().hex[:8].upper()}"
        receipt_num = f"DEMO-REC-{random.randint(1000, 9999)}"
        provider_pay_id = f"demo_pay_{uuid.uuid4().hex[:12]}"
        provider_order_id = f"demo_order_{uuid.uuid4().hex[:10]}"

        if outcome == "PENDING":
            return PaymentResult(
                status="PENDING",
                provider="DEMO",
                transaction_ref=txn_ref,
                receipt_number=receipt_num,
                amount_minor=request.amount_minor,
                currency=request.currency,
                provider_order_id=provider_order_id,
                provider_payment_id=provider_pay_id,
                message="Simulated payment pending authorization (DEMO)",
                is_demo=True,
                raw_details={"simulation": "PENDING", "channel": request.payment_method}
            )

        if outcome == "FAILED":
            return PaymentResult(
                status="FAILED",
                provider="DEMO",
                transaction_ref=txn_ref,
                receipt_number=receipt_num,
                amount_minor=request.amount_minor,
                currency=request.currency,
                provider_order_id=provider_order_id,
                provider_payment_id=provider_pay_id,
                message="Simulated card/UPI authorization declined (DEMO_DECLINED)",
                is_demo=True,
                raw_details={"simulation": "FAILED", "reason": "INSUFFICIENT_FUNDS_SIMULATED"}
            )

        if outcome == "CANCELLED":
            return PaymentResult(
                status="CANCELLED",
                provider="DEMO",
                transaction_ref=txn_ref,
                receipt_number=receipt_num,
                amount_minor=request.amount_minor,
                currency=request.currency,
                provider_order_id=provider_order_id,
                provider_payment_id=provider_pay_id,
                message="Simulated transaction cancelled by user (DEMO_USER_CANCELLED)",
                is_demo=True,
                raw_details={"simulation": "CANCELLED"}
            )

        # Default SUCCESS
        return PaymentResult(
            status="SUCCESS",
            provider="DEMO",
            transaction_ref=txn_ref,
            receipt_number=receipt_num,
            amount_minor=request.amount_minor,
            currency=request.currency,
            provider_order_id=provider_order_id,
            provider_payment_id=provider_pay_id,
            message="Simulated payment processed successfully (DEMO MODE)",
            is_demo=True,
            raw_details={
                "simulation": "SUCCESS",
                "paymentMethod": request.payment_method,
                "payerUpi": request.payer_upi,
                "cardLast4": request.card_last4
            }
        )

    async def verify_payment(self, verification_payload: Dict[str, Any]) -> PaymentResult:
        status_input = verification_payload.get("status", "SUCCESS").upper()
        txn_ref = verification_payload.get("transaction_ref") or f"DEMO-TXN-{uuid.uuid4().hex[:8].upper()}"
        amount = verification_payload.get("amount_minor", 0)

        return PaymentResult(
            status=status_input,
            provider="DEMO",
            transaction_ref=txn_ref,
            receipt_number=f"DEMO-REC-{random.randint(1000, 9999)}",
            amount_minor=amount,
            currency="INR",
            provider_payment_id=verification_payload.get("provider_payment_id", f"demo_pay_{uuid.uuid4().hex[:12]}"),
            message=f"Simulated verification result: {status_input}",
            is_demo=True,
            raw_details=verification_payload
        )

    async def process_refund(self, request: RefundRequest) -> RefundResult:
        outcome = (request.simulation_outcome or "SUCCESS").upper()

        refund_ref = f"DEMO-REF-{uuid.uuid4().hex[:8].upper()}"
        if outcome == "FAILED":
            return RefundResult(
                status="FAILED",
                refund_ref=refund_ref,
                amount_minor=request.amount_minor,
                message="Simulated refund failed by provider (DEMO_REVERSAL_REJECTED)",
                is_demo=True,
                raw_details={"simulation": "FAILED"}
            )

        return RefundResult(
            status="SUCCESS",
            refund_ref=refund_ref,
            amount_minor=request.amount_minor,
            message="Simulated refund authorized and completed (DEMO MODE)",
            is_demo=True,
            raw_details={
                "originalTxnRef": request.transaction_ref,
                "reason": request.reason
            }
        )

    async def get_settlement_records(self, date_or_batch: Optional[str] = None) -> List[SettlementRecord]:
        """Deterministic settlement records for reconciliation."""
        today = date_or_batch or datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Standard seeded records reflecting realistic 2% MDR fee + 18% GST on fee
        return [
            SettlementRecord(
                settlement_id="SETTLE-DEMO-001",
                provider="DEMO",
                provider_transaction_id="demo_pay_nz84129x",
                transaction_ref="TXN-2026-9041",
                folio_id="fol-5501",
                amount_minor=1848000,      # ₹18,480.00
                fee_minor=36960,           # 2% MDR: ₹369.60
                tax_minor=6653,            # 18% GST on MDR: ₹66.53
                net_payout_minor=1804387,  # ₹18,043.87
                settlement_date=today,
                status="SETTLED",
                is_demo=True,
                notes="Matched advance deposit for Rahul Sharma (Room 101)"
            ),
            SettlementRecord(
                settlement_id="SETTLE-DEMO-002",
                provider="DEMO",
                provider_transaction_id="demo_pay_9042_stripe",
                transaction_ref="TXN-2026-9042",
                folio_id="fol-5502",
                amount_minor=1000000,      # ₹10,000.00
                fee_minor=20000,           # ₹200.00
                tax_minor=3600,            # ₹36.00
                net_payout_minor=976400,   # ₹9,764.00
                settlement_date=today,
                status="SETTLED",
                is_demo=True,
                notes="Matched deposit for Kavita Chawla"
            ),
            SettlementRecord(
                settlement_id="SETTLE-DEMO-003",
                provider="DEMO",
                provider_transaction_id="demo_pay_9043_pos",
                transaction_ref="TXN-2026-9043",
                folio_id="fol-5503",
                amount_minor=1000000,      # ₹10,000.00
                fee_minor=20000,
                tax_minor=3600,
                net_payout_minor=976400,
                settlement_date=today,
                status="SETTLED",
                is_demo=True,
                notes="Matched card deposit for Rohit Khandelwal"
            )
        ]
