import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingState } from '../components/common/LoadingState';

// Auth Components
const LoginPage = lazy(() => import('../pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { useAuthStore } from '../stores/authStore';
import type { Permission } from '../types/auth';

// Staff HMS Layout & Screens
import { StaffLayout } from '../components/staff/StaffLayout';
const DashboardPage = lazy(() => import('../pages/staff/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ReservationsPage = lazy(() => import('../pages/staff/ReservationsPage').then(m => ({ default: m.ReservationsPage })));
const CalendarPage = lazy(() => import('../pages/staff/CalendarPage').then(m => ({ default: m.CalendarPage })));
const FrontDeskPage = lazy(() => import('../pages/staff/FrontDeskPage').then(m => ({ default: m.FrontDeskPage })));
const RoomsPage = lazy(() => import('../pages/staff/RoomsPage').then(m => ({ default: m.RoomsPage })));
const GuestsPage = lazy(() => import('../pages/staff/GuestsPage').then(m => ({ default: m.GuestsPage })));
const HousekeepingPage = lazy(() => import('../pages/staff/HousekeepingPage').then(m => ({ default: m.HousekeepingPage })));
const MaintenancePage = lazy(() => import('../pages/staff/MaintenancePage').then(m => ({ default: m.MaintenancePage })));
const PosPage = lazy(() => import('../pages/staff/fnb/PosPage').then(m => ({ default: m.PosPage })));
const KitchenPage = lazy(() => import('../pages/staff/fnb/KitchenPage').then(m => ({ default: m.KitchenPage })));
const MenuPage = lazy(() => import('../pages/staff/fnb/MenuPage').then(m => ({ default: m.MenuPage })));
const GuestDiningApp = lazy(() => import('../tapmenu/GuestDiningApp'));
const CustomerDisplayPage = lazy(() => import('../pages/staff/fnb/CustomerDisplayPage').then(m => ({ default: m.CustomerDisplayPage })));
import { LegacyRoomRedirect } from '../tapmenu/LegacyRoomRedirect';
const TablesPage = lazy(() => import('../pages/staff/fnb/TablesPage').then(m => ({ default: m.TablesPage })));
const FnbReviewsPage = lazy(() => import('../pages/staff/fnb/FnbReviewsPage').then(m => ({ default: m.FnbReviewsPage })));
const FnbHistoryPage = lazy(() => import('../pages/staff/fnb/FnbHistoryPage').then(m => ({ default: m.FnbHistoryPage })));
const FnbSettingsPage = lazy(() => import('../pages/staff/fnb/FnbSettingsPage').then(m => ({ default: m.FnbSettingsPage })));
const RoomDiningPage = lazy(() => import('../pages/staff/fnb/RoomDiningPage').then(m => ({ default: m.RoomDiningPage })));
const DineInRoomPage = lazy(() => import('../pages/guest/DineInRoomPage').then(m => ({ default: m.DineInRoomPage })));
const FnbAnalyticsPage = lazy(() => import('../pages/staff/FnbAnalyticsPage').then(m => ({ default: m.FnbAnalyticsPage })));
const FolioPage = lazy(() => import('../pages/staff/FolioPage').then(m => ({ default: m.FolioPage })));
const PaymentsPage = lazy(() => import('../pages/staff/PaymentsPage').then(m => ({ default: m.PaymentsPage })));
const NightAuditPage = lazy(() => import('../pages/staff/NightAuditPage').then(m => ({ default: m.NightAuditPage })));
const ReportsPage = lazy(() => import('../pages/staff/ReportsPage').then(m => ({ default: m.ReportsPage })));
const StaffPage = lazy(() => import('../pages/staff/StaffPage').then(m => ({ default: m.StaffPage })));
const SettingsPage = lazy(() => import('../pages/staff/SettingsPage').then(m => ({ default: m.SettingsPage })));
const MorePage = lazy(() => import('../pages/staff/MorePage').then(m => ({ default: m.MorePage })));
// Website admin screens (moved here from the website's /admin). They talk to the website backend through the /api/v1/website gateway.
import { SectionTabs } from '../components/staff/SectionTabs';
import { resolveSiteUrl } from '../site/features/qrhub/lib/qrUrl';

const GuestDiningRedirect: React.FC = () => {
  const loc = useLocation();
  React.useEffect(() => {
    const siteUrl = resolveSiteUrl();
    window.location.replace(`${siteUrl}${loc.pathname}${loc.search}`);
  }, [loc.pathname, loc.search]);
  return <LoadingState message="Connecting to guest dining..." subtext="" />;
};

const LegacyRoomToSiteRedirect: React.FC = () => {
  const loc = useLocation();
  React.useEffect(() => {
    const siteUrl = resolveSiteUrl();
    const token = loc.pathname.replace(/^\/(?:dine|dine-classic)\//, '');
    window.location.replace(`${siteUrl}/dining/r/${encodeURIComponent(token)}`);
  }, [loc.pathname]);
  return <LoadingState message="Connecting to room dining..." subtext="" />;
};
import { WebsiteProvider } from '../site/features/admin/AdminShell';
const WebUsers = lazy(() => import('../site/features/admin/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const WebReports = lazy(() => import('../site/features/admin/AdminReports').then(m => ({ default: m.AdminReports })));
const WebActivity = lazy(() => import('../site/features/admin/AdminActivity').then(m => ({ default: m.AdminActivity })));
const WebSettings = lazy(() => import('../site/features/admin/AdminSettings').then(m => ({ default: m.AdminSettings })));
const QrLibrary = lazy(() => import('../site/features/qrhub/admin/QrLibrary').then(m => ({ default: m.Component })));
const QrHotelPage = lazy(() => import('../site/features/qrhub/admin/Workspace').then(m => ({ default: m.Component })));
const QrAnalytics = lazy(() => import('../site/features/qrhub/admin/Analytics').then(m => ({ default: m.Component })));
/** Website screens share one loaded set of website numbers. */
const web = (el: React.ReactElement) => <WebsiteProvider>{el}</WebsiteProvider>;
/** Old /app/admin/... addresses (and the website's /admin redirect) land on the merged pages. */
const LEGACY: Record<string, string> = {
  '': '/app/dashboard',
  bookings: '/app/reservations?source=website',
  users: '/app/staff/website',
  rooms: '/app/rooms',
  reports: '/app/reports/website',
  activity: '/app/reports/activity',
  settings: '/app/settings/website',
  'qr-hub': '/app/qr/library',
  'qr-hub/qr': '/app/qr/library',
  'qr-hub/hub': '/app/qr/hotel-page',
  'qr-hub/analytics': '/app/qr/analytics',
};
const LegacyAdmin: React.FC = () => {
  const loc = useLocation();
  const key = loc.pathname.replace(/^\/app\/admin\/?/, '').replace(/\/$/, '');
  return <Navigate to={`${LEGACY[key] ?? '/app/dashboard'}${loc.search}`} replace />;
};
/** First screen a role may open: captains, waiters and kitchen staff have no hotel dashboard. */
const homePath = (has: (p: Permission) => boolean) =>
  has('VIEW_DASHBOARD') ? '/app/dashboard' : has('ACCESS_POS') || has('VIEW_KDS') ? '/app/fnb' : has('VIEW_FOLIO') ? '/app/folio' : '/app/dashboard';
const AppHome: React.FC = () => <Navigate to={homePath(useAuthStore((st) => st.hasPermission))} replace />;
/** Lets in anyone holding at least one of the permissions (the restaurant area is shared by POS staff and the kitchen). */
const AnyOf: React.FC<{ perms: Permission[] }> = ({ perms }) => {
  const has = useAuthStore((st) => st.hasPermission);
  return perms.some(has) ? <Outlet /> : <Navigate to={homePath(has)} replace />;
};
/** /app/fnb lands on the first restaurant screen the user may use. */
const FnbHome: React.FC = () => {
  const has = useAuthStore((st) => st.hasPermission);
  return <Navigate to={has('ACCESS_POS') ? 'pos' : has('VIEW_KDS') ? 'kitchen' : '/app/dashboard'} replace />;
};
import { useQuery } from '@tanstack/react-query';
import { fnbService } from '../services/fnbService';

const FNB_TABS = [
  // Service screens first (used all shift), then the manager screens.
  { to: '/app/fnb/pos', label: 'POS', permission: 'ACCESS_POS' as const, group: 'service' },
  { to: '/app/fnb/live-orders', label: 'Live Orders', permission: 'ACCESS_POS' as const, group: 'service' },
  { to: '/app/fnb/kitchen', label: 'Kitchen', permission: 'VIEW_KDS' as const, group: 'service' },
  { to: '/app/fnb/tables', label: 'Tables', permission: 'ACCESS_POS' as const, group: 'service' },
  { to: '/app/fnb/room-dining', label: 'Room dining', permission: 'ACCESS_POS' as const, group: 'service' },
  { to: '/app/fnb/history', label: 'History', group: 'service' },
  { to: '/app/fnb/menu', label: 'Menu', group: 'manage' },
  { to: '/app/fnb/reviews', label: 'Reviews', permission: 'MANAGE_SETTINGS' as const, group: 'manage' },
  { to: '/app/fnb/settings', label: 'Settings', permission: 'MANAGE_SETTINGS' as const, group: 'manage' },
  { to: '/app/fnb/analytics', label: 'Analytics', permission: 'VIEW_FINANCIAL_REPORTS' as const, group: 'manage' },
];

const FnbSection: React.FC = () => {
  const live = useQuery({
    queryKey: ['fnb', 'orders', 'all'],
    queryFn: () => fnbService.orders('all'),
    refetchInterval: (q) => (typeof document !== 'undefined' && document.hidden ? 30_000 : q.state.error ? 10_000 : 5_000),
    refetchIntervalInBackground: false,
  });
  const openCount = (live.data ?? [])
    .filter((o) => !['BILLED', 'CANCELLED'].includes(o.status) && !(o.status === 'DELIVERED' && o.orderType === 'ROOM_SERVICE'))
    .length;

  const tabs = React.useMemo(
    () => FNB_TABS.map((t) => (t.to === '/app/fnb/live-orders' ? { ...t, badge: openCount } : t)),
    [openCount],
  );

  return <SectionTabs tabs={tabs} />;
};
const WEB_RES = { permission: 'VIEW_RESERVATIONS' as const };
const WEB_ADMIN = { permission: 'MANAGE_SETTINGS' as const };
export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Root redirects to HMS operational entry (guarded by ProtectedRoute) */}
      <Route path="/" element={<Navigate to="/app" replace />} />

      {/* In-room and table dining migrated to public website (/dining/*).
          These routes redirect any legacy QR scans seamlessly to the public website. */}
      <Route path="/dine/:token" element={<LegacyRoomToSiteRedirect />} />
      <Route path="/dine-classic/:token" element={<LegacyRoomToSiteRedirect />} />
      <Route path="/dining/*" element={<GuestDiningRedirect />} />
      {/* Customer-facing second screen for the POS: it only shows what the POS in the same browser publishes, so it needs no login */}
      <Route path="/customer-display" element={<Suspense fallback={<LoadingState message="Loading..." subtext="" />}><CustomerDisplayPage /></Suspense>} />
      {/* Staff Authentication */}
      <Route path="/login" element={<LoginPage />} />

      {/* Legacy / Public Guest Booking Routes — redirected to HMS staff entry on port 5174 */}
      <Route path="/book" element={<Navigate to="/app" replace />} />
      <Route path="/search" element={<Navigate to="/app" replace />} />
      <Route path="/hold" element={<Navigate to="/app" replace />} />
      <Route path="/checkout" element={<Navigate to="/app" replace />} />
      <Route path="/payment-pending" element={<Navigate to="/app" replace />} />
      <Route path="/confirmation" element={<Navigate to="/app" replace />} />
      <Route path="/manage-booking" element={<Navigate to="/app" replace />} />

      {/* Surface 2: Staff HMS Operational Routes (Protected by AuthGuard and granular RBAC) */}
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<StaffLayout />}>
          <Route index element={<AppHome />} />

          {/* Dashboard: hotel and website together */}
          <Route element={<ProtectedRoute requiredPermission="VIEW_DASHBOARD" />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="dashboard/website" element={<Navigate to="/app/dashboard" replace />} />
          </Route>
          {/* Bookings: hotel reservations and website requests in one list, plus the calendar */}
          <Route element={<ProtectedRoute requiredPermission="VIEW_RESERVATIONS" />}>
            <Route path="reservations" element={<SectionTabs tabs={[{ to: '/app/reservations', label: 'Bookings', end: true }, { to: '/app/reservations/calendar', label: 'Calendar' }]} />}>
              <Route index element={<ReservationsPage />} />
              <Route path="website" element={<Navigate to="/app/reservations?source=website" replace />} />
              <Route path="calendar" element={<CalendarPage />} />
            </Route>
          </Route>
          <Route element={<ProtectedRoute requiredPermission="VIEW_FRONT_DESK" />}>
            <Route path="front-desk" element={<FrontDeskPage />} />
          </Route>
          {/* Rooms: matrix, room types and website rates on one page */}
          <Route element={<ProtectedRoute requiredPermission="VIEW_DASHBOARD" />}>
            <Route path="rooms" element={<RoomsPage />} />
            <Route path="rooms/rates" element={<Navigate to="/app/rooms" replace />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="VIEW_GUEST_PROFILES" />}>
            <Route path="guests" element={<GuestsPage />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="MANAGE_HOUSEKEEPING" />}>
            <Route path="housekeeping" element={<HousekeepingPage />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="MANAGE_MAINTENANCE" />}>
            <Route path="maintenance" element={<MaintenancePage />} />
          </Route>
          {/* Restaurant & kitchen: POS, kitchen display, menu, in-room dining links and analytics */}
          <Route element={<AnyOf perms={['ACCESS_POS', 'VIEW_KDS']} />}>
            <Route path="fnb" element={<FnbSection />}>
              <Route index element={<FnbHome />} />
              <Route element={<ProtectedRoute requiredPermission="ACCESS_POS" />}>
                <Route path="pos" element={<PosPage />} />
                <Route path="live-orders" element={<PosPage />} />
                <Route path="orders" element={<Navigate to="/app/fnb/live-orders" replace />} />
                <Route path="room-dining" element={<RoomDiningPage />} />
                <Route path="tables" element={<TablesPage />} />
              </Route>
              <Route element={<ProtectedRoute requiredPermission="MANAGE_SETTINGS" />}>
                <Route path="settings" element={<FnbSettingsPage />} />
                <Route path="reviews" element={<FnbReviewsPage />} />
              </Route>
              <Route element={<ProtectedRoute requiredPermission="VIEW_KDS" />}>
                <Route path="kitchen" element={<KitchenPage />} />
              </Route>
              <Route path="history" element={<FnbHistoryPage />} />
              <Route path="menu" element={<MenuPage />} />
              <Route element={<ProtectedRoute requiredPermission="VIEW_FINANCIAL_REPORTS" />}>
                <Route path="analytics" element={<FnbAnalyticsPage />} />
              </Route>
            </Route>
            <Route path="pos" element={<Navigate to="/app/fnb/pos" replace />} />
            <Route path="kds" element={<Navigate to="/app/fnb/kitchen" replace />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="VIEW_FOLIO" />}>
            <Route path="folio" element={<FolioPage />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="PROCESS_PAYMENTS" />}>
            <Route path="payments" element={<PaymentsPage />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="EXECUTE_NIGHT_AUDIT" />}>
            <Route path="night-audit" element={<NightAuditPage />} />
          </Route>
          {/* Reports: hotel, website, activity log */}
          <Route element={<ProtectedRoute requiredPermission="VIEW_FINANCIAL_REPORTS" />}>
            <Route path="reports" element={<SectionTabs tabs={[{ to: '/app/reports', label: 'Hotel', end: true }, { to: '/app/reports/website', label: 'Website', ...WEB_ADMIN }, { to: '/app/reports/activity', label: 'Activity log', ...WEB_ADMIN }]} />}>
              <Route index element={<ReportsPage />} />
              <Route element={<ProtectedRoute requiredPermission="MANAGE_SETTINGS" />}>
                <Route path="website" element={web(<WebReports />)} />
                <Route path="activity" element={web(<WebActivity />)} />
              </Route>
            </Route>
          </Route>
          {/* Staff: HMS staff and the website's user accounts */}
          <Route element={<ProtectedRoute requiredPermission="MANAGE_STAFF" />}>
            <Route path="staff" element={<SectionTabs tabs={[{ to: '/app/staff', label: 'Hotel staff', end: true }, { to: '/app/staff/website', label: 'Website users', ...WEB_ADMIN }]} />}>
              <Route index element={<StaffPage />} />
              <Route element={<ProtectedRoute requiredPermission="MANAGE_SETTINGS" />}>
                <Route path="website" element={web(<WebUsers />)} />
              </Route>
            </Route>
          </Route>
          {/* QR codes */}
          <Route element={<ProtectedRoute requiredPermission="MANAGE_SETTINGS" />}>
            <Route path="qr" element={<SectionTabs tabs={[{ to: '/app/qr/library', label: 'QR library' }, { to: '/app/qr/hotel-page', label: 'Hotel page' }, { to: '/app/qr/analytics', label: 'Analytics' }]} />}>
              <Route index element={<Navigate to="library" replace />} />
              <Route path="library" element={<QrLibrary />} />
              <Route path="hotel-page" element={<QrHotelPage />} />
              <Route path="analytics" element={<QrAnalytics />} />
            </Route>
          </Route>
          {/* Settings: hotel settings, and the website / QR settings */}
          <Route element={<ProtectedRoute requiredPermission="MANAGE_SETTINGS" />}>
            <Route path="settings" element={<SectionTabs tabs={[{ to: '/app/settings', label: 'Hotel settings', end: true }, { to: '/app/settings/website', label: 'Website & QR' }]} />}>
              <Route index element={<SettingsPage />} />
              <Route path="website" element={web(<WebSettings />)} />
            </Route>
          </Route>
          <Route path="more" element={<MorePage />} />
          <Route path="admin/*" element={<LegacyAdmin />} />
          <Route path="admin" element={<LegacyAdmin />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
};
