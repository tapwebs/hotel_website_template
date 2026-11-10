// Auth client. With VITE_AUTH_API_URL unset it does nothing and says so: no fake success and no local session.
// Sessions are an HttpOnly cookie set by the API, so every call sends credentials. Passwords are only ever
// sent in the request body, never logged.
import { normalizeIndianPhone } from '@/components/booking/buildWhatsAppUrl'
import type { LoginValues, SignupValues } from './schemas'
export type AuthErrorCode = 'AUTH_NOT_CONFIGURED' | 'INVALID_REQUEST' | 'ACCOUNT_DISABLED' | 'NETWORK' | 'TIMEOUT' | 'SERVER'
export type AuthResult = { ok: true; user?: SessionUser } | { ok: false; code: AuthErrorCode }
export interface SessionUser {
  id: string
  name: string
  email: string
  role: 'guest' | 'staff' | 'admin'
}
/** Plain check (not zod) so the eager auth code does not pull zod into every page. Returns a copy with only the known fields, like zod's object parse. */
function parseSessionBody(b: unknown): SessionUser | undefined {
  const u = (b as { user?: Record<string, unknown> } | null)?.user
  if (!u || typeof u !== 'object') return undefined
  const { id, name, email, role } = u
  if (typeof id !== 'string' || typeof name !== 'string' || typeof email !== 'string') return undefined
  if (role !== 'guest' && role !== 'staff' && role !== 'admin') return undefined
  return { id, name, email, role }
}
export interface AuthOptions {
  /** Defaults to import.meta.env.VITE_AUTH_API_URL. */
  baseUrl?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}
/** Generic, non-revealing copy per code (never says which of email/password was wrong). */
export const authErrorMessage: Record<Exclude<AuthErrorCode, 'AUTH_NOT_CONFIGURED'>, string> = {
  INVALID_REQUEST: 'We could not complete that with the details provided. Please check them and try again.',
  NETWORK: 'We could not reach the server. Check your connection and try again.',
  TIMEOUT: 'The request took too long. Please try again.',
  ACCOUNT_DISABLED: 'This account has been disabled. Please contact the hotel.',
  SERVER: 'Something went wrong on our side. Please try again in a moment.',
}
export const DEFAULT_GOOGLE_CLIENT_ID = 'demo-client-id.apps.googleusercontent.com'

/** Normalised API base URL, or '' when the API is not configured. */
export const authBaseUrl = (opts: AuthOptions = {}) => {
  if (opts.baseUrl !== undefined) {
    return opts.baseUrl.trim().replace(/\/+$/, '')
  }
  const envVal = (import.meta.env.VITE_AUTH_API_URL ?? '').trim().replace(/\/+$/, '')
  if (envVal) return envVal.replace(/\/api(\/v1)?\/?$/, '')
  return ''
}

export const googleClientId = () => {
  return ''
}
async function post(path: '/auth/login' | '/auth/signup' | '/auth/google', body: unknown, opts: AuthOptions): Promise<AuthResult> {
  const base = authBaseUrl(opts)
  if (!base) return { ok: false, code: 'AUTH_NOT_CONFIGURED' }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000)
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
      signal: controller.signal,
    })
    if (res.ok) {
      // A body that does not parse still counts as success, just without a user.
      const user = await Promise.resolve()
        .then(() => res.json())
        .then(parseSessionBody)
        .catch(() => undefined)
      return user ? { ok: true, user } : { ok: true }
    }
    if (res.status === 403) return { ok: false, code: 'ACCOUNT_DISABLED' }
    return { ok: false, code: res.status >= 400 && res.status < 500 ? 'INVALID_REQUEST' : 'SERVER' }
  } catch (err) {
    return { ok: false, code: err instanceof DOMException && err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK' }
  } finally {
    clearTimeout(timer)
  }
}
export const signIn = (v: LoginValues, opts: AuthOptions = {}) =>
  post('/auth/login', { email: v.email, password: v.password, remember: v.remember === true }, opts)

export const signInWithGoogle = (idToken: string, opts: AuthOptions = {}) =>
  post('/auth/google', { idToken }, opts)

export type SessionResult =
  | { ok: true; user: SessionUser | null }
  | { ok: false; code: 'AUTH_NOT_CONFIGURED' | 'NETWORK' | 'TIMEOUT' | 'SERVER' }
/** GET /auth/me. 401 means "not signed in" (user: null); anything else unexpected is an error, not "logged out". */
export async function getSession(opts: AuthOptions = {}): Promise<SessionResult> {
  const base = authBaseUrl(opts)
  if (!base) return { ok: false, code: 'AUTH_NOT_CONFIGURED' }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000)
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${base}/auth/me`, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
      signal: controller.signal,
    })
    if (res.status === 401) return { ok: true, user: null }
    if (!res.ok) return { ok: false, code: 'SERVER' }
    const user = parseSessionBody(await res.json().catch(() => null))
    return user ? { ok: true, user } : { ok: false, code: 'SERVER' }
  } catch (err) {
    return { ok: false, code: err instanceof DOMException && err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK' }
  } finally {
    clearTimeout(timer)
  }
}

/** POST /auth/logout (idempotent). Resolves true when the server confirmed. */
export async function signOut(opts: AuthOptions = {}): Promise<boolean> {
  const base = authBaseUrl(opts)
  if (!base) return true
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${base}/auth/logout`, { method: 'POST', credentials: 'include' })
    return res.ok
  } catch {
    return false
  }
}
export const signUp = (v: SignupValues, opts: AuthOptions = {}) =>
  post(
    '/auth/signup',
    { name: v.name, email: v.email, phone: `+91${normalizeIndianPhone(v.phone)}`, password: v.password, consent: v.consent },
    opts,
  )
