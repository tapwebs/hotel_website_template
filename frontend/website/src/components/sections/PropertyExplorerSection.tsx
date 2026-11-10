import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ExplorerFallback } from '@/components/three/ExplorerFallback'
import { useMediaQuery, usePrefersReducedMotion } from '@/lib/useMediaQuery'
import { cn, container } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PetalDecor } from '@/components/ui/PetalDecor'
import { hotspots } from '@/components/three/hotspots'

const PropertyExplorer = lazy(() => import('@/components/three/PropertyExplorer'))

/** Client-only WebGL probe. Safe to call where `document` is missing (returns false). */
function probeWebGL(): boolean {
  try {
    if (typeof document === 'undefined') return false
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') ?? c.getContext('webgl')
    // Release the probe context right away so it does not count against the browser's context limit.
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return Boolean(gl)
  } catch {
    return false
  }
}

const saveData = () =>
  typeof navigator !== 'undefined' && Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)

let glCache: boolean | undefined
const hasWebGL = () => (glCache ??= probeWebGL())
/** Auto-load eligibility: WebGL and no Save-Data. */
const canUse3D = () => !saveData() && hasWebGL()

let webglCache: boolean | undefined
const webglSnapshot = () => (webglCache ??= canUse3D())
const noSubscribe = () => () => {}

/**
 * Home "Explore the property". Server and first client render show the static fallback (real
 * content in the prerendered HTML, no hydration mismatch). After mount, desktop screens with
 * WebGL and motion allowed swap in the 3D view, whose chunk loads only near the viewport.
 * Small screens, reduced motion and Save-Data never download three.js on their own: with WebGL
 * they get a "View in 3D" button (any screen size), and the chunks load only after the user taps it.
 */
export function PropertyExplorerSection() {
  const ref = useRef<HTMLElement>(null)
  const reduced = usePrefersReducedMotion()
  const small = useMediaQuery('(max-width: 767px)')
  // Server snapshot `false` is also used while hydrating, then React re-renders with the real value.
  // Probe WebGL only when the screen could use 3D at all: phones and reduced-motion users skip the cost.
  const wants3D = !reduced && !small
  const webgl = useSyncExternalStore(
    noSubscribe,
    () => wants3D && webglSnapshot(),
    () => false,
  )
  // Explicit opt-in on any screen size whenever auto-load is not used (phones, reduced motion, Save-Data) but WebGL works.
  const canOptIn = useSyncExternalStore(
    noSubscribe,
    () => hasWebGL(),
    () => false,
  )
  // Client-only (server snapshot false), so prerendered HTML is unchanged.
  const noWebGL = useSyncExternalStore(
    noSubscribe,
    () => !hasWebGL(),
    () => false,
  )
  const [optIn, setOptIn] = useState(false)
  const [near, setNear] = useState(false)
  const [inView, setInView] = useState(false)
  const use3D = webgl || (optIn && hasWebGL())

  useEffect(() => {
    const el = ref.current
    if (!el || !use3D) return
    const nearObs = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '600px 0px' })
    const viewObs = new IntersectionObserver(([e]) => setInView(e.isIntersecting))
    // Start fetching the chunk well before the section is reached (no idle-time download for guests who never scroll here).
    const fetchObs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        void import('@/components/three/PropertyExplorer')
        fetchObs.disconnect()
      },
      { rootMargin: '1800px 0px' },
    )
    // Opted-in (tapped) users skip the prefetch/near observers: the chunk is requested by the render itself.
    if (!optIn) {
      fetchObs.observe(el)
      nearObs.observe(el)
    }
    viewObs.observe(el)
    return () => {
      nearObs.disconnect()
      viewObs.disconnect()
      fetchObs.disconnect()
    }
  }, [use3D, optIn])

  return (
    <section ref={ref} aria-labelledby="explorer-title" className={cn(container, 'relative isolate py-10 md:py-16 lg:py-28')}>
      <PetalDecor variant="bottom" side="left" />
      <div className="mb-6 grid gap-3 md:mb-10">
        <h2 id="explorer-title" className="text-h2 text-burgundy-deep">
          Explore the property
        </h2>
        <p className="max-w-[58ch] text-walnut">
          Rooms, the ground-floor restaurant and the basement banquet hall share one building, with a large function lawn beside it, so
          guests and celebrations never have far to go. EV charging is coming soon to the forecourt in front.
        </p>
      </div>
      {optIn && use3D ? (
        <div className="mb-4 flex justify-end">
          <Button type="button" variant="outline" onClick={() => setOptIn(false)}>
            Hide 3D view
          </Button>
        </div>
      ) : null}
      {use3D ? (
        near || optIn ? (
          <Suspense fallback={<ExplorerSkeleton />}>
            <PropertyExplorer inView={inView} />
          </Suspense>
        ) : (
          <ExplorerSkeleton />
        )
      ) : (
        <>
          <ExplorerFallback />
          {canOptIn ? (
            <div className="mt-6 grid justify-items-start gap-2">
              <Button type="button" size="lg" variant="default" onClick={() => setOptIn(true)} aria-describedby="explorer-3d-note">
                View in 3D
              </Button>
              <p id="explorer-3d-note" className="text-sm text-walnut">
                Loads about 1 MB.
              </p>
            </div>
          ) : null}
          {noWebGL ? (
            <p className="mt-6 text-sm text-walnut">Interactive 3D needs WebGL, which is turned off or unsupported in this browser.</p>
          ) : null}
        </>
      )}
    </section>
  )
}

function ExplorerSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]" role="status" aria-busy="true" aria-label="Loading the 3D view…">
      <div className="aspect-[4/5] animate-pulse rounded-md bg-muted sm:aspect-[16/10]" />
      <div className="grid content-start gap-2">
        {hotspots.map((h) => (
          <div key={h.id} className="h-12 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    </div>
  )
}
