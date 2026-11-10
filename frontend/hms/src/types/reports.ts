export interface DashboardKPIs {
  businessDate: string;
  totalRooms: number;
  sellableRooms: number;
  occupiedRooms: number;
  occupancyPercentage: number;
  arrivalsToday: {
    expected: number;
    checkedIn: number;
    pending: number;
  };
  departuresToday: {
    expected: number;
    checkedOut: number;
    pending: number;
  };
  inHouseGuests: number;
  adrPaise: number; // Average Daily Rate
  revParPaise: number; // Revenue Per Available Room
  todaysRoomRevenuePaise: number;
  todaysFnbRevenuePaise: number;
  todaysTotalRevenuePaise: number;
  unsettledFolioBalancePaise: number;
  overCreditLimitCount: number;
  roomStatusSummary: {
    clean: number;
    dirty: number;
    cleaning: number;
    inspected: number;
    ooo: number;
    oos: number;
  };
  pendingHousekeepingTasks: number;
  criticalMaintenanceAlerts: number;
  paymentExceptionsCount: number;
}

export interface UnresolvedArrivalItem {
  reservation_id: string;
  booking_reference: string;
  external_booking_ref?: string;
  guest_name: string;
  status: string;
  total_rooms: number;
  checked_in_rooms: number;
  pending_rooms: number;
  checkin_date: string;
  checkout_date: string;
}

export interface NightAuditChecklistStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'WARNING';
  details?: string;
  actionRequired?: boolean;
  unresolved_items?: UnresolvedArrivalItem[];
}

export interface NightAuditStatus {
  property_id: string;
  business_date: string;
  calendar_date: string;
  status: 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
  can_run: boolean;
  last_audit_run?: {
    business_date: string;
    new_business_date?: string;
    completed_at?: string;
    room_charges_posted?: number;
    total_charges_minor?: number;
    total_tax_minor?: number;
  };
  pending_arrivals_count: number;
  open_pos_orders_count: number;
  open_shifts_count?: number;
  in_house_stays_count: number;
  blocking_reasons: string[];
  unresolved_arrivals?: UnresolvedArrivalItem[];
}

export interface NightAuditRolloverResult {
  success: boolean;
  already_completed?: boolean;
  business_date: string;
  new_business_date: string;
  status: string;
  message: string;
  room_charges_posted?: number;
  total_charges_minor?: number;
  total_tax_minor?: number;
  flash_report?: any;
}

export interface ManagerFlashReport {
  propertyId: string;
  propertyName: string;
  businessDate: string;
  generatedAt: string;
  roomStats: {
    totalRooms: number;
    oooRooms: number;
    oosRooms?: number;
    sellableRooms: number;
    roomsSold: number;
    occupancyPct: number;
    compRooms: number;
  };
  revenueSummary: {
    roomRevenuePaise: number;
    fnbRevenuePaise: number;
    laundryRevenuePaise: number;
    spaRevenuePaise: number;
    otherRevenuePaise: number;
    taxesCollectedPaise: number;
    grossRevenuePaise: number;
  };
  financialMetrics: {
    adrPaise: number;
    revParPaise: number;
    averageCheckPaise: number;
  };
  settlements: {
    cashPaise: number;
    upiPaise: number;
    cardPaise: number;
    bankTransferPaise?: number;
    cityLedgerPaise: number;
    totalCollectedPaise: number;
  };
  taxLiabilityBreakdown: {
    sacCode: string;
    description: string;
    taxablePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    totalTaxPaise: number;
    ratePercent?: number;
  }[];
}

export interface NightAuditHistoryItem {
  business_date: string;
  new_business_date?: string | null;
  status: string;
  performed_by: string;
  completed_at?: string | null;
  room_charges_posted: number;
  total_charges_minor: number;
  total_tax_minor: number;
  rooms_sold?: number | null;
  occupancy_pct?: number | null;
  gross_revenue_minor?: number | null;
  has_report: boolean;
  error_message?: string | null;
}
