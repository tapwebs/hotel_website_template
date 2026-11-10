from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class TodayMoveStats(BaseModel):
    expected: int
    checkedIn: Optional[int] = Field(0, serialization_alias="checkedIn")
    checkedOut: Optional[int] = Field(0, serialization_alias="checkedOut")
    pending: int

    model_config = ConfigDict(populate_by_name=True)


class RoomStatusSummary(BaseModel):
    clean: int
    dirty: int
    cleaning: int
    inspected: int
    ooo: int
    oos: int


class DashboardKPIsResponse(BaseModel):
    businessDate: str = Field(..., serialization_alias="businessDate")
    totalRooms: int = Field(..., serialization_alias="totalRooms")
    sellableRooms: int = Field(..., serialization_alias="sellableRooms")
    occupiedRooms: int = Field(..., serialization_alias="occupiedRooms")
    occupancyPercentage: float = Field(..., serialization_alias="occupancyPercentage")
    arrivalsToday: Dict[str, int] = Field(..., serialization_alias="arrivalsToday")
    departuresToday: Dict[str, int] = Field(..., serialization_alias="departuresToday")
    inHouseGuests: int = Field(..., serialization_alias="inHouseGuests")
    adrPaise: int = Field(..., serialization_alias="adrPaise")
    revParPaise: int = Field(..., serialization_alias="revParPaise")
    todaysRoomRevenuePaise: int = Field(..., serialization_alias="todaysRoomRevenuePaise")
    todaysFnbRevenuePaise: int = Field(..., serialization_alias="todaysFnbRevenuePaise")
    todaysTotalRevenuePaise: int = Field(..., serialization_alias="todaysTotalRevenuePaise")
    unsettledFolioBalancePaise: int = Field(..., serialization_alias="unsettledFolioBalancePaise")
    overCreditLimitCount: int = Field(0, serialization_alias="overCreditLimitCount")
    roomStatusSummary: RoomStatusSummary = Field(..., serialization_alias="roomStatusSummary")
    pendingHousekeepingTasks: int = Field(..., serialization_alias="pendingHousekeepingTasks")
    criticalMaintenanceAlerts: int = Field(..., serialization_alias="criticalMaintenanceAlerts")
    paymentExceptionsCount: int = Field(0, serialization_alias="paymentExceptionsCount")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class NightAuditStepResponse(BaseModel):
    id: str
    stepNumber: int = Field(..., serialization_alias="stepNumber")
    title: str
    description: str
    status: str  # PENDING, IN_PROGRESS, PASSED, FAILED, WARNING
    details: Optional[str] = None
    actionRequired: Optional[bool] = Field(False, serialization_alias="actionRequired")
    unresolved_items: Optional[List[Dict[str, Any]]] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class NightAuditExecuteRequest(BaseModel):
    business_date: Optional[str] = None
    force_auto_no_show: Optional[bool] = False

    model_config = ConfigDict(populate_by_name=True)


class NightAuditExecuteResponse(BaseModel):
    success: bool
    already_completed: bool = False
    business_date: str
    new_business_date: str
    status: str
    message: str
    room_charges_posted: int = 0
    total_charges_minor: int = 0
    total_tax_minor: int = 0
    flash_report: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(populate_by_name=True)


class NightAuditStatusResponse(BaseModel):
    property_id: str
    business_date: str
    calendar_date: str
    status: str  # READY, IN_PROGRESS, COMPLETED, FAILED, BLOCKED
    can_run: bool
    last_audit_run: Optional[Dict[str, Any]] = None
    pending_arrivals_count: int = 0
    open_pos_orders_count: int = 0
    open_shifts_count: int = 0
    in_house_stays_count: int = 0
    blocking_reasons: List[str] = []
    unresolved_arrivals: List[Dict[str, Any]] = []

    model_config = ConfigDict(populate_by_name=True)


class TaxLiabilityItem(BaseModel):
    sacCode: str = Field(..., serialization_alias="sacCode")
    description: str
    taxablePaise: int = Field(..., serialization_alias="taxablePaise")
    cgstPaise: int = Field(..., serialization_alias="cgstPaise")
    sgstPaise: int = Field(..., serialization_alias="sgstPaise")
    igstPaise: int = Field(0, serialization_alias="igstPaise")
    totalTaxPaise: int = Field(..., serialization_alias="totalTaxPaise")
    ratePercent: float = Field(0.0, serialization_alias="ratePercent")

    model_config = ConfigDict(populate_by_name=True)


class ManagerFlashReportResponse(BaseModel):
    propertyId: str = Field(..., serialization_alias="propertyId")
    propertyName: str = Field(..., serialization_alias="propertyName")
    businessDate: str = Field(..., serialization_alias="businessDate")
    generatedAt: str = Field(..., serialization_alias="generatedAt")
    roomStats: Dict[str, Any] = Field(..., serialization_alias="roomStats")
    revenueSummary: Dict[str, Any] = Field(..., serialization_alias="revenueSummary")
    financialMetrics: Dict[str, Any] = Field(..., serialization_alias="financialMetrics")
    settlements: Dict[str, Any] = Field(..., serialization_alias="settlements")
    taxLiabilityBreakdown: List[TaxLiabilityItem] = Field(..., serialization_alias="taxLiabilityBreakdown")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


# ── F&B Analytics ─────────────────────────────────────────────────────────────

class FnbIntegrationStatus(BaseModel):
    posConnected: bool
    kdsConnected: bool
    lastSyncFormatted: str
    dataStatus: str
    posProviderName: str
    kdsProviderName: str
    model_config = ConfigDict(populate_by_name=True)


class FnbSummaryKPIs(BaseModel):
    revenueTodayMinor: int
    revenueYesterdayMinor: int
    revenueChangePct: float
    ordersToday: int
    ordersYesterday: int
    ordersChangePct: float
    averageOrderValueMinor: int
    roomServiceRevenueMinor: int
    fnbContributionToHotelRevenuePct: float
    model_config = ConfigDict(populate_by_name=True)


class FnbOutletPerformance(BaseModel):
    id: str
    name: str
    type: str
    revenueMinor: int
    ordersCount: int
    averageOrderValueMinor: int
    topCategory: str
    model_config = ConfigDict(populate_by_name=True)


class FnbRevenueTrendPoint(BaseModel):
    periodLabel: str
    revenueMinor: int
    ordersCount: int
    model_config = ConfigDict(populate_by_name=True)


class FnbRevenueBreakdownItem(BaseModel):
    channel: str
    revenueMinor: int
    orderCount: int
    percentageContribution: float
    model_config = ConfigDict(populate_by_name=True)


class FnbTopSellingItem(BaseModel):
    rank: int
    itemName: str
    category: str
    ordersCount: int
    revenueMinor: int
    model_config = ConfigDict(populate_by_name=True)


class FnbOperationalMetrics(BaseModel):
    totalKots: int
    averagePreparationTimeMinutes: float
    completedOrders: int
    cancelledOrders: int
    voidOrders: int
    pendingOrders: int
    roomServiceOrders: int
    model_config = ConfigDict(populate_by_name=True)


class FnbFolioReconciliation(BaseModel):
    fnbGrossRevenueMinor: int
    postedToFolioMinor: int
    directCashierSettledMinor: int
    pendingReconciliationMinor: int
    reconciliationStatus: str
    lastReconciliationAt: str
    model_config = ConfigDict(populate_by_name=True)


class FnbTrends(BaseModel):
    today: List[FnbRevenueTrendPoint]
    sevenDays: List[FnbRevenueTrendPoint]
    thirtyDays: List[FnbRevenueTrendPoint]
    model_config = ConfigDict(populate_by_name=True)


class FnbAnalyticsResponse(BaseModel):
    integration: FnbIntegrationStatus
    summary: FnbSummaryKPIs
    outlets: List[FnbOutletPerformance]
    trends: FnbTrends
    breakdown: List[FnbRevenueBreakdownItem]
    topSellingItems: List[FnbTopSellingItem]
    operationalMetrics: FnbOperationalMetrics
    folioReconciliation: FnbFolioReconciliation
    model_config = ConfigDict(populate_by_name=True)
