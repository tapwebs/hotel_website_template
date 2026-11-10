import { useCallback, useEffect, useRef, useState } from 'react'
import { errMsg } from '@/features/qrhub/lib/utils'

// Results are cached per loader + deps: switching QR Hub sections shows the last result at once and refreshes it silently.
const cache = new Map<string, unknown>()
export const clearLoadCache = () => cache.clear()

/** Runs an async loader on mount and whenever `deps` change. `reload()` refetches. Stale responses are ignored.
 * A cached result is shown immediately (no loading flash) while a fresh one is fetched. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const key = `${fn.toString()}|${JSON.stringify(deps)}`
  const [state, setState] = useState<{ key: string; data?: T; error?: string; loading: boolean }>({ key: '', loading: true })
  const run = useRef(0)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const keyRef = useRef(key)
  keyRef.current = key
  // oxlint-disable-next-line react/exhaustive-deps
  const load = useCallback(() => {
    const id = ++run.current
    const k = keyRef.current
    setState((s) => ({ ...s, key: k, loading: !cache.has(k), error: undefined }))
    fnRef.current().then(
      (data) => {
        cache.set(k, data)
        if (id === run.current) setState({ key: k, data, loading: false })
      },
      (e) => id === run.current && setState((s) => ({ ...s, key: k, error: errMsg(e), loading: false })),
    )
  }, [])
  // oxlint-disable-next-line react/exhaustive-deps
  useEffect(load, deps)
  const cached = cache.get(key) as T | undefined
  const view = state.key === key ? state : cached !== undefined ? { key, data: cached, loading: false } : state
  return { data: view.data, error: view.error, loading: view.loading, reload: load }
}
