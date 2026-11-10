// Generates web copies of the chosen source images (DESIGN-PLAN §8).
// - AVIF + WebP at 640/1024/1600, never wider than the source (no upscaling).
//   If the source sits well above the largest standard width (e.g. 1448px), its native width is added.
// - Output: public/images/<slug>-<w>.<avif|webp>  +  src/data/image-meta.json (dimensions for CLS-safe <img>).
// - Originals in images/ and images/ai-generated/ are only read, never written.
// Run: npm run images
import sharp from 'sharp'
import { mkdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Originals live in images/ (AI-generated in images/ai-generated); outputs stay inside frontend/.
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')

const OUT = 'public/images'
const META = 'src/data/image-meta.json'
const WIDTHS = [640, 1024, 1600]

// One entry per unique scene. Selection rationale lives in src/data/images.ts.
const SOURCES = [
  // Brand
  { slug: 'logo-badge', src: 'images/ai-generated/logo-dream-heavens-wood-badge.jpg', widths: [160, 320] },
  // Exterior
  { slug: 'exterior-front-steps', src: 'images/exterior/hotel-dream-heavens-entrance.png' },
  { slug: 'exterior-angled-wing', src: 'images/exterior/exterior-06.jpg' },
  { slug: 'exterior-gate-forecourt', src: 'images/exterior/exterior-08.jpg' },
  { slug: 'exterior-wide-forecourt', src: 'images/exterior/exterior-07.jpg' },
  { slug: 'hotel-exterior-modern-day', src: 'images/exterior/hotel-exterior-modern-day.png' },
  // Lobby & reception
  { slug: 'lobby-reception-desk', src: 'images/lobby-reception/lobby-11.jpg' },
  { slug: 'lobby-wood-ceiling-lift', src: 'images/lobby-reception/lobby-14.jpg' },
  { slug: 'lobby-jali-chandelier', src: 'images/lobby-reception/lobby-02.jpg' },
  // Corridors, stairs, rooms
  { slug: 'corridor-wood-ceiling', src: 'images/corridors-stairs-rooms/corridor-03.jpg' },
  { slug: 'corridor-chandelier', src: 'images/corridors-stairs-rooms/corridor-chandelier.png' },
  { slug: 'corridor-oval-ceiling-lift', src: 'images/corridors-stairs-rooms/corridor-02.jpg' },
  { slug: 'stairwell-looking-up', src: 'images/corridors-stairs-rooms/corridor-13.jpg' },
  { slug: 'staircase-glass-rail', src: 'images/corridors-stairs-rooms/corridor-15.jpg' },
  { slug: 'room-real-wide', src: 'images/corridors-stairs-rooms/corridor-17.jpg' },
  // Rooms & washroom (real photos, Oct 2026 shoot)
  { slug: 'room-real-bed', src: 'images/rooms/room-bed-cove-lighting.jpg' },
  { slug: 'room-window-view', src: 'images/rooms/room-window-view.jpg' },
  { slug: 'washroom-marble', src: 'images/washroom/washroom-marble.png' },
  // Kitchen
  { slug: 'kitchen-steel-ranges', src: 'images/kitchen/kitchen-01.jpg' },
  // Banquet hall
  { slug: 'banquet-murals-jali-ceiling', src: 'images/banquet-hall/banquet-hall-murals-jali-ceiling.jpg' },
  { slug: 'banquet-marble-chandeliers', src: 'images/banquet-hall/banquet-hall-08.jpg' },
  { slug: 'banquet-hall-grand', src: 'images/banquet-hall/banquet-hall-grand.png' },
  { slug: 'banquet-long-view', src: 'images/banquet-hall/banquet-hall-15.jpg' },
  // Lighting
  { slug: 'light-tulip-chandelier', src: 'images/lighting-details/lighting-05.jpg' },
  { slug: 'light-crystal-pendant', src: 'images/lighting-details/lighting-06.jpg' },
  { slug: 'light-lantern-walkway', src: 'images/lighting-details/lighting-07.jpg' },
  { slug: 'light-wall-sconce', src: 'images/lighting-details/lighting-08.jpg' },
  { slug: 'light-brass-lantern', src: 'images/lighting-details/lighting-11.jpg' },
  // Wall murals
  { slug: 'mural-peacock-palace', src: 'images/wall-murals/mural-09.jpg' },
  { slug: 'mural-peony-birds', src: 'images/wall-murals/mural-07.jpg' },
  { slug: 'mural-wishing-tree', src: 'images/wall-murals/mural-02.jpg' },
  { slug: 'mural-sunrise-peaks', src: 'images/wall-murals/mural-03.jpg' },
  { slug: 'mural-palms', src: 'images/wall-murals/mural-06.jpg' },
  { slug: 'mural-lotus', src: 'images/wall-murals/mural-08.jpg' },
  // Decorative textures + 3D fallback illustration (AI)
  { slug: 'bg-palms-cream', src: 'images/ai-generated/bg-rooms-palms-cream.png', widths: [640, 1024] },
  { slug: 'bg-peonies-cream', src: 'images/ai-generated/bg-serviced-peonies-cream.png', widths: [640, 1024] },
  { slug: 'illustration-exterior-golden-hour', src: 'images/ai-generated/hotel-exterior-golden-hour.png' },
]

function targetWidths(native, widths = WIDTHS) {
  const list = widths.filter((w) => w <= native)
  const top = list.at(-1) ?? 0
  // Small sources (e.g. 1448px) also get their native width, so they are not capped at the
  // step below. Never above the largest standard width.
  if (native > top * 1.1 && native < Math.max(...widths)) list.push(native)
  return list
}

const isFresh = (out, srcMtime) => existsSync(out) && statSync(out).mtimeMs >= srcMtime

mkdirSync(OUT, { recursive: true })
const meta = {}
let written = 0

for (const { slug, src: rel, widths } of SOURCES) {
  const src = join(REPO, rel)
  const srcMtime = statSync(src).mtimeMs
  // .rotate() applies EXIF orientation so width/height match what the browser shows.
  const { width, height } = await sharp(src)
    .rotate()
    .toBuffer({ resolveWithObject: true })
    .then((r) => r.info)
  const ws = targetWidths(width, widths)
  meta[slug] = { width, height, widths: ws }

  for (const w of ws) {
    const base = sharp(src).rotate().resize({ width: w, withoutEnlargement: true })
    const avif = join(OUT, `${slug}-${w}.avif`)
    const webp = join(OUT, `${slug}-${w}.webp`)
    if (!isFresh(avif, srcMtime)) {
      await base.clone().avif({ quality: 45, effort: 5 }).toFile(avif)
      written++
    }
    if (!isFresh(webp, srcMtime)) {
      await base.clone().webp({ quality: 72, effort: 5 }).toFile(webp)
      written++
    }
  }
  console.log(`${slug.padEnd(36)} ${width}x${height} -> ${ws.join(', ')}`)
}

writeFileSync(META, JSON.stringify(meta, null, 2) + '\n')
console.log(`\n${SOURCES.length} sources, ${written} files written, meta -> ${META}`)
