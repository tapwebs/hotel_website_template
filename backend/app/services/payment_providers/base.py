from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from backend.app.core.errors import AppException


class PaymentConfigurationError(AppException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            code="PAYMENT_PROVIDER_NOT_CONFIGURED",
            message=message,
            status_code=503,
            details=details
        )


class PaymentProviderError(AppException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            code="PAYMENT_PROVIDER_ERROR",
            message=message,
            status_code=400,
            details=details
        )


class PaymentVerificationError(AppException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            code="PAYMENT_VERIFICATION_FAILED",
            message=message,
            status_code=400,
            details=details
        )


class PaymentRequest(BaseModel):
    folio_id: str
    amount_minor: int
    currency: str = "INR"
    payment_method: str = "UPI"  # CASH, UPI, CREDIT_CARD, DEBIT_CARD, BANK_TRANSFER, CITY_LEDGER
    idempotency_key: Optional[str] = None
    payer_name: Optional[str] = None
    payer_upi: Optional[str] = None
    card_last4: Optional[str] = None
    notes: Optional[str] = None
    simulation_outcome: Optional[str] = None  # SUCCESS, PENDING, FAILED, CANCELLED, PROVIDER_ERROR


class PaymentResult(BaseModel):
    status: str  # SUCCESS, PENDING, FAILED, CANCELLED
    provider: str
    transaction_ref: str
    receipt_number: str
    amount_minor: int
    currency: str = "INR"
    provider_order_id: Optional[str] = None
    provider_payment_id: Optional[str] = None
    message: str = "Payment processed"
    is_demo: bool = False
    raw_details: Optional[Dict[str, Any]] = None


class RefundRequest(BaseModel):
    payment_id: str
    transaction_ref: str
    amount_minor: int
    currency: str = "INR"
    reason: Optional[str] = "Guest requested refund"
    idempotency_key: Optional[str] = None
    provider_payment_id: Optional[str] = None
    simulation_outcome: Optional[str] = None  # SUCCESS, FAILED


class RefundResult(BaseModel):
    status: str  # SUCCESS, PENDING, FAILED
    refund_ref: str
    amount_minor: int
    message: str
    is_demo: bool = False
    raw_details: Optional[Dict[str, Any]] = None


class SettlementRecord(BaseModel):
    settlement_id: str
    provider: str
    provider_transaction_id: str
    transaction_ref: str
    folio_id: Optional[str] = None
    amount_minor: int
    fee_minor: int = 0
    tax_minor: int = 0
    net_payout_minor: int
    currency: str = "INR"
    settlement_date: str
    status: str = "SETTLED"  # SETTLED, PENDING, FAILED
    is_demo: bool = False
    notes: Optional[str] = None


class PaymentProvider(ABC):
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Unique provider code: demo, razorpay, bank, etc."""
        pass

    @property
    @abstractmethod
    def is_demo(self) -> bool:
        """Whether this provider operates in simulated local demo mode."""
        pass

    @abstractmethod
    def validate_configuration(self) -> bool:
        """Validate credentials and configuration. Raise PaymentConfigurationError if invalid."""
        pass

    @abstractmethod
    async def initiate_payment(self, request: PaymentRequest) -> PaymentResult:
        """Initiate or simulate a payment request."""
        pass

    @abstractmethod
    async def verify_payment(self, verification_payload: Dict[str, Any]) -> PaymentResult:
        """Verify an asynchronous payment callback, webhook, or signature."""
        pass

    @abstractmethod
    async def process_refund(self, request: RefundRequest) -> RefundResult:
        """Initiate or simulate a refund."""
        pass

    @abstractmethod
    async def get_settlement_records(self, date_or_batch: Optional[str] = None) -> List[SettlementRecord]:
        """Fetch settlement records for gateway reconciliation."""
        pass
