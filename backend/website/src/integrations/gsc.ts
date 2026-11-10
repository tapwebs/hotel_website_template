import { addDays, todayIST } from '../domain/bookings.ts'
import { accessToken, failed, fetchWithRetry, notConnected, type GoogleEnv, type IntegrationState } from './google.ts'

export interface GscMetrics {
  searchClicks: number
  impressions: number
  ctr: number // percent
  averagePosition: number
  searchTrend: { date: string; clicks: number; impressions: number }[]
}
interface CacheEntry {
  expiresAt: number
  state: IntegrationState<GscMetrics>
}
const _gscCache = new Map<string, CacheEntry>()
const GSC_TTL_MS = 15 * 60 * 1000 // 15 minutes

export function clearGscCache(): void {
  _gscCache.clear()
}

/** Search Console search analytics for the hub page(s) of one organization. Off unless all three env vars are set. */
export async function fetchGsc(slug: string, days: number, env: GoogleEnv = process.env, fetcher: typeof fetch = fetch): Promise<IntegrationState<GscMetrics>> {
  const { GSC_SITE_URL: site, GSC_CLIENT_EMAIL: email, GSC_PRIVATE_KEY: key } = env
  if (!site || !email || !key) return notConnected('gsc', 'Google Search Console', 'Not connected. Set GSC_SITE_URL, GSC_CLIENT_EMAIL and GSC_PRIVATE_KEY on the API server.')

  const cacheKey = `${site}:${slug}:${days}`
  const cached = _gscCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.state
  }

  try {
    const token = await accessToken(email, key, 'https://www.googleapis.com/auth/webmasters.readonly', fetcher)
    const today = todayIST()
    const res = await fetchWithRetry(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        startDate: addDays(today, -days),
        endDate: today,
        dimensions: ['date'],
        dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'contains', expression: `/hub/${slug}` }] }],
        rowLimit: 100,
      }),
      signal: AbortSignal.timeout(8000),
    }, fetcher)
    if (!res.ok) throw new Error(`Search Console API returned HTTP ${res.status}`)
    const rows = ((await res.json()) as { rows?: { keys: string[]; clicks: number; impressions: number; position: number }[] }).rows ?? []
    const clicks = rows.reduce((n, r) => n + r.clicks, 0)
    const impressions = rows.reduce((n, r) => n + r.impressions, 0)
    const result: IntegrationState<GscMetrics> = {
      provider: 'gsc',
      name: 'Google Search Console',
      status: 'connected',
      lastSynced: new Date().toISOString(),
      explanation: 'Synced with Google Search Console.',
      data: {
        searchClicks: clicks,
        impressions,
        ctr: impressions ? Number(((clicks / impressions) * 100).toFixed(1)) : 0,
        averagePosition: rows.length ? Number((rows.reduce((n, r) => n + r.position, 0) / rows.length).toFixed(1)) : 0,
        searchTrend: rows.map((r) => ({ date: r.keys[0] ?? '', clicks: r.clicks, impressions: r.impressions })),
      },
    }
    _gscCache.set(cacheKey, { expiresAt: Date.now() + GSC_TTL_MS, state: result })
    return result
  } catch (err) {
    return failed('gsc', 'Google Search Console', err)
  }
}
