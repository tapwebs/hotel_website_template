// Image map for every site section (DESIGN-PLAN §8).
//
// Every file in images/ and images/ai-generated/ was opened and inspected before choosing.
// Rules applied:
// - Each scene appears ONCE across the whole site. Near-duplicates (featured/*.webp,
//   dream-heavens-*.webp, *-framed-wall.png, repeat angles) were checked with a perceptual
//   hash and by eye. The sharpest, cleanest frame of each scene is the one used.
// - Frames showing work in progress (ladders, workers, cartons, loose wiring, unfinished
//   ceilings) are left out. reception-desk-wip.jpg is skipped as instructed.
// - images/ai-generated/banquet-hall-marble-floor.jpg (originally "resturent.jpg") shows the
//   BANQUET HALL, not a dining room: it is an AI version of banquet-hall-08.jpg. It is not
//   used, because the real photo exists. No real restaurant photo was supplied, so /dining
//   uses real lighting details plus the supplied kitchen photo.
// - Oct 2026 shoot (see images/MANIFEST.md): real room, washroom, window and banquet photos
//   replace the AI room renders. The AI exterior is used only as the 3D-explorer fallback,
//   labelled as an illustration, never as a photo.
// - No real photo of the outdoor function lawn exists. Weddings shows the lawn through copy
//   and capacity figures only.
//
// Files live in public/images/<slug>-<width>.<avif|webp>, made by scripts/optimize-images.mjs.

import meta from './image-meta.json'

export type ImageSlug = keyof typeof meta

export type ImageKind =
  | 'photo' // real photograph of the property
  | 'ai-representative' // AI render shown with a "Representative image" caption
  | 'ai-illustration' // AI illustration, never presented as a photo
  | 'decorative' // texture/background, alt=""
  | 'brand'

export interface SiteImage {
  slug: ImageSlug
  alt: string
  kind: ImageKind
  caption?: string
  width: number
  height: number
  widths: readonly number[]
}

export const REPRESENTATIVE_CAPTION = 'Representative image'

function img(slug: ImageSlug, alt: string, kind: ImageKind = 'photo', caption?: string): SiteImage {
  const { width, height, widths } = meta[slug]
  return { slug, alt, kind, caption, width, height, widths }
}

/** `srcset` string for one format, e.g. srcset(image, 'avif'). */
export function srcset(image: SiteImage, format: 'avif' | 'webp'): string {
  return image.widths.map((w) => `/images/${image.slug}-${w}.${format} ${w}w`).join(', ')
}

/** Fallback `src` (WebP at the width closest to 1024). */
export function fallbackSrc(image: SiteImage): string {
  const w = image.widths.reduce((a, b) => (Math.abs(b - 1024) < Math.abs(a - 1024) ? b : a))
  return `/images/${image.slug}-${w}.webp`
}

export const images = {
  brand: {
    logo: img('logo-badge', 'Hotel Dream Heaven’s logo: gold DH monogram in a round walnut-wood badge', 'brand'),
  },

  home: {
    hero: img(
      'exterior-front-steps',
      'Entrance of Hotel Dream Heaven’s on Agra Road, Bassi, Jaipur: a blue-glass and wood-clad facade with the vertical Hotel Dream Heavens & Restaurant sign, a marble forecourt, reflecting pools and a wide flight of stone steps under a blue sky',
    ),
    roomsTeaser: img(
      'corridor-chandelier',
      'Guest-room corridor with a crystal chandelier in a layered cove-lit ceiling, white panelled walls with brass wall lights, dark doors and a polished marble floor leading to a bright window',
      'ai-representative',
      REPRESENTATIVE_CAPTION,
    ),
    diningTeaser: img('light-brass-lantern', 'Hand-finished brass lantern pendant hanging beneath a striped wood ceiling'),
    weddingsTeaser: img(
      'banquet-hall-grand',
      'Empty indoor banquet hall with a layered wood and walnut ceiling edged in warm cove lighting, jali panels and amber pendant lights, white panelled walls, square columns and a glossy marble floor',
      'ai-representative',
      REPRESENTATIVE_CAPTION,
    ),
    location: img(
      'hotel-exterior-modern-day',
      'Hotel Dream Heavens & Restaurant by day: a corner building with a wood-clad tower carrying the vertical hotel sign, a gold and blue-glass facade with the round DH logo, a canopied entrance with stone steps and potted palms, under a blue sky with clouds',
      'ai-representative',
      REPRESENTATIVE_CAPTION,
    ),
    explorerFallback: img(
      'illustration-exterior-golden-hour',
      'Illustration of Hotel Dream Heaven’s at golden hour (artist’s impression, not a photograph)',
      'ai-illustration',
      'Illustration, not a photograph',
    ),
  },

  // Real room photos (the washroom is a representative image). The bed size in each frame does not show which room type it is, so the
  // alt text describes a guest room generically rather than naming Deluxe or Super Deluxe.
  rooms: {
    deluxe: img(
      'room-real-bed',
      'Guest room at Hotel Dream Heaven’s, Bassi: bed with a padded headboard between two curtained windows, grey stone-finish wall panel, wall-mounted AC and a wooden ceiling fan in a cove-lit ceiling',
    ),
    superDeluxe: img(
      'room-real-wide',
      'Guest room at Hotel Dream Heaven’s, Bassi: large bed with a marble-finish frame, walnut door, wall-mounted AC and ceiling fan with cove lighting',
    ),
    realRoom: img(
      'washroom-marble',
      'Attached washroom: grey marble-finish tiled walls and floor, square chrome rain shower, wall-mounted WC, vessel basin with wall-mounted tap, framed mirror and towel rack',
      'ai-representative',
      REPRESENTATIVE_CAPTION,
    ),
  },

  dining: {
    hero: img('light-lantern-walkway', 'Row of pierced-brass lanterns along a glazed walkway, with greenery visible outside'),
    kitchen: img(
      'kitchen-steel-ranges',
      'Restaurant kitchen at Hotel Dream Heaven’s: stainless-steel gas ranges under extraction hoods, a central prep counter, shelves of steel utensils and a tiled floor with a drain channel',
    ),
  },

  weddings: {
    hero: img(
      'banquet-marble-chandeliers',
      'Banquet hall with a mirror-polished marble floor, crystal chandeliers, carved jali ceiling panels and a framed floral mural',
    ),
    detail: img('light-tulip-chandelier', 'Gold-ringed chandelier with tulip-shaped glass shades, with a framed mural below'),
  },

  about: {
    hero: img(
      'exterior-angled-wing',
      'Hotel Dream Heaven’s in Bassi seen from the corner, showing the glass tower with its vertical sign and the long two-storey wing beside it',
    ),
    arrival: img(
      'lobby-reception-desk',
      'Hotel reception desk: white marble counter on a walnut base, framed by sculpted leaf-shaped pillars and pendant lights',
    ),
    wood: img(
      'lobby-wood-ceiling-lift',
      'Lift lobby under a stepped wood ceiling with warm cove lighting and lanterns, beside the glass-railed staircase',
    ),
    muralPeacock: img(
      'mural-peacock-palace',
      'Wall mural of peacocks beside a lake palace with domed pavilions at sunset, in a stone-textured frame',
    ),
    muralPeony: img('mural-peony-birds', 'Wall mural of golden peonies and blossom branches with birds in flight over misty hills'),
  },

  contact: {
    arrival: img(
      'exterior-wide-forecourt',
      'Hotel Dream Heaven’s seen across its large paved forecourt off the Agra Road in Bassi: the glass tower with the vertical hotel sign, the entrance steps and open space to park',
    ),
  },

  decorative: {
    palms: img('bg-palms-cream', '', 'decorative'),
    peonies: img('bg-peonies-cream', '', 'decorative'),
  },
} as const

export type GalleryCategory = 'Exterior' | 'Lobby' | 'Rooms & Corridors' | 'Banquet' | 'Lighting' | 'Murals'

export interface GalleryItem {
  image: SiteImage
  category: GalleryCategory
}

// Scenes not used elsewhere on the site, grouped by source folder.
export const gallery: GalleryItem[] = [
  {
    category: 'Exterior',
    image: img(
      'exterior-gate-forecourt',
      'Approach to Hotel Dream Heaven’s from the Agra Road gate: the paved forecourt where guests park, the entrance steps and the glass-fronted building',
    ),
  },
  {
    category: 'Lobby',
    image: img(
      'lobby-jali-chandelier',
      'Lobby ceiling with a laser-cut wooden jali panel and an ivory glass chandelier, framed murals along the walls',
    ),
  },
  {
    category: 'Rooms & Corridors',
    image: img(
      'corridor-wood-ceiling',
      'Long symmetrical guest corridor with a wood-panelled ceiling, brass wall lights and framed wall mouldings',
    ),
  },
  {
    category: 'Rooms & Corridors',
    image: img('corridor-oval-ceiling-lift', 'Lift landing with an oval cove-lit ceiling opening onto a guest corridor'),
  },
  {
    category: 'Rooms & Corridors',
    image: img('stairwell-looking-up', 'Looking up the stairwell: glass balustrades with a wooden handrail rising floor after floor'),
  },
  {
    category: 'Rooms & Corridors',
    image: img('staircase-glass-rail', 'Granite staircase with a glass balustrade and wooden handrail beside tall slim windows'),
  },
  {
    category: 'Rooms & Corridors',
    image: img('room-window-view', 'Guest-room window framed by yellow curtains, looking out over open grounds and trees'),
  },
  {
    category: 'Banquet',
    image: img(
      'banquet-murals-jali-ceiling',
      'Indoor banquet hall seen end to end: carved jali ceiling panels with chandeliers, framed peacock and palm murals, and a polished marble floor with inlaid black borders',
    ),
  },
  {
    category: 'Banquet',
    image: img('banquet-long-view', 'Full length of the banquet hall with a wood ceiling, hanging lanterns and a polished marble floor'),
  },
  {
    category: 'Lighting',
    image: img('light-crystal-pendant', 'Crystal pendant light with sculpted arms, set against a textured silver ceiling'),
  },
  {
    category: 'Lighting',
    image: img('light-wall-sconce', 'Crystal and brass wall sconce in a guest corridor, with the wood ceiling running into the distance'),
  },
  {
    category: 'Murals',
    image: img('mural-wishing-tree', 'Relief mural of a golden wishing tree with a cow and calf, a peacock and lotus flowers'),
  },
  { category: 'Murals', image: img('mural-sunrise-peaks', 'Wall mural of a golden sun rising over layered mountain peaks') },
  { category: 'Murals', image: img('mural-palms', 'Wall mural of palms and tropical trees in soft cream and sage tones') },
  { category: 'Murals', image: img('mural-lotus', 'Wall mural of pink and white lotus flowers with broad green leaves') },
]
