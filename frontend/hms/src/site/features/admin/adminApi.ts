// Typed client for the admin API. Never throws: every call resolves to { ok, data } or { ok:false, error }.
import type { z } from 'zod4'
import { authBaseUrl, authHeaders } from '@/site/features/auth/authService'
import {
  roles,
  sortKeys,
  statsSchema,
  statuses,
  userEnvelopeSchema,
  userListSchema,
  type AdminError,
  type AdminStats,
  type AdminUser,
  type ApiResult,
  type ListParams,
  type Role,
  type Status,
  type UserList,
} from './adminTypes'

export const DEFAULT_PARAMS: ListParams = { page: 1, pageSize: 20, q: '', role: '', status: '', sort: 'createdAt', order: 'desc' }
export const hasFilters = (p: ListParams) => Boolean(p.q.trim() || p.role || p.status)
export const PAGE_SIZES = [10, 20, 50] as const

const friendly: Record<string, string> = {
  self_modification_forbidden: 'You cannot change your own role or status.',
  last_admin: 'At least one active admin is required.',
  forbidden_origin: 'This request was blocked. Reload the page and try again.',
}

export function errorFor(status: number, body: unknown): AdminError {
  const code = typeof (body as { error?: unknown } | null)?.error === 'string' ? (body as { error: string }).error : undefined
  const message = (fallback: string) => (code && friendly[code]) || fallback
  if (status === 401) return { kind: 'unauthenticated', code, message: 'Your session has expired. Please log in again.' }
  if (status === 403) return { kind: 'forbidden', code, message: message('You do not have access to this.') }
  if (status === 404) return { kind: 'not_found', code, message: 'That user no longer exists.' }
  if (status === 409) return { kind: 'conflict', code, message: message('That change is not allowed.') }
  if (status === 422) return { kind: 'validation', code, message: 'Those values are not valid. Please check them and try again.' }
  return { kind: 'server', code, message: 'Something went wrong on our side. Please try again.' }
}

/** Query string for GET /admin/users: defaults and empty values are left out. */
export function buildListQuery(p: ListParams): string {
  const sp = new URLSearchParams()
  sp.set('page', String(p.page))
  sp.set('pageSize', String(p.pageSize))
  if (p.q.trim()) sp.set('q', p.q.trim())
  if (p.role) sp.set('role', p.role)
  if (p.status) sp.set('status', p.status)
  sp.set('sort', p.sort)
  sp.set('order', p.order)
  return sp.toString()
}

const int = (v: string | null, min: number, max: number, fallback: number) => {
  const n = Number(v)
  return v !== null && Number.isInteger(n) && n >= min && n <= max ? n : fallback
}
const oneOf = <T extends string>(v: string | null, list: readonly T[]): T | undefined => list.find((x) => x === v)

/** Page URL params -> validated list params (bad values fall back to defaults). */
export function parseListParams(sp: URLSearchParams): ListParams {
  const d = DEFAULT_PARAMS
  const pageSize = int(sp.get('pageSize'), 1, 100, d.pageSize)
  return {
    page: int(sp.get('page'), 1, 100000, d.page),
    pageSize,
    q: (sp.get('q') ?? '').slice(0, 100),
    role: oneOf(sp.get('role'), roles) ?? '',
    status: oneOf(sp.get('status'), statuses) ?? '',
    sort: oneOf(sp.get('sort'), sortKeys) ?? d.sort,
    order: sp.get('order') === 'asc' ? 'asc' : 'desc',
  }
}

/** List params -> page URL params (defaults omitted). */
export function toSearchParams(p: ListParams): URLSearchParams {
  const d = DEFAULT_PARAMS
  const sp = new URLSearchParams()
  if (p.page !== d.page) sp.set('page', String(p.page))
  if (p.pageSize !== d.pageSize) sp.set('pageSize', String(p.pageSize))
  if (p.q.trim()) sp.set('q', p.q.trim())
  if (p.role) sp.set('role', p.role)
  if (p.status) sp.set('status', p.status)
  if (p.sort !== d.sort) sp.set('sort', p.sort)
  if (p.order !== d.order) sp.set('order', p.order)
  return sp
}

interface CallOptions {
  method?: 'GET' | 'PATCH'
  body?: unknown
  signal?: AbortSignal
  baseUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

async function call<S extends z.ZodType>(path: string, schema: S, o: CallOptions = {}): Promise<ApiResult<z.infer<S>>> {
  const base = authBaseUrl({ baseUrl: o.baseUrl })
  if (!base) return { ok: false, error: { kind: 'network', message: 'The accounts server is not configured.' } }
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), o.timeoutMs ?? 10_000)
  const signal = o.signal ? AbortSignal.any([o.signal, timeout.signal]) : timeout.signal
  try {
    const res = await (o.fetchImpl ?? fetch)(`${base}${path}`, {
      method: o.method ?? 'GET',
      headers: { Accept: 'application/json', ...authHeaders(), ...(o.body ? { 'Content-Type': 'application/json' } : {}) },
      body: o.body ? JSON.stringify(o.body) : undefined,
      credentials: 'omit',
      signal,
    })
    const json: unknown = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: errorFor(res.status, json) }
    const parsed = schema.safeParse(json)
    if (!parsed.success) return { ok: false, error: { kind: 'server', message: 'The server sent an unexpected response.' } }
    return { ok: true, data: parsed.data }
  } catch (err) {
    if (o.signal?.aborted) throw err // caller cancelled: let the hook ignore it
    const timedOut = err instanceof DOMException && err.name === 'AbortError'
    return {
      ok: false,
      error: {
        kind: 'network',
        message: timedOut
          ? 'The request took too long. Please try again.'
          : 'We could not reach the server. Check your connection and try again.',
      },
    }
  } finally {
    clearTimeout(timer)
  }
}

type Opts = Pick<CallOptions, 'signal' | 'baseUrl' | 'fetchImpl' | 'timeoutMs'>

export const listUsers = (p: ListParams, o?: Opts): Promise<ApiResult<UserList>> =>
  call(`/admin/users?${buildListQuery(p)}`, userListSchema, o)
export const getStats = (o?: Opts): Promise<ApiResult<AdminStats>> => call('/admin/stats', statsSchema, o)
export const getUser = async (id: string, o?: Opts): Promise<ApiResult<AdminUser>> => {
  const r = await call(`/admin/users/${encodeURIComponent(id)}`, userEnvelopeSchema, o)
  return r.ok ? { ok: true, data: r.data.user } : r
}
const patch = async (id: string, part: 'role' | 'status', body: object, o?: Opts): Promise<ApiResult<AdminUser>> => {
  const r = await call(`/admin/users/${encodeURIComponent(id)}/${part}`, userEnvelopeSchema, { ...o, method: 'PATCH', body })
  return r.ok ? { ok: true, data: r.data.user } : r
}
export const setRole = (id: string, role: Role, o?: Opts) => patch(id, 'role', { role }, o)
export const setStatus = (id: string, status: Status, o?: Opts) => patch(id, 'status', { status }, o)
