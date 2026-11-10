import { useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'

export interface SessionUser {
  id: string
  name: string
  email: string
  /** admin: manages HMS settings. staff: works with reservations. guest: neither. Mirrors the website backend's mapping. */
  role: 'guest' | 'staff' | 'admin'
}
export type AuthState = { status: 'loading' } | { status: 'anonymous'; configured: boolean } | { status: 'authenticated'; user: SessionUser }

/** Same shape as the website's useAuth, backed by the HMS session. */
export function useAuth() {
  const session = useAuthStore((s) => s.session)
  const initialized = useAuthStore((s) => s.isInitialized)
  const logout = useAuthStore((s) => s.logout)
  const initializeSession = useAuthStore((s) => s.initializeSession)
  const auth = useMemo<AuthState>(() => {
    if (!initialized) return { status: 'loading' }
    if (!session) return { status: 'anonymous', configured: true }
    const perms = session.permissions
    const role = perms.includes('MANAGE_SETTINGS') ? 'admin' : perms.includes('VIEW_RESERVATIONS') ? 'staff' : 'guest'
    return { status: 'authenticated', user: { id: session.userId, name: session.fullName, email: session.email, role } }
  }, [session, initialized])
  return { auth, clear: logout, refresh: () => void initializeSession(), setUser: () => undefined, logout: async () => logout() }
}
