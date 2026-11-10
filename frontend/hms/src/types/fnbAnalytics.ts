export interface FnbIntegrationStatus {
  posConnected: boolean;
  kdsConnected: boolean;
  lastSyncFormatted: string;
  dataStatus: 'Synced' | 'Syncing' | 'Offline';
  posProviderName: string;
  kdsProviderName: string;
}

export interface FnbSummaryKPIs {
  revenueTodayMinor: number; // in integer paise, e.g. 18450000 = ₹1,84,500.00
  revenueYesterdayMinor: number;
  revenueChangePct: number;
  ordersToday: number;
  ordersYesterday: number;
  ordersChangePct: number;
  averageOrderValueMinor: number; // e.g. 129930 = ₹1,299.30
  roomServiceRevenueMinor: number; // e.g. 4235000 = ₹42,350.00
  fnbContributionToHotelRevenuePct: number; // e.g. 22.8%
}

export interface FnbOutletPerformance {
  id: string;
  name: string;
  type: 'DINE_IN' | 'BAR' | 'ROOM_SERVICE';
  revenueMinor: number;
  ordersCount: number;
  averageOrderValueMinor: number;
  topCategory: string;
}

export interface FnbRevenueTrendPoint {
  periodLabel: string;
  revenueMinor: number;
  ordersCount: number;
}

export interface FnbRevenueBreakdownItem {
  channel: 'Dine-In' | 'Room Service' | 'Takeaway' | 'Other F&B';
  revenueMinor: number;
  orderCount: number;
  percentageContribution: number;
}

export interface FnbTopSellingItem {
  rank: number;
  itemName: string;
  category: string;
  ordersCount: number;
  revenueMinor: number;
}

export interface FnbOperationalMetrics {
  totalKots: number;
  averagePreparationTimeMinutes: number;
  completedOrders: number;
  cancelledOrders: number;
  voidOrders: number;
  pendingOrders: number;
  roomServiceOrders: number;
}

export interface FnbFolioReconciliation {
  fnbGrossRevenueMinor: number; // e.g. 18450000
  postedToFolioMinor: number; // e.g. 17920000
  directCashierSettledMinor: number; // e.g. direct at restaurant
  pendingReconciliationMinor: number; // e.g. 530000 (₹5,300.00)
  reconciliationStatus: 'Reconciliation Required' | 'In Balance';
  lastReconciliationAt: string;
}

export interface FnbAnalyticsData {
  integration: FnbIntegrationStatus;
  summary: FnbSummaryKPIs;
  outlets: FnbOutletPerformance[];
  trends: {
    today: FnbRevenueTrendPoint[];
    sevenDays: FnbRevenueTrendPoint[];
    thirtyDays: FnbRevenueTrendPoint[];
  };
  breakdown: FnbRevenueBreakdownItem[];
  topSellingItems: FnbTopSellingItem[];
  operationalMetrics: FnbOperationalMetrics;
  folioReconciliation: FnbFolioReconciliation;
}
