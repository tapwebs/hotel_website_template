
import { useAuth } from '@/site/features/auth/auth-context'
import type { AdminError } from './adminTypes'
import { useWebsite } from './AdminShell'
import { BookingsPanel } from './BookingsPanel'

export function AdminBookingsPage() {
  const { stats } = useWebsite()
  const { clear, refresh } = useAuth()
  const onAuthError = (e: AdminError) => (e.kind === 'unauthenticated' ? clear() : refresh())
  return <BookingsPanel onAuthError={onAuthError} onChanged={stats.reload} />
}
