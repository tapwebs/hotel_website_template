export interface BookingSearchParams {
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  adults: number;
  children: number;
  roomsCount: number;
  promoCode?: string;
}

export interface RoomAmenity {
  id: string;
  name: string;
  icon: string;
}

export interface RatePlan {
  id: string;
  code: string; // e.g. "EP", "CP", "MAP"
  name: string;
  description: string;
  inclusions: string[];
  basePricePerNightPaise: number; // in integer paise (₹4500.00 = 450000)
  totalNetPaise: number;
  taxPaise: number;
  totalGrossPaise: number;
  cancellationPolicy: {
    type: 'FREE_CANCELLATION' | 'NON_REFUNDABLE' | 'MODERATE';
    freeCancellationHoursBefore: number;
    description: string;
  };
  mealPlan: 'ROOM_ONLY' | 'BREAKFAST_INCLUDED' | 'HALF_BOARD' | 'ALL_INCLUSIVE';
}

export interface RoomCategory {
  id: string;
  code: string;
  name: string;
  description: string;
  tagline: string;
  maxAdults: number;
  maxChildren: number;
  maxTotalOccupancy: number;
  bedType: string;
  roomSizeSqFt: number;
  viewType: string;
  heroImage: string;
  galleryImages: string[];
  amenities: RoomAmenity[];
  availableUnits: number;
  startingPricePerNightPaise: number;
  ratePlans: RatePlan[];
  featured?: boolean;
}

export interface RoomHold {
  holdId: string;
  roomCategoryId: string;
  ratePlanId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomsCount: number;
  adults: number;
  children: number;
  expiresAt: string; // ISO string
  remainingSeconds: number;
  pricingSummary: {
    baseAmountPaise: number;
    taxesPaise: number;
    grandTotalPaise: number;
    depositRequiredPaise: number;
  };
}

export interface GuestContactDetails {
  title: 'Mr' | 'Ms' | 'Mrs' | 'Dr' | 'Prof';
  firstName: string;
  lastName: string;
  email: string;
  phoneCountryCode: string;
  phoneNumber: string;
  specialRequests?: string;
  estimatedArrivalTime?: string;
  agreeToTerms: boolean;
  subscribeNewsletter?: boolean;
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    gstin?: string;
    companyName?: string;
  };
}

export interface ConfirmedBooking {
  bookingReference: string; // e.g. "DH-2026-8821"
  status: 'CONFIRMED' | 'PENDING_VERIFICATION' | 'CANCELLED';
  createdAt: string;
  guest: GuestContactDetails;
  stay: {
    propertyId: string;
    propertyName: string;
    propertyAddress: string;
    propertyPhone: string;
    propertyEmail: string;
    roomCategoryName: string;
    roomImage: string;
    bedType: string;
    ratePlanName: string;
    mealPlan: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    adults: number;
    children: number;
    cancellationPolicy: string;
  };
  payment: {
    transactionId: string;
    method: 'UPI' | 'CREDIT_CARD' | 'NET_BANKING' | 'PAY_AT_HOTEL';
    amountPaidPaise: number;
    balanceDueAtCheckInPaise: number;
    totalAmountPaise: number;
    taxesPaise: number;
    currency: string;
    receiptUrl?: string;
  };
}
