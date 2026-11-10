import { cn } from '@/lib/utils'
import { VIEW } from './geometry'

/**
 * Shared drawing kit for the inner-page hero line-art. Every stroke carries pathLength=1 so the
 * shared `.anim-draw` class (index.css) can draw it in with a dasharray/dashoffset of 1.
 * Strokes: maroon = currentColor (svg is text-burgundy), gold = `text-gold` group, and a
 * gold-to-maroon gradient via <Grad>. Purely decorative: aria-hidden.
 */

export function P({ d }: { d: string }) {
  return <path d={d} pathLength={1} />
}

export function C({ c: [cx, cy, r] }: { c: [number, number, number] }) {
  return <circle cx={cx} cy={cy} r={r} pathLength={1} />
}

/** Paths and circles, drawn once. */
export function Shapes({ d = [], c = [] }: { d?: string[]; c?: [number, number, number][] }) {
  return (
    <>
      {d.map((p) => (
        <P key={p} d={p} />
      ))}
      {c.map((x) => (
        <C key={x.join('-')} c={x} />
      ))}
    </>
  )
}

/** Left-half shapes plus their mirror image across the vertical centre line. */
export function Sym(props: { d?: string[]; c?: [number, number, number][] }) {
  return (
    <>
      <Shapes {...props} />
      <g transform={`matrix(-1 0 0 1 ${VIEW} 0)`}>
        <Shapes {...props} />
      </g>
    </>
  )
}

/** Gold strokes. */
export function Gold({ children }: { children: React.ReactNode }) {
  return (
    <g className="text-gold" stroke="currentColor">
      {children}
    </g>
  )
}

/** Gold-to-maroon gradient strokes (the gradient is defined by HeroSvg). */
export function Grad({ id, children }: { id: string; children: React.ReactNode }) {
  return <g stroke={`url(#hg-${id})`}>{children}</g>
}

export function HeroSvg({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      aria-hidden="true"
      focusable="false"
      className={cn('anim-draw pointer-events-none text-burgundy', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        {/* userSpaceOnUse so straight horizontal/vertical strokes still get the gradient. */}
        <linearGradient id={`hg-${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={VIEW}>
          <stop offset="0" style={{ stopColor: 'var(--color-gold)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-burgundy)' }} />
        </linearGradient>
      </defs>
      {children}
    </svg>
  )
}

export type ArtProps = { className?: string }
