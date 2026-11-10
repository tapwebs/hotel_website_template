import React from 'react';
import { GuestOrderAlerts } from './GuestOrderAlerts';
import { Outlet } from 'react-router-dom';
import { StaffSidebar } from './StaffSidebar';
import { StaffTopNavbar } from './StaffTopNavbar';
import { MobileTabBar } from './MobileTabBar';
const CommandPaletteModal = React.lazy(() => import('./CommandPaletteModal').then(m => ({ default: m.CommandPaletteModal })));
const QuickActionModal = React.lazy(() => import('./QuickActionModal').then(m => ({ default: m.QuickActionModal })));
import { usePmsUIStore } from '../../stores/pmsUIStore';
export const StaffLayout: React.FC = () => {
  const sidebarOpen = usePmsUIStore((state) => state.sidebarOpen);
  return (
    <div className="min-h-screen text-walnut flex">
      {/* Sidebar */}
      <StaffSidebar />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          sidebarOpen ? 'md:pl-64' : 'md:pl-[4.5rem]'
        }`}
      >
        <StaffTopNavbar />

        <main className="flex-1 p-4 pb-28 md:pb-8 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <React.Suspense fallback={<div className="flex items-center justify-center p-12 text-center min-h-[300px] text-slate-500 text-sm">Loading module...</div>}>
            <Outlet />
          </React.Suspense>
        </main>
      </div>

      <MobileTabBar />
      <GuestOrderAlerts />
      {/* Global Modals (Lazy Loaded) */}
      <React.Suspense fallback={null}>
        <CommandPaletteModal />
        <QuickActionModal />
      </React.Suspense>
    </div>
  );
};
