import type { MenuItem, POSOrder, POSTable } from '../types/pms';
import type {
  Category, Coupon, CouponInput, DiningInfo, FnbConfig, FnbConfigUpdate, GuestOrder, MenuItemInput, NewOrder, OrderLine, OrderStatus,
  RoomQr, RoomQrCode, Section, SettleInput, Shift, Station, TableReservation,
} from '../types/fnb';
import { API_BASE_URL, apiRequest } from './apiServices';
import { useAuthStore } from '../stores/authStore';
import type { FnbReviewsData } from '../types/fnb';
import type { FnbAnalyticsData } from '../types/fnbAnalytics';

const json = (body: unknown, method = 'POST'): RequestInit => ({ method, body: JSON.stringify(body) });

/**
 * GET with If-None-Match. The server answers 304 when nothing in the restaurant changed, so frequent polling costs
 * almost nothing. Throws an Error with `offline` set when the network is down, so screens can show a banner.
 */
const etags = new Map<string, { tag: string; data: unknown }>();
async function etagGet<T>(endpoint: string): Promise<T> {
  const token = localStorage.getItem('hms_token');
  const pid = useAuthStore.getState().session?.activePropertyId || 'prop-jaipur-01';
  const key = `${pid}:${endpoint}`;
  const prev = etags.get(key);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${endpoint}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
      headers: { 'X-Property-Id': pid, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(prev ? { 'If-None-Match': prev.tag } : {}) },
    });
  } catch {
    throw Object.assign(new Error('Connection lost. Retrying…'), { offline: true });
  }
  if (res.status === 304 && prev) return prev.data as T;
  if (res.status === 401) { useAuthStore.getState().logout(); throw new Error('Authentication required'); }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Request failed with status ${res.status}`);
  }
  const data = (await res.json()) as T;
  const tag = res.headers.get('etag');
  if (tag) etags.set(key, { tag, data });
  return data;
}

/** Staff: restaurant POS, kitchen display, menu and analytics (all need staff login). */
export const fnbService = {
  tables: () => etagGet<POSTable[]>('/pos/tables'),
  menu: () => apiRequest<MenuItem[]>('/pos/menu', { cache: 'no-store' }),
  orders: (scope: 'active' | 'all' = 'active', station?: Station, limit = scope === 'all' ? 150 : 200) =>
    etagGet<POSOrder[]>(`/pos/orders?scope=${scope}${station ? `&station=${station}` : ''}&limit=${limit}`),
  createOrder: (order: NewOrder) => apiRequest<POSOrder>('/pos/orders', json(order)),
  setStatus: (id: string, status: OrderStatus, reason?: string) => apiRequest<POSOrder>(`/pos/orders/${id}/status`, json({ status, reason }, 'PATCH')),
  settle: (id: string, body: SettleInput) => apiRequest<POSOrder>(`/pos/orders/${id}/settle`, json(body)),
  setRush: (id: string, isRush: boolean) => apiRequest<POSOrder>(`/pos/orders/${id}/priority`, json({ isRush }, 'PATCH')),
  markKot: (id: string) => apiRequest<POSOrder>(`/pos/orders/${id}/kot`, { method: 'POST' }),
  /** Claim an unprinted KOT for this printer. Only one device gets claimed: true. */
  claimKot: (id: string) => apiRequest<{ claimed: boolean; fromSeq: number; toSeq: number }>(`/pos/orders/${id}/kot/claim`, { method: 'POST' }),
  releaseKot: (id: string, fromSeq = 0, toSeq?: number) =>
    apiRequest<void>(`/pos/orders/${id}/kot/release?fromSeq=${fromSeq}${toSeq != null ? `&toSeq=${toSeq}` : ''}`, { method: 'POST' }),
  /** Add dishes to an order already sent; they print as an additional KOT. */
  addItems: (id: string, items: OrderLine[], notes?: string) => apiRequest<POSOrder>(`/pos/orders/${id}/items`, json({ items, notes })),
  /** Cancel some or all of one dish (captains and admins). */
  voidItem: (id: string, lineId: string, quantity: number, reason: string) =>
    apiRequest<POSOrder>(`/pos/orders/${id}/items/${encodeURIComponent(lineId)}/void`, json({ quantity, reason })),
  /** Move an order, or every open order on its table, to another table. */
  moveOrder: (id: string, tableId: string, allOnTable = false) => apiRequest<POSOrder[]>(`/pos/orders/${id}/move`, json({ tableId, allOnTable })),
  pendingGuestOrders: () => etagGet<POSOrder[]>('/pos/orders/pending'),
  acceptOrder: (id: string) => apiRequest<POSOrder>(`/pos/orders/${id}/accept`, { method: 'POST' }),
  counterCode: (code: string) => apiRequest<POSOrder>('/pos/orders/counter-code', json({ code })),
  roomQr: () => apiRequest<RoomQr[]>('/pos/room-qr', { cache: 'no-store' }),
  /** Every room with its permanent ordering QR. */
  roomsQr: () => apiRequest<RoomQrCode[]>('/pos/rooms-qr', { cache: 'no-store' }),
  resetRoomQr: (roomId: string) => apiRequest<{ token: string }>(`/pos/rooms-qr/${roomId}/reset`, { method: 'POST' }),
  rotateRoomLink: (stayId: string) => apiRequest<{ token: string }>(`/pos/room-qr/${stayId}/rotate`, { method: 'POST' }),
  createMenuItem: (m: MenuItemInput) => apiRequest<MenuItem>('/pos/menu', json(m)),
  updateMenuItem: (id: string, patch: Partial<MenuItemInput> & { sortOrder?: number }) => apiRequest<MenuItem>(`/pos/menu/${id}`, json(patch, 'PATCH')),
  deleteMenuItem: (id: string) => apiRequest<void>(`/pos/menu/${id}`, { method: 'DELETE' }),
  reviews: (rating?: number, offset = 0) =>
    apiRequest<FnbReviewsData>(`/pos/reviews?limit=50&offset=${offset}${rating ? `&rating=${rating}` : ''}`, { cache: 'no-store' }),
  getFnbAnalytics: () => apiRequest<FnbAnalyticsData>('/reports/fnb-analytics'),
  // settings
  config: () => apiRequest<FnbConfig>('/pos/config', { cache: 'no-store' }),
  saveConfig: (c: FnbConfigUpdate) => apiRequest<FnbConfig>('/pos/config', json(c, 'PUT')),
  me: () => apiRequest<{ userId: string; stations: string[]; role: string }>('/pos/me', { cache: 'no-store' }),
  // categories & import/export
  categories: () => apiRequest<Category[]>('/pos/categories', { cache: 'no-store' }),
  addCategory: (name: string) => apiRequest<Category>('/pos/categories', json({ name })),
  renameCategory: (id: string, name: string) => apiRequest<Category>(`/pos/categories/${id}`, json({ name }, 'PATCH')),
  deleteCategory: (id: string) => apiRequest<void>(`/pos/categories/${id}`, { method: 'DELETE' }),
  reorderCategories: (ids: string[]) => apiRequest<Category[]>('/pos/categories/reorder', json({ ids }, 'PUT')),
  exportMenu: () => apiRequest<{ categories: unknown[] }>('/pos/menu/export', { cache: 'no-store' }),
  importMenu: (payload: unknown, mode: 'merge' | 'replace') => apiRequest<{ created: number; updated: number }>(`/pos/menu/import?mode=${mode}`, json(payload)),
  // sections, tables, QR
  sections: () => apiRequest<Section[]>('/pos/sections', { cache: 'no-store' }),
  addSection: (name: string) => apiRequest<Section>('/pos/sections', json({ name })),
  renameSection: (id: string, name: string) => apiRequest<Section>(`/pos/sections/${id}`, json({ name }, 'PATCH')),
  deleteSection: (id: string) => apiRequest<void>(`/pos/sections/${id}`, { method: 'DELETE' }),
  addTable: (t: { tableNumber: string; capacity: number; sectionId?: string | null }) => apiRequest<{ ok: boolean }>('/pos/tables', json(t)),
  editTable: (id: string, t: { tableNumber?: string; capacity?: number; sectionId?: string | null }) => apiRequest<{ ok: boolean }>(`/pos/tables/${id}`, json(t, 'PATCH')),
  deleteTable: (id: string) => apiRequest<void>(`/pos/tables/${id}`, { method: 'DELETE' }),
  resetTableQr: (id: string) => apiRequest<{ qrToken: string }>(`/pos/tables/${id}/qr`, { method: 'POST' }),
  setTableStatus: (id: string, status: 'AVAILABLE' | 'SEATED' | 'CLEANING' | 'MAINTENANCE') => apiRequest<{ ok: boolean }>(`/pos/tables/${id}/status`, json({ status }, 'PATCH')),
  // coupons (super admin)
  coupons: () => apiRequest<Coupon[]>('/pos/coupons', { cache: 'no-store' }),
  saveCoupon: (c: CouponInput, id?: string) => apiRequest<Coupon>(id ? `/pos/coupons/${id}` : '/pos/coupons', json(c, id ? 'PUT' : 'POST')),
  deleteCoupon: (id: string) => apiRequest<void>(`/pos/coupons/${id}`, { method: 'DELETE' }),
  // shifts
  activeShift: () => apiRequest<{ shift: Shift | null }>('/pos/shifts/active', { cache: 'no-store' }),
  shifts: () => apiRequest<Shift[]>('/pos/shifts', { cache: 'no-store' }),
  openShift: (openingFloatPaise: number) => apiRequest<Shift>('/pos/shifts/open', json({ openingFloatPaise })),
  closeShift: (closingCashPaise: number) => apiRequest<Shift>('/pos/shifts/close', json({ closingCashPaise })),
  // reservations
  reservations: (day?: string) => apiRequest<TableReservation[]>(`/pos/reservations${day ? `?day=${day}` : ''}`, { cache: 'no-store' }),
  addReservation: (r: { guestName: string; phone?: string; partySize: number; reservedFor: string; durationMinutes: number; tableId?: string; roomNumber?: string; notes?: string }) =>
    apiRequest<TableReservation>('/pos/reservations', json(r)),
  updateReservation: (id: string, patch: Partial<Pick<TableReservation, 'status' | 'tableId' | 'reservedFor' | 'partySize' | 'notes'>>) =>
    apiRequest<TableReservation>(`/pos/reservations/${id}`, json(patch, 'PATCH')),
};

export const fnbAnalyticsService = {
  getFnbAnalytics: fnbService.getFnbAnalytics,
};

/** Guest: classic in-room dining page. No login; the token in the link is the credential, so no staff headers are sent. */
async function guest<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/dining/${encodeURIComponent(token)}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message ?? (typeof body?.detail === 'string' ? body.detail : 'Something went wrong. Please try again.');
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return body as T;
}

export const diningApi = {
  info: (token: string) => guest<DiningInfo>(token, ''),
  orders: (token: string) => guest<GuestOrder[]>(token, '/orders'),
  place: (token: string, items: OrderLine[], notes?: string) => guest<GuestOrder>(token, '/orders', json({ items, notes: notes || undefined })),
  cancel: (token: string, orderNumber: string) => guest<GuestOrder>(token, `/orders/${encodeURIComponent(orderNumber)}/cancel`, { method: 'POST' }),
};
