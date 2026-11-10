// ============================================================================
// HMS SETTINGS CONFIGURATION CONTROL PLANE — TYPE DEFINITIONS
// Source of truth: 15-HMS_SETTINGS_CONFIGURATION_SPECIFICATION.md
// ============================================================================

export type SettingsCategoryId =
  | 'property'
  | 'localization'
  | 'branding'
  | 'stay'
  | 'reservations'
  | 'housekeeping'
  | 'rates-taxes'
  | 'billing'
  | 'payments'
  | 'night-audit'
  | 'distribution'
  | 'communications'
  | 'security'
  | 'integrations'
  | 'organization';

// ----------------------------------------------------------------------------
// 1. PROPERTY & IDENTITY
// ----------------------------------------------------------------------------
export interface PropertyIdentityConfig {
  propertyName: string;
  legalEntityName: string;
  propertyCode: string;
  hotelType: 'HERITAGE_LUXURY' | 'BOUTIQUE' | 'RESORT' | 'BUSINESS' | 'BED_AND_BREAKFAST';
  starClassification: number; // 1 - 5
  propertyStatus: 'ACTIVE' | 'SEASONAL_PAUSE' | 'MAINTENANCE_HOLD' | 'INACTIVE';
}

export interface PropertyContactConfig {
  phone: string;
  email: string;
  whatsappNumber: string;
  website: string;
}

export interface LegalRegistrationConfig {
  gstin: string;
  pan: string;
  registeredAddress: string;
  state: string;
  stateCode: string;
  city: string;
  pinCode: string;
  country: string;
  saraiActRegistration: string;
  fssaiNumber: string;
  fireSafetyLicenseNo: string;
}

export interface LocalizationConfig {
  currency: 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';
  currencySymbol: string;
  timezone: string;
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';
  timeFormat: '12_HOUR' | '24_HOUR';
  firstDayOfWeek: 'MONDAY' | 'SUNDAY';
  defaultLanguage: string;
  secondaryLanguage: string;
}

export interface PropertyBrandingConfig {
  hotelLogoUrl: string;
  faviconUrl: string;
  primaryBrandColor: string;
  secondaryBrandColor: string;
  invoiceLogoUrl: string;
  bookingEngineLogoUrl: string;
  emailHeaderLogoUrl: string;
}

// ----------------------------------------------------------------------------
// 2. HOTEL OPERATIONS
// ----------------------------------------------------------------------------
export interface StandardStayTimesConfig {
  standardCheckIn: string; // e.g., '14:00'
  standardCheckOut: string; // e.g., '11:00'
  earlyCheckInAllowed: boolean;
  earlyCheckInGraceMinutes: number;
  lateCheckOutAllowed: boolean;
  lateCheckOutGraceMinutes: number;
  /** Charged when a guest arrives earlier than the grace period allows, as % of one night's room rate. */
  earlyCheckInFeePercent: number;
  /** Charged when a guest leaves later than the grace period allows, as % of one night's room rate. */
  lateCheckOutFeePercent: number;
}

export interface GuestPoliciesConfig {
  minCheckInAge: number;
  childFreeStayAgeLimit: number;
  idProofRequiredAtCheckIn: boolean;
  /** Form C reporting to FRRO for foreign nationals (Indian Foreigners Act). */
  formCForForeignNationals: boolean;
  extraBedAllowed: boolean;
  extraBedChargeINR: number;
  smokingPolicy: 'NON_SMOKING' | 'DESIGNATED_ROOMS' | 'ALLOWED';
  petsAllowed: boolean;
}

export interface BusinessDateInfo {
  currentBusinessDate: string; // e.g., '2026-09-29'
  lastNightAuditTimestamp: string;
  nextAuditRequiredBy: string;
  isDateRollAutomated: boolean;
}

export interface OverbookingPolicyConfig {
  allowOverbooking: boolean;
  maxOverbookingPercentage: number;
  scope: 'PROPERTY_WIDE' | 'PER_ROOM_TYPE';
  managerApprovalRequired: boolean;
  applicableSources: string[]; // e.g., ['DIRECT_WEBSITE', 'BOOKING_COM']
}

export interface StayPoliciesConfig {
  sameDayBookingAllowed: boolean;
  sameDayCutoffTime: string; // e.g. '22:00'
  walkInBookingAllowed: boolean;
  sameDayCancellationAllowed: boolean;
  roomMoveAfterCheckInAllowed: boolean;
}

// ----------------------------------------------------------------------------
// 3. RESERVATIONS & INVENTORY
// ----------------------------------------------------------------------------
export interface ReservationPoliciesConfig {
  defaultReservationStatus: 'CONFIRMED' | 'HOLD' | 'PROVISIONAL';
  defaultBookingSource: string;
  defaultRatePlan: string;
  cancellationPolicyDefault: 'FREE_48H' | 'FREE_24H' | 'NON_REFUNDABLE' | 'MODERATE';
  noShowPolicyDefault: 'CHARGE_FIRST_NIGHT' | 'CHARGE_FULL_STAY' | 'NO_CHARGE';
  modificationCutoffHours: number;
  reservationHoldDurationMinutes: number;
  autoReleaseExpiredHolds: boolean;
  minLengthOfStayNights: number;
  maxLengthOfStayNights: number;
  maxAdvanceBookingDays: number;
}

export interface InventoryRulesConfig {
  inventoryMode: 'SHARED_POOL' | 'CHANNEL_ALLOCATED' | 'HYBRID';
  availabilityCalculation: 'PHYSICAL_MINUS_OCCUPIED_AND_OOO' | 'INCLUDE_PROVISIONAL';
  allowPartialAvailabilityDisplay: boolean;
  releaseInventoryOnCancellation: boolean;
  releaseInventoryOnNoShow: boolean;
}

export interface BookingSourceItem {
  id: string;
  code: string;
  displayName: string;
  enabled: boolean;
  commissionPercentage: number;
  defaultRatePlan: string;
  cancellationPolicy: string;
}

// ----------------------------------------------------------------------------
// 4. ROOMS & HOUSEKEEPING
// ----------------------------------------------------------------------------
// Note: Spec 15 strictly mandates room-state terminology:
// VACANT_DIRTY | IN_CLEANING | CLEANED | INSPECTED_READY
export type RoomLifecycleState = 'VACANT_DIRTY' | 'IN_CLEANING' | 'CLEANED' | 'INSPECTED_READY';

export interface RoomStatusPolicyConfig {
  inspectionRequiredBeforeSell: boolean;
  allowFrontDeskAssignmentBeforeInspection: boolean;
  supervisorOverrideAllowed: boolean;
  defaultStateAfterCheckout: 'VACANT_DIRTY';
}

export interface RoomOutageConfig {
  oosSellable: boolean; // Out of Service: minor cosmetic, sellable in emergency
  oooSellable: boolean; // Out of Order: physical defect, NEVER sellable
  requireReasonForOOS: boolean;
  requireReasonForOOO: boolean;
}

export interface HousekeepingAutomationConfig {
  autoCreateDepartureTask: boolean;
  autoCreateStayoverTask: boolean;
  autoCreateInspectionTask: boolean;
  requirePhotoOnCompletion: boolean;
  stayoverLinenChangeFrequencyDays: number;
  priorityOrder: ('VIP_ARRIVALS' | 'EXPRESS_CHECKIN' | 'DIRTY_DEPARTURES' | 'STAYOVERS')[];
}

export interface MaintenanceAutomationConfig {
  autoMarkRoomOOSOnCriticalTicket: boolean;
  requireResolutionNote: boolean;
  requireCompletionPhoto: boolean;
  managerApprovalBeforeReturningRoom: boolean;
}

// ----------------------------------------------------------------------------
// 5. RATES, TAXES & BILLING
// ----------------------------------------------------------------------------
export interface RateEngineConfig {
  taxInclusivePricing: boolean;
  baseRateSource: 'BAR_STANDARD' | 'DYNAMIC_TIER' | 'CORPORATE_LINKED';
  allowManualRateOverride: boolean;
  minAllowedRateINR: number;
  maxAllowedRateINR: number;
}

export interface TaxRuleItem {
  id: string;
  taxName: string;
  sacHsn: string;
  serviceCategory: 'ACCOMMODATION' | 'FOOD_AND_BEVERAGE' | 'BANQUET' | 'LAUNDRY' | 'SPA_WELLNESS' | 'TRANSPORT';
  taxType: 'GST_SLAB' | 'FIXED_PERCENT' | 'EXEMPT';
  cgstRate: number; // percentage e.g. 6 or 9
  sgstRate: number; // percentage e.g. 6 or 9
  igstRate: number; // percentage e.g. 12 or 18
  effectiveFrom: string;
  effectiveUntil: string;
  inclusive: boolean;
  active: boolean;
}

export interface FolioConfig {
  defaultFolioType: 'INDIVIDUAL' | 'MASTER_COMPANY' | 'GROUP';
  allowSplitFolio: boolean;
  allowFrontDeskDiscount: boolean;
  maxFrontDeskDiscountPercent: number;
  discountRequiresApprovalAbovePercent: number;
  allowAllowancePosting: boolean;
  negativeBalancePolicy: 'RESTRICT_CHECKOUT' | 'ALLOW_WITH_SUPERVISOR_SIGN_OFF';
}

export interface InvoiceConfig {
  invoicePrefix: string;
  numberFormat: 'YEAR_SEQUENTIAL' | 'MONTH_SEQUENTIAL' | 'GLOBAL_INCREMENT';
  startingSequenceNumber: number;
  creditNotePrefix: string;
  receiptPrefix: string;
  roundOffTotals: boolean;
  footerLegalText: string;
  showGSTIN: boolean;
  showSacHsnBreakdown: boolean;
  showDetailedTaxBreakdown: boolean;
  showGuestAddress: boolean;
}

// ----------------------------------------------------------------------------
// 6. PAYMENTS & NIGHT AUDIT
// ----------------------------------------------------------------------------
export interface PaymentMethodItem {
  id: string;
  code: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'BANK_TRANSFER' | 'PAYMENT_GATEWAY' | 'CORPORATE_BILL_TO_COMPANY' | 'OTHER';
  displayName: string;
  enabled: boolean;
  settlementAccount: string;
  requireReferenceNo: boolean;
  allowRefund: boolean;
}

export interface DepositPolicyConfig {
  requireDepositForGuaranteedBooking: boolean;
  defaultDepositPercentage: number;
  allowManualDepositOverride: boolean;
  overrideRequiresManagerApproval: boolean;
}

export interface RefundPolicyConfig {
  allowRefunds: boolean;
  approvalLevelRequired: 'STAFF' | 'DUTY_MANAGER' | 'GENERAL_MANAGER' | 'FINANCE_HEAD';
  maxFrontDeskRefundINR: number;
  refundReasonMandatory: boolean;
}

export interface NightAuditConfig {
  autoStartAudit: boolean;
  auditCutoffTime: string; // e.g. '03:00'
  mandatoryPaymentReconciliation: boolean;
  mandatoryCashReconciliation: boolean;
  blockAuditOnUnpostedCharges: boolean;
  blockAuditOnOpenFolioDiscrepancies: boolean;
  autoAdvanceBusinessDateUponSuccess: boolean;
  autoPostRoomCharges: boolean;
  autoMarkNoShows: boolean;
}

// ----------------------------------------------------------------------------
// 7. CHANNELS & BOOKING ENGINE
// ----------------------------------------------------------------------------
export interface DirectBookingEngineConfig {
  enabled: boolean;
  allowGuestModification: boolean;
  allowGuestCancellation: boolean;
  holdDurationMinutes: number;
  advancePaymentRequired: boolean;
  instantConfirmation: boolean;
}

export interface ChannelAdapterItem {
  id: string;
  channelCode: 'DIRECT_WEB' | 'BOOKING_COM' | 'MAKEMYTRIP' | 'AGODA' | 'EXPEDIA';
  channelName: string;
  connectionStatus: 'CONNECTED' | 'NOT_CONNECTED' | 'ERROR' | 'PAUSED';
  propertyId: string;
  apiStatus: 'HEALTHY' | 'DEGRADED' | 'DISCONNECTED';
  lastSyncTimestamp: string;
  inventorySyncEnabled: boolean;
  rateSyncEnabled: boolean;
  restrictionSyncEnabled: boolean;
  reservationSyncEnabled: boolean;
  // Masked secret fields
  apiKeyMasked: string;
  apiSecretMasked: string;
  webhookSecretMasked: string;
}

export interface WebsiteApiConfig {
  apiStatus: 'ONLINE' | 'MAINTENANCE' | 'OFFLINE';
  apiVersion: string;
  publicBookingEndpoint: string;
  rateAvailabilityEndpoint: string;
  rateLimitingPerMinute: number;
  apiKeyMasked: string;
  webhookSecretMasked: string;
  allowedOrigins: string[];
}

// ----------------------------------------------------------------------------
// 8. GUEST EXPERIENCE & COMMUNICATIONS
// ----------------------------------------------------------------------------
export interface CommunicationProviderItem {
  providerType: 'EMAIL_SMTP' | 'SMS_GATEWAY' | 'WHATSAPP_BUSINESS';
  providerName: string;
  status: 'CONNECTED' | 'CONFIG_REQUIRED' | 'DISCONNECTED';
  senderIdentifier: string; // e.g. reservations@jaipurpalace.com or WABA ID
  dailyQuotaLimit: number;
  dailySentCount: number;
  credentialTokenMasked: string;
}

export interface EventNotificationTriggerItem {
  eventId: string;
  eventName: string;
  eventDescription: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  defaultTemplateId: string;
}

export interface MessageTemplateItem {
  id: string;
  name: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
  eventType: string;
  subjectTemplate: string;
  bodyContent: string;
  isActive: boolean;
  supportedPlaceholders: string[]; // e.g. '{{guest_name}}', '{{confirmation_code}}'
}

// ----------------------------------------------------------------------------
// 9. SECURITY & ACCESS
// ----------------------------------------------------------------------------
export interface AuthenticationPolicyConfig {
  sessionTimeoutMinutes: number;
  mfaEnforcement: 'ALL_STAFF' | 'MANAGERS_AND_ADMINS' | 'OPTIONAL';
  passwordMinLength: number;
  passwordRequireSpecialChar: boolean;
  passwordRequireNumber: boolean;
  passwordExpiryDays: number;
  loginMaxFailedAttempts: number;
  lockoutDurationMinutes: number;
  allowConcurrentSessions: boolean;
}

export interface DataPrivacyConfig {
  guestDataRetentionMonths: number;
  maskIdDocumentNumbers: boolean;
  requireMarketingConsent: boolean;
}

/** Single source of truth for every "needs a manager" rule that is not tied to one feature's own section. */
export interface ManagerApprovalPoliciesConfig {
  rateOverrideApproval: boolean;
  discountAboveLimitApproval: boolean;
  folioVoidApproval: boolean;
  refundApproval: boolean;
  roomUpgradeApproval: boolean;
  roomOooApproval: boolean;
  cancellationPenaltyWaiverApproval: boolean;
  paymentAdjustmentApproval: boolean;
  permissionChangesApproval: boolean;
}

export interface AuditLoggingConfig {
  recordIpAddress: boolean;
  recordUserId: boolean;
  recordTimestamp: boolean;
  sensitiveActionsTracked: {
    discounts: boolean;
    refunds: boolean;
    rateChanges: boolean;
    reservationCancellations: boolean;
    folioVoids: boolean;
    cashDrawerOpenings: boolean;
    permissionModifications: boolean;
    settingsChanges: boolean;
  };
}

// ----------------------------------------------------------------------------
// 10. INTEGRATIONS & WEBHOOKS
// ----------------------------------------------------------------------------
export interface PaymentGatewayConfig {
  provider: 'RAZORPAY' | 'PINE_LABS';
  mode: 'TEST' | 'PRODUCTION';
  keyIdMasked: string;
  secretKeyMasked: string;
  webhookSecretMasked: string;
  status: 'CONNECTED' | 'NOT_CONFIGURED' | 'ERROR';
  autoCapture: boolean;
}

// EXTERNAL F&B PRODUCT BOUNDARY:
// HMS CONSUMES analytics, operational stats, and nightly reconciliation.
// HMS DOES NOT OWN POS/KDS.
export interface ExternalFnbIntegrationConfig {
  providerName: string;
  connectionStatus: 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED';
  endpointUrl: string;
  analyticsSyncEnabled: boolean;
  operationalStatsSyncEnabled: boolean;
  nightlyFolioReconciliationEnabled: boolean;
  lastReconciliationTimestamp: string;
  webhookSecretMasked: string;
}

export interface WebhookEndpointItem {
  id: string;
  targetUrl: string;
  description: string;
  eventsSubscribed: ('BOOKING_CREATED' | 'PAYMENT_CAPTURED' | 'ROOM_STATUS_CHANGED' | 'FOLIO_CLOSED' | 'NIGHT_AUDIT_COMPLETED')[];
  secretTokenMasked: string;
  signatureVerification: 'HMAC_SHA256';
  idempotencyEnforced: boolean;
  retryPolicyMaxRetries: number;
  status: 'ACTIVE' | 'PAUSED' | 'FAILING';
}

// ----------------------------------------------------------------------------
// 11. ORGANIZATION & MULTI-PROPERTY
// ----------------------------------------------------------------------------
export interface ManagedPropertyItem {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  roomCount: number;
  status: 'ACTIVE' | 'ONBOARDING' | 'INACTIVE';
  isCurrentProperty: boolean;
}

export interface OrganizationDefaultsConfig {
  organizationName: string;
  defaultCurrency: 'INR' | 'USD';
  defaultTimezone: string;
  centralizedNotificationPolicy: boolean;
  centralizedSecurityPolicy: boolean;
  allowPropertySpecificOverrides: boolean;
  sharedCorporateRatePlans: boolean;
  multiPropertyDashboardAccess: boolean;
}

// ----------------------------------------------------------------------------
// AGGREGATE SETTINGS DATA CONTRACT
// ----------------------------------------------------------------------------
export interface HMSSettingsData {
  // Category 1
  propertyIdentity: PropertyIdentityConfig;
  contact: PropertyContactConfig;
  legalRegistration: LegalRegistrationConfig;
  localization: LocalizationConfig;
  branding: PropertyBrandingConfig;

  // Category 2
  stayTimes: StandardStayTimesConfig;
  guestPolicies: GuestPoliciesConfig;
  businessDate: BusinessDateInfo;
  overbooking: OverbookingPolicyConfig;
  stayPolicies: StayPoliciesConfig;

  // Category 3
  reservationPolicies: ReservationPoliciesConfig;
  inventoryRules: InventoryRulesConfig;
  bookingSources: BookingSourceItem[];

  // Category 4
  roomStatusPolicy: RoomStatusPolicyConfig;
  roomOutage: RoomOutageConfig;
  housekeepingAutomation: HousekeepingAutomationConfig;
  maintenanceAutomation: MaintenanceAutomationConfig;

  // Category 5
  rateEngine: RateEngineConfig;
  taxRules: TaxRuleItem[];
  folio: FolioConfig;
  invoice: InvoiceConfig;

  // Category 6
  paymentMethods: PaymentMethodItem[];
  depositPolicy: DepositPolicyConfig;
  refundPolicy: RefundPolicyConfig;
  nightAudit: NightAuditConfig;

  // Category 7
  directBookingEngine: DirectBookingEngineConfig;
  channels: ChannelAdapterItem[];
  websiteApi: WebsiteApiConfig;

  // Category 8
  communicationProviders: CommunicationProviderItem[];
  eventTriggers: EventNotificationTriggerItem[];
  messageTemplates: MessageTemplateItem[];

  // Category 9
  authPolicy: AuthenticationPolicyConfig;
  approvalPolicies: ManagerApprovalPoliciesConfig;
  auditLogging: AuditLoggingConfig;
  dataPrivacy: DataPrivacyConfig;

  // Category 10
  paymentGateways: {
    razorpay: PaymentGatewayConfig;
    pineLabs: PaymentGatewayConfig;
  };
  externalFnb: ExternalFnbIntegrationConfig;
  webhooks: WebhookEndpointItem[];

  // Category 11
  managedProperties: ManagedPropertyItem[];
  organizationDefaults: OrganizationDefaultsConfig;
}
