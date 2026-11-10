import { 
  BookingSearchParams, 
  RoomCategory, 
  RoomHold, 
  GuestContactDetails, 
  ConfirmedBooking 
} from '../types/booking';
import { 
  PhysicalRoom, 
  Reservation, 
  GuestProfile, 
  HousekeepingTask, 
  MaintenanceTicket, 
  MaintenanceTicketCreatePayload,
  MaintenanceTicketUpdatePayload,
  MasterFolio, 
  PaymentTransaction,
  TaxInvoice,
  ProviderStatus,
  ReconciliationReport
} from '../types/pms';
import { DashboardKPIs, ManagerFlashReport, NightAuditChecklistStep, NightAuditStatus, NightAuditRolloverResult, NightAuditHistoryItem } from '../types/reports';
import { StaffMember, StaffAuditLog, CreateStaffPayload, UpdateStaffPayload } from '../types/auth';
import { useAuthStore } from '../stores/authStore';

export function resolveApiBase(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
  if (raw) return raw.replace(/\/api\/v1$/, '');
  return '';
}
export const API_BASE_URL = `${resolveApiBase()}/api/v1`;

const inFlightRequests = new Map<string, Promise<unknown>>();
const responseCache = new Map<string, { data: unknown; expiresAt: number }>();
const MAX_CACHE_ENTRIES = 250;

const LIVE_DATA_PATTERNS = ['/rooms', '/housekeeping', '/maintenance', '/folios', '/pos/orders', '/reservations'];

function getTtlForEndpoint(endpoint: string): number {
  if (LIVE_DATA_PATTERNS.some((pattern) => endpoint.includes(pattern))) {
    return 2_500; // 2.5 seconds for live operational data
  }
  return 15_000; // 15 seconds for static/reference data
}

function storeInCache(key: string, data: unknown, ttlMs: number): void {
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = responseCache.keys().next().value;
    if (firstKey) responseCache.delete(firstKey);
  }
  responseCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateApiCache(): void {
  responseCache.clear();
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const token = localStorage.getItem('hms_token');
  const session = useAuthStore.getState().session;
  const propertyId = session?.activePropertyId || 'prop-jaipur-01';

  // For mutations, invalidate response cache immediately
  if (method !== 'GET') {
    invalidateApiCache();
  }

  // For GET requests, check response cache or deduplicate concurrent in-flight promises
  const skipCache = options.cache === 'no-cache' || options.cache === 'no-store';
  const cacheKey = method === 'GET' ? `${propertyId}:${token || ''}:${endpoint}` : null;
  if (cacheKey && !skipCache) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey)! as Promise<T>;
    }
  }

  const promise = (async () => {
    const controller = new AbortController();
    // Reads fail fast; writes (e.g. a 150-dish menu import) get longer so a slow server isn't reported as "aborted".
    const timeoutId = setTimeout(() => controller.abort(), method === 'GET' ? 12000 : 90000);
    const signal = options.signal || controller.signal;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Property-Id': propertyId,
        ...(options.headers as Record<string, string> || {})
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        signal,
        headers
      });

      if (res.status === 401) {
        useAuthStore.getState().logout();
        throw new Error('Authentication required (401 Unauthorized)');
      }

      if (res.status === 403) {
        throw new Error('Access forbidden (403 Forbidden)');
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: res.statusText }));
        const msg = typeof errorData?.error?.message === 'string' ? errorData.error.message : typeof errorData.detail === 'string' ? errorData.detail : `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      if (res.status === 204) return undefined as T;
      const data = (await res.json()) as T;
      if (cacheKey && !skipCache) {
        storeInCache(cacheKey, data, getTtlForEndpoint(endpoint));
      }
      return data;
    } finally {
      clearTimeout(timeoutId);
      if (cacheKey) {
        inFlightRequests.delete(cacheKey);
      }
    }
  })();

  if (cacheKey) {
    inFlightRequests.set(cacheKey, promise);
  }

  return promise;
}

export const availabilityService = {
  async searchCategories(params?: Partial<BookingSearchParams>): Promise<RoomCategory[]> {
    return await apiRequest<RoomCategory[]>('/availability/categories');
  },

  async getCategoryById(id: string): Promise<RoomCategory | undefined> {
    try {
      return await apiRequest<RoomCategory>(`/availability/categories/${id}`);
    } catch (e: any) {
      if (e.message?.includes('404')) return undefined;
      throw e;
    }
  },

  async createHold(categoryId: string, ratePlanId: string, params: BookingSearchParams): Promise<RoomHold> {
    const payload = {
      categoryId,
      ratePlanId,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      adults: params.adults,
      children: params.children,
      roomsCount: params.roomsCount
    };
    return await apiRequest<RoomHold>('/availability/hold', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};

export const reservationService = {
  async getAll(): Promise<Reservation[]> {
    return await apiRequest<Reservation[]>('/reservations');
  },

  async getById(id: string): Promise<Reservation | undefined> {
    return await apiRequest<Reservation>(`/reservations/${encodeURIComponent(id)}`);
  },

  async confirmBooking(holdId: string, guest: GuestContactDetails, paymentMethod: string): Promise<ConfirmedBooking> {
    const payload = {
      holdId,
      guest,
      paymentMethod
    };
    return await apiRequest<ConfirmedBooking>('/reservations/confirm', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async confirmReservation(reservationId: string): Promise<Reservation> {
    return await apiRequest<Reservation>(`/reservations/${encodeURIComponent(reservationId)}/confirm`, {
      method: 'POST'
    });
  },

  async rejectReservation(reservationId: string): Promise<Reservation> {
    return await apiRequest<Reservation>(`/reservations/${encodeURIComponent(reservationId)}/reject`, {
      method: 'POST'
    });
  },

  async cancelBooking(reservationId: string): Promise<Reservation | null> {
    return await apiRequest<Reservation>(`/reservations/${encodeURIComponent(reservationId)}/cancel`, {
      method: 'POST'
    });
  },

  async markNoShow(reservationId: string): Promise<Reservation> {
    return await apiRequest<Reservation>(`/reservations/${encodeURIComponent(reservationId)}/no-show`, {
      method: 'POST'
    });
  }
};

export const roomService = {
  async getAll(): Promise<PhysicalRoom[]> {
    return await apiRequest<PhysicalRoom[]>('/rooms');
  },

  /** Add rooms (admins). Existing room numbers are skipped and returned in `skipped`. */
  async create(body: { room_type_id: string; room_numbers: string[]; floor_number?: number; wing?: string }): Promise<{ created: PhysicalRoom[]; skipped: string[] }> {
    return await apiRequest<{ created: PhysicalRoom[]; skipped: string[] }>('/rooms', { method: 'POST', body: JSON.stringify(body) });
  },

  /** Create Deluxe Room and Super Deluxe Room if the property has none (idempotent). */
  async setupTypes(): Promise<{ id: string; code: string; name: string }[]> {
    return await apiRequest('/rooms/types/setup', { method: 'POST' });
  },

  /** Change a room type's nightly rate in rupees (super admin). Applies to the HMS and the website. */
  async setTypeRate(typeId: string, rate: number): Promise<{ id: string; rate: number }> {
    return await apiRequest(`/rooms/types/${typeId}/rate`, { method: 'PUT', body: JSON.stringify({ rate }) });
  },

  async updateStatus(roomId: string, statusUpdate: { clean_status?: string; occupancy_status?: string; notes?: string }): Promise<PhysicalRoom | null> {
    return await apiRequest<PhysicalRoom>(`/rooms/${roomId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(statusUpdate)
    });
  }
};

export const guestService = {
  async getAll(): Promise<GuestProfile[]> {
    return await apiRequest<GuestProfile[]>('/guests');
  },
  async getById(id: string): Promise<GuestProfile | undefined> {
    return await apiRequest<GuestProfile>(`/guests/${id}`);
  }
};

export const housekeepingService = {
  async getTasks(): Promise<HousekeepingTask[]> {
    return await apiRequest<HousekeepingTask[]>('/housekeeping/tasks');
  },

  async updateTaskStatus(taskId: string, status: string, notes?: string): Promise<HousekeepingTask | null> {
    return await apiRequest<HousekeepingTask>(`/housekeeping/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes })
    });
  }
};

export const maintenanceService = {
  async getTickets(): Promise<MaintenanceTicket[]> {
    return await apiRequest<MaintenanceTicket[]>('/maintenance/tickets');
  },

  async getTicket(ticketId: string): Promise<MaintenanceTicket> {
    return await apiRequest<MaintenanceTicket>(`/maintenance/tickets/${ticketId}`);
  },

  async createTicket(payload: MaintenanceTicketCreatePayload): Promise<MaintenanceTicket> {
    return await apiRequest<MaintenanceTicket>('/maintenance/tickets', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateTicketStatus(
    ticketId: string,
    update: MaintenanceTicketUpdatePayload | string,
    resolutionNotes?: string
  ): Promise<MaintenanceTicket | null> {
    const payload = typeof update === 'string'
      ? { status: update, resolution_notes: resolutionNotes }
      : update;
    return await apiRequest<MaintenanceTicket>(`/maintenance/tickets/${ticketId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }
};

export const folioService = {
  async getAll(): Promise<MasterFolio[]> {
    return await apiRequest<MasterFolio[]>('/folios');
  },
  async getById(id: string): Promise<MasterFolio | undefined> {
    return await apiRequest<MasterFolio>(`/folios/${id}`);
  },
  async postCharge(
    folioId: string,
    description: string,
    debitPaise: number,
    taxPaise: number,
    transactionType: string = 'ROOM_CHARGE',
    sacCode?: string
  ): Promise<MasterFolio | null> {
    return await apiRequest<MasterFolio>('/folios/charges', {
      method: 'POST',
      body: JSON.stringify({
        folio_id: folioId,
        description,
        debit_paise: debitPaise,
        tax_paise: taxPaise,
        transaction_type: transactionType,
        sac_code: sacCode
      })
    });
  },
  async getInvoice(folioId: string): Promise<TaxInvoice> {
    return await apiRequest<TaxInvoice>(`/folios/${folioId}/invoice`);
  },
  async recordPayment(
    folioId: string,
    amountPaise: number,
    paymentMethod: string = 'CASH',
    transactionRef?: string,
    cardLast4?: string,
    upiId?: string
  ): Promise<MasterFolio> {
    return await apiRequest<MasterFolio>('/folios/payments', {
      method: 'POST',
      body: JSON.stringify({
        folio_id: folioId,
        amount_paise: amountPaise,
        payment_method: paymentMethod,
        transaction_ref: transactionRef,
        card_last4: cardLast4,
        upi_id: upiId
      })
    });
  }
};

export const paymentService = {
  async getAll(): Promise<PaymentTransaction[]> {
    return await apiRequest<PaymentTransaction[]>('/payments');
  },
  async getProviderStatus(): Promise<ProviderStatus> {
    return await apiRequest<ProviderStatus>('/payments/provider-status');
  },
  async processPayment(payload: {
    folio_id: string;
    amount_paise: number;
    payment_method: string;
    payer_name?: string;
    payer_upi?: string;
    card_last4?: string;
    idempotency_key?: string;
    simulation_outcome?: string;
  }): Promise<any> {
    return await apiRequest<any>('/payments/process', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  async processRefund(
    paymentId: string,
    amountPaise: number,
    reason?: string,
    simulationOutcome?: string
  ): Promise<{ status: string; message: string; refundAmountPaise: number; paymentId: string; refundRef?: string; isDemo?: boolean }> {
    return await apiRequest('/payments/refund', {
      method: 'POST',
      body: JSON.stringify({
        payment_id: paymentId,
        amount_paise: amountPaise,
        reason,
        simulation_outcome: simulationOutcome
      })
    });
  },
  async getReconciliation(): Promise<ReconciliationReport> {
    return await apiRequest<ReconciliationReport>('/payments/reconciliation');
  },
  async reconcileDemo(): Promise<ReconciliationReport> {
    return await apiRequest<ReconciliationReport>('/payments/reconciliation/demo', {
      method: 'POST'
    });
  },
  async importSettlementCsv(csvContent: string): Promise<ReconciliationReport> {
    return await apiRequest<ReconciliationReport>('/payments/reconciliation/import-csv', {
      method: 'POST',
      body: JSON.stringify({ csv_content: csvContent })
    });
  },
  async exportCsv(): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/payments/export-csv`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('hms_token') || ''}`,
        'X-Property-Id': useAuthStore.getState().session?.activePropertyId || 'prop-jaipur-01'
      }
    });
    if (!res.ok) throw new Error('Failed to export payments CSV');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hotel_dream_heavens_payments.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
};

export const reportService = {
  async getDashboardKPIs(): Promise<DashboardKPIs> {
    return await apiRequest<DashboardKPIs>('/reports/dashboard-kpis');
  },
  async getNightAuditStatus(): Promise<NightAuditStatus> {
    return await apiRequest<NightAuditStatus>('/reports/night-audit/status');
  },
  async getNightAuditSteps(): Promise<NightAuditChecklistStep[]> {
    return await apiRequest<NightAuditChecklistStep[]>('/reports/night-audit/steps');
  },
  async getFlashReport(businessDate?: string): Promise<ManagerFlashReport> {
    const q = businessDate ? `?business_date=${encodeURIComponent(businessDate)}` : '';
    return await apiRequest<ManagerFlashReport>(`/reports/flash-report${q}`);
  },
  async getNightAuditHistory(limit = 30): Promise<NightAuditHistoryItem[]> {
    return await apiRequest<NightAuditHistoryItem[]>(`/reports/night-audit/history?limit=${limit}`);
  },
  async executeRollover(payload?: { business_date?: string; force_auto_no_show?: boolean }): Promise<NightAuditRolloverResult> {
    return await apiRequest<NightAuditRolloverResult>('/reports/night-audit/rollover', {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined
    });
  }
};

export const staffService = {
  async getAll(propertyId?: string): Promise<StaffMember[]> {
    const query = propertyId ? `?property_id=${encodeURIComponent(propertyId)}` : '';
    return await apiRequest<StaffMember[]>(`/staff${query}`);
  },

  async getById(userId: string): Promise<StaffMember> {
    return await apiRequest<StaffMember>(`/staff/${userId}`);
  },

  async getAuditHistory(limit: number = 50): Promise<StaffAuditLog[]> {
    return await apiRequest<StaffAuditLog[]>(`/staff/audit-history?limit=${limit}`);
  },

  async create(payload: CreateStaffPayload): Promise<StaffMember> {
    return await apiRequest<StaffMember>('/staff', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async update(userId: string, payload: UpdateStaffPayload): Promise<StaffMember> {
    return await apiRequest<StaffMember>(`/staff/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  async updateStatus(userId: string, isActive: boolean): Promise<StaffMember> {
    return await apiRequest<StaffMember>(`/staff/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive })
    });
  },

  async resetPassword(userId: string, newPassword: string): Promise<{ status: string; message: string }> {
    return await apiRequest<{ status: string; message: string }>(`/staff/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password: newPassword })
    });
  },

  async forceLogout(userId: string): Promise<{ status: string; message: string }> {
    return await apiRequest<{ status: string; message: string }>(`/staff/${userId}/force-logout`, {
      method: 'POST'
    });
  }
};

export interface WalkInPayload {
  guest_name: string;
  guest_phone: string;
  guest_email?: string;
  room_number: string;
  nights: number;
  deposit_payment_method: string;
  advance_amount_paise: number;
}

export interface WalkInResponse {
  success: boolean;
  message: string;
  room_number: string;
  booking_reference: string;
  stay_id: string;
  reservation_id: string;
  qr_access_token?: string;
}

export const frontDeskService = {
  async checkIn(payload: { reservation_id: string; room_id: string; reservation_room_id?: string }): Promise<any> {
    return await apiRequest('/front-desk/check-in', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async checkOut(payload: { stay_id?: string; reservation_id?: string; room_id?: string; settle_remaining_with_method?: string }): Promise<any> {
    return await apiRequest('/front-desk/check-out', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async moveRoom(payload: { stay_id: string; new_room_id: string; reason: string }): Promise<any> {
    return await apiRequest('/front-desk/room-move', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async walkInCheckIn(payload: WalkInPayload): Promise<WalkInResponse> {
    return await apiRequest<WalkInResponse>('/front-desk/walk-in', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getBusinessDate(): Promise<{ property_id: string; business_date: string; calendar_date: string; timezone: string; night_audit_status: string }> {
    return await apiRequest('/front-desk/business-date');
  }
};

