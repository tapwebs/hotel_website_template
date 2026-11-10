import type { CartLine, Category, MenuItem, OrderStatus } from '../types/customer'
import { apiUrl, getDiningSession, setDiningSession } from '../lib/env'

/**
 * Thin fetch client for /api/*. Deliberately contains NO business logic
 * and NO mock/fallback data — every function here is a direct 1:1 mapping
 * to a backend endpoint. If the backend is down, these calls fail; there
 * is no local fallback, because the backend is the only source of truth
 * for pricing, session state, and order state in this rebuild.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Set on a 409 ITEM_UNAVAILABLE: the dishes that are sold out or gone, so the app can drop just those lines. */
    public unavailable?: { itemId: string; name: string | null }[]
  ) {
    super(message)
  }
}

/**
 * Tiny in-memory cache for GETs that are safe to reuse across page
 * navigations within the same tab — menu data doesn't change mid-session,
 * so re-fetching it every time MenuPage/CartPage/TrackingPage mount was
 * paying a full network round-trip (~1-3s to the Render backend) on every
 * navigation for data that was already sitting in memory a second ago.
 *
 * Deliberately NOT a general-purpose cache for all endpoints — session,
 * quote, and order-status calls must always hit the network (they reflect
 * state that changes: cart contents, payment/order progress), so those
 * keep calling request() directly, uncached.
 */
const cache = new Map<string, { data: unknown; expiresAt: number }>()
const inFlight = new Map<string, Promise<unknown>>()
const MENU_CACHE_TTL_MS = 60_000 // 1 min: long enough to skip refetches on back/forward nav, short enough that a staff-side menu edit shows up soon

async function cachedRequest<T>(cacheKey: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(cacheKey)
  if (hit && hit.expiresAt > Date.now()) return hit.data as T

  const activePromise = inFlight.get(cacheKey)
  if (activePromise) return activePromise as Promise<T>

  const promise = fetcher()
    .then((data) => {
      cache.set(cacheKey, { data, expiresAt: Date.now() + ttlMs })
      return data
    })
    .finally(() => {
      inFlight.delete(cacheKey)
    })

  inFlight.set(cacheKey, promise)
  return promise
}

const orderEtags = new Map<string, string>()
const cachedOrders = new Map<string, any>()

/** Drops all cached entries — call after anything that can change what a
 * cached GET would return (e.g. a fresh session exchange, in case it's
 * ever for a different restaurant on the same device). */
export function clearApiCache(): void {
  cache.clear()
  inFlight.clear()
  orderEtags.clear()
  cachedOrders.clear()
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Dream Heavens: the guest session travels in the X-Dining-Session header instead of a cookie.
  const session = getDiningSession()
  const res = await fetch(apiUrl(`/api${path}`), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(session ? { 'X-Dining-Session': session } : {}), ...init?.headers },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Something went wrong. Please try again.' }))
    const msg = typeof body.error === 'string' ? body.error : body.error?.message || body.detail?.[0]?.msg
    throw new ApiError(res.status, msg || 'Something went wrong. Please try again.')
  }

  const data = (await res.json()) as T & { sessionId?: string }
  if (path === '/session/exchange' && data.sessionId) setDiningSession(data.sessionId)
  return data as T
}

export interface SessionInfo {
  restaurant: {
    id: string
    name: string
    logo: string
    accent: string
    features?: import('../types/customer').RestaurantFeatures
    slug?: string
    brandFont?: string
    heroImage?: string
    customDomain?: string
    pwaAppName?: string
    pwaThemeColor?: string
  }
  tableLabel: string
}

export interface ExchangeResponse extends SessionInfo {
  cartKey: string
}

export const api = {
  session: {
    exchange: (token: string) => request<ExchangeResponse>('/session/exchange', { method: 'POST', body: JSON.stringify({ token }) }),
    get: () => request<SessionInfo>('/session'),
  },

  menu: {
    get: () =>
      cachedRequest('menu', MENU_CACHE_TTL_MS, () =>
        request<{
          categories: Category[]
          items: MenuItem[]
          onlinePaymentEnabled?: boolean
          features?: import('../types/customer').RestaurantFeatures
        }>('/menu')
      ),
  },

  quote: {
    get: (lines: CartLine[], couponCode?: string) =>
      request<{ subtotal: number; discount: number; tax: number; total: number; couponError?: string }>('/quote', {
        method: 'POST',
        body: JSON.stringify({ lines, couponCode }),
      }),
  },

  orders: {
    create: (input: {
      lines: CartLine[]
      note?: string
      couponCode?: string
      payment: 'online' | 'counter'
      roomNumber?: string
      isRushPriority?: boolean
      customerName?: string
      customerPhone?: string
      tip?: number
      clientRequestId?: string
    }) =>
      request<{
        orderId?: string
        trackingToken: string
        displayNumber: string
        status: OrderStatus
        counterToken?: string
        customerName?: string
        customerPhone?: string
        razorpay?: {
          keyId: string
          orderId: string
          amount: number
          currency: string
          restaurantName?: string
        }
      }>('/orders', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    initRazorpayRetry: (trackingToken: string) =>
      request<{
        alreadyPaid?: boolean
        orderId: string
        trackingToken: string
        displayNumber: string
        status: OrderStatus
        razorpay?: {
          keyId: string
          orderId: string
          amount: number
          currency: string
          restaurantName?: string
        }
      }>(`/orders/${encodeURIComponent(trackingToken)}/razorpay-init`, {
        method: 'POST',
      }),
    get: async (trackingToken: string) => {
      const etag = orderEtags.get(trackingToken)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (etag) {
        headers['If-None-Match'] = etag
      }
      const res = await fetch(apiUrl(`/api/orders/${encodeURIComponent(trackingToken)}`), {
        headers,
      })

      if (res.status === 304 && cachedOrders.has(trackingToken)) {
        return cachedOrders.get(trackingToken)!
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Something went wrong. Please try again.' }))
        throw new ApiError(res.status, body.error || 'Something went wrong. Please try again.')
      }

      const newEtag = res.headers.get('etag')
      if (newEtag) {
        orderEtags.set(trackingToken, newEtag)
      }
      const data = await res.json()
      cachedOrders.set(trackingToken, data)
      return data
    },
  },


  payments: {
    verifyRazorpay: (data: {
      orderId: string
      razorpayPaymentId: string
      razorpayOrderId: string
      razorpaySignature: string
    }) =>
      request<{
        success: boolean
        orderId: string
        trackingToken: string
        status: OrderStatus
      }>('/payments/razorpay/verify', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
}
