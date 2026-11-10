"""Staff F&B API: POS (tables, orders), kitchen display (KDS) and menu management. Guest ordering lives in dining.py."""
import hashlib
import time
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_user, get_property_context, require_any_permission, require_permission
from backend.app.core.errors import ForbiddenException
from backend.app.core.rbac import Permission, user_has_permission
from backend.app.models.pos import POSOrder, POSTable
from backend.app.models.user import User
from backend.app.schemas.pos import (
    CreatePOSOrderRequest, InHouseRoomQr, MenuItemCreate, MenuItemResponse, MenuItemUpdate, OrderStatusUpdate,
    POSOrderResponse, POSTableResponse, Station,
)
from backend.app.services.fnb_ops_service import FnbOps
from backend.app.services.pos_service import OPEN_AT_TABLE, PENDING, POSService


def _etag(request: Request, response: Response, parts) -> Optional[Response]:
    """Weak ETag from cheap DB aggregates (multi-worker safe). Returns a 304 response when the client already has it."""
    digest = hashlib.sha1(repr(parts).encode()).hexdigest()[:24]
    etag = f'W/"{digest}"'
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "private, no-cache"
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={"ETag": etag, "Cache-Control": "private, no-cache"})
    return None


async def _orders_stats(db: AsyncSession, pid: str, *, statuses=None, latest: Optional[int] = None):
    """count/max(updated_at)/max(created_at) over the orders a list endpoint would return. Every ORM and Core write to
    pos_orders bumps updated_at (Column onupdate), so any change to a returned order, or a row entering/leaving the set,
    changes the tuple. The minute bucket covers elapsedMinutes, which the response derives from the clock."""
    sub = select(POSOrder.updated_at, POSOrder.created_at).where(POSOrder.property_id == pid)
    if statuses:
        sub = sub.where(POSOrder.status.in_(statuses))
    if latest:
        sub = sub.order_by(POSOrder.created_at.desc()).limit(latest)
    sub = sub.subquery()
    row = (await db.execute(select(func.count(), func.max(sub.c.updated_at), func.max(sub.c.created_at)).select_from(sub))).one()
    return (row[0], str(row[1]), str(row[2]), int(time.time() // 60))


router = APIRouter(prefix="/pos", tags=["F&B POS & Kitchen KDS"])

POS = Permission.ACCESS_POS.value
KDS = Permission.VIEW_KDS.value
ACCEPT = Permission.ACCEPT_GUEST_ORDERS.value
CANCEL = Permission.CANCEL_FNB_ORDERS.value
MANAGE = Permission.MANAGE_SETTINGS.value


@router.get("/tables", response_model=List[POSTableResponse], summary="List restaurant floor tables")
async def get_tables(
    request: Request,
    response: Response,
    property_id: str = Depends(get_property_context),
    _: User = Depends(require_permission(POS)),
    db: AsyncSession = Depends(get_db),
):
    # Table status/bill is written onto pos_tables by every order change (_sync_table), so the table rows themselves are the
    # tag; tables are few, so selecting them is cheap. The minute bucket covers seatedMinutes (derived from the clock).
    rows = (await db.execute(select(POSTable.__table__).where(POSTable.property_id == property_id).order_by(POSTable.table_id))).all()
    if (hit := _etag(request, response, ("t", [tuple(r) for r in rows], int(time.time() // 60)))):
        return hit
    await FnbOps.ensure_table_tokens(db, property_id)
    return await POSService.get_tables(db, property_id)


@router.get("/menu", response_model=List[MenuItemResponse], summary="List menu items (including sold-out ones)")
async def get_menu(
    property_id: str = Depends(get_property_context),
    _: User = Depends(require_any_permission([POS, KDS])),
    db: AsyncSession = Depends(get_db),
):
    return await POSService.get_menu(db, property_id)


@router.post("/menu", response_model=MenuItemResponse, status_code=201, summary="Add a menu item")
async def create_menu_item(
    body: MenuItemCreate,
    property_id: str = Depends(get_property_context),
    _: User = Depends(require_permission(MANAGE)),
    db: AsyncSession = Depends(get_db),
):
    return await POSService.create_menu_item(db, property_id, body)


@router.patch("/menu/{item_id}", response_model=MenuItemResponse, summary="Edit a menu item, or mark it sold out (86)")
async def update_menu_item(
    item_id: str,
    body: MenuItemUpdate,
    property_id: str = Depends(get_property_context),
    user: User = Depends(require_any_permission([POS, KDS])),
    db: AsyncSession = Depends(get_db),
):
    # Anyone on the floor or the pass can 86 an item; changing the menu itself needs settings access.
    if set(body.model_dump(exclude_unset=True)) - {"isAvailable"} and not user_has_permission(user, MANAGE):
        raise ForbiddenException("Editing the menu needs settings access.")
    return await POSService.update_menu_item(db, property_id, item_id, body)


@router.delete("/menu/{item_id}", status_code=204, summary="Remove a menu item")
async def delete_menu_item(
    item_id: str,
    property_id: str = Depends(get_property_context),
    _: User = Depends(require_permission(MANAGE)),
    db: AsyncSession = Depends(get_db),
):
    await POSService.delete_menu_item(db, property_id, item_id)
    return Response(status_code=204)


@router.get("/orders", response_model=List[POSOrderResponse], summary="Kitchen board (scope=active) or recent orders (scope=all)")
async def get_orders(
    request: Request,
    response: Response,
    scope: Literal["active", "all"] = "active",
    station: Optional[Station] = None,
    limit: int = Query(200, ge=1, le=500),
    property_id: str = Depends(get_property_context),
    _: User = Depends(require_any_permission([POS, KDS])),
    db: AsyncSession = Depends(get_db),
):
    # Tag from a cheap aggregate query, so an unchanged board costs one small query and no order loading. Active scope covers
    # DELIVERED too: those orders decide additionalKot on the active ones.
    stats = await _orders_stats(db, property_id, statuses=OPEN_AT_TABLE) if scope == "active" else await _orders_stats(db, property_id, latest=limit)
    if (hit := _etag(request, response, ("o", scope, station, limit, stats))):
        return hit
    return await POSService.list_orders(db, property_id, scope=scope, station=station, limit=limit)


@router.post("/orders", response_model=POSOrderResponse, status_code=201, summary="Create a dine-in, takeaway or room-service order")
async def create_order(
    request: CreatePOSOrderRequest,
    property_id: str = Depends(get_property_context),
    _: User = Depends(require_permission(POS)),
    db: AsyncSession = Depends(get_db),
):
    return await POSService.create_order(db, property_id, request)


@router.patch("/orders/{order_id}/status", response_model=POSOrderResponse, summary="Move an order through its lifecycle")
async def update_order_status(
    order_id: str,
    body: OrderStatusUpdate,
    property_id: str = Depends(get_property_context),
    user: User = Depends(require_any_permission([POS, KDS])),
    db: AsyncSession = Depends(get_db),
):
    if body.status == "CANCELLED" and not user_has_permission(user, CANCEL):
        raise ForbiddenException("Only a captain or admin can cancel an order.")
    return await POSService.update_status(
        db, property_id, order_id, body.status, can_all_moves=user_has_permission(user, POS), reason=body.reason
    )


@router.get("/orders/pending", response_model=List[POSOrderResponse], summary="Guest orders waiting to be accepted")
async def pending_orders(
    request: Request,
    response: Response,
    property_id: str = Depends(get_property_context),
    _: User = Depends(require_permission(ACCEPT)),
    db: AsyncSession = Depends(get_db),
):
    if (hit := _etag(request, response, ("p", await _orders_stats(db, property_id, statuses=(PENDING,))))):
        return hit
    return await POSService.pending_guest_orders(db, property_id)


@router.post("/orders/{order_id}/accept", response_model=POSOrderResponse, summary="Accept a guest order and send it to the kitchen")
async def accept_order(
    order_id: str,
    property_id: str = Depends(get_property_context),
    user: User = Depends(require_permission(ACCEPT)),
    db: AsyncSession = Depends(get_db),
):
    return await POSService.accept(db, property_id, order_id, (user.full_name or user.user_id)[:50])


@router.get("/room-qr", response_model=List[InHouseRoomQr], summary="In-room ordering links for checked-in guests")
async def room_qr(
    property_id: str = Depends(get_property_context),
    _: User = Depends(require_permission(POS)),
    db: AsyncSession = Depends(get_db),
):
    return await POSService.in_house_qr(db, property_id)
