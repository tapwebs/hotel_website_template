from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class BookingSearchParams(BaseModel):
    checkIn: str
    checkOut: str
    adults: int = 2
    children: int = 0
    roomsCount: int = 1
    promoCode: Optional[str] = None


class HoldCreateRequest(BaseModel):
    categoryId: str
    ratePlanId: str
    checkIn: str
    checkOut: str
    adults: int = 2
    children: int = 0
    roomsCount: int = 1


class PricingSummary(BaseModel):
    baseAmountPaise: int = Field(..., serialization_alias="baseAmountPaise")
    taxesPaise: int = Field(..., serialization_alias="taxesPaise")
    grandTotalPaise: int = Field(..., serialization_alias="grandTotalPaise")
    depositRequiredPaise: int = Field(..., serialization_alias="depositRequiredPaise")

    model_config = ConfigDict(populate_by_name=True)


class RoomHoldResponse(BaseModel):
    holdId: str = Field(..., serialization_alias="holdId")
    roomCategoryId: str = Field(..., serialization_alias="roomCategoryId")
    ratePlanId: str = Field(..., serialization_alias="ratePlanId")
    checkIn: str = Field(..., serialization_alias="checkIn")
    checkOut: str = Field(..., serialization_alias="checkOut")
    nights: int
    roomsCount: int = Field(..., serialization_alias="roomsCount")
    adults: int
    children: int
    expiresAt: str = Field(..., serialization_alias="expiresAt")
    remainingSeconds: int = Field(600, serialization_alias="remainingSeconds")
    pricingSummary: PricingSummary = Field(..., serialization_alias="pricingSummary")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class BillingAddress(BaseModel):
    street: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    postalCode: Optional[str] = ""
    country: Optional[str] = "India"
    gstin: Optional[str] = None
    companyName: Optional[str] = None


class GuestContactDetails(BaseModel):
    title: Optional[str] = "Mr"
    firstName: str
    lastName: str
    email: str
    phoneCountryCode: str = "+91"
    phoneNumber: str
    specialRequests: Optional[str] = None
    estimatedArrivalTime: Optional[str] = None
    agreeToTerms: bool = True
    subscribeNewsletter: Optional[bool] = False
    billingAddress: Optional[BillingAddress] = None


class ConfirmBookingRequest(BaseModel):
    holdId: str
    guest: GuestContactDetails
    paymentMethod: str = "UPI"


class ConfirmedBookingStay(BaseModel):
    propertyId: str
    propertyName: str
    propertyAddress: str
    propertyPhone: str
    propertyEmail: str
    roomCategoryName: str
    roomImage: Optional[str] = ""
    bedType: str = "1 King Bed"
    ratePlanName: str
    mealPlan: str
    checkIn: str
    checkOut: str
    nights: int
    adults: int
    children: int
    cancellationPolicy: str


class ConfirmedBookingPayment(BaseModel):
    transactionId: str
    method: str
    amountPaidPaise: int
    balanceDueAtCheckInPaise: int
    totalAmountPaise: int
    taxesPaise: int
    currency: str = "INR"
    receiptUrl: Optional[str] = None


class ConfirmedBookingResponse(BaseModel):
    bookingReference: str
    status: str
    createdAt: str
    guest: GuestContactDetails
    stay: ConfirmedBookingStay
    payment: ConfirmedBookingPayment


class ReservationRoomItemResponse(BaseModel):
    id: str
    reservationId: str = Field(..., serialization_alias="reservationId")
    roomTypeId: str = Field(..., serialization_alias="roomTypeId")
    roomTypeName: str = Field(..., serialization_alias="roomTypeName")
    assignedRoomId: Optional[str] = Field(None, serialization_alias="assignedRoomId")
    assignedRoomNumber: Optional[str] = Field(None, serialization_alias="assignedRoomNumber")
    ratePlanId: str = Field(..., serialization_alias="ratePlanId")
    ratePlanName: str = Field(..., serialization_alias="ratePlanName")
    checkIn: str = Field(..., serialization_alias="checkIn")
    checkOut: str = Field(..., serialization_alias="checkOut")
    nights: int
    adults: int
    children: int
    ratePerNightPaise: int = Field(..., serialization_alias="ratePerNightPaise")
    totalGrossPaise: int = Field(..., serialization_alias="totalGrossPaise")
    stayId: Optional[str] = Field(None, serialization_alias="stayId")
    stayStatus: Optional[str] = Field("SCHEDULED", serialization_alias="stayStatus")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class ReservationResponse(BaseModel):
    id: str
    bookingReference: str = Field(..., serialization_alias="bookingReference")
    propertyId: str = Field(..., serialization_alias="propertyId")
    propertyName: str = Field(..., serialization_alias="propertyName")
    guestId: str = Field(..., serialization_alias="guestId")
    guestName: str = Field(..., serialization_alias="guestName")
    guestEmail: Optional[str] = Field("", serialization_alias="guestEmail")
    guestPhone: Optional[str] = Field("", serialization_alias="guestPhone")
    guestVipStatus: Optional[str] = Field("REGULAR", serialization_alias="guestVipStatus")
    source: str
    status: str
    checkIn: str = Field(..., serialization_alias="checkIn")
    checkOut: str = Field(..., serialization_alias="checkOut")
    nights: int
    roomsCount: int = Field(..., serialization_alias="roomsCount")
    rooms: List[ReservationRoomItemResponse] = Field(default_factory=list)
    totalAmountPaise: int = Field(..., serialization_alias="totalAmountPaise")
    paidAmountPaise: int = Field(..., serialization_alias="paidAmountPaise")
    balanceAmountPaise: int = Field(..., serialization_alias="balanceAmountPaise")
    paymentStatus: str = Field(..., serialization_alias="paymentStatus")
    specialRequests: Optional[str] = Field(None, serialization_alias="specialRequests")
    createdAt: str = Field(..., serialization_alias="createdAt")
    updatedAt: str = Field(..., serialization_alias="updatedAt")
    masterFolioId: Optional[str] = Field(None, serialization_alias="masterFolioId")
    externalBookingRef: Optional[str] = Field(None, serialization_alias="externalBookingRef")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class CheckInRequest(BaseModel):
    reservation_id: str
    reservation_room_id: Optional[str] = None
    room_id: str  # assigned physical room


class CheckOutRequest(BaseModel):
    stay_id: Optional[str] = None
    reservation_id: Optional[str] = None
    room_id: Optional[str] = None
    settle_remaining_with_method: Optional[str] = None  # CASH, UPI, CREDIT_CARD


class RoomMoveRequest(BaseModel):
    stay_id: str
    new_room_id: str
    reason: str


class WalkInCheckInRequest(BaseModel):
    guest_name: str
    guest_phone: str
    guest_email: Optional[str] = None
    room_number: str
    nights: int = 1
    deposit_payment_method: Optional[str] = "UPI"
    advance_amount_paise: Optional[int] = 0
