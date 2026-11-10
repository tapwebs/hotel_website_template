from sqlalchemy import Column, String, Integer, BigInteger, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.core.database import Base
from backend.app.models.base import generate_uuid, utc_now


class MasterFolio(Base):
    __tablename__ = "master_folios"

    folio_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    reservation_id = Column(String(50), nullable=False, index=True)
    stay_id = Column(String(50), nullable=True)
    room_number = Column(String(50), nullable=True)
    guest_id = Column(String(50), ForeignKey("guest_profiles.guest_id", ondelete="RESTRICT"), nullable=False, index=True)
    folio_number = Column(String(50), unique=True, nullable=False, index=True)
    status = Column(String(30), default="OPEN", nullable=False)  # OPEN, SETTLED, CLOSED, TRANSFERRED
    credit_limit_minor = Column(BigInteger, default=5000000, nullable=False)
    total_charges_minor = Column(BigInteger, default=0, nullable=False)
    total_taxes_minor = Column(BigInteger, default=0, nullable=False)
    total_payments_minor = Column(BigInteger, default=0, nullable=False)
    outstanding_balance_minor = Column(BigInteger, default=0, nullable=False)
    split_folios = Column(JSON, default=list, nullable=False)
    version_id = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    line_items = relationship("FolioLineItem", back_populates="folio", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="folio")


class FolioLineItem(Base):
    __tablename__ = "folio_line_items"

    line_item_id = Column(String(50), primary_key=True, default=generate_uuid)
    folio_id = Column(String(50), ForeignKey("master_folios.folio_id", ondelete="CASCADE"), nullable=False, index=True)
    business_date = Column(String(10), nullable=False, index=True)
    transaction_type = Column(String(30), nullable=False, index=True)  # ROOM_CHARGE, FNB_CHARGE, LAUNDRY, MINIBAR, SPA, PAYMENT, REFUND, DISCOUNT, TAX
    service_category = Column(String(50), default="ACCOMMODATION", nullable=False)
    sac_hsn_code = Column(String(30), default="996311", nullable=False)
    description = Column(String(255), nullable=False)
    debit_minor = Column(BigInteger, default=0, nullable=False)
    credit_minor = Column(BigInteger, default=0, nullable=False)
    net_minor = Column(BigInteger, default=0, nullable=False)
    tax_minor = Column(BigInteger, default=0, nullable=False)
    posted_by = Column(String(100), default="SYSTEM", nullable=False)
    is_immutable = Column(Boolean, default=True, nullable=False)
    reference_number = Column(String(100), nullable=True)
    posted_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    folio = relationship("MasterFolio", back_populates="line_items")


class Payment(Base):
    __tablename__ = "payments"

    payment_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    folio_id = Column(String(50), ForeignKey("master_folios.folio_id", ondelete="RESTRICT"), nullable=False, index=True)
    transaction_ref = Column(String(100), nullable=False, index=True)
    receipt_number = Column(String(50), nullable=False)
    amount_minor = Column(BigInteger, nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    payment_method = Column(String(30), nullable=False)  # CASH, UPI, CREDIT_CARD, DEBIT_CARD, BANK_TRANSFER, CITY_LEDGER
    provider = Column(String(50), default="CASH_REGISTER", nullable=False)  # RAZORPAY, STRIPE, PINE_LABS_POS, CASH_REGISTER
    status = Column(String(30), default="SUCCESS", nullable=False)  # SUCCESS, PENDING, FAILED, REFUNDED
    card_last4 = Column(String(10), nullable=True)
    upi_id = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    folio = relationship("MasterFolio", back_populates="payments")


class Invoice(Base):
    __tablename__ = "invoices"

    invoice_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    folio_id = Column(String(50), ForeignKey("master_folios.folio_id", ondelete="RESTRICT"), nullable=False, index=True)
    invoice_number = Column(String(50), unique=True, nullable=False, index=True)
    financial_year = Column(String(20), default="2026-27", nullable=False)
    recipient_name = Column(String(150), nullable=False)
    recipient_gstin = Column(String(30), nullable=True)
    recipient_state_code = Column(String(10), nullable=True)
    total_taxable_minor = Column(BigInteger, nullable=False)
    total_tax_minor = Column(BigInteger, nullable=False)
    total_invoice_minor = Column(BigInteger, nullable=False)
    pdf_s3_key = Column(String(255), nullable=True)
    issued_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class ReconciliationBatch(Base):
    __tablename__ = "payment_reconciliations"

    reconciliation_id = Column(String(50), primary_key=True, default=generate_uuid)
    property_id = Column(String(50), ForeignKey("properties.property_id", ondelete="CASCADE"), nullable=False, index=True)
    batch_reference = Column(String(100), unique=True, nullable=False, index=True)
    provider = Column(String(50), nullable=False, default="DEMO")
    settlement_date = Column(String(10), nullable=False, index=True)
    status = Column(String(30), default="COMPLETED", nullable=False)
    total_records = Column(Integer, default=0, nullable=False)
    matched_count = Column(Integer, default=0, nullable=False)
    discrepancy_count = Column(Integer, default=0, nullable=False)
    total_settled_minor = Column(BigInteger, default=0, nullable=False)
    total_fees_minor = Column(BigInteger, default=0, nullable=False)
    total_payout_minor = Column(BigInteger, default=0, nullable=False)
    discrepancies = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

