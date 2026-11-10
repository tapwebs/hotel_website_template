import { useEffect, useState } from 'react'
import { api } from './api'
import type { QrSettings } from './types'

let cache: QrSettings | null = null

export const resetSettingsCache = () => {
  cache = null
}

/** QR Hub settings (poster defaults), fetched once per session. Falls back to {} when the call fails. */
export function useSettings(): QrSettings {
  const [s, setS] = useState<QrSettings>(cache ?? {})
  useEffect(() => {
    if (cache) return
    let live = true
    api.getSettings().then(
      (v) => {
        cache = v
        if (live) setS(v)
      },
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [])
  return s
}
