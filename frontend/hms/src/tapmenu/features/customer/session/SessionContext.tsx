import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { api, ApiError, clearApiCache } from '../../../services/api'
import type { SessionInfo } from '../../../services/api'
import { usePageMeta } from '../../../hooks/usePageMeta'

interface SessionContextValue {
  session: SessionInfo | null
  cartKey: string | null
  /** null = not yet checked, true/false = checked and known */
  loading: boolean
  error: string | null
  /** Exchanges a table token for a session. Throws on failure (caller decides how to route). */
  exchangeToken: (token: string) => Promise<void>
  /** Re-checks the current session cookie without a token (page refresh flow). */
  rehydrate: () => Promise<boolean>
}

const SessionContext = createContext<SessionContextValue | null>(null)

const GENERIC_ERROR = 'Please scan the QR code on your table again.'

// cartKey is only returned once, from /session/exchange — it's kept in
// memory + sessionStorage for the tab's lifetime rather than refetched,
// since GET /session doesn't return it (see backend/src/routes/session.ts).
const CART_KEY_STORAGE = 'tapmenu_cart_key'

function safeGetSessionStorage(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : null
  } catch {
    return null
  }
}

function safeSetSessionStorage(key: string, value: string) {
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(key, value)
    }
  } catch {
    // Ignore storage quota / private mode restrictions
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  usePageMeta({ noindex: true })
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [cartKey, setCartKey] = useState<string | null>(() => safeGetSessionStorage(CART_KEY_STORAGE))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const exchangeToken = useCallback(async (token: string) => {
    setLoading(true)
    setError(null)
    try {
      // A fresh scan may be a different table/restaurant than whatever
      // this tab last cached menu data for.
      clearApiCache()
      const res = await api.session.exchange(token)
      setSession({ restaurant: res.restaurant, tableLabel: res.tableLabel })
      setCartKey(res.cartKey)
      safeSetSessionStorage(CART_KEY_STORAGE, res.cartKey)
    } catch (err) {
      setSession(null)
      setError(err instanceof ApiError ? err.message : GENERIC_ERROR)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const rehydrate = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.session.get()
      setSession(res)
      setError(null)
      return true
    } catch {
      setSession(null)
      setError(GENERIC_ERROR)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <SessionContext.Provider value={{ session, cartKey, loading, error, exchangeToken, rehydrate }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within a SessionProvider')
  return ctx
}
