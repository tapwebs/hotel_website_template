import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { frontDeskService } from '../services/apiServices';
import { usePmsUIStore } from '../stores/pmsUIStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getKolkataCalendarDate, formatKolkataDate, getMillisUntilKolkataMidnight } from '../utils/dateUtils';

export function useAppDate() {
  const queryClient = useQueryClient();
  const businessDate = usePmsUIStore((s) => s.businessDate);
  const calendarDate = usePmsUIStore((s) => s.calendarDate);
  const nightAuditStatus = usePmsUIStore((s) => s.nightAuditStatus);
  const timezone = usePmsUIStore((s) => s.timezone);
  const setBusinessDateInfo = usePmsUIStore((s) => s.setBusinessDateInfo);
  const setCalendarDate = usePmsUIStore((s) => s.setCalendarDate);

  // Authoritative query from PostgreSQL backed endpoint
  const { data: businessDateInfo, isFetching, refetch } = useQuery({
    queryKey: ['businessDate'],
    queryFn: () => frontDeskService.getBusinessDate(),
    staleTime: 1000 * 30, // 30 seconds fresh
    refetchOnWindowFocus: true,
  });

  // Synchronize state stores when server returns business-date data
  useEffect(() => {
    if (businessDateInfo) {
      setBusinessDateInfo(businessDateInfo);
      if (businessDateInfo.business_date) {
        useSettingsStore.getState().setBusinessDate(businessDateInfo.business_date);
      }
    }
  }, [businessDateInfo, setBusinessDateInfo]);

  // Handle midnight rollover in Asia/Kolkata
  useEffect(() => {
    const checkRollover = () => {
      const today = getKolkataCalendarDate();
      if (today !== usePmsUIStore.getState().calendarDate) {
        setCalendarDate(today);
        void queryClient.invalidateQueries({ queryKey: ['businessDate'] });
        void queryClient.invalidateQueries({ queryKey: ['dashboardKPIs'] });
        void queryClient.invalidateQueries({ queryKey: ['reservations'] });
        void queryClient.invalidateQueries({ queryKey: ['nightAuditSteps'] });
        void queryClient.invalidateQueries({ queryKey: ['website', 'bookings'] });
      }
    };

    // 1. Check every 30 seconds
    const interval = setInterval(checkRollover, 30_000);

    // 2. Schedule timeout for midnight (+1s buffer)
    const msUntilMidnight = getMillisUntilKolkataMidnight();
    const timer = setTimeout(checkRollover, msUntilMidnight + 1000);

    // 3. Document visibility & window focus triggers
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkRollover();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkRollover);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkRollover);
    };
  }, [queryClient, setCalendarDate]);

  const isAuditPending = businessDate < calendarDate;

  return {
    businessDate,
    calendarDate,
    timezone,
    nightAuditStatus,
    isAuditPending,
    isFetching,
    refetch,
    calendarDateFormatted: formatKolkataDate(calendarDate, { weekday: 'long', day: 'numeric', month: 'long' }),
    businessDateFormatted: formatKolkataDate(businessDate, { day: 'numeric', month: 'short', year: 'numeric' }),
  };
}
