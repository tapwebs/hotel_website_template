import { createSign } from 'node:crypto'

export type IntegrationStatus = 'connected' | 'not_connected' | 'error'
export interface IntegrationState<T = unknown> {
  provider: 'ga4' | 'gsc'
  name: string
  status: IntegrationStatus
  lastSynced: string | null
  explanation: string
  errorMessage?: string
  data?: T
}
export interface GoogleEnv {
  [key: string]: string | undefined
}
const b64 = (v: string | Buffer) => Buffer.from(v).toString('base64url')
const cache = new Map<string, { token: string; exp: number }>()

/** Fetch with exponential backoff and jitter for transient failures (5xx or network timeouts). */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  fetcher: typeof fetch = fetch,
  retries = 2
): Promise<Response> {
  let attempt = 0
  while (true) {
    try {
      const res = await fetcher(url, init)
      if (res.ok || (res.status < 500 && res.status !== 429) || attempt >= retries) {
        return res
      }
    } catch (err) {
      if (attempt >= retries) throw err
    }
    attempt++
    const jitter = Math.random() * 150
    const delay = Math.min(2000, 250 * Math.pow(2, attempt) + jitter)
    await new Promise((r) => setTimeout(r, delay))
  }
}

/** Service-account OAuth (RS256 JWT bearer). Keys stay server-side; the token is cached until shortly before expiry. */
export async function accessToken(clientEmail: string, privateKey: string, scope: string, fetcher: typeof fetch = fetch): Promise<string> {
  const key = `${clientEmail}|${scope}`
  const hit = cache.get(key)
  if (hit && hit.exp > Date.now() + 60_000) return hit.token
  const iat = Math.floor(Date.now() / 1000)
  const head = `${b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64(JSON.stringify({ iss: clientEmail, scope, aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 }))}`
  const sig = createSign('RSA-SHA256').update(head).sign(privateKey.replace(/\\n/g, '\n'))
  const res = await fetchWithRetry('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${b64(sig)}` }),
    signal: AbortSignal.timeout(8000),
  }, fetcher)
  if (!res.ok) throw new Error(`Google token request failed (HTTP ${res.status})`)
  const json = (await res.json()) as { access_token: string; expires_in: number }
  cache.set(key, { token: json.access_token, exp: Date.now() + json.expires_in * 1000 })
  return json.access_token
}
export const notConnected = <T>(provider: 'ga4' | 'gsc', name: string, explanation: string): IntegrationState<T> => ({
  provider,
  name,
  status: 'not_connected',
  lastSynced: null,
  explanation,
})
export const failed = <T>(provider: 'ga4' | 'gsc', name: string, err: unknown): IntegrationState<T> => ({
  provider,
  name,
  status: 'error',
  lastSynced: new Date().toISOString(),
  explanation: `Could not read ${name}.`,
  errorMessage: err instanceof Error ? err.message.slice(0, 200) : 'Unknown error',
})
