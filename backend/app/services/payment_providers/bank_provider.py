"""
Bank Gateway Payment Provider Adapter Specification & Contract
---------------------------------------------------------------
This adapter defines the integration boundary for direct bank payment gateways
(e.g., HDFC SmartGateway, ICICI Eazypay, SBI Corporate e-Pay).

Required configuration and specifications from the selected acquiring bank:
1. Base API URL (e.g., BANK_GATEWAY_API_URL)
2. Merchant ID / Terminal ID (e.g., BANK_GATEWAY_MERCHANT_ID)
3. API Key / Client Secret (e.g., BANK_GATEWAY_API_KEY, BANK_GATEWAY_CLIENT_SECRET)
4. Mutual TLS / Client Certificate (e.g., BANK_GATEWAY_CERT_PATH) if required by the bank
5. Signature Algorithm: Typically RSA-SHA256 with bank public key or AES-256-GCM encryption payload
6. Webhook / Callback notification endpoint for asynchronous debit confirmation
7. Bank reconciliation batch / MIS file format (CSV, MT940, or ISO 20022 CAMT.053)
"""

from typing import Any, Dict, List, Optional
from backend.app.core.config import settings
from backend.app.services.payment_providers.base import (
    PaymentConfigurationError,
    PaymentProvider,
    PaymentProviderError,
    PaymentRequest,
    PaymentResult,
    RefundRequest,
    RefundResult,
    SettlementRecord,
)


class BankGatewayPaymentProvider(PaymentProvider):
    @property
    def provider_name(self) -> str:
        return "bank"

    @property
    def is_demo(self) -> bool:
        return False

    def validate_configuration(self) -> bool:
        missing = []
        if not settings.BANK_GATEWAY_API_URL or not settings.BANK_GATEWAY_API_URL.strip():
            missing.append("BANK_GATEWAY_API_URL")
        if not settings.BANK_GATEWAY_MERCHANT_ID or not settings.BANK_GATEWAY_MERCHANT_ID.strip():
            missing.append("BANK_GATEWAY_MERCHANT_ID")
        if not settings.BANK_GATEWAY_API_KEY or not settings.BANK_GATEWAY_API_KEY.strip():
            missing.append("BANK_GATEWAY_API_KEY")

        if missing:
            raise PaymentConfigurationError(
                f"Bank Gateway adapter is selected (PAYMENT_PROVIDER=bank), but required bank gateway credentials "
                f"are missing: {', '.join(missing)}. "
                f"Please supply the bank API URL, Merchant ID, and API Key, or switch PAYMENT_PROVIDER to 'demo'.",
                details={
                    "provider": "bank",
                    "missing_keys": missing,
                    "specification_status": "AWAITING_BANK_CREDENTIALS"
                }
            )
        return True

    async def initiate_payment(self, request: PaymentRequest) -> PaymentResult:
        self.validate_configuration()
        raise PaymentProviderError(
            "Direct bank gateway API call cannot proceed: specific bank gateway protocol specification "
            "(e.g., HDFC/ICICI payload signature/encryption contract) is awaiting finalized partner bank onboarding.",
            details={"provider": "bank", "folio_id": request.folio_id}
        )

    async def verify_payment(self, verification_payload: Dict[str, Any]) -> PaymentResult:
        self.validate_configuration()
        raise PaymentProviderError(
            "Bank callback verification awaiting selected bank signature verification specification.",
            details={"provider": "bank"}
        )

    async def process_refund(self, request: RefundRequest) -> RefundResult:
        self.validate_configuration()
        raise PaymentProviderError(
            "Bank gateway refund API awaiting direct bank host-to-host refund API specification.",
            details={"provider": "bank", "payment_id": request.payment_id}
        )

    async def get_settlement_records(self, date_or_batch: Optional[str] = None) -> List[SettlementRecord]:
        self.validate_configuration()
        raise PaymentProviderError(
            "Bank settlement MIS import awaiting bank file delivery channel specification (SFTP or REST).",
            details={"provider": "bank"}
        )
