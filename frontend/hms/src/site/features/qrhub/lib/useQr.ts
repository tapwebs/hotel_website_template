import { useEffect, useState } from 'react'
import { qrPng } from './qr'

/** Generates QR PNG data URLs for many texts. Keys are the texts. */
export function useQrMap(texts: string[], width = 512): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({})
  const key = texts.join('\n')
  useEffect(() => {
    let live = true
    const list = key ? key.split('\n') : []
    void Promise.all(list.map(async (t) => [t, await qrPng(t, width)] as const)).then((pairs) => live && setMap(Object.fromEntries(pairs)))
    return () => {
      live = false
    }
  }, [key, width])
  return map
}
