"""Pydantic request and response schemas for the website module.

Matches the exact validation rules, field names, and casing expected by:
- frontend/src/features/auth/authService.ts
- frontend/src/features/account/accountService.ts
- frontend/src/features/bookings/bookingService.ts
- frontend/hms/src/site/features/qrhub/
"""
import re
from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

# Room rates and metadata matching Fastify domain/bookings.ts
ROOM_DEFINITIONS = {
    "deluxe": {"name": "Deluxe Room", "ratePerNight": 2000, "maxAdults": 2},
    "super-deluxe": {"name": "Super Deluxe Room", "ratePerNight": 2200, "maxAdults": 2},
}
ROOM_IDS = list(ROOM_DEFINITIONS.keys())


# ---- Customer Authentication ----
class SignupRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., pattern=r"^\+91[6-9]\d{9}$")
    password: str = Field(..., min_length=8, max_length=200)
    consent: Literal[True]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=200)
    remember: Optional[bool] = False


class GoogleAuthRequest(BaseModel):
    idToken: str = Field(..., min_length=10, max_length=8192)


class SessionUserInfo(BaseModel):
    id: str
    name: str
    email: str
    role: str


class AuthMeResponse(BaseModel):
    user: SessionUserInfo


class LoginSuccessResponse(BaseModel):
    ok: Literal[True] = True
    user: SessionUserInfo


# ---- Customer Profile & Account ----
class PreferencesSchema(BaseModel):
    bed: Literal["no_preference", "king", "twin", "extra_bed"] = "no_preference"
    dietary: Literal["no_preference", "vegetarian", "vegan", "jain", "other"] = "no_preference"
    notes: str = Field(default="", max_length=500)


class ProfileData(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    country: Optional[str] = None
    addressLine1: Optional[str] = None
    addressLine2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postcode: Optional[str] = None
    preferences: PreferencesSchema
    marketingOptIn: bool = False
    role: str
    createdAt: str
    lastLoginAt: Optional[str] = None


class ProfileResponse(BaseModel):
    profile: ProfileData


class ProfilePatchRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, pattern=r"^\+91[6-9]\d{9}$")
    country: Optional[str] = None
    addressLine1: Optional[str] = None
    addressLine2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postcode: Optional[str] = None
    preferences: Optional[PreferencesSchema] = None
    marketingOptIn: Optional[bool] = None

    @model_validator(mode="after")
    def check_at_least_one(self):
        fields = [
            self.name, self.phone, self.country, self.addressLine1,
            self.addressLine2, self.city, self.state, self.postcode,
            self.preferences, self.marketingOptIn
        ]
        if all(v is None for v in fields):
            raise ValueError("Provide at least one field to update.")
        return self


class PasswordChangeRequest(BaseModel):
    currentPassword: str = Field(..., min_length=1, max_length=200)
    newPassword: str = Field(..., min_length=8, max_length=200)

    @model_validator(mode="after")
    def check_different_password(self):
        if self.currentPassword == self.newPassword:
            raise ValueError("Choose a different password.")
        return self


class DeleteAccountRequest(BaseModel):
    password: str = Field(..., min_length=1, max_length=200)


# ---- Bookings ----
class RoomInfo(BaseModel):
    id: str
    name: str


class CreateBookingRequest(BaseModel):
    requestId: Optional[str] = None
    roomId: str
    checkIn: date
    checkOut: date
    rooms: int = Field(default=1, ge=1, le=5)
    adults: int = Field(..., ge=1)
    children: int = Field(default=0, ge=0, le=10)
    extraBed: bool = False
    specialRequests: Optional[str] = Field(None, max_length=500)

    @model_validator(mode="after")
    def validate_booking(self):
        if self.roomId not in ROOM_DEFINITIONS:
            raise ValueError(f"Invalid roomId. Must be one of: {', '.join(ROOM_IDS)}")
        if self.checkOut <= self.checkIn:
            raise ValueError("Check-out must be at least 1 night after check-in.")
        nights = (self.checkOut - self.checkIn).days
        if nights > 30:
            raise ValueError("Stays are limited to 30 nights.")
        max_adults = ROOM_DEFINITIONS[self.roomId]["maxAdults"]
        if self.adults < self.rooms:
            raise ValueError("Each room needs at least 1 adult.")
        if self.adults > self.rooms * max_adults:
            raise ValueError(f"Each room sleeps up to {max_adults} adults.")
        return self


class BookingData(BaseModel):
    id: str
    reference: str
    status: str
    paymentStatus: str
    room: RoomInfo
    roomCount: int
    checkIn: str
    checkOut: str
    nights: int
    adults: int
    children: int
    extraBed: bool
    specialRequests: Optional[str] = None
    ratePerNight: int
    totalAmount: int
    currency: Literal["INR"] = "INR"
    canCancel: bool
    cancelledAt: Optional[str] = None
    createdAt: str
    updatedAt: str


class BookingCounts(BaseModel):
    all: int
    upcoming: int
    past: int
    cancelled: int


class BookingResponse(BaseModel):
    booking: BookingData


class BookingListResponse(BaseModel):
    items: List[BookingData]
    page: int
    pageSize: int
    total: int
    totalPages: int
    counts: BookingCounts


# ---- QR Hub ----
class QrClickRequest(BaseModel):
    slug: str
    linkId: Optional[str] = None
    placement: Optional[str] = None


class QrVisitRequest(BaseModel):
    slug: str
