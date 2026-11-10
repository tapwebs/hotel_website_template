import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, 
  BedDouble, 
  AlertTriangle, 
  CalendarCheck, 
  Receipt, 
  Sparkles, 
  Wrench, 
  Clock,
  Plus,
  DoorOpen
} from 'lucide-react';
import { reportService } from '../../services/apiServices';
import { usePmsUIStore } from '../../stores/pmsUIStore';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { DashboardKPIs } from '../../types/reports';
import { RefreshCw } from 'lucide-react';

import { useAppDate } from '../../hooks/useAppDate';
import { getKolkataCalendarDate } from '../../utils/dateUtils';

/** Empty (all-zero) state shown until the first response arrives. No invented figures. */
const EMPTY_KPIS: DashboardKPIs = {
  businessDate: '',
  totalRooms: 0,
  sellableRooms: 0,
  occupiedRooms: 0,
  occupancyPercentage: 0,
  arrivalsToday: { expected: 0, checkedIn: 0, pending: 0 },
  departuresToday: { expected: 0, checkedOut: 0, pending: 0 },
  inHouseGuests: 0,
  adrPaise: 0,
  revParPaise: 0,
  todaysRoomRevenuePaise: 0,
  todaysFnbRevenuePaise: 0,
  todaysTotalRevenuePaise: 0,
  unsettledFolioBalancePaise: 0,
  overCreditLimitCount: 0,
  roomStatusSummary: { clean: 0, dirty: 0, cleaning: 0, inspected: 0, ooo: 0, oos: 0 },
  pendingHousekeepingTasks: 0,
  criticalMaintenanceAlerts: 0,
  paymentExceptionsCount: 0
};

const pct = (part: number, whole: number) => (whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0);

import { Link } from 'react-router-dom';
import { Globe } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { getStats } from '../../site/features/admin/adminApi';
import { WebsiteProvider } from '../../site/features/admin/AdminShell';
const AdminOverview = React.lazy(() => import('../../site/features/admin/AdminOverview').then((m) => ({ default: m.AdminOverview })));

/** Attention-queue row: website booking requests waiting for a confirmation. Hidden when there are none or the website API is unreachable. */
const WebsiteRequestsAlert: React.FC = () => {
  const { data } = useQuery({
    queryKey: ['website', 'pending-requests'],
    queryFn: async () => {
      const r = await getStats();
      return r.ok ? r.data.bookings.byStatus.pending : 0;
    },
    refetchInterval: 45_000,
    refetchIntervalInBackground: false,
    staleTime: 20_000,
  });
  if (!data) return null;
  return (
    <Link to="/app/reservations?source=website&status=PENDING" className="p-3 bg-gold-soft/40 rounded-xl border border-gold/60 flex items-start gap-3 hover:bg-gold-soft/60 transition-colors">
      <Globe className="w-4 h-4 text-burgundy shrink-0 mt-0.5" />
      <div className="text-xs">
        <span className="font-bold text-walnut block">{data} website booking {data === 1 ? 'request' : 'requests'} to confirm</span>
        <span className="text-muted-foreground text-[11px]">Guests are waiting for an answer. Open them in Reservations.</span>
      </div>
    </Link>
  );
};

export const DashboardPage: React.FC = () => {
  const canWeb = useAuthStore((st) => st.hasPermission('VIEW_RESERVATIONS'));
  const openModal = usePmsUIStore((state) => state.openModal);
  const { businessDate, calendarDate } = useAppDate();
  const propertyName = useAuthStore((st) => st.session?.activePropertyName) ?? '';

  const { data: kpis = EMPTY_KPIS, isFetching, isError, refetch } = useQuery({
    queryKey: ['dashboardKPIs'],
    queryFn: () => reportService.getDashboardKPIs(),
    placeholderData: (prev) => prev ?? EMPTY_KPIS,
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 30,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true
  });

  const activeBusinessDate = kpis.businessDate || businessDate;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-sans font-bold text-slate-900 tracking-tight">
              Front Office Command Center
            </h1>
            {isFetching && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full font-medium animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" /> Syncing...
              </span>
            )}
            {isError && (
              <button 
                onClick={() => refetch()}
                className="inline-flex items-center gap-1 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full font-medium hover:bg-rose-100 transition-colors"
              >
                Offline snapshot • Click to retry
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {propertyName ? `${propertyName} • ` : ''}Live Operational Pulse • Business Date: <span className="font-mono font-semibold text-slate-700">{activeBusinessDate}</span> • Calendar: <span className="font-mono font-semibold text-slate-700">{calendarDate}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="gold"
            size="sm"
            onClick={() => openModal('WALK_IN_CHECKIN')}
            className="text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Walk-In Check-In
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openModal('NEW_RESERVATION')}
            className="text-xs bg-ivory"
          >
            + New Reservation
          </Button>
        </div>
      </div>

      {/* Primary KPI Grid (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Occupancy */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Occupancy</span>
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <BedDouble className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-display text-3xl leading-none font-semibold lining-nums tabular-nums text-burgundy-deep">{kpis.occupancyPercentage}%</span>
              <span className="text-xs text-slate-500">{kpis.occupiedRooms} occupied</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 flex justify-between">
              <span>{kpis.occupiedRooms} / {kpis.sellableRooms} Sellable Rooms</span>
              <span>{kpis.roomStatusSummary.ooo} OOO</span>
            </div>
          </CardContent>
        </Card>

        {/* ADR */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Average Daily Rate (ADR)</span>
              <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <Receipt className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-display text-3xl leading-none font-semibold lining-nums tabular-nums text-burgundy-deep">
                <CurrencyDisplay amountPaise={kpis.adrPaise} showDecimals={false} />
              </span>
              <span className="text-xs text-slate-500">per room sold</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              RevPAR: <strong className="text-slate-700"><CurrencyDisplay amountPaise={kpis.revParPaise} showDecimals={false} /></strong>
            </div>
          </CardContent>
        </Card>

        {/* Today's Revenue */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Gross Day Revenue</span>
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                <CalendarCheck className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-display text-3xl leading-none font-semibold lining-nums tabular-nums text-burgundy-deep">
                <CurrencyDisplay amountPaise={kpis.todaysTotalRevenuePaise} showDecimals={false} />
              </span>
              <span className="text-xs text-slate-500">Rooms + F&B</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 flex justify-between">
              <span>Room: <CurrencyDisplay amountPaise={kpis.todaysRoomRevenuePaise} showDecimals={false} /></span>
              <span>F&B: <CurrencyDisplay amountPaise={kpis.todaysFnbRevenuePaise} showDecimals={false} /></span>
            </div>
          </CardContent>
        </Card>

        {/* In-House Guests */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">In-House Guests</span>
              <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                <Users className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-display text-3xl leading-none font-semibold lining-nums tabular-nums text-burgundy-deep">{kpis.inHouseGuests}</span>
              <Badge variant="purple" size="sm">{kpis.occupiedRooms} {kpis.occupiedRooms === 1 ? 'Room' : 'Rooms'}</Badge>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 flex justify-between">
              <span>Arr: {kpis.arrivalsToday.expected}</span>
              <span>Dep: {kpis.departuresToday.expected}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operational Traffic Matrix (Arrivals vs Departures) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Arrivals & Departures Board (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Arrivals Widget */}
            <Card>
              <CardHeader className="py-3 px-4 bg-emerald-50/50">
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                    <DoorOpen className="w-3.5 h-3.5 text-emerald-600" /> Today's Arrivals
                  </span>
                  <Badge variant="success" size="sm">{kpis.arrivalsToday.expected} Total</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-slate-600">Checked-In So Far</span>
                  <span className="font-bold text-emerald-700">{kpis.arrivalsToday.checkedIn}</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-t border-slate-100">
                  <span className="text-slate-600">Pending Arrivals</span>
                  <span className="font-bold text-amber-700">{kpis.arrivalsToday.pending}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full"
                    style={{ width: `${pct(kpis.arrivalsToday.checkedIn, kpis.arrivalsToday.expected)}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Departures Widget */}
            <Card>
              <CardHeader className="py-3 px-4 bg-amber-50/50">
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" /> Today's Departures
                  </span>
                  <Badge variant="warning" size="sm">{kpis.departuresToday.expected} Total</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-slate-600">Settled & Departed</span>
                  <span className="font-bold text-slate-800">{kpis.departuresToday.checkedOut}</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-t border-slate-100">
                  <span className="text-slate-600">Pending Check-Out</span>
                  <span className="font-bold text-rose-700">{kpis.departuresToday.pending}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
                  <div
                    className="bg-amber-600 h-full rounded-full"
                    style={{ width: `${pct(kpis.departuresToday.checkedOut, kpis.departuresToday.expected)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Room Status Summary Grid */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                Housekeeping & Room State Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200/60">
                  <span className="font-bold text-emerald-800 font-mono text-base block">{kpis.roomStatusSummary.inspected}</span>
                  <span className="text-[10px] text-emerald-700 font-medium">Inspected</span>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200/60">
                  <span className="font-bold text-blue-800 font-mono text-base block">{kpis.roomStatusSummary.clean}</span>
                  <span className="text-[10px] text-blue-700 font-medium">Clean</span>
                </div>
                <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200/60">
                  <span className="font-bold text-purple-800 font-mono text-base block">{kpis.roomStatusSummary.cleaning}</span>
                  <span className="text-[10px] text-purple-700 font-medium">Cleaning</span>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200/60">
                  <span className="font-bold text-amber-800 font-mono text-base block">{kpis.roomStatusSummary.dirty}</span>
                  <span className="text-[10px] text-amber-700 font-medium">Dirty</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-300">
                  <span className="font-bold text-slate-800 font-mono text-base block">{kpis.roomStatusSummary.ooo}</span>
                  <span className="text-[10px] text-slate-600 font-medium">Out of Order</span>
                </div>
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200/60">
                  <span className="font-bold text-rose-800 font-mono text-base block">{kpis.roomStatusSummary.oos}</span>
                  <span className="text-[10px] text-rose-700 font-medium">Out of Svc</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Priority Operational Alerts (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs uppercase tracking-wider text-slate-500 font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> Duty Manager Attention Queue
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <WebsiteRequestsAlert />
              {kpis.criticalMaintenanceAlerts > 0 && (
                <Link to="/app/maintenance" className="p-3 bg-rose-50 rounded-xl border border-rose-200/80 flex items-start gap-3 hover:bg-rose-100/70 transition-colors">
                  <Wrench className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold text-rose-950 block">{kpis.criticalMaintenanceAlerts} critical maintenance {kpis.criticalMaintenanceAlerts === 1 ? 'ticket' : 'tickets'} open</span>
                    <span className="text-rose-800 text-[11px]">Open Maintenance to assign or update them.</span>
                  </div>
                </Link>
              )}
              {kpis.overCreditLimitCount > 0 && (
                <Link to="/app/folio" className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 flex items-start gap-3 hover:bg-amber-100/70 transition-colors">
                  <Receipt className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold text-amber-950 block">{kpis.overCreditLimitCount} {kpis.overCreditLimitCount === 1 ? 'folio is' : 'folios are'} over the credit limit</span>
                    <span className="text-amber-800 text-[11px]">Unsettled balance across open folios: <CurrencyDisplay amountPaise={kpis.unsettledFolioBalancePaise} />.</span>
                  </div>
                </Link>
              )}
              {kpis.pendingHousekeepingTasks > 0 && (
                <Link to="/app/housekeeping" className="p-3 bg-purple-50 rounded-xl border border-purple-200/80 flex items-start gap-3 hover:bg-purple-100/70 transition-colors">
                  <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold text-purple-950 block">{kpis.pendingHousekeepingTasks} housekeeping {kpis.pendingHousekeepingTasks === 1 ? 'task' : 'tasks'} pending</span>
                    <span className="text-purple-800 text-[11px]">Rooms waiting to be cleaned or inspected.</span>
                  </div>
                </Link>
              )}
              {kpis.paymentExceptionsCount > 0 && (
                <Link to="/app/payments" className="p-3 bg-rose-50 rounded-xl border border-rose-200/80 flex items-start gap-3 hover:bg-rose-100/70 transition-colors">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold text-rose-950 block">{kpis.paymentExceptionsCount} failed {kpis.paymentExceptionsCount === 1 ? 'payment' : 'payments'} today</span>
                    <span className="text-rose-800 text-[11px]">Review them in Payments.</span>
                  </div>
                </Link>
              )}
              {kpis.criticalMaintenanceAlerts + kpis.overCreditLimitCount + kpis.pendingHousekeepingTasks + kpis.paymentExceptionsCount === 0 && (
                <p className="text-[11px] text-slate-500">Nothing needs attention right now.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      {canWeb && (
        <WebsiteProvider>
          <React.Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-border/50" />}>
            <AdminOverview embedded />
          </React.Suspense>
        </WebsiteProvider>
      )}
    </div>
  );
};
