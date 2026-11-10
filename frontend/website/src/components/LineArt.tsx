import { cn } from '@/lib/utils'

/**
 * Rajasthani line-art ornaments (original drawings): a cusped arch panel, a chhatri pavilion,
 * a jharokha balcony window under a crescent moon, and a diamond-chain divider. Each motif is authored as its left half and mirrored, so it is
 * always symmetric. Strokes use currentColor (set colour with a text-* class) and draw in as
 * they scroll into view (see `.line-draw` in index.css). Purely decorative: aria-hidden.
 */
interface Motif {
  w: number
  h: number
  /** Left-half paths, mirrored onto the right. */
  half: string[]
  /** Left-half circles [cx, cy, r], mirrored. */
  dots?: [number, number, number][]
  /** Paths on the centre line, drawn once. */
  center?: string[]
  centerDots?: [number, number, number][]
}

const archPanel: Motif = {
  w: 200,
  h: 420,
  half: [
    // frame top, double rule
    'M2 20H100',
    'M2 27H100',
    // column: bell capital, shaft, base
    'M2 146H38',
    'M4 146q15 -12 30 0',
    'M4 152H36V160H4Z',
    'M8 160V388',
    'M30 160V388',
    'M4 388H34V398H4Z',
    'M0 398H38V410H0Z',
    // cusped arch: outer and inner
    'M36 146C32 122 44 106 60 100C58 82 70 68 86 64C88 52 94 44 100 38',
    'M46 170V152C44 130 54 116 68 110C66 94 76 82 90 78C92 68 96 60 100 56',
    'M46 170V398',
    // spandrel vine with curls and leaves
    'M8 136C10 104 22 74 44 54C56 44 68 38 80 34',
    'M20 96C6 88 8 70 22 72C30 74 28 84 22 84',
    'M38 62C32 46 46 38 54 46C58 52 52 56 48 52',
    'M28 78q10 -10 18 -4q-8 10 -18 4Z',
    'M58 44q8 -11 18 -8q-6 11 -18 8Z',
    'M14 112q-2 -14 8 -18q4 12 -8 18Z',
    // railing with balusters
    'M46 360H100',
    'M46 372H100',
    'M58 360V372',
    'M70 360V372',
    'M82 360V372',
    'M94 360V372',
    // steps
    'M38 398H100',
    'M0 410H100',
  ],
  dots: [
    [19, 200, 4],
    [19, 240, 4],
    [19, 280, 4],
    [19, 320, 4],
    [19, 360, 4],
    [19, 200, 1.4],
    [19, 240, 1.4],
    [19, 280, 1.4],
    [19, 320, 1.4],
    [19, 360, 1.4],
    [66, 38, 3],
    [24, 82, 1.6],
    [50, 50, 1.6],
  ],
  center: ['M100 38V27', 'M100 56V112', 'M100 112l6 10l-6 10l-6 -10Z', 'M100 132V150', 'M100 150l4 7l-4 7l-4 -7Z'],
  centerDots: [
    [100, 16, 3.5],
    [100, 172, 2.2],
  ],
}

const chhatri: Motif = {
  w: 160,
  h: 240,
  half: [
    // dome and ribs
    'M80 30C62 34 40 52 38 82',
    'M80 30C74 44 70 62 70 82',
    'M80 30C66 40 54 60 54 82',
    // lotus band, drum
    'M38 82q6 -8 12 0q6 -8 12 0q6 -8 12 0q3 -4 6 0',
    'M34 82H80',
    'M34 90H80',
    'M34 82V90',
    // chhajja (eave) and brackets
    'M18 98H80',
    'M18 98L30 108H80',
    'M36 108q5 9 -1 15',
    'M62 108q5 9 -1 15',
    // column and cusped opening
    'M30 108V196',
    'M38 108V196',
    'M26 120H42',
    'M38 196V146C38 134 46 128 54 126C58 118 66 112 72 112C76 106 80 104 80 104',
    // plinth steps
    'M22 196H80',
    'M22 196V206H80',
    'M14 206V218H80',
    'M6 218V230H80',
  ],
  dots: [
    [34, 140, 1.6],
    [34, 160, 1.6],
    [34, 180, 1.6],
  ],
  center: ['M80 6V30', 'M74 30q6 -8 12 0', 'M80 112V134'],
  centerDots: [
    [80, 14, 3],
    [80, 138, 3],
  ],
}

const divider: Motif = {
  w: 240,
  h: 24,
  half: [
    'M4 12H104',
    'M24 12l4 -4l4 4l-4 4Z',
    'M52 12l5 -5l5 5l-5 5Z',
    'M80 12l3 -3l3 3l-3 3Z',
    'M106 12q-4 -8 -12 -7',
    'M106 12q-4 8 -12 7',
  ],
  center: ['M120 1l11 11l-11 11l-11 -11Z', 'M120 6l6 6l-6 6l-6 -6Z'],
}

// Jali lattice cells for the balcony railing (left half, 7 cells of 14 units).
const jali = Array.from({ length: 7 }, (_, i) => {
  const x = 22 + i * 14
  return [`M${x} 204L${x + 14} 232`, `M${x + 14} 204L${x} 232`]
}).flat()

const jharokha: Motif = {
  w: 240,
  h: 300,
  half: [
    // bangaldar (curved) roof, corner finial
    'M20 70C40 40 80 30 120 28',
    'M30 74C50 50 84 42 120 40',
    'M20 70L30 74',
    'M22 70V60',
    // chhajja (eave) with fringe
    'M10 82H120',
    'M10 82L20 90H120',
    'M32 90v5',
    'M46 90v5',
    'M60 90v5',
    'M74 90v5',
    'M88 90v5',
    'M102 90v5',
    // beam, pillars, capitals
    'M24 100H120',
    'M24 100V196',
    'M32 100V196',
    'M76 100V196',
    'M84 100V196',
    'M20 108H36',
    'M72 108H88',
    // cusped side opening and half of the centre opening
    'M32 196V138C32 126 40 120 46 118C48 112 52 108 54 106C56 108 60 112 62 118C68 120 76 126 76 138V196',
    'M84 196V134C84 120 96 112 104 110C108 102 114 96 120 92',
    // balcony: rails, jali, base, corbels
    'M18 196H120',
    'M18 204H120',
    'M18 232H120',
    'M14 238H120',
    ...jali,
    'M30 238C30 252 40 258 46 262',
    'M70 238C70 254 80 262 92 266C104 270 114 272 120 274',
  ],
  dots: [
    [22, 56, 2.2],
    [54, 150, 2],
  ],
  center: [
    'M120 28V14',
    'M120 92V120',
    'M114 286q6 -8 12 0q-6 10 -12 0Z',
    'M120 274V282',
    // crescent moon and stars: the room-at-night accent, drawn once
    'M214 6a14 14 0 1 0 14 20a11 11 0 1 1 -14 -20Z',
    'M30 14v10M25 19h10',
    'M58 4v7M54.5 7.5h7',
    'M188 30v6M185 33h6',
  ],
  centerDots: [
    [120, 10, 3.2],
    [120, 124, 2.4],
    [120, 294, 2],
  ],
}

type OrnamentProps = { className?: string; strokeWidth?: number }

function Draw({ motif, className, strokeWidth = 1.2 }: OrnamentProps & { motif: Motif }) {
  const { w, h, half, dots = [], center = [], centerDots = [] } = motif
  const shapes = (paths: string[], circles: [number, number, number][]) => (
    <>
      {paths.map((d) => (
        <path key={d} d={d} pathLength={1} />
      ))}
      {circles.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}-${r}`} cx={cx} cy={cy} r={r} pathLength={1} />
      ))}
    </>
  )
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      focusable="false"
      className={cn('line-draw pointer-events-none', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes(half, dots)}
      <g transform={`matrix(-1 0 0 1 ${w} 0)`}>{shapes(half, dots)}</g>
      {shapes(center, centerDots)}
    </svg>
  )
}

export function ArchPanel(props: OrnamentProps) {
  return <Draw motif={archPanel} {...props} />
}

export function Chhatri(props: OrnamentProps) {
  return <Draw motif={chhatri} {...props} />
}

export function Jharokha(props: OrnamentProps) {
  return <Draw motif={jharokha} {...props} />
}

export function LineDivider(props: OrnamentProps) {
  return <Draw motif={divider} {...props} />
}
