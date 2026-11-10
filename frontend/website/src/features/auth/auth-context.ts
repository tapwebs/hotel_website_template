import { createContext, useContext } from 'react'
import type { SessionUser } from './authService'

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous'; configured: boolean }
  | { status: 'error' }
  | { status: 'authenticated'; user: SessionUser }

export interface AuthContextValue {
  auth: AuthState
  /** Called by the login form on success. */
  setUser: (user: SessionUser) => void
  /** Drop the local session (e.g. after a 401 from an API call). */
  clear: () => void
  refresh: () => void
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Only same-origin absolute paths ("/admin"); rejects "//evil.com", "/\\evil.com" and full URLs. */
export function safeNext(from: unknown): string | null {
  return typeof from === 'string' && /^\/(?![/\\])/.test(from) ? from : null
}
