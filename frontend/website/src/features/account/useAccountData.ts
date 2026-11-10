import { useEffect } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { useResource } from '@/features/admin/useAdminData'
import type { ApiResult } from '@/features/admin/adminTypes'
/** useResource plus: a 401 from the API drops the local session, so RequireAuth sends the guest to /login. */
export function useAccountResource<T>(load: (signal: AbortSignal) => Promise<ApiResult<T>>, key: string) {
  const { clear } = useAuth()
  const res = useResource<T>(load, key)
  const unauthenticated = res.status === 'error' && res.error.kind === 'unauthenticated'
  useEffect(() => {
    if (unauthenticated) clear()
  }, [unauthenticated, clear])
  return res
}
