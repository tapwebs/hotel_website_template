import { Table2 } from 'lucide-react'
// Keep this file IDENTICAL to backend/src/types/customer.ts.
// No /shared package yet — see implementation plan §6/§1. If you change one,
// change the other, or the two apps will silently drift out of sync.

export interface RestaurantFeatures {
  coupons?: boolean
  discounts?: boolean
  spinWheel?: boolean
  reviews?: boolean
  onlinePayment?: boolean
  specialInstructions?: boolean
  loyalty?: boolean
  aiAssistant?: boolean
  whatsappOrdering?: boolean
  qrOrdering?: boolean
  whatsappReceipts?: boolean
  soundAlerts?: boolean
  autoAcceptOrders?: boolean
  roomService?: boolean
  inventoryDeduction?: boolean
  priorityOrders?: boolean
}

export interface ReceiptSettings {
  headerNote?: string
  footerNote?: string
  paperWidth?: '80mm' | '58mm'
  showGstin?: boolean
  showFssai?: boolean
  showQrCode?: boolean
  showTaxBreakdown?: boolean
  autoPrintOnPayment?: boolean
}

export interface OperatingHours {
  openingTime?: string
  closingTime?: string
  isOpen?: boolean
  busyMode?: boolean
  activeDays?: string[]
  minOrderAmount?: number
  autoAcceptOrders?: boolean
}

export interface PrinterSettings {
  kitchenPrinterIp?: string
  barPrinterIp?: string
  billingPrinterIp?: string
  autoPrintKitchen?: boolean
  autoPrintBilling?: boolean
}

export interface SoundSettings {
  tone: 'chime' | 'bell' | 'buzzer' | 'synth'
  volume: number // 0 - 100
  enabled: boolean
}

export interface SecuritySettings {
  managerPin?: string
  requirePinForVoid?: boolean
  requirePinForDiscount?: boolean
  requirePinForPriceEdit?: boolean
  maxDiscountWithoutPin?: number
}

export interface OrderPolicy {
  allowCancellation: boolean
  cancellationPolicyNotice?: string
}

export type RewardType = 'percent' | 'flat' | 'free_item' | 'free_drink' | 'bogo' | 'loyalty' | 'none'

export interface RewardItem {
  id: string
  label: string
  type: RewardType
  value: number
  probability: number // 0-100 percentage
  color?: string
  textColor?: string
  emoji?: string
  minOrder?: number
  description?: string
}

export interface RewardSettings {
  spinWheelEnabled: boolean
  couponPrefix: string
  defaultExpiryDays: number
  minOrderValue: number
  maxRedemptionsPerUser: number
  rewards: RewardItem[]
}

export interface Restaurant {
  id: string
  name: string
  logo: string
  accent: string
  taxRate: number
  codePrefix: string
  slug?: string
  features?: RestaurantFeatures
  rewardSettings?: RewardSettings
  permissionMatrix?: Record<string, Record<string, boolean>>
  brandFont?: string
  heroImage?: string
  customDomain?: string
  pwaAppName?: string
  pwaThemeColor?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  gstin?: string
  fssaiLicense?: string
  currency?: string
  serviceCharge?: number
  receiptSettings?: ReceiptSettings
  operatingHours?: OperatingHours
  upiId?: string
  upiPayeeName?: string
  printerSettings?: PrinterSettings
  soundSettings?: SoundSettings
  securitySettings?: SecuritySettings
  orderPolicy?: OrderPolicy
}

export interface Category {
  id: string
  name: string
}

export interface MenuItemVariant {
  id: string
  name: string
  price: number
  value?: number
  unit?: string
  isDefault?: boolean
}

export interface MenuItemAddOn {
  id: string
  name: string
  price: number
}

export interface MenuItem {
  id: string
  name: string
  categoryId: string
  price: number
  originalPrice?: number
  kcal?: number
  image: string
  description: string
  ingredients: string[]
  isVeg: boolean
  rating?: number
  tags: ('bestseller' | 'chef' | 'trending')[]
  variants?: MenuItemVariant[]
  addOns?: MenuItemAddOn[]
  pairsWith?: string[]
  isAvailable?: boolean
  prepStation?: string
  dietaryType?: string
}

export interface CartLine {
  itemId: string
  variantId?: string
  addOnIds: string[]
  qty: number
}

export interface Coupon {
  id: string
  code: string
  type: 'percent' | 'flat'
  value: number
  minOrder: number
  maxDiscount?: number
  description: string
  /** Empty/undefined = applies order-wide. Non-empty = discount applies only to lines whose item.categoryId is in this list. */
  categoryIds?: string[]
  isSingleUse?: boolean
  expiresAt?: string
  usedAt?: string
  createdAt?: string
  phone?: string
  orderId?: string
  deviceId?: string
}

export type OrderStatus = 'awaiting_payment' | 'placed' | 'accepted' | 'preparing' | 'ready' | 'served'

export interface Order {
  id: string
  table: string
  lines: CartLine[]
  note?: string
  subtotal: number
  discount: number
  tax: number
  total: number
  payment: 'online' | 'counter'
  status: OrderStatus
  displayNumber: string
  trackingToken: string
  counterToken?: string
  gamePlayed: boolean
  createdAt?: string
  updatedAt?: string
}

export interface Table2 {
  id: string
  restaurantId: string
  label: string
  tokenHash: string
}

export interface Session {
  idHash: string
  restaurantId: string
  tableId: string
  expiresAt: string
  tableLabel?: string
  taxRate?: number
}
