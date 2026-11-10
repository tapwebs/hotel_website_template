import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext, type AuthContextValue, type AuthState } from './auth-context'
import { clearResourceCache } from '@/features/admin/useAdminData'
import { clearLoadCache } from '@/features/qrhub/lib/useLoad'
import { authBaseUrl, getSession, signOut } from './authService'

/** Cached dashboard data belongs to one account: drop it whenever the session changes. */
const dropCaches = () => {
  clearResourceCache()
  clearLoadCache()
}

/**
 * Session state from GET /auth/me. SSR-safe: starts as 'loading' on the server and on the first client
 * render, and only fetches inside an effect.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => (authBaseUrl() ? { status: 'loading' } : { status: 'anonymous', configured: false }))
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!authBaseUrl()) return
    let live = true
    void getSession().then((r) => {
      if (!live) return
      if (!r.ok) setAuth({ status: 'error' })
      else setAuth(r.user ? { status: 'authenticated', user: r.user } : { status: 'anonymous', configured: true })
    })
    return () => {
      live = false
    }
  }, [tick])

  const setUser = useCallback<AuthContextValue['setUser']>((user) => {
    dropCaches()
    setAuth({ status: 'authenticated', user })
  }, [])
  const clear = useCallback(() => {
    dropCaches()
    setAuth({ status: 'anonymous', configured: true })
  }, [])
  const refresh = useCallback(() => {
    setAuth({ status: 'loading' })
    setTick((t) => t + 1)
  }, [])
  const logout = useCallback(async () => {
    await signOut()
    dropCaches()
    setAuth({ status: 'anonymous', configured: true })
  }, [])

  const value = useMemo(() => ({ auth, setUser, clear, refresh, logout }), [auth, setUser, clear, refresh, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
