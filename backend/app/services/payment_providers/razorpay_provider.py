import hashlib
import hmac
import random
import uuid
from typing import Any, Dict, List, Optional
import httpx

from backend.app.core.config import settings
from backend.app.services.payment_providers.base import (
    PaymentConfigurationError,
    PaymentProvider,
    PaymentProviderError,
    PaymentRequest,
    PaymentResult,
    PaymentVerificationError,
    RefundRequest,
    RefundResult,
    SettlementRecord,
)


class RazorpayPaymentProvider(PaymentProvider):
    @property
    def provider_name(self) -> str:
        return "razorpay"

    @property
    def is_demo(self) -> bool:
        return False

    def validate_configuration(self) -> bool:
        missing = []
        if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_ID.strip():
            missing.append("RAZORPAY_KEY_ID")
        if not settings.RAZORPAY_KEY_SECRET or not settings.RAZORPAY_KEY_SECRET.strip():
            missing.append("RAZORPAY_KEY_SECRET")

        if missing:
            raise PaymentConfigurationError(
                f"Razorpay payment provider is enabled but missing required credentials: {', '.join(missing)}. "
                f"Set these environment variables or switch PAYMENT_PROVIDER to 'demo'.",
                details={"provider": "razorpay", "missing_keys": missing}
            )
        return True

    def _get_auth(self) -> tuple:
        return (settings.RAZORPAY_KEY_ID or "", settings.RAZORPAY_KEY_SECRET or "")

    def verify_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        """Standard Razorpay HMAC-SHA256 signature verification."""
        secret = (settings.RAZORPAY_KEY_SECRET or "").encode("utf-8")
        msg = f"{order_id}|{payment_id}".encode("utf-8")
        generated_signature = hmac.new(secret, msg, hashlib.sha256).hexdigest()
        return hmac.compare_digest(generated_signature, signature)

    def verify_webhook_signature(self, body_bytes: bytes, signature: str) -> bool:
        """Verify Razorpay webhook event signature using RAZORPAY_WEBHOOK_SECRET."""
        if not settings.RAZORPAY_WEBHOOK_SECRET:
            raise PaymentConfigurationError("RAZORPAY_WEBHOOK_SECRET is not configured for signature verification.")
        secret = settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8")
        expected = hmac.new(secret, body_bytes, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    async def initiate_payment(self, request: PaymentRequest) -> PaymentResult:
        self.validate_configuration()

        txn_ref = request.idempotency_key or f"RZP-TXN-{uuid.uuid4().hex[:8].upper()}"
        receipt = f"REC-RZP-{random.randint(1000, 9999)}"

        payload = {
            "amount": request.amount_minor,
            "currency": request.currency,
            "receipt": receipt,
            "notes": {
                "folio_id": request.folio_id,
                "txn_ref": txn_ref,
                "payer_name": request.payer_name or "Guest"
            }
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(
                    "https://api.razorpay.com/v1/orders",
                    auth=self._get_auth(),
                    json=payload
                )

                if res.status_code >= 400:
                    err_json = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
                    err_desc = err_json.get("error", {}).get("description") or res.text
                    raise PaymentProviderError(
                        f"Razorpay order creation failed: {err_desc}",
                        details={"status_code": res.status_code, "response": err_json}
                    )

                data = res.json()
                order_id = data.get("id")

                return PaymentResult(
                    status="PENDING",
                    provider="RAZORPAY",
                    transaction_ref=txn_ref,
                    receipt_number=receipt,
                    amount_minor=request.amount_minor,
                    currency=request.currency,
                    provider_order_id=order_id,
                    message="Razorpay payment order initiated",
                    is_demo=False,
                    raw_details={"order": data}
                )
        except httpx.RequestError as exc:
            raise PaymentProviderError(f"Razorpay network communication error: {str(exc)}")

    async def verify_payment(self, verification_payload: Dict[str, Any]) -> PaymentResult:
        self.validate_configuration()

        order_id = verification_payload.get("razorpay_order_id")
        payment_id = verification_payload.get("razorpay_payment_id")
        signature = verification_payload.get("razorpay_signature")
        txn_ref = verification_payload.get("transaction_ref") or f"RZP-{payment_id}"
        amount = verification_payload.get("amount_minor", 0)

        if not order_id or not payment_id or not signature:
            raise PaymentVerificationError(
                "Missing required signature verification fields (razorpay_order_id, razorpay_payment_id, razorpay_signature)."
            )

        if not self.verify_signature(order_id, payment_id, signature):
            raise PaymentVerificationError("Razorpay signature verification failed. Transaction cannot be trusted.")

        return PaymentResult(
            status="SUCCESS",
            provider="RAZORPAY",
            transaction_ref=txn_ref,
            receipt_number=f"REC-{payment_id[-6:]}",
            amount_minor=amount,
            currency="INR",
            provider_order_id=order_id,
            provider_payment_id=payment_id,
            message="Razorpay payment verified successfully",
            is_demo=False,
            raw_details=verification_payload
        )

    async def process_refund(self, request: RefundRequest) -> RefundResult:
        self.validate_configuration()

        if not request.provider_payment_id:
            raise PaymentProviderError("Original Razorpay payment ID (provider_payment_id) required to issue refund.")

        url = f"https://api.razorpay.com/v1/payments/{request.provider_payment_id}/refund"
        payload = {
            "amount": request.amount_minor,
            "notes": {
                "reason": request.reason or "Guest refund",
                "payment_id": request.payment_id
            }
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, auth=self._get_auth(), json=payload)
                if res.status_code >= 400:
                    err_json = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
                    err_desc = err_json.get("error", {}).get("description") or res.text
                    raise PaymentProviderError(
                        f"Razorpay refund failed: {err_desc}",
                        details={"status_code": res.status_code, "response": err_json}
                    )

                data = res.json()
                return RefundResult(
                    status="SUCCESS",
                    refund_ref=data.get("id", f"rfnd_{uuid.uuid4().hex[:8]}"),
                    amount_minor=data.get("amount", request.amount_minor),
                    message="Razorpay refund processed successfully",
                    is_demo=False,
                    raw_details=data
                )
        except httpx.RequestError as exc:
            raise PaymentProviderError(f"Razorpay network communication error during refund: {str(exc)}")

    async def get_settlement_records(self, date_or_batch: Optional[str] = None) -> List[SettlementRecord]:
        self.validate_configuration()

        url = "https://api.razorpay.com/v1/settlements"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url, auth=self._get_auth())
                if res.status_code >= 400:
                    raise PaymentProviderError(f"Failed to fetch Razorpay settlements: {res.text}")

                data = res.json().get("items", [])
                records = []
                for item in data:
                    records.append(SettlementRecord(
                        settlement_id=item.get("id"),
                        provider="RAZORPAY",
                        provider_transaction_id=item.get("id"),
                        transaction_ref=item.get("utr", item.get("id")),
                        amount_minor=item.get("amount", 0),
                        fee_minor=item.get("fees", 0),
                        tax_minor=item.get("tax", 0),
                        net_payout_minor=item.get("amount", 0) - item.get("fees", 0) - item.get("tax", 0),
                        settlement_date=str(item.get("created_at")),
                        status="SETTLED" if item.get("status") == "processed" else "PENDING",
                        is_demo=False
                    ))
                return records
        except httpx.RequestError as exc:
            raise PaymentProviderError(f"Razorpay settlements network error: {str(exc)}")
