import { resolveApiBase } from '../../../services/apiServices'

export const authBaseUrl = (opts: { baseUrl?: string } = {}): string => {
  if (opts.baseUrl !== undefined) {
    return opts.baseUrl.trim().replace(/\/+$/, '')
  }
  const configured = (import.meta.env.VITE_SITE_API_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '')
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured
  }
  const apiBase = resolveApiBase()
  if (apiBase) {
    const route = (configured || '/api/v1/website').replace(/^\/+/, '')
    return `${apiBase}/${route}`
  }
  return configured || '/api/v1/website'
}

/** Authorization header for website-backend calls (empty when signed out). */
export const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('hms_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}
