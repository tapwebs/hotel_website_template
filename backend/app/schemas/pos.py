from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

OrderType = Literal["DINE_IN", "ROOM_SERVICE", "TAKEAWAY", "COUNTER"]
OrderStatus = Literal["AWAITING_PAYMENT", "PENDING_ACCEPTANCE", "QUEUED", "PREPARING", "READY", "DELIVERED", "BILLED", "CANCELLED"]
# One kitchen station. Older station names are still accepted from clients and stored as MAIN_KITCHEN.
Station = Literal["MAIN_KITCHEN", "TANDOOR_GRILL", "BAR", "BAKERY", "DESSERT", "DRINKS"]
Dietary = Literal["veg", "non-veg", "egg", "vegan"]
PaymentMethod = Literal["CASH", "UPI", "CARD", "SPLIT", "ROOM"]  # ONLINE is set only by the guest Razorpay flow


class POSTableResponse(BaseModel):
    id: str
    tableNumber: str = Field(..., serialization_alias="tableNumber")
    section: str
    capacity: int
    status: str
    activeOrderId: Optional[str] = Field(None, serialization_alias="activeOrderId")
    activeOrderTotalPaise: Optional[int] = Field(0, serialization_alias="activeOrderTotalPaise")
    seatedMinutes: Optional[int] = Field(0, serialization_alias="seatedMinutes")
    sectionId: Optional[str] = None
    qrToken: Optional[str] = None
    isActive: bool = True
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class MenuItemResponse(BaseModel):
    id: str
    category: str
    name: str
    description: Optional[str] = ""
    pricePaise: int = Field(..., serialization_alias="pricePaise")
    isVeg: bool = Field(True, serialization_alias="isVeg")
    isAvailable: bool = Field(True, serialization_alias="isAvailable")
    station: str = "MAIN_KITCHEN"
    preparationTimeMinutes: int = Field(15, serialization_alias="preparationTimeMinutes")
    modifiers: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    imageUrl: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    kcal: Optional[int] = None
    originalPricePaise: Optional[int] = None
    dietaryType: str = "veg"
    variants: List[Dict[str, Any]] = Field(default_factory=list)
    addOns: List[Dict[str, Any]] = Field(default_factory=list)
    sortOrder: int = 0
    taxPercent: Optional[int] = None  # GST rate for this dish; None = the restaurant's default
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class VariantIn(BaseModel):
    id: Optional[str] = Field(None, max_length=50)
    name: str = Field(..., min_length=1, max_length=80)
    pricePaise: int = Field(..., ge=0, le=10_000_000)
    isDefault: bool = False


class AddOnIn(BaseModel):
    id: Optional[str] = Field(None, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    pricePaise: int = Field(..., ge=0, le=10_000_000)


class MenuItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    category: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = Field("", max_length=500)
    pricePaise: int = Field(..., ge=0, le=10_000_000)
    isVeg: bool = True
    isAvailable: bool = True
    station: Station = "MAIN_KITCHEN"
    preparationTimeMinutes: int = Field(15, ge=1, le=240)
    imageUrl: Optional[str] = Field(None, max_length=2_000_000)
    tags: List[str] = Field(default_factory=list, max_length=10)
    kcal: Optional[int] = Field(None, ge=0, le=10000)
    originalPricePaise: Optional[int] = Field(None, ge=0, le=10_000_000)
    dietaryType: Optional[Dietary] = None
    variants: List[VariantIn] = Field(default_factory=list, max_length=12)
    addOns: List[AddOnIn] = Field(default_factory=list, max_length=20)
    taxPercent: Optional[int] = Field(None, ge=0, le=28)  # GST rate for this dish; omit to use the restaurant's rate
    @field_validator("imageUrl")
    @classmethod
    def validate_image_url(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        v = v.strip()
        if not v:
            return None
        lower = v.lower()
        if lower.startswith("javascript:") or lower.startswith("data:text/html") or lower.startswith("vbscript:"):
            raise ValueError("Invalid image URL scheme.")
        if not (lower.startswith("http://") or lower.startswith("https://") or lower.startswith("data:image/")):
            raise ValueError("Image URL must begin with http://, https://, or data:image/.")
        return v



class MenuItemUpdate(BaseModel):
    """Every field optional. Only isAvailable (the kitchen's "86" switch) is open to POS staff; the rest needs MANAGE_SETTINGS."""
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    category: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    pricePaise: Optional[int] = Field(None, ge=0, le=10_000_000)
    isVeg: Optional[bool] = None
    isAvailable: Optional[bool] = None
    station: Optional[Station] = None
    preparationTimeMinutes: Optional[int] = Field(None, ge=1, le=240)
    imageUrl: Optional[str] = Field(None, max_length=2_000_000)
    tags: Optional[List[str]] = Field(None, max_length=10)
    kcal: Optional[int] = Field(None, ge=0, le=10000)
    originalPricePaise: Optional[int] = Field(None, ge=0, le=10_000_000)
    dietaryType: Optional[Dietary] = None
    variants: Optional[List[VariantIn]] = Field(None, max_length=12)
    addOns: Optional[List[AddOnIn]] = Field(None, max_length=20)
    sortOrder: Optional[int] = Field(None, ge=0, le=10000)
    taxPercent: Optional[int] = Field(None, ge=0, le=28)
    @field_validator("imageUrl")
    @classmethod
    def validate_image_url(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        v = v.strip()
        if not v:
            return None
        lower = v.lower()
        if lower.startswith("javascript:") or lower.startswith("data:text/html") or lower.startswith("vbscript:"):
            raise ValueError("Invalid image URL scheme.")
        if not (lower.startswith("http://") or lower.startswith("https://") or lower.startswith("data:image/")):
            raise ValueError("Image URL must begin with http://, https://, or data:image/.")
        return v


class OrderItemSchema(BaseModel):
    """A line on a placed order (name, price and station are copied from the menu at order time)."""
    menuItemId: str = Field(..., serialization_alias="menuItemId")
    name: str
    quantity: int
    pricePaise: int = Field(..., serialization_alias="pricePaise")
    notes: Optional[str] = None
    station: str = "MAIN_KITCHEN"
    variantName: Optional[str] = None
    addOns: List[str] = Field(default_factory=list)
    prepMinutes: Optional[int] = None
    category: Optional[str] = None
    taxPercent: Optional[int] = None  # rate this line was taxed at when ordered
    lineId: Optional[str] = None  # stable id, used to cancel one line
    seq: int = 1  # KOT round the line was added in (1 = the original order)
    rounds: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    model_config = ConfigDict(populate_by_name=True)


class OrderLineIn(BaseModel):
    """What a client may send for a line: which item, how many. Prices always come from the menu."""
    menuItemId: str = Field(..., min_length=1, max_length=50)
    quantity: int = Field(..., ge=1, le=20)
    notes: Optional[str] = Field(None, max_length=200)
    variantId: Optional[str] = Field(None, max_length=50)
    addOnIds: List[str] = Field(default_factory=list, max_length=20)


class POSOrderResponse(BaseModel):
    id: str
    orderNumber: str = Field(..., serialization_alias="orderNumber")
    orderType: str = Field(..., serialization_alias="orderType")
    tableNumber: Optional[str] = Field(None, serialization_alias="tableNumber")
    roomNumber: Optional[str] = Field(None, serialization_alias="roomNumber")
    stayId: Optional[str] = Field(None, serialization_alias="stayId")
    guestName: Optional[str] = Field(None, serialization_alias="guestName")
    items: List[OrderItemSchema] = Field(default_factory=list)
    subtotalPaise: int = Field(..., serialization_alias="subtotalPaise")
    taxPaise: int = Field(..., serialization_alias="taxPaise")
    totalPaise: int = Field(..., serialization_alias="totalPaise")
    status: str
    source: str = "STAFF"
    notes: Optional[str] = None
    createdAt: str = Field(..., serialization_alias="createdAt")
    updatedAt: str = Field("", serialization_alias="updatedAt")
    elapsedMinutes: int = Field(0, serialization_alias="elapsedMinutes")
    isRush: bool = False
    estimatedPrepMinutes: int = 15
    kotPrintedAt: Optional[str] = None
    acceptedAt: Optional[str] = None
    acceptedBy: Optional[str] = None
    voidReason: Optional[str] = None
    roundOffPaise: int = 0
    additionalKot: bool = False  # a later order for a table that already has an open order (kitchen board only)
    kotSeq: int = 1
    kotPrintedSeq: int = 0
    voidedItems: List[Dict[str, Any]] = Field(default_factory=list)
    taxPercent: int = 5
    discountPaise: int = 0
    couponCode: Optional[str] = None
    paymentMethod: Optional[str] = None
    splitAmounts: Optional[Dict[str, int]] = None
    tenderedPaise: Optional[int] = None
    paidAt: Optional[str] = None
    customerPhone: Optional[str] = None
    counterCode: Optional[str] = None
    reviewRating: Optional[int] = None
    reviewComment: Optional[str] = None
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class CreatePOSOrderRequest(BaseModel):
    order_type: OrderType = "DINE_IN"
    table_id: Optional[str] = Field(None, max_length=50)
    table_number: Optional[str] = Field(None, max_length=20)
    room_number: Optional[str] = Field(None, max_length=20)
    stay_id: Optional[str] = Field(None, max_length=50)
    guest_name: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=500)
    items: List[OrderLineIn] = Field(..., min_length=1, max_length=40)
    is_rush: bool = False
    customer_phone: Optional[str] = Field(None, max_length=20)


class AddItemsRequest(BaseModel):
    items: List[OrderLineIn] = Field(..., min_length=1, max_length=40)
    notes: Optional[str] = Field(None, max_length=500)


class VoidItemRequest(BaseModel):
    quantity: int = Field(..., ge=1, le=20)
    reason: str = Field(..., min_length=1, max_length=200)


class MoveTableRequest(BaseModel):
    tableId: str = Field(..., min_length=1, max_length=50)
    allOnTable: bool = False  # move every open order on the current table (the party changed tables)


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    reason: Optional[str] = Field(None, max_length=200)


class RoomQrItem(BaseModel):
    """One room's permanent ordering QR, whether or not a guest is staying there."""
    id: str
    roomNumber: str
    floor: int
    roomTypeName: str
    guestName: Optional[str] = None  # the checked-in guest, if any
    occupied: bool = False
    token: str


class InHouseRoomQr(BaseModel):
    """A checked-in stay and the token for its in-room ordering link (/dine/<token>)."""
    roomNumber: str
    guestName: str
    stayId: str
    token: str


# ── Guest (public, token-gated) ──────────────────────────────────────────────
class GuestDiningInfo(BaseModel):
    roomNumber: str
    guestFirstName: str
    propertyName: str
    taxRatePercent: int
    menu: List[MenuItemResponse]


class GuestOrderRequest(BaseModel):
    items: List[OrderLineIn] = Field(..., min_length=1, max_length=20)
    notes: Optional[str] = Field(None, max_length=300)


class GuestOrderView(BaseModel):
    """What a guest sees of their own order: no stay or folio identifiers."""
    orderNumber: str
    status: str
    items: List[OrderItemSchema]
    subtotalPaise: int
    taxPaise: int
    totalPaise: int
    notes: Optional[str] = None
    createdAt: str
    canCancel: bool


# ── TapMenu port: settlement, config, admin ─────────────────────────────────
class SettleRequest(BaseModel):
    method: PaymentMethod
    tenderedPaise: Optional[int] = Field(None, ge=0, le=100_000_000)
    split: Optional[Dict[str, int]] = None  # {"cash": paise, "digital": paise}
    discountPaise: Optional[int] = Field(None, ge=0, le=100_000_000)
    couponCode: Optional[str] = Field(None, max_length=50)
    managerPin: Optional[str] = Field(None, max_length=12)
    roomNumber: Optional[str] = Field(None, max_length=20)
    customerName: Optional[str] = Field(None, max_length=100)
    customerPhone: Optional[str] = Field(None, max_length=20)


class PriorityUpdate(BaseModel):
    isRush: bool


class FnbConfig(BaseModel):
    gstPercent: int = Field(5, ge=0, le=28)
    maxDiscountPercentWithoutPin: int = Field(10, ge=0, le=100)
    hasManagerPin: bool = False
    receiptHeader: str = ""
    receiptFooter: str = "Thank you for dining with us"
    gstin: str = ""
    fssai: str = ""
    upiId: str = ""  # shown as a pay-by-UPI QR on the customer display
    upiPayeeName: str = ""
    paperWidth: Literal["80mm", "58mm"] = "80mm"
    # Receipt layout: which parts print, text size, copies
    receiptAddress: str = ""
    receiptPhone: str = ""
    extraFooter: str = ""
    showAddress: bool = True
    showPhone: bool = True
    showGstin: bool = True
    showFssai: bool = True
    showOrderTime: bool = True
    showPaymentMethod: bool = True
    showCustomerName: bool = True
    showUnitPrice: bool = True
    showTaxBreakup: bool = True
    showQr: bool = False
    reviewUrl: str = ""
    qrCaption: str = "Scan to rate us"
    fontSize: Literal["small", "normal", "large"] = "normal"
    copies: int = Field(1, ge=1, le=5)
    autoPrint: bool = False
    soundTone: Literal["chime", "bell", "buzzer", "synth", "phone", "siren"] = "phone"
    soundVolume: int = Field(90, ge=0, le=100)
    keepRinging: bool = True  # keep ringing continuously until staff accepts or dismisses
    soundEffectsEnabled: bool = True
    roundOffTotal: bool = False  # round restaurant bills to the nearest rupee (room-service and charge-to-room are billed on the folio)
    # Guest orders from /menu wait for a captain (or waiter) to accept them before the kitchen sees them.
    guestOrderAcceptance: bool = True
    ringWaitersForGuestOrders: bool = True  # waiters devices ring at once along with captains
    acceptanceEscalationMinutes: int = Field(2, ge=1, le=30)  # then admins and super admins ring too
    alertRepeatSeconds: int = Field(3, ge=1, le=60)
    autoPrintKot: bool = True  # the kitchen printer device prints each KOT once, as soon as the order reaches the kitchen
    kotCopies: int = Field(1, ge=1, le=3)
    kotShowPrices: bool = False
    tableOrdering: bool = True
    roomOrdering: bool = True  # guests may order from the QR placed in their room (charged to the room bill)
    roomOrderingVacant: bool = False  # the room QR also works when nobody is checked in (pay at the counter)
    spinWheelEnabled: bool = True
    reviewsEnabled: bool = True
    onlinePayment: bool = True  # guests at a table may pay online (Razorpay) before the kitchen starts
    rewards: List[Dict[str, Any]] = Field(default_factory=list)


class FnbConfigUpdate(BaseModel):
    gstPercent: Optional[int] = Field(None, ge=0, le=28)
    maxDiscountPercentWithoutPin: Optional[int] = Field(None, ge=0, le=100)
    managerPin: Optional[str] = Field(None, min_length=4, max_length=12, pattern=r"^\d+$")
    receiptHeader: Optional[str] = Field(None, max_length=200)
    receiptFooter: Optional[str] = Field(None, max_length=200)
    gstin: Optional[str] = Field(None, max_length=20)
    fssai: Optional[str] = Field(None, max_length=20)
    upiId: Optional[str] = Field(None, max_length=80, pattern=r"^$|^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9.-]{1,40}$")
    upiPayeeName: Optional[str] = Field(None, max_length=60)
    paperWidth: Optional[Literal["80mm", "58mm"]] = None
    receiptAddress: Optional[str] = Field(None, max_length=200)
    receiptPhone: Optional[str] = Field(None, max_length=30)
    extraFooter: Optional[str] = Field(None, max_length=200)
    showAddress: Optional[bool] = None
    showPhone: Optional[bool] = None
    showGstin: Optional[bool] = None
    showFssai: Optional[bool] = None
    showOrderTime: Optional[bool] = None
    showPaymentMethod: Optional[bool] = None
    showCustomerName: Optional[bool] = None
    showUnitPrice: Optional[bool] = None
    showTaxBreakup: Optional[bool] = None
    showQr: Optional[bool] = None
    reviewUrl: Optional[str] = Field(None, max_length=300, pattern=r"^$|^https?://\S+$")
    qrCaption: Optional[str] = Field(None, max_length=80)
    fontSize: Optional[Literal["small", "normal", "large"]] = None
    copies: Optional[int] = Field(None, ge=1, le=5)
    autoPrint: Optional[bool] = None
    soundTone: Optional[Literal["chime", "bell", "buzzer", "synth", "phone", "siren"]] = None
    soundVolume: Optional[int] = Field(None, ge=0, le=100)
    keepRinging: Optional[bool] = None
    soundEffectsEnabled: Optional[bool] = None
    roundOffTotal: Optional[bool] = None
    guestOrderAcceptance: Optional[bool] = None
    ringWaitersForGuestOrders: Optional[bool] = None
    acceptanceEscalationMinutes: Optional[int] = Field(None, ge=1, le=30)
    alertRepeatSeconds: Optional[int] = Field(None, ge=1, le=60)
    autoPrintKot: Optional[bool] = None
    kotCopies: Optional[int] = Field(None, ge=1, le=3)
    kotShowPrices: Optional[bool] = None
    tableOrdering: Optional[bool] = None
    roomOrdering: Optional[bool] = None
    roomOrderingVacant: Optional[bool] = None
    spinWheelEnabled: Optional[bool] = None
    reviewsEnabled: Optional[bool] = None
    onlinePayment: Optional[bool] = None
    rewards: Optional[List[Dict[str, Any]]] = None


class CategoryIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)


class ReorderIn(BaseModel):
    ids: List[str] = Field(..., max_length=500)


class CategoryOut(BaseModel):
    id: str
    name: str
    sortOrder: int
    itemCount: int = 0


class SectionIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)


class SectionOut(BaseModel):
    id: str
    name: str
    sortOrder: int


class TableIn(BaseModel):
    tableNumber: str = Field(..., min_length=1, max_length=20)
    capacity: int = Field(4, ge=1, le=40)
    sectionId: Optional[str] = Field(None, max_length=50)


class TableUpdate(BaseModel):
    tableNumber: Optional[str] = Field(None, min_length=1, max_length=20)
    capacity: Optional[int] = Field(None, ge=1, le=40)
    sectionId: Optional[str] = Field(None, max_length=50)


class TableStatusIn(BaseModel):
    status: Literal["AVAILABLE", "SEATED", "CLEANING", "MAINTENANCE"]


class CouponIn(BaseModel):
    code: str = Field(..., min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")
    kind: Literal["PERCENT", "FLAT"] = "PERCENT"
    value: int = Field(..., ge=1, le=10_000_000)
    minOrderPaise: int = Field(0, ge=0)
    maxDiscountPaise: Optional[int] = Field(None, ge=0)
    description: str = Field("", max_length=200)
    categories: List[str] = Field(default_factory=list)
    singleUse: bool = False
    expiresAt: Optional[str] = None
    isActive: bool = True


class CouponOut(BaseModel):
    id: str
    code: str
    kind: str
    value: int
    minOrderPaise: int
    maxDiscountPaise: Optional[int] = None
    description: str
    categories: List[str]
    singleUse: bool
    usedAt: Optional[str] = None
    expiresAt: Optional[str] = None
    isActive: bool
    source: str


class ShiftOut(BaseModel):
    id: str
    status: str
    openedAt: str
    closedAt: Optional[str] = None
    openingFloatPaise: int
    cashSalesPaise: int
    expectedCashPaise: int
    closingCashPaise: Optional[int] = None
    variancePaise: Optional[int] = None


class ShiftOpenIn(BaseModel):
    openingFloatPaise: int = Field(..., ge=0, le=100_000_000)


class ShiftCloseIn(BaseModel):
    closingCashPaise: int = Field(..., ge=0, le=100_000_000)


class CounterCodeIn(BaseModel):
    code: str = Field(..., pattern=r"^\d{6}$")


class ReservationIn(BaseModel):
    guestName: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    partySize: int = Field(2, ge=1, le=40)
    reservedFor: str  # ISO datetime
    durationMinutes: int = Field(90, ge=15, le=480)
    tableId: Optional[str] = Field(None, max_length=50)
    roomNumber: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = Field(None, max_length=300)


class ReservationUpdate(BaseModel):
    status: Optional[Literal["BOOKED", "SEATED", "CANCELLED", "NO_SHOW", "COMPLETED"]] = None
    tableId: Optional[str] = Field(None, max_length=50)
    reservedFor: Optional[str] = None
    partySize: Optional[int] = Field(None, ge=1, le=40)
    notes: Optional[str] = Field(None, max_length=300)


class ReservationOut(BaseModel):
    id: str
    guestName: str
    phone: Optional[str] = None
    partySize: int
    reservedFor: str
    durationMinutes: int
    tableId: Optional[str] = None
    tableNumber: Optional[str] = None
    roomNumber: Optional[str] = None
    notes: Optional[str] = None
    status: str
