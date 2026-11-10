export type RoomOperationalStatus = 'VACANT' | 'OCCUPIED' | 'OUT_OF_ORDER' | 'OUT_OF_SERVICE';
export type RoomHousekeepingStatus = 'CLEAN' | 'DIRTY' | 'CLEANING' | 'INSPECTED' | 'TOUCH_UP';

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'NO_SHOW' | 'COMPLETED';
export type StayStatus = 'SCHEDULED' | 'CHECKED_IN' | 'CHECKED_OUT';

export type BookingSource = 'DIRECT_WEB' | 'WEBSITE' | 'WALK_IN' | 'PHONE' | 'BOOKING_COM' | 'AGODA' | 'MAKEMYTRIP' | 'AIRBNB' | 'CORPORATE';

export interface PhysicalRoom {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  floor: number;
  wing?: string;
  occupancyStatus: RoomOperationalStatus;
  housekeepingStatus: RoomHousekeepingStatus;
  maintenanceStatus?: 'OPERATIONAL' | 'OUT_OF_ORDER' | 'UNDER_MAINTENANCE';
  currentStayId?: string;
  currentGuestName?: string;
  assignedHousekeeper?: string;
  activeMaintenanceTicketId?: string;
  notes?: string;
  lockStatus?: 'LOCKED' | 'UNLOCKED' | 'DND';
}

export interface ReservationRoomItem {
  id: string;
  reservationId: string;
  roomTypeId: string;
  roomTypeName: string;
  assignedRoomId?: string;
  assignedRoomNumber?: string;
  ratePlanId: string;
  ratePlanName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  ratePerNightPaise: number;
  totalGrossPaise: number;
  stayId?: string;
  stayStatus?: StayStatus;
}

export interface Reservation {
  id: string;
  bookingReference: string; // e.g., "DH-2026-1042"
  propertyId: string;
  propertyName: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestVipStatus?: 'REGULAR' | 'SILVER' | 'GOLD' | 'PLATINUM';
  source: BookingSource;
  status: ReservationStatus;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomsCount: number;
  rooms: ReservationRoomItem[];
  totalAmountPaise: number;
  paidAmountPaise: number;
  balanceAmountPaise: number;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
  masterFolioId: string;
  externalBookingRef?: string;
}

export interface GuestKYCDocument {
  id: string;
  documentType: 'PASSPORT' | 'DRIVING_LICENSE' | 'AADHAAR' | 'NATIONAL_ID' | 'VISA';
  documentNumberMasked: string; // e.g. "XXXX-XXXX-8921"
  issuingCountry: string;
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  presignedUrlExpiresAt?: string;
  presignedViewUrl?: string; // Private S3 temporary link
}

export interface GuestProfile {
  id: string;
  organizationId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  vipTier: 'REGULAR' | 'SILVER' | 'GOLD' | 'PLATINUM';
  totalStays: number;
  totalSpentPaise: number;
  preferences: {
    roomType?: string;
    highFloor?: boolean;
    quietRoom?: boolean;
    dietary?: string;
    specialNotes?: string;
  };
  kycDocuments: GuestKYCDocument[];
  pastReservations: {
    id: string;
    bookingReference: string;
    dates: string;
    roomType: string;
    spentPaise: number;
  }[];
}

export interface HousekeepingTask {
  id: string;
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  floor: number;
  taskType: 'FULL_TURNOVER' | 'STAYOVER_CLEAN' | 'TOUCH_UP' | 'DEEP_CLEAN' | 'INSPECTION';
  status: 'DIRTY' | 'CLEANING' | 'CLEANED' | 'INSPECTED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'VIP';
  assignedToStaffId?: string;
  assignedToStaffName?: string;
  startedAt?: string;
  completedAt?: string;
  inspectedAt?: string;
  inspectedBy?: string;
  offlineQueued?: boolean;
  notes?: string;
}

export interface MaintenanceTicket {
  id: string;
  ticketNumber: string; // e.g. "MNT-2026-089"
  roomId?: string;
  roomNumber?: string;
  locationArea?: string; // e.g. "Main Lobby AC", "Room 304"
  category: 'PLUMBING' | 'ELECTRICAL' | 'HVAC' | 'CARPENTRY' | 'APPLIANCE' | 'STRUCTURAL' | 'OTHER' | string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_PARTS' | 'ON_HOLD' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
  title: string;
  description: string;
  reportedBy: string;
  reportedAt: string;
  assignedTechnician?: string;
  photoUrl?: string;
  blocksRoomFromSale: boolean;
  resolvedAt?: string;
  resolutionNotes?: string;
}

export interface MaintenanceTicketCreatePayload {
  room_id?: string;
  room_number?: string;
  location_area?: string;
  category: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description?: string;
  reported_by?: string;
  assigned_technician?: string;
  blocks_room_from_sale: boolean;
}

export interface MaintenanceTicketUpdatePayload {
  status?: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_PARTS' | 'ON_HOLD' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
  assigned_technician?: string;
  resolution_notes?: string;
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  blocks_room_from_sale?: boolean;
}

export interface POSTable {
  id: string;
  tableNumber: string;
  section: string; // MAIN_DINING, ROOFTOP_TERRACE, POOL_BAR or a section the hotel adds
  capacity: number;
  status: 'AVAILABLE' | 'SEATED' | 'ORDERED' | 'BILLED' | 'CLEANING' | 'MAINTENANCE';
  activeOrderId?: string;
  activeOrderTotalPaise?: number;
  seatedMinutes?: number;
  sectionId?: string | null;
  qrToken?: string | null;
  isActive?: boolean;
}

export interface MenuItem {
  id: string;
  category: string; // STARTERS, MAINS, BREADS, BEVERAGES, DESSERTS, or anything the hotel adds
  name: string;
  description: string;
  pricePaise: number;
  isVeg: boolean;
  isAvailable: boolean;
  station: 'MAIN_KITCHEN' | 'TANDOOR_GRILL' | 'BAR' | 'BAKERY' | 'DESSERT' | 'DRINKS';
  preparationTimeMinutes: number;
  modifiers?: {
    groupName: string;
    options: { name: string; extraPricePaise: number }[];
  }[];
  imageUrl?: string | null;
  tags?: string[];
  kcal?: number | null;
  originalPricePaise?: number | null;
  dietaryType?: 'veg' | 'non-veg' | 'egg' | 'vegan';
  variants?: { id: string; name: string; pricePaise: number; isDefault?: boolean }[];
  addOns?: { id: string; name: string; pricePaise: number }[];
  sortOrder?: number;
  taxPercent?: number | null; // GST rate for this dish; null/absent = the restaurant's default
}

export interface VoidedItem {
  lineId: string; name: string; variantName?: string | null; quantity: number; pricePaise: number;
  reason: string; by: string; at: string; seq: number;
  /** The dish never reached the kitchen on paper, so no cancellation slip is printed. */
  noSlip?: boolean;
}

export interface POSOrder {
  id: string;
  orderNumber: string; // e.g. "KOT-1042"
  orderType: 'DINE_IN' | 'ROOM_SERVICE' | 'TAKEAWAY' | 'COUNTER';
  tableNumber?: string;
  roomNumber?: string;
  stayId?: string;
  guestName?: string;
  items: {
    menuItemId: string;
    name: string;
    quantity: number;
    pricePaise: number;
    notes?: string;
    station: MenuItem['station'];
    variantName?: string | null;
    addOns?: string[];
    prepMinutes?: number | null;
    category?: string | null;
    taxPercent?: number | null; // rate this line was taxed at when ordered
    /** Stable id, used to cancel one dish. */
    lineId?: string;
    /** KOT round the dish was added in (1 = the original order). */
    seq?: number;
    /** Round history when items are added to an existing order line. */
    rounds?: { seq: number; quantity: number }[];
  }[];
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  status: 'AWAITING_PAYMENT' | 'PENDING_ACCEPTANCE' | 'QUEUED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'BILLED' | 'CANCELLED';
  source?: 'STAFF' | 'GUEST_QR' | 'TABLE_QR';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  elapsedMinutes: number;
  isRush?: boolean;
  estimatedPrepMinutes?: number;
  kotPrintedAt?: string | null;
  acceptedAt?: string | null;
  acceptedBy?: string | null;
  voidReason?: string | null;
  /** Included in totalPaise when bill round-off is on. */
  roundOffPaise?: number;
  /** Kitchen board: a later order for a table that already has an open order. */
  additionalKot?: boolean;
  /** KOT rounds: +1 each time dishes are added or cancelled. The kitchen has printed rounds up to kotPrintedSeq. */
  kotSeq?: number;
  kotPrintedSeq?: number;
  voidedItems?: VoidedItem[];
  taxPercent?: number;
  discountPaise?: number;
  couponCode?: string | null;
  paymentMethod?: 'CASH' | 'UPI' | 'CARD' | 'SPLIT' | 'ROOM' | 'ONLINE' | null;
  splitAmounts?: Record<string, number> | null;
  tenderedPaise?: number | null;
  paidAt?: string | null;
  customerPhone?: string | null;
  counterCode?: string | null;
  reviewRating?: number | null;
  reviewComment?: string | null;
}

export interface FolioItem {
  id: string;
  folioId: string;
  transactionType: 'ROOM_CHARGE' | 'FNB_CHARGE' | 'LAUNDRY' | 'MINIBAR' | 'SPA' | 'PAYMENT' | 'REFUND' | 'DISCOUNT' | 'TAX';
  description: string;
  sacCode?: string;
  debitPaise: number; // Charges incurred
  creditPaise: number; // Payments or discounts applied
  netPaise: number;
  taxPaise: number;
  postedAt: string;
  postedBy: string;
  isImmutable: boolean;
  referenceNumber?: string;
}

export interface MasterFolio {
  id: string;
  folioNumber: string; // e.g. "FOL-2026-5510"
  reservationId: string;
  stayId?: string;
  guestId: string;
  guestName: string;
  roomNumber?: string;
  status: 'OPEN' | 'SETTLED' | 'CLOSED' | 'TRANSFERRED';
  creditLimitPaise: number;
  totalChargesPaise: number;
  totalTaxesPaise: number;
  totalPaymentsPaise: number;
  outstandingBalancePaise: number;
  items: FolioItem[];
  splitFolios?: {
    id: string;
    folioCode: string; // "Folio A (Room)", "Folio B (Personal Extras)"
    target: 'GUEST_PERSONAL' | 'COMPANY_CORPORATE';
    balancePaise: number;
  }[];
}

export interface PaymentTransaction {
  id: string;
  transactionRef: string;
  folioId: string;
  guestName: string;
  roomNumber?: string;
  amountPaise: number;
  paymentMethod: 'CASH' | 'UPI' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'CITY_LEDGER';
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  provider: 'RAZORPAY' | 'STRIPE' | 'PINE_LABS_POS' | 'CASH_REGISTER' | 'DEMO' | 'BANK' | string;
  gatewayEventId?: string;
  cardLast4?: string;
  upiId?: string;
  createdAt: string;
  receiptNumber: string;
}

export interface TaxInvoiceItem {
  description: string;
  sacCode: string;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  totalPaise: number;
}

export interface TaxInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  financialYear: string;
  hotelDetails: {
    name: string;
    legalName: string;
    address: string;
    gstin: string;
    pan: string;
    stateCode: string;
    sacCategory: string;
  };
  guestDetails: {
    name: string;
    roomNumber: string;
    stayId: string;
    folioNumber: string;
    reservationId: string;
    gstin?: string;
  };
  items: TaxInvoiceItem[];
  totalTaxablePaise: number;
  totalCgstPaise: number;
  totalSgstPaise: number;
  /** Set when Hotel settings > Folios & invoices > Round off totals is on. */
  roundOffPaise?: number;
  amountPayablePaise?: number;
  totalInvoicePaise: number;
  paymentsAppliedPaise: number;
  balanceDuePaise: number;
}

export interface ProviderStatus {
  activeProvider: 'DEMO' | 'RAZORPAY' | 'BANK' | string;
  isDemo: boolean;
  configurationValid: boolean;
  configurationError?: string;
  supportedProviders: string[];
  razorpay?: { configured: boolean; mode: 'TEST' | 'PRODUCTION' | null; keyIdMasked: string; webhookConfigured: boolean };
  /** Gateway used for guest QR orders: 'razorpay', 'demo' (local only) or null when guests cannot pay online. */
  guestOnlinePayment?: 'razorpay' | 'demo' | null;
}

export interface ReconciliationItem {
  settlementId: string;
  provider: string;
  transactionRef: string;
  folioId?: string;
  hmsAmountPaise?: number;
  settlementAmountPaise: number;
  feePaise: number;
  taxPaise: number;
  netPayoutPaise: number;
  matchStatus: 'MATCHED' | 'AMOUNT_MISMATCH' | 'FEE_DIFFERENCE' | 'MISSING_IN_HMS' | 'MISSING_IN_GATEWAY' | 'PENDING' | string;
  discrepancyNote?: string;
}

export interface ReconciliationReport {
  batchId: string;
  provider: string;
  settlementDate: string;
  totalHmsPaymentsPaise: number;
  totalSettledPaise: number;
  totalFeesPaise: number;
  totalPayoutPaise: number;
  matchedCount: number;
  discrepancyCount: number;
  status: string;
  isDemo: boolean;
  items: ReconciliationItem[];
}

