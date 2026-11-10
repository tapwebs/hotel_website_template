"""Public in-room dining for guests. No login: the QR token for the stay is the credential (see dining_service.py)."""
from typing import List

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.core.ratelimit import get_client_ip, hit
from backend.app.schemas.pos import GuestDiningInfo, GuestOrderRequest, GuestOrderView
from backend.app.services.dining_service import DiningService

router = APIRouter(prefix="/dining", tags=["Guest In-Room Dining"])


def _limit(request: Request, token: str, *, writes: bool = False) -> None:
    ip = get_client_ip(request)
    hit(f"dine-ip:{ip}", 120, 60)  # any guess-and-check against tokens burns this budget
    if writes:
        hit(f"dine-order:{token}", 6, 600)


@router.get("/{token}", response_model=GuestDiningInfo, summary="Room, guest first name and the available menu")
async def info(token: str, request: Request, db: AsyncSession = Depends(get_db)):
    _limit(request, token)
    return await DiningService.info(db, token)


@router.get("/{token}/orders", response_model=List[GuestOrderView], summary="This stay's orders")
async def orders(token: str, request: Request, db: AsyncSession = Depends(get_db)):
    _limit(request, token)
    return await DiningService.orders(db, token)


@router.post("/{token}/orders", response_model=GuestOrderView, status_code=201, summary="Order to the room")
async def place(token: str, body: GuestOrderRequest, request: Request, db: AsyncSession = Depends(get_db)):
    _limit(request, token, writes=True)
    return await DiningService.place(db, token, body)


@router.post("/{token}/orders/{order_number}/cancel", response_model=GuestOrderView, summary="Cancel an order the kitchen has not started")
async def cancel(token: str, order_number: str, request: Request, db: AsyncSession = Depends(get_db)):
    _limit(request, token, writes=True)
    return await DiningService.cancel(db, token, order_number)
