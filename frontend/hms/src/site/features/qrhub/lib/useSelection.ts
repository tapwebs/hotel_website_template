import { useCallback, useState } from 'react'

/** Multi-select over string ids. */
export function useSelection() {
  const [ids, setIds] = useState<Set<string>>(new Set())
  const toggle = useCallback(
    (id: string) =>
      setIds((s) => {
        const n = new Set(s)
        if (n.has(id)) n.delete(id)
        else n.add(id)
        return n
      }),
    [],
  )
  const setAll = useCallback((all: string[], on: boolean) => setIds(on ? new Set(all) : new Set()), [])
  const clear = useCallback(() => setIds(new Set()), [])
  return { ids, list: [...ids], has: (id: string) => ids.has(id), toggle, setAll, clear }
}
