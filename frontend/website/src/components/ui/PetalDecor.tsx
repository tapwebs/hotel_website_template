import { cn } from '@/lib/utils'

/** `top` / `bottom`: a sprig blooming into that corner, inside the section's vertical padding. `dots`: dots only. */
type Variant = 'top' | 'bottom' | 'dots'
type Side = 'left' | 'right'

/** [x %, y %, radius px, opacity]. Fixed values, so server and client markup always match. */
const DOTS: Record<Variant, ReadonlyArray<readonly [number, number, number, number]>> = {
  top: [
    [4, 6, 2, 0.28],
    [12, 3, 1.5, 0.2],
    [3, 14, 1.5, 0.22],
    [96, 94, 2, 0.22],
  ],
  bottom: [
    [4, 94, 2, 0.26],
    [11, 97, 1.5, 0.2],
    [97, 6, 2, 0.2],
    [2, 50, 1.5, 0.22],
  ],
  dots: [
    // Gutters and the bottom band only: these sections start with text and have no top padding.
    [2, 22, 2, 0.26],
    [1.5, 55, 1.5, 0.2],
    [98, 35, 2, 0.22],
    [97.5, 70, 1.5, 0.25],
    [8, 95, 2, 0.2],
    [17, 92, 1.5, 0.26],
    [90, 94, 2, 0.22],
  ],
}

const PETAL = 'M0 0C6 -6 6 -16 0 -22C-6 -16 -6 -6 0 0Z'
const LEAF = 'M0 0C7 -4 14 -2 18 4C11 8 4 6 0 0Z'

/** Thin line-art flower sprig: a curved stem, three leaves and a five-petal bloom at the top right of its box. */
function Sprig({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
      className={cn('absolute fill-none stroke-burgundy opacity-30', className)}
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 114C30 92 52 72 82 42" vectorEffect="non-scaling-stroke" />
      <path d={LEAF} transform="translate(26 96) rotate(-35)" vectorEffect="non-scaling-stroke" />
      <path d={LEAF} transform="translate(44 80) rotate(45)" vectorEffect="non-scaling-stroke" />
      <path d={LEAF} transform="translate(62 62) rotate(-40)" vectorEffect="non-scaling-stroke" />
      <g transform="translate(84 40)">
        {[0, 72, 144, 216, 288].map((deg) => (
          <path key={deg} d={PETAL} transform={`rotate(${deg})`} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </svg>
  )
}

/**
 * Faint maroon petals and dots for a cream section. Purely decorative: aria-hidden, not interactive,
 * no animation, no layout impact. Put it as the first child of a `relative isolate` section.
 * Sprigs stay inside the section's top or bottom padding (80px, 112px from lg) so they never sit
 * under text, and are hidden on phones where only the dots remain.
 * Fully deterministic (no random values) so prerendered HTML hydrates cleanly.
 */
export function PetalDecor({ variant = 'top', side = 'right' }: { variant?: Variant; side?: Side }) {
  const mirror = cn(side === 'left' && 'scale-x-[-1]', variant === 'bottom' && 'scale-y-[-1]')
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {variant !== 'dots' && (
        <Sprig
          className={cn(
            'hidden size-20 sm:block lg:size-28',
            variant === 'top' ? 'top-0' : 'bottom-0',
            side === 'left' ? 'left-0' : 'right-0',
            mirror,
          )}
        />
      )}
      <svg className="absolute inset-0 size-full fill-burgundy" aria-hidden="true" focusable="false">
        {DOTS[variant].map(([x, y, r, o]) => (
          <circle key={`${x}-${y}`} cx={`${side === 'left' ? x : 100 - x}%`} cy={`${y}%`} r={r} fillOpacity={o} />
        ))}
      </svg>
    </div>
  )
}
