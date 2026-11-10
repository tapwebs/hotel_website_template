interface AppEnv {
  /** Base URL of the Express backend's /api routes, e.g.
   * "https://tapmenu-backend.onrender.com/api". Empty string means
   * relative "/api" (same-origin dev via Vite's proxy). */
  apiBaseUrl: string
  googleClientId: string
}

function resolveTapMenuBase(raw?: string): string {
  const trimmed = (raw ?? '').trim().replace(/\/+$/, '');
  if (trimmed) return trimmed.replace(/\/api\/v1$/, '');
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname.toLowerCase();
    if (host === 'hoteldreamheavens.in' || host === 'hms.hoteldreamheavens.in' || host.endsWith('.hoteldreamheavens.in')) {
      return 'https://api.hoteldreamheavens.in';
    }
  }
  return '';
}

export function loadEnv(source: Record<string, string | undefined> = import.meta.env): AppEnv {
  return {
    // Trim any trailing slash so callers can always do `${apiBaseUrl}/path`.
    apiBaseUrl: resolveTapMenuBase(source?.VITE_API_BASE_URL),
    googleClientId: source?.VITE_GOOGLE_CLIENT_ID ?? '',
  }
}

export const env = loadEnv()

/** Prefix a `/api/...`-style path with the configured backend origin.
 * In dev (VITE_API_BASE_URL unset), this resolves to a plain relative
 * path, which Vite's dev proxy forwards to localhost:4000 same-origin —
 * see vite.config.ts. In production it points at the Render backend's
 * full URL, since the frontend (Hostinger) and backend (Render) are
 * different origins there. */
export function apiUrl(path: string): string {
  // Dream Heavens: TapMenu's /api/* guest routes live under /api/v1/guest/* in the FastAPI backend.
  return `${env.apiBaseUrl}${path.replace(/^\/api(\/|$)/, '/api/v1/guest$1')}`
}

const SESSION_STORAGE_KEY = 'dh_dining_session'
/** The session id from /session/exchange, sent as X-Dining-Session (Dream Heavens uses a header, not a cookie). */
export function getDiningSession(): string | null {
  try { return sessionStorage.getItem(SESSION_STORAGE_KEY) } catch { return null }
}
export function setDiningSession(id: string | null): void {
  try { if (id) sessionStorage.setItem(SESSION_STORAGE_KEY, id); else sessionStorage.removeItem(SESSION_STORAGE_KEY) } catch { /* private mode */ }
}

