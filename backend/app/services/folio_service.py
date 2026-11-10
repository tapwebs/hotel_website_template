import random
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.numbering import financial_year
from backend.app.core.tax import room_tax_minor, percent_of, RESTAURANT_GST_PERCENT, SERVICE_GST_PERCENT
from backend.app.core.errors import AppException, ConflictException, NotFoundException, ValidationException
from backend.app.models.folio import MasterFolio, FolioLineItem, Payment, Invoice
from backend.app.models.guest import GuestProfile
from backend.app.models.organization import Organization, Property, PropertySettings
from backend.app.schemas.folio import (
    FolioItemResponse,
    MasterFolioResponse,
    PaymentTransactionResponse,
    PostChargeRequest,
    RecordPaymentRequest,
    SplitFolioBrief,
    TaxInvoiceItem,
    TaxInvoiceResponse
)


class FolioService:
    @staticmethod
    def recalculate_folio_balance(folio: MasterFolio) -> None:
        """
        Authoritatively recalculates MasterFolio balance and totals from persisted ledger line items.
        - total_charges_minor: sum of (debit_minor + tax_minor) for all non-payment/refund items
        - total_taxes_minor: sum of tax_minor for all items
        - total_payments_minor: sum of credit_minor for PAYMENT items - sum of debit_minor for REFUND items
        - outstanding_balance_minor: max(0, total_charges_minor - total_payments_minor)
        """
        from sqlalchemy.orm import attributes
        state = attributes.instance_state(folio)
        if "line_items" not in state.dict:
            return
        line_items = folio.line_items
        if not line_items:
            return
        charges_minor = 0
        taxes_minor = 0
        payments_minor = 0
        has_charge_items = False

        for item in line_items:
            taxes_minor += (item.tax_minor or 0)
            if item.transaction_type == "PAYMENT":
                payments_minor += (item.credit_minor or 0)
            elif item.transaction_type == "REFUND":
                payments_minor -= (item.debit_minor or 0)
            else:
                has_charge_items = True
                charges_minor += (item.debit_minor or 0) - (item.credit_minor or 0) + (item.tax_minor or 0)

        if has_charge_items:
            folio.total_charges_minor = charges_minor
            folio.total_taxes_minor = taxes_minor
        elif folio.total_charges_minor:
            # Preserve initial reservation charges & taxes if no charge line items posted yet
            charges_minor = folio.total_charges_minor
            taxes_minor = folio.total_taxes_minor

        folio.total_payments_minor = max(0, payments_minor)
        folio.outstanding_balance_minor = max(0, charges_minor - folio.total_payments_minor)

        if folio.status in ("OPEN", "SETTLED"):
            if folio.outstanding_balance_minor == 0 and folio.total_charges_minor > 0:
                folio.status = "SETTLED"
            elif folio.outstanding_balance_minor > 0:
                folio.status = "OPEN"

    @staticmethod
    def _format_folio_dto(f: MasterFolio, guest_name: str) -> MasterFolioResponse:
        FolioService.recalculate_folio_balance(f)

        items_dto = [
            FolioItemResponse(
                id=item.line_item_id,
                folioId=item.folio_id,
                transactionType=item.transaction_type,
                description=item.description,
                sacCode=item.sac_hsn_code,
                debitPaise=item.debit_minor,
                creditPaise=item.credit_minor,
                netPaise=item.net_minor,
                taxPaise=item.tax_minor,
                postedAt=item.posted_at.isoformat() if item.posted_at else datetime.now(timezone.utc).isoformat(),
                postedBy=item.posted_by,
                isImmutable=item.is_immutable,
                referenceNumber=item.reference_number
            )
            for item in (f.line_items or [])
        ]

        split_folios_dto = [
            SplitFolioBrief(
                id=sf.get("id", f"spl-{i}"),
                folioCode=sf.get("folioCode", f"Folio {i+1}"),
                target=sf.get("target", "GUEST_PERSONAL"),
                balancePaise=sf.get("balancePaise", 0)
            )
            for i, sf in enumerate(f.split_folios or [])
        ]

        return MasterFolioResponse(
            id=f.folio_id,
            folioNumber=f.folio_number,
            reservationId=f.reservation_id,
            stayId=f.stay_id,
            guestId=f.guest_id,
            guestName=guest_name,
            roomNumber=f.room_number,
            status=f.status,
            creditLimitPaise=f.credit_limit_minor,
            totalChargesPaise=f.total_charges_minor,
            totalTaxesPaise=f.total_taxes_minor,
            totalPaymentsPaise=f.total_payments_minor,
            outstandingBalancePaise=f.outstanding_balance_minor,
            items=items_dto,
            splitFolios=split_folios_dto
        )

    @staticmethod
    async def get_all_folios(
        db: AsyncSession,
        property_id: str,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[MasterFolioResponse]:
        query = (
            select(MasterFolio)
            .where(MasterFolio.property_id == property_id)
            .options(selectinload(MasterFolio.line_items), selectinload(MasterFolio.payments))
            .order_by(MasterFolio.created_at.desc())
        )
        if status:
            query = query.where(MasterFolio.status == status)

        query = query.limit(max(1, min(limit, 500))).offset(max(0, offset))
        res = await db.execute(query)
        folios = res.scalars().all()
        if not folios:
            return []

        # Batch fetch all referenced guest profiles in ONE query
        guest_ids = {f.guest_id for f in folios if f.guest_id}
        if guest_ids:
            g_stmt = select(GuestProfile.guest_id, GuestProfile.full_name).where(GuestProfile.guest_id.in_(guest_ids))
            g_rows = (await db.execute(g_stmt)).all()
            guest_map = {row[0]: row[1] for row in g_rows}
        else:
            guest_map = {}

        return [
            FolioService._format_folio_dto(f, guest_map.get(f.guest_id, "Guest"))
            for f in folios
        ]

    @staticmethod
    async def get_folio_by_id(db: AsyncSession, property_id: str, folio_id: str) -> Optional[MasterFolioResponse]:
        stmt = (
            select(MasterFolio)
            .where(
                MasterFolio.property_id == property_id,
                or_(MasterFolio.folio_id == folio_id, MasterFolio.folio_number == folio_id)
            )
            .options(selectinload(MasterFolio.line_items), selectinload(MasterFolio.payments))
        )
        folio = (await db.execute(stmt)).scalar_one_or_none()
        if not folio:
            return None

        guest_name = "Guest"
        if folio.guest_id:
            g = await db.get(GuestProfile, folio.guest_id)
            if g and g.full_name:
                guest_name = g.full_name

        return FolioService._format_folio_dto(folio, guest_name)

    @staticmethod
    async def post_charge(
        db: AsyncSession,
        property_id: str,
        request: PostChargeRequest
    ) -> MasterFolioResponse:
        stmt = (
            select(MasterFolio)
            .where(MasterFolio.property_id == property_id, MasterFolio.folio_id == request.folio_id)
            .options(selectinload(MasterFolio.line_items), selectinload(MasterFolio.payments))
        )
        folio = (await db.execute(stmt)).scalar_one_or_none()
        if not folio:
            raise NotFoundException("Master folio not found.")

        if folio.status in ["CLOSED"]:
            raise ConflictException("Cannot post charges to a closed folio.")

        if request.debit_paise <= 0:
            raise ValidationException("Charge amount must be positive.")

        # Idempotency check: if reference_number already posted to this folio, return early
        if request.reference_number:
            existing_item = (await db.execute(
                select(FolioLineItem).where(
                    FolioLineItem.folio_id == folio.folio_id,
                    FolioLineItem.reference_number == request.reference_number
                )
            )).scalar_one_or_none()
            if existing_item:
                return await FolioService.get_folio_by_id(db, property_id, folio.folio_id)

        # Standard GST and SAC code determination
        tax_paise = request.tax_paise
        sac_code = request.sac_code or "996311"
        if tax_paise == 0:
            tt = (request.transaction_type or "").upper()
            if tt in ("FNB_CHARGE", "RESTAURANT", "ROOM_SERVICE"):
                tax_paise = percent_of(request.debit_paise, RESTAURANT_GST_PERCENT)
                sac_code = "996331"
            elif tt in ("SPA", "WELLNESS"):
                tax_paise = percent_of(request.debit_paise, SERVICE_GST_PERCENT)
                sac_code = "999711"
            elif tt == "ROOM_CHARGE":
                tax_paise = room_tax_minor(request.debit_paise)
                sac_code = "996311"
            else:
                tax_paise = percent_of(request.debit_paise, SERVICE_GST_PERCENT)
                sac_code = "999799"

        # Create Line Item
        now = datetime.now(timezone.utc)
        item = FolioLineItem(
            folio_id=folio.folio_id,
            business_date=now.strftime("%Y-%m-%d"),
            transaction_type=request.transaction_type,
            service_category=request.transaction_type,
            sac_hsn_code=sac_code,
            description=request.description,
            debit_minor=request.debit_paise,
            credit_minor=0,
            net_minor=request.debit_paise,
            tax_minor=tax_paise,
            posted_by="FRONT_DESK",
            reference_number=request.reference_number
        )
        db.add(item)
        if folio.line_items is not None:
            folio.line_items.append(item)

        FolioService.recalculate_folio_balance(folio)
        await db.commit()
        return await FolioService.get_folio_by_id(db, property_id, folio.folio_id)

    @staticmethod
    async def apply_confirmed_payment(
        db: AsyncSession,
        property_id: str,
        folio_id: str,
        amount_paise: int,
        payment_method: str,
        provider: str,
        transaction_ref: str,
        receipt_number: Optional[str] = None,
        card_last4: Optional[str] = None,
        upi_id: Optional[str] = None,
        is_demo: bool = False
    ) -> MasterFolioResponse:
        stmt = (
            select(MasterFolio)
            .where(MasterFolio.property_id == property_id, MasterFolio.folio_id == folio_id)
            .options(selectinload(MasterFolio.line_items), selectinload(MasterFolio.payments))
        )
        folio = (await db.execute(stmt)).scalar_one_or_none()
        if not folio:
            raise NotFoundException("Master folio not found.")

        if amount_paise <= 0:
            raise ValidationException("Payment amount must be greater than zero.")

        if folio.status in ["CLOSED"]:
            raise ConflictException("Cannot apply payment to a closed folio.")

        # Idempotency check: if transaction_ref already recorded for this folio, return early
        existing_payment = (await db.execute(
            select(Payment).where(
                Payment.folio_id == folio.folio_id,
                Payment.transaction_ref == transaction_ref
            )
        )).scalar_one_or_none()
        if existing_payment:
            return await FolioService.get_folio_by_id(db, property_id, folio.folio_id)

        receipt_num = receipt_number or f"{'DEMO-' if is_demo else ''}REC-2026-{random.randint(100, 999)}"

        payment = Payment(
            property_id=property_id,
            folio_id=folio.folio_id,
            transaction_ref=transaction_ref,
            receipt_number=receipt_num,
            amount_minor=amount_paise,
            currency="INR",
            payment_method=payment_method,
            provider="DEMO" if is_demo else provider,
            status="SUCCESS",
            card_last4=card_last4,
            upi_id=upi_id
        )
        db.add(payment)

        # Record Folio Line Item
        now = datetime.now(timezone.utc)
        desc_prefix = "[DEMO] " if is_demo else ""
        item = FolioLineItem(
            folio_id=folio.folio_id,
            business_date=now.strftime("%Y-%m-%d"),
            transaction_type="PAYMENT",
            service_category="PAYMENT",
            sac_hsn_code="996311",
            description=f"{desc_prefix}Payment received via {payment_method} ({'DEMO' if is_demo else provider})",
            debit_minor=0,
            credit_minor=amount_paise,
            net_minor=-amount_paise,
            tax_minor=0,
            posted_by="PAYMENT_SERVICE",
            reference_number=transaction_ref
        )
        db.add(item)
        if folio.line_items is not None:
            folio.line_items.append(item)

        FolioService.recalculate_folio_balance(folio)
        await db.commit()
        return await FolioService.get_folio_by_id(db, property_id, folio.folio_id)

    @staticmethod
    async def record_payment(
        db: AsyncSession,
        property_id: str,
        request: RecordPaymentRequest
    ) -> MasterFolioResponse:
        txn_ref = request.transaction_ref or f"TXN-{random.randint(100000, 999999)}"
        is_demo = (request.provider or "").upper() == "DEMO"
        return await FolioService.apply_confirmed_payment(
            db=db,
            property_id=property_id,
            folio_id=request.folio_id,
            amount_paise=request.amount_paise,
            payment_method=request.payment_method,
            provider=request.provider or "CASH_REGISTER",
            transaction_ref=txn_ref,
            card_last4=request.card_last4,
            upi_id=request.upi_id,
            is_demo=is_demo
        )

    @staticmethod
    async def get_all_payments(db: AsyncSession, property_id: str, limit: int = 500, offset: int = 0) -> List[PaymentTransactionResponse]:
        query = (
            select(Payment)
            .where(Payment.property_id == property_id)
            .options(selectinload(Payment.folio))
            .order_by(Payment.created_at.desc(), Payment.payment_id.desc())
            .offset(offset).limit(limit)
        )
        res = await db.execute(query)
        payments = res.scalars().all()
        guest_ids = {p.folio.guest_id for p in payments if p.folio and p.folio.guest_id}
        guest_map = {g.guest_id: g for g in (await db.execute(select(GuestProfile).where(GuestProfile.guest_id.in_(guest_ids)))).scalars()} if guest_ids else {}

        responses = []
        for p in payments:
            guest_name = "Guest"
            room_num = None
            if p.folio:
                room_num = p.folio.room_number
                guest = guest_map.get(p.folio.guest_id)
                if guest:
                    guest_name = guest.full_name

            responses.append(PaymentTransactionResponse(
                id=p.payment_id,
                transactionRef=p.transaction_ref,
                folioId=p.folio_id,
                guestName=guest_name,
                roomNumber=room_num,
                amountPaise=p.amount_minor,
                paymentMethod=p.payment_method,
                status=p.status,
                provider=p.provider,
                cardLast4=p.card_last4,
                upiId=p.upi_id,
                createdAt=p.created_at.isoformat() if p.created_at else datetime.now(timezone.utc).isoformat(),
                receiptNumber=p.receipt_number
            ))
        return responses

    @staticmethod
    async def process_refund(
        db: AsyncSession,
        property_id: str,
        payment_id: str,
        amount_paise: int,
        reason: Optional[str] = None,
        simulation_outcome: Optional[str] = None
    ) -> dict:
        stmt = (
            select(Payment)
            .where(Payment.property_id == property_id, or_(Payment.payment_id == payment_id, Payment.transaction_ref == payment_id))
            .options(selectinload(Payment.folio).selectinload(MasterFolio.line_items))
        )
        payment = (await db.execute(stmt)).scalar_one_or_none()
        if not payment:
            raise NotFoundException("Payment transaction not found.")

        if amount_paise <= 0:
            raise ValidationException("Refund amount must be positive.")

        if payment.status == "REFUNDED":
            raise ValidationException("Payment has already been fully refunded.")

        if payment.status not in ("SUCCESS", "PARTIALLY_REFUNDED"):
            raise ValidationException(f"Cannot refund payment in '{payment.status}' status. Only SUCCESS payments can be refunded.")

        # Check total previously refunded on this payment
        refund_stmt = select(FolioLineItem).where(
            FolioLineItem.folio_id == payment.folio_id,
            FolioLineItem.transaction_type == "REFUND",
            FolioLineItem.reference_number.like(f"%{payment.transaction_ref}%")
        )
        prior_refunds = (await db.execute(refund_stmt)).scalars().all()
        already_refunded = sum(r.debit_minor for r in prior_refunds)
        refundable_remaining = payment.amount_minor - already_refunded

        if amount_paise > refundable_remaining:
            raise ValidationException(
                f"Refund amount of ₹{amount_paise/100:.2f} exceeds refundable balance of ₹{refundable_remaining/100:.2f}."
            )

        # Route the refund by where the money was captured, never by the currently active gateway.
        from backend.app.services.payment_providers.factory import refund_provider_for
        from backend.app.services.payment_providers.base import RefundRequest, RefundResult
        provider = refund_provider_for(payment.provider, payment.transaction_ref)
        if provider is None:
            # Cash drawer, card machine, bank transfer: staff hand the money back; the HMS records it.
            refund_res = RefundResult(
                status="SUCCESS",
                refund_ref=f"MAN-{random.randint(100000, 999999)}",
                amount_minor=amount_paise,
                message=f"Refund recorded. Return the money to the guest via {payment.payment_method}.",
                is_demo=False,
            )
        else:
            refund_res = await provider.process_refund(RefundRequest(
                payment_id=payment.payment_id,
                transaction_ref=payment.transaction_ref,
                amount_minor=amount_paise,
                reason=reason,
                provider_payment_id=payment.transaction_ref if payment.transaction_ref.startswith("pay_") else None,
                simulation_outcome=simulation_outcome,
            ))

        if refund_res.status != "SUCCESS":
            raise AppException(
                code="REFUND_FAILED",
                message=f"Refund declined by payment provider: {refund_res.message}",
                status_code=400,
                details={"status": refund_res.status, "message": refund_res.message}
            )

        # Record Folio Line Item for Refund
        now = datetime.now(timezone.utc)
        desc_label = "[DEMO] " if refund_res.is_demo else ""
        item = FolioLineItem(
            folio_id=payment.folio_id,
            business_date=now.strftime("%Y-%m-%d"),
            transaction_type="REFUND",
            service_category="PAYMENT",
            sac_hsn_code="996311",
            description=f"{desc_label}Refund: {reason or 'Guest requested refund'}",
            debit_minor=amount_paise,
            credit_minor=0,
            net_minor=amount_paise,
            tax_minor=0,
            posted_by="SUPERVISOR",
            reference_number=f"REF-{payment.transaction_ref}-{refund_res.refund_ref}"
        )
        db.add(item)

        # If fully refunded, update payment status; otherwise set PARTIALLY_REFUNDED
        if already_refunded + amount_paise >= payment.amount_minor:
            payment.status = "REFUNDED"
        else:
            payment.status = "PARTIALLY_REFUNDED"

        # Update folio balance
        if payment.folio:
            if payment.folio.line_items is not None:
                payment.folio.line_items.append(item)
            FolioService.recalculate_folio_balance(payment.folio)

        await db.commit()
        return {
            "status": "SUCCESS",
            "message": refund_res.message,
            "refundAmountPaise": amount_paise,
            "paymentId": payment.payment_id,
            "refundRef": refund_res.refund_ref,
            "isDemo": refund_res.is_demo
        }

    @staticmethod
    async def generate_tax_invoice(db: AsyncSession, property_id: str, folio_id: str) -> TaxInvoiceResponse:
        stmt = (
            select(MasterFolio)
            .where(MasterFolio.property_id == property_id, or_(MasterFolio.folio_id == folio_id, MasterFolio.folio_number == folio_id))
            .options(selectinload(MasterFolio.line_items), selectinload(MasterFolio.payments))
        )
        folio = (await db.execute(stmt)).scalar_one_or_none()
        if not folio:
            raise NotFoundException("Master folio not found.")

        FolioService.recalculate_folio_balance(folio)

        # Guest info
        guest_name = "Guest"
        guest_gstin = None
        guest_state = "08"
        if folio.guest_id:
            g = await db.get(GuestProfile, folio.guest_id)
            if g:
                guest_name = g.full_name or "Guest"
                guest_gstin = getattr(g, "tax_id", None) or getattr(g, "gstin", None)

        # Existing or new invoice
        inv_stmt = select(Invoice).where(Invoice.folio_id == folio.folio_id)
        existing_invoice = (await db.execute(inv_stmt)).scalar_one_or_none()
        if existing_invoice:
            invoice_num = existing_invoice.invoice_number
            inv_date = existing_invoice.issued_at.strftime("%d-%b-%Y").upper() if existing_invoice.issued_at else datetime.now(timezone.utc).strftime("%d-%b-%Y").upper()
            existing_invoice.total_taxable_minor = folio.total_charges_minor - folio.total_taxes_minor
            existing_invoice.total_tax_minor = folio.total_taxes_minor
            existing_invoice.total_invoice_minor = folio.total_charges_minor
            await db.commit()
        else:
            fy = financial_year()
            # GST invoices carry a consecutive serial number within the financial year
            serial = (await db.execute(
                select(func.count(Invoice.invoice_id)).where(Invoice.property_id == property_id, Invoice.financial_year == fy)
            )).scalar() or 0
            invoice_num = f"INV/{fy}/{serial + 1:05d}"
            inv_date = datetime.now(timezone.utc).strftime("%d-%b-%Y").upper()
            new_inv = Invoice(
                property_id=property_id,
                folio_id=folio.folio_id,
                invoice_number=invoice_num,
                financial_year=fy,
                recipient_name=guest_name,
                recipient_gstin=guest_gstin,
                recipient_state_code=guest_state,
                total_taxable_minor=folio.total_charges_minor - folio.total_taxes_minor,
                total_tax_minor=folio.total_taxes_minor,
                total_invoice_minor=folio.total_charges_minor
            )
            db.add(new_inv)
            await db.commit()

        # Itemize lines
        invoice_items = []
        for line in folio.line_items or []:
            if line.transaction_type not in ("PAYMENT", "REFUND"):
                taxable = (line.debit_minor or 0) - (line.credit_minor or 0)
                tax = line.tax_minor
                half_tax = tax // 2
                invoice_items.append(TaxInvoiceItem(
                    description=line.description,
                    sacCode=line.sac_hsn_code or "996311",
                    taxablePaise=taxable,
                    cgstPaise=half_tax,
                    sgstPaise=tax - half_tax,
                    totalPaise=taxable + tax
                ))

        cgst_total = folio.total_taxes_minor // 2
        sgst_total = folio.total_taxes_minor - cgst_total
        prop = await db.get(Property, property_id)
        org = await db.get(Organization, prop.org_id) if prop else None
        hotel_details = {
            "name": prop.name if prop else "",
            "legalName": (org.legal_entity_name if org else None) or (prop.name if prop else ""),
            "address": ", ".join(x for x in (prop.address_line1, prop.city, prop.postal_code) if x) if prop else "",
            # Registration data comes from the property record only; blank until it is set (never a placeholder number).
            "gstin": (prop.gstin or "") if prop else "",
            "pan": "",
            "stateCode": "08 (Rajasthan)" if prop and prop.state_code == "08" else (prop.state_code if prop else ""),
            "sacCategory": "9963 Accommodation, Food & Beverage Services",
        }

        # Round the grand total to the nearest rupee when Hotel settings > Folios & invoices > Round off totals is on.
        ps = (await db.execute(select(PropertySettings).where(PropertySettings.property_id == property_id))).scalar_one_or_none()
        round_on = bool((((ps.settings_json or {}) if ps else {}).get("invoice") or {}).get("roundOffTotals", False))
        grand = folio.total_charges_minor
        payable = (grand + 50) // 100 * 100 if round_on else grand
        balance = folio.outstanding_balance_minor
        if round_on:
            # Paying either the exact or the rounded amount settles the invoice.
            balance = 0 if folio.total_payments_minor in (grand, payable) else payable - folio.total_payments_minor
        return TaxInvoiceResponse(
            invoiceNumber=invoice_num,
            invoiceDate=inv_date,
            financialYear=financial_year(),
            hotelDetails=hotel_details,
            guestDetails={
                "name": guest_name,
                "roomNumber": folio.room_number or "N/A",
                "stayId": folio.stay_id or "Active Stay",
                "folioNumber": folio.folio_number,
                "reservationId": folio.reservation_id,
                "gstin": guest_gstin or "N/A (Consumer / B2C)"
            },
            items=invoice_items,
            totalTaxablePaise=folio.total_charges_minor - folio.total_taxes_minor,
            totalCgstPaise=cgst_total,
            totalSgstPaise=sgst_total,
            totalInvoicePaise=folio.total_charges_minor,
            paymentsAppliedPaise=folio.total_payments_minor,
            balanceDuePaise=balance,
            roundOffPaise=payable - grand,
            amountPayablePaise=payable,
        )
