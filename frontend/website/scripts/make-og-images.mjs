// Makes public/og/<slug>.jpg (1200x630) for the per-page Open Graph / Twitter images.
// Slugs must match `socialSlug` in src/seo/schema.ts. Run: npm run og
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const slugs = [
  'room-window-view',
  'light-brass-lantern',
  'banquet-marble-chandeliers',
  'lobby-jali-chandelier',
  'exterior-angled-wing',
  'exterior-wide-forecourt',
]
await mkdir(join(root, 'public/og'), { recursive: true })
for (const slug of slugs) {
  await sharp(join(root, `public/images/${slug}-1600.webp`))
    .resize(1200, 630, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(join(root, `public/og/${slug}.jpg`))
  console.log(`public/og/${slug}.jpg`)
}
