import { create } from 'zustand';
import { getKolkataCalendarDate } from '../utils/dateUtils';

export type QuickActionModalType = 
  | 'WALK_IN_CHECKIN'
  | 'NEW_RESERVATION'
  | 'COLLECT_PAYMENT'
  | 'ROOM_MOVE'
  | 'NEW_MAINTENANCE_TICKET'
  | 'ADD_FOLIO_CHARGE'
  | 'KYC_VIEWER';

interface PmsUIState {
  sidebarOpen: boolean;
  businessDate: string; // Active hotel financial business date 'YYYY-MM-DD'
  calendarDate: string; // Current real-world calendar date 'YYYY-MM-DD' in Asia/Kolkata
  timezone: string;
  nightAuditStatus: string;
  activeModal: QuickActionModalType | null;
  modalContextData: any;
  commandPaletteOpen: boolean;
  selectedDrawerEntity: {
    type: 'ROOM' | 'RESERVATION' | 'GUEST' | 'FOLIO' | null;
    id: string | null;
  };

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setBusinessDate: (date: string) => void;
  setCalendarDate: (date: string) => void;
  setBusinessDateInfo: (info: { business_date: string; calendar_date: string; timezone?: string; night_audit_status?: string }) => void;
  openModal: (modal: QuickActionModalType, contextData?: any) => void;
  closeModal: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  openDrawer: (type: 'ROOM' | 'RESERVATION' | 'GUEST' | 'FOLIO', id: string) => void;
  closeDrawer: () => void;
}

export const usePmsUIStore = create<PmsUIState>((set) => ({
  // Tablets (under 1280px) start with the slim icon rail so pages keep their width; desktops start expanded. Staff can still toggle it.
  sidebarOpen: typeof window === 'undefined' || window.innerWidth >= 1280,
  businessDate: getKolkataCalendarDate(),
  calendarDate: getKolkataCalendarDate(),
  timezone: 'Asia/Kolkata',
  nightAuditStatus: 'IDLE',
  activeModal: null,
  modalContextData: null,
  commandPaletteOpen: false,
  selectedDrawerEntity: { type: null, id: null },

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setBusinessDate: (date) => set({ businessDate: date }),
  setCalendarDate: (date) => set({ calendarDate: date }),
  setBusinessDateInfo: (info) => set((state) => ({
    businessDate: info.business_date || state.businessDate,
    calendarDate: info.calendar_date || state.calendarDate,
    timezone: info.timezone || state.timezone,
    nightAuditStatus: info.night_audit_status || state.nightAuditStatus,
  })),

  openModal: (modal, contextData = null) => set({
    activeModal: modal,
    modalContextData: contextData
  }),

  closeModal: () => set({ activeModal: null, modalContextData: null }),

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  openDrawer: (type, id) => set({
    selectedDrawerEntity: { type, id }
  }),

  closeDrawer: () => set({
    selectedDrawerEntity: { type: null, id: null }
  })
}));
