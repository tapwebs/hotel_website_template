import type { MenuItem, POSOrder } from './pms';

export type OrderStatus = POSOrder['status'];
export type OrderType = POSOrder['orderType'];
export type Station = MenuItem['station'];
export type PaymentMethod = Exclude<NonNullable<POSOrder['paymentMethod']>, 'ONLINE'>;

/** A room's permanent ordering QR (the guest staying there, if any, is charged). */
export interface RoomQrCode { id: string; roomNumber: string; floor: number; roomTypeName: string; guestName: string | null; occupied: boolean; token: string }

export interface RoomQr { roomNumber: string; guestName: string; stayId: string; token: string }

export interface MenuItemInput {
  name: string;
  category: string;
  description: string;
  pricePaise: number;
  isVeg: boolean;
  isAvailable: boolean;
  station: Station;
  preparationTimeMinutes: number;
  imageUrl?: string | null;
  tags?: string[];
  kcal?: number | null;
  originalPricePaise?: number | null;
  dietaryType?: MenuItem['dietaryType'];
  variants?: { id?: string; name: string; pricePaise: number; isDefault?: boolean }[];
  addOns?: { id?: string; name: string; pricePaise: number }[];
  taxPercent?: number | null;
}

export interface OrderLine { menuItemId: string; quantity: number; notes?: string; variantId?: string; addOnIds?: string[] }

export interface NewOrder {
  order_type: OrderType;
  table_id?: string;
  room_number?: string;
  guest_name?: string;
  customer_phone?: string;
  notes?: string;
  is_rush?: boolean;
  items: OrderLine[];
}

export interface SettleInput {
  method: PaymentMethod;
  tenderedPaise?: number;
  split?: { cash: number; digital: number };
  discountPaise?: number;
  couponCode?: string;
  managerPin?: string;
  roomNumber?: string;
  customerName?: string;
  customerPhone?: string;
}

export interface FnbConfig {
  gstPercent: number;
  maxDiscountPercentWithoutPin: number;
  hasManagerPin: boolean;
  receiptHeader: string;
  receiptFooter: string;
  gstin: string;
  fssai: string;
  upiId: string;
  upiPayeeName: string;
  paperWidth: '80mm' | '58mm';
  // Receipt layout: which parts print, text size, copies
  receiptAddress: string;
  receiptPhone: string;
  extraFooter: string;
  showAddress: boolean;
  showPhone: boolean;
  showGstin: boolean;
  showFssai: boolean;
  showOrderTime: boolean;
  showPaymentMethod: boolean;
  showCustomerName: boolean;
  showUnitPrice: boolean;
  showTaxBreakup: boolean;
  showQr: boolean;
  reviewUrl: string;
  qrCaption: string;
  fontSize: 'small' | 'normal' | 'large';
  copies: number;
  autoPrint: boolean;
  soundTone: 'chime' | 'bell' | 'buzzer' | 'synth' | 'phone' | 'siren';
  soundVolume: number;
  /** Keep ringing continuously until someone accepts or silences the alert. */
  keepRinging: boolean;
  /** Enable sound effects for printing, order complete, order accept, etc. */
  soundEffectsEnabled: boolean;
  /** Round restaurant bills to the nearest rupee (charge-to-room and room service are rounded on the room invoice). */
  roundOffTotal: boolean;
  /** Guest orders from /menu wait for a captain, waiter or admin to accept them. */
  guestOrderAcceptance: boolean;
  /** Off: only captains ring first. Waiters can always accept. */
  ringWaitersForGuestOrders: boolean;
  /** After this many minutes unaccepted, admin and super admin devices ring too. */
  acceptanceEscalationMinutes: number;
  alertRepeatSeconds: number;
  /** The kitchen printer device prints each KOT once, as soon as the order reaches the kitchen. */
  autoPrintKot: boolean;
  kotCopies: number;
  kotShowPrices: boolean;
  tableOrdering: boolean;
  /** Guests may order from the QR placed in their room (charged to the room bill). */
  roomOrdering: boolean;
  /** The room QR also works when nobody is checked in; those orders are paid at the counter. */
  roomOrderingVacant: boolean;
  spinWheelEnabled: boolean;
  reviewsEnabled: boolean;
  onlinePayment: boolean;
  rewards: { id: string; label: string; type: string; value: number; probability: number; color?: string; emoji?: string }[];
}
export type FnbConfigUpdate = Partial<Omit<FnbConfig, 'hasManagerPin'>> & { managerPin?: string };

export interface Category { id: string; name: string; sortOrder: number; itemCount: number }
export interface Section { id: string; name: string; sortOrder: number }

export interface Coupon {
  id: string; code: string; kind: 'PERCENT' | 'FLAT'; value: number; minOrderPaise: number; maxDiscountPaise?: number | null;
  description: string; categories: string[]; singleUse: boolean; usedAt?: string | null; expiresAt?: string | null; isActive: boolean; source: string;
}
export type CouponInput = Omit<Coupon, 'id' | 'usedAt' | 'source'>;

export interface Shift {
  id: string; status: 'OPEN' | 'CLOSED'; openedAt: string; closedAt?: string | null; openingFloatPaise: number; cashSalesPaise: number;
  expectedCashPaise: number; closingCashPaise?: number | null; variancePaise?: number | null;
}

export interface TableReservation {
  id: string; guestName: string; phone?: string | null; partySize: number; reservedFor: string; durationMinutes: number;
  tableId?: string | null; tableNumber?: string | null; roomNumber?: string | null; notes?: string | null;
  status: 'BOOKED' | 'SEATED' | 'CANCELLED' | 'NO_SHOW' | 'COMPLETED';
}

// Guest in-room dining (classic page)
export interface DiningInfo { roomNumber: string; guestFirstName: string; propertyName: string; taxRatePercent: number; menu: MenuItem[] }
export interface GuestOrder {
  orderNumber: string;
  status: OrderStatus;
  items: POSOrder['items'];
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  notes?: string | null;
  createdAt: string;
  canCancel: boolean;
}

export interface FnbReview {
  orderId: string; orderNumber: string; orderType: string; status: string; location: string | null;
  guestName: string | null; phone: string | null; rating: number; comment: string | null;
  totalMinor: number; orderedAt: string; reviewedAt: string; spinPrize: string | null;
}
export interface FnbReviewsData {
  summary: { count: number; average: number; distribution: Record<'1' | '2' | '3' | '4' | '5', number> };
  items: FnbReview[];
}
