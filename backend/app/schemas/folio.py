from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class FolioItemResponse(BaseModel):
    id: str
    folioId: str = Field(..., serialization_alias="folioId")
    transactionType: str = Field(..., serialization_alias="transactionType")
    description: str
    sacCode: Optional[str] = Field("996311", serialization_alias="sacCode")
    debitPaise: int = Field(0, serialization_alias="debitPaise")
    creditPaise: int = Field(0, serialization_alias="creditPaise")
    netPaise: int = Field(0, serialization_alias="netPaise")
    taxPaise: int = Field(0, serialization_alias="taxPaise")
    postedAt: str = Field(..., serialization_alias="postedAt")
    postedBy: str = Field("SYSTEM", serialization_alias="postedBy")
    isImmutable: bool = Field(True, serialization_alias="isImmutable")
    referenceNumber: Optional[str] = Field(None, serialization_alias="referenceNumber")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class SplitFolioBrief(BaseModel):
    id: str
    folioCode: str = Field(..., serialization_alias="folioCode")
    target: str = Field("GUEST_PERSONAL", serialization_alias="target")
    balancePaise: int = Field(0, serialization_alias="balancePaise")

    model_config = ConfigDict(populate_by_name=True)


class MasterFolioResponse(BaseModel):
    id: str
    folioNumber: str = Field(..., serialization_alias="folioNumber")
    reservationId: str = Field(..., serialization_alias="reservationId")
    stayId: Optional[str] = Field(None, serialization_alias="stayId")
    guestId: str = Field(..., serialization_alias="guestId")
    guestName: str = Field(..., serialization_alias="guestName")
    roomNumber: Optional[str] = Field(None, serialization_alias="roomNumber")
    status: str
    creditLimitPaise: int = Field(..., serialization_alias="creditLimitPaise")
    totalChargesPaise: int = Field(..., serialization_alias="totalChargesPaise")
    totalTaxesPaise: int = Field(..., serialization_alias="totalTaxesPaise")
    totalPaymentsPaise: int = Field(..., serialization_alias="totalPaymentsPaise")
    outstandingBalancePaise: int = Field(..., serialization_alias="outstandingBalancePaise")
    items: List[FolioItemResponse] = Field(default_factory=list)
    splitFolios: Optional[List[SplitFolioBrief]] = Field(default_factory=list, serialization_alias="splitFolios")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class PostChargeRequest(BaseModel):
    folio_id: str
    transaction_type: str  # ROOM_CHARGE, FNB_CHARGE, LAUNDRY, MINIBAR, SPA, MISC
    description: str
    debit_paise: int
    tax_paise: int = 0
    sac_code: Optional[str] = "996311"
    reference_number: Optional[str] = None


class RecordPaymentRequest(BaseModel):
    folio_id: str
    amount_paise: int
    payment_method: str  # CASH, UPI, CREDIT_CARD, DEBIT_CARD, BANK_TRANSFER, CITY_LEDGER
    provider: Optional[str] = "CASH_REGISTER"
    transaction_ref: Optional[str] = None
    card_last4: Optional[str] = None
    upi_id: Optional[str] = None


class PaymentTransactionResponse(BaseModel):
    id: str
    transactionRef: str = Field(..., serialization_alias="transactionRef")
    folioId: str = Field(..., serialization_alias="folioId")
    guestName: str = Field(..., serialization_alias="guestName")
    roomNumber: Optional[str] = Field(None, serialization_alias="roomNumber")
    amountPaise: int = Field(..., serialization_alias="amountPaise")
    paymentMethod: str = Field(..., serialization_alias="paymentMethod")
    status: str
    provider: str
    gatewayEventId: Optional[str] = Field(None, serialization_alias="gatewayEventId")
    cardLast4: Optional[str] = Field(None, serialization_alias="cardLast4")
    upiId: Optional[str] = Field(None, serialization_alias="upiId")
    createdAt: str = Field(..., serialization_alias="createdAt")
    receiptNumber: str = Field(..., serialization_alias="receiptNumber")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class ProcessPaymentPayload(BaseModel):
    folio_id: str
    amount_paise: int
    payment_method: str = "UPI"  # CASH, UPI, CREDIT_CARD, DEBIT_CARD, BANK_TRANSFER, CITY_LEDGER
    payer_name: Optional[str] = None
    payer_upi: Optional[str] = None
    card_last4: Optional[str] = None
    idempotency_key: Optional[str] = None
    simulation_outcome: Optional[str] = None  # SUCCESS, PENDING, FAILED, CANCELLED, PROVIDER_ERROR


class TaxInvoiceItem(BaseModel):
    description: str
    sacCode: str
    taxablePaise: int
    cgstPaise: int
    sgstPaise: int
    totalPaise: int


class TaxInvoiceResponse(BaseModel):
    invoiceNumber: str
    invoiceDate: str
    financialYear: str
    hotelDetails: Dict[str, Any]
    guestDetails: Dict[str, Any]
    items: List[TaxInvoiceItem]
    totalTaxablePaise: int
    totalCgstPaise: int
    totalSgstPaise: int
    totalInvoicePaise: int
    paymentsAppliedPaise: int
    balanceDuePaise: int
    roundOffPaise: int = 0  # set when Hotel settings > Folios & invoices > Round off totals is on
    amountPayablePaise: Optional[int] = None  # grand total after round-off

    model_config = ConfigDict(populate_by_name=True)


class ReconciliationItemResponse(BaseModel):
    settlementId: str
    provider: str
    transactionRef: str
    folioId: Optional[str] = None
    hmsAmountPaise: Optional[int] = None
    settlementAmountPaise: int
    feePaise: int = 0
    taxPaise: int = 0
    netPayoutPaise: int = 0
    matchStatus: str  # MATCHED, AMOUNT_MISMATCH, FEE_DIFFERENCE, MISSING_IN_HMS, MISSING_IN_GATEWAY, PENDING
    discrepancyNote: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class ReconciliationReportResponse(BaseModel):
    batchId: str
    provider: str
    settlementDate: str
    totalHmsPaymentsPaise: int
    totalSettledPaise: int
    totalFeesPaise: int
    totalPayoutPaise: int
    matchedCount: int
    discrepancyCount: int
    status: str
    isDemo: bool = True
    items: List[ReconciliationItemResponse]

    model_config = ConfigDict(populate_by_name=True)

