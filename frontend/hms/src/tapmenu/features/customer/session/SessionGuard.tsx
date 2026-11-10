import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSession } from './SessionContext'
import { SessionErrorScreen } from './SessionErrorScreen'
import { CustomerMenuSkeleton } from '../../../components/ui/Skeleton'

import { api } from '../../../services/api'

/**
 * Guards /menu, /cart, /checkout — requires an active session. On a fresh
 * page load (no in-memory session yet, e.g. after a browser refresh),
 * re-checks via the HttpOnly cookie through GET /api/session rather than
 * needing the token again.
 */
export function SessionGuard({ children }: { children: ReactNode }) {
  const { session, rehydrate } = useSession()
  const [checked, setChecked] = useState(false)
  const [valid, setValid] = useState(false)
  const attempted = useRef(false)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('dark')
    }

    if (session) {
      setValid(true)
      setChecked(true)
      return
    }
    if (attempted.current) return
    attempted.current = true

    // Prefetch menu concurrently with session rehydration to eliminate waterfall latency
    void api.menu.get().catch(() => {})

    rehydrate().then((ok) => {
      setValid(ok)
      setChecked(true)
    })
  }, [session, rehydrate])

  if (!checked) {
    return <CustomerMenuSkeleton />
  }

  if (!valid) {
    return <SessionErrorScreen />
  }

  return <>{children}</>
}
