import { useCallback, useEffect, useState } from 'react'
import { getStats, listUsers } from './adminApi'
import type { AdminError, AdminStats, ApiResult, ListParams, UserList } from './adminTypes'

export type Resource<T> =
  | { status: 'loading'; data: T | null; error: null; reload: () => void }
  | { status: 'ready'; data: T; error: null; reload: () => void }
  | { status: 'error'; data: T | null; error: AdminError; reload: () => void }

// Module-level cache: switching dashboard sections shows the last result at once and refreshes it in the background,
// instead of flashing a skeleton. Cleared on log out (clearResourceCache) so one account never sees another's data.
const cache = new Map<string, unknown>()
export const clearResourceCache = () => cache.clear()

/** Runs `load` whenever `key` changes or reload() is called. Aborts the previous request and ignores stale responses.
 * With a cached result for `key` it reports 'ready' immediately and revalidates silently. Keys must be unique per query. */
export function useResource<T>(load: (signal: AbortSignal) => Promise<ApiResult<T>>, key: string): Resource<T> {
  const [state, setState] = useState<{ key: string; data: T | null; error: AdminError | null; done: boolean }>({ key: '', data: null, error: null, done: false })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const ctl = new AbortController()
    load(ctl.signal).then(
      (r) => {
        if (ctl.signal.aborted) return
        if (r.ok && !key.startsWith('nocache:')) cache.set(key, r.data)
        setState((s) => (r.ok ? { key, data: r.data, error: null, done: true } : { key, data: s.data, error: r.error, done: true }))
      },
      () => undefined, // aborted
    )
    return () => ctl.abort()
    // `load` is rebuilt every render; `key` + `tick` are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  // Derive the view during render so a cached key never shows a loading frame.
  const cached = !key.startsWith('nocache:') && cache.has(key) ? (cache.get(key) as T) : null
  const view = state.key === key ? state : cached !== null ? { key, data: cached, error: null, done: true } : { ...state, key, done: false }
  if (!view.done) return { status: 'loading', data: view.data, error: null, reload }
  if (view.error) return { status: 'error', data: view.data, error: view.error, reload }
  return { status: 'ready', data: view.data as T, error: null, reload }
}
export const useAdminUsers = (p: ListParams) => useResource<UserList>((signal) => listUsers(p, { signal }), `users:${JSON.stringify(p)}`)
export const useAdminStats = () => useResource<AdminStats>((signal) => getStats({ signal }), 'stats')
