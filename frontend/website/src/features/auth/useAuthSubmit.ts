import { useRef, useState } from 'react'
import { play } from '@/lib/sounds'
import { authErrorMessage, type AuthResult } from './authService'
export type AuthStatus = { state: 'idle' } | { state: 'unavailable' } | { state: 'done' } | { state: 'error'; message: string }
/** Wraps a submit call: blocks duplicate submits and maps results to UI state. */
export function useAuthSubmit<T>(call: (values: T) => Promise<AuthResult>, onSuccess?: (r: Extract<AuthResult, { ok: true }>) => void) {
  const [status, setStatus] = useState<AuthStatus>({ state: 'idle' })
  const busy = useRef(false)
  const submit = async (values: T) => {
    if (busy.current) return
    busy.current = true
    setStatus({ state: 'idle' })
    const r = await call(values)
    busy.current = false
    if (r.ok) {
      play('success')
      setStatus({ state: 'done' })
      onSuccess?.(r)
    } else if (r.code === 'AUTH_NOT_CONFIGURED') setStatus({ state: 'unavailable' })
    else {
      play('error')
      setStatus({ state: 'error', message: authErrorMessage[r.code] })
    }
  }
  return { status, submit }
}
