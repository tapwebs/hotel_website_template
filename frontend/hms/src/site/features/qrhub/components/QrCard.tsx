import { useEffect, useState } from 'react'
import { Download, FileImage } from 'lucide-react'
import { Button } from '@/site/features/qrhub/components/ui/button'
import { buildQrUrl } from '@/site/features/qrhub/lib/qrUrl'
import { posterPng, qrPng, qrSvg } from '@/site/features/qrhub/lib/qr'
import { saveText, saveUrl, fileSafe } from '@/site/features/qrhub/lib/download'
import { errMsg } from '@/site/features/qrhub/lib/utils'
import { useSettings } from '@/site/features/qrhub/lib/useSettings'

interface Props {
  org: { slug: string; name: string; logo?: string }
  placement?: { code: string; label: string } | null
  /** Smaller layout for lists of placements. */
  compact?: boolean
}

/** QR preview plus PNG (1024), SVG, branded poster and print-sheet shortcuts. */
export function QrCard({ org, placement, compact }: Props) {
  const url = buildQrUrl(org.slug, placement?.code)
  const [src, setSrc] = useState('')
  const [err, setErr] = useState('')
  const settings = useSettings()
  const base = `${fileSafe(org.slug)}${placement ? '-' + fileSafe(placement.code) : ''}`

  useEffect(() => {
    let live = true
    qrPng(url, compact ? 360 : 512).then(
      (s) => live && setSrc(s),
      () => live && setErr('Could not build the QR.'),
    )
    return () => {
      live = false
    }
  }, [url, compact])

  const run = async (fn: () => Promise<void>) => {
    setErr('')
    try {
      await fn()
    } catch (e) {
      setErr(errMsg(e))
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="mx-auto w-full max-w-[220px] rounded-lg border bg-white p-2">
        {src ? (
          <img src={src} alt={`QR code for ${placement?.label ?? org.name}`} className="aspect-square w-full" />
        ) : (
          <div className="aspect-square w-full animate-pulse bg-muted" />
        )}
      </div>
      <div className="text-center">
        <p className="font-display text-lg text-burgundy">{placement?.label ?? org.name}</p>
        <p className="text-xs break-all text-muted-foreground">{url}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="outline" onClick={() => run(async () => saveUrl(await qrPng(url, 1024), `${base}-qr-1024.png`))}>
          <Download /> PNG
        </Button>
        <Button size="sm" variant="outline" onClick={() => run(async () => saveText(await qrSvg(url), `${base}-qr.svg`, 'image/svg+xml'))}>
          <FileImage /> SVG
        </Button>
        {!compact && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              run(async () =>
                saveUrl(
                  await posterPng({
                    name: org.name,
                    url,
                    logo: org.logo,
                    label: placement?.label,
                    cta: settings.poster_cta,
                    support: settings.poster_support,
                  }),
                  `${base}-poster-1200x1600.png`,
                ),
              )
            }
          >
            <FileImage /> Poster
          </Button>
        )}
      </div>
      {err && (
        <p role="alert" className="text-center text-xs text-destructive">
          {err}
        </p>
      )}
    </div>
  )
}
