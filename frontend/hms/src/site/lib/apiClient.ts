// Generic JSON client for the accounts API. Never throws (except when the caller aborts): every call resolves
// to { ok:true, data } or { ok:false, error }. Same behaviour as the admin client, plus POST and DELETE.
import type { z } from 'zod4'
import { authBaseUrl, authHeaders } from '@/site/features/auth/authService'
import type { AdminError, ApiResult } from '@/site/features/admin/adminTypes'
export interface ApiCallOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  baseUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
  /** Turns a non-2xx response into an error. */
  mapError: (status: number, body: unknown) => AdminError
}
export async function apiCall<S extends z.ZodType>(path: string, schema: S, o: ApiCallOptions): Promise<ApiResult<z.infer<S>>> {
  const base = authBaseUrl({ baseUrl: o.baseUrl })
  if (!base) return { ok: false, error: { kind: 'network', message: 'The accounts server is not configured.' } }
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), o.timeoutMs ?? 10_000)
  const signal = o.signal ? AbortSignal.any([o.signal, timeout.signal]) : timeout.signal
  const hasBody = o.body !== undefined
  try {
    const res = await (o.fetchImpl ?? fetch)(`${base}${path}`, {
      method: o.method ?? 'GET',
      headers: { Accept: 'application/json', ...authHeaders(), ...(hasBody ? { 'Content-Type': 'application/json' } : {}) },
      body: hasBody ? JSON.stringify(o.body) : undefined,
      credentials: 'omit',
      signal,
    })
    const json: unknown = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: o.mapError(res.status, json) }
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
        message: timedOut ? 'The request took too long. Please try again.' : 'We could not reach the server. Check your connection and try again.',
      },
    }
  } finally {
    clearTimeout(timer)
  }
}
