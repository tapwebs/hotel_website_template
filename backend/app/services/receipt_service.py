"""Server-sent F&B receipts: a short WhatsApp or SMS note once an order is paid.

Off unless a provider is configured (see config.py). Sending never blocks or fails a payment: it runs after the payment commit
in a background task with its own DB session, and receipt_sent_at makes a repeat call a no-op.
"""
import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Optional

import httpx
from sqlalchemy import update

from backend.app.core.config import settings
from backend.app.core.database import async_session_factory
from backend.app.models.pos import POSOrder
from backend.app.services.pos_service import property_name

log = logging.getLogger("receipts")
_tasks: set = set()  # keeps background tasks alive until they finish
_TIMEOUT = 10.0


def channel() -> Optional[str]:
    if settings.WHATSAPP_CLOUD_TOKEN and settings.WHATSAPP_CLOUD_PHONE_NUMBER_ID:
        return "whatsapp"
    if settings.MSG91_AUTH_KEY and settings.MSG91_RECEIPT_TEMPLATE_ID:
        return "sms"
    return None


def normalize_phone(raw: Optional[str]) -> Optional[str]:
    """Digits with a country code, or None. A 10-digit number gets the default country code."""
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 10:
        digits = settings.RECEIPT_DEFAULT_COUNTRY_CODE + digits
    return digits if 11 <= len(digits) <= 15 else None


def _rupees(paise: int) -> str:
    return f"₹{paise / 100:,.2f}"


def message_values(order: POSOrder, restaurant: str) -> list:
    return [(order.guest_name or "Guest").split()[0][:30], order.order_number, _rupees(order.total_minor), restaurant]


def text_body(order: POSOrder, restaurant: str) -> str:
    name, number, total, rest = message_values(order, restaurant)
    paid = f" via {order.payment_method.title()}" if order.payment_method else ""
    return f"Hi {name}, thank you for dining at {rest}. Order {number}: {total} paid{paid}."


async def _send_whatsapp(to: str, order: POSOrder, restaurant: str) -> None:
    url = f"https://graph.facebook.com/{settings.WHATSAPP_GRAPH_VERSION}/{settings.WHATSAPP_CLOUD_PHONE_NUMBER_ID}/messages"
    if settings.WHATSAPP_RECEIPT_TEMPLATE:
        payload = {"messaging_product": "whatsapp", "to": to, "type": "template", "template": {
            "name": settings.WHATSAPP_RECEIPT_TEMPLATE, "language": {"code": settings.WHATSAPP_RECEIPT_LANG},
            "components": [{"type": "body", "parameters": [{"type": "text", "text": v} for v in message_values(order, restaurant)]}]}}
    else:
        payload = {"messaging_product": "whatsapp", "to": to, "type": "text", "text": {"body": text_body(order, restaurant)}}
    async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
        r = await c.post(url, json=payload, headers={"Authorization": f"Bearer {settings.WHATSAPP_CLOUD_TOKEN}"})
    r.raise_for_status()


async def _send_sms(to: str, order: POSOrder, restaurant: str) -> None:
    recipient = {"mobiles": to, **{f"VAR{n}": v for n, v in enumerate(message_values(order, restaurant), start=1)}}
    async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
        r = await c.post("https://control.msg91.com/api/v5/flow", headers={"authkey": settings.MSG91_AUTH_KEY or ""},
                         json={"template_id": settings.MSG91_RECEIPT_TEMPLATE_ID, "recipients": [recipient]})
    r.raise_for_status()


async def send_receipt(order_id: str, *, phone: Optional[str] = None, force: bool = False) -> bool:
    """Send the receipt for a paid order. Returns True if it went out. Never raises."""
    ch = channel()
    if not ch:
        return False
    claimed = False
    try:
        async with async_session_factory() as db:
            order = await db.get(POSOrder, order_id)
            if not order or not order.paid_at:
                return False
            to = normalize_phone(phone or order.customer_phone)
            if not to:
                return False
            # Claim the send first with one conditional UPDATE, so two triggers for the same payment (verify + webhook) can't both send.
            claim = update(POSOrder).where(POSOrder.order_id == order_id)
            if not force:
                claim = claim.where(POSOrder.receipt_sent_at.is_(None))
            if (await db.execute(claim.values(receipt_sent_at=datetime.now(timezone.utc)))).rowcount == 0:
                return False
            await db.commit()
            claimed = True
            restaurant = await property_name(db, order.property_id)
            await (_send_whatsapp if ch == "whatsapp" else _send_sms)(to, order, restaurant)
            return True
    except Exception as exc:  # a failed receipt must never affect the sale
        log.warning("receipt for order %s not sent: %s", order_id, exc.__class__.__name__)
        if claimed:  # release the claim so a retry or resend can go out
            try:
                async with async_session_factory() as db:
                    await db.execute(update(POSOrder).where(POSOrder.order_id == order_id).values(receipt_sent_at=None))
                    await db.commit()
            except Exception:
                pass
        return False


def queue_receipt(order_id: str) -> None:
    """Fire and forget, called after the payment has been committed."""
    if not channel():
        return
    task = asyncio.get_running_loop().create_task(send_receipt(order_id))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
