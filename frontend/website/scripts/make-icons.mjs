// Favicons (round crop of the logo badge) and the Open Graph image (DESIGN-PLAN §10).
// Reads originals, never writes to images/ or images/ai-generated/. Run: node scripts/make-icons.mjs
import sharp from 'sharp'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Originals live in frontend/images.
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const LOGO = join(REPO, 'images/ai-generated/logo-dream-heavens-wood-badge.jpg')
const OG_SRC = join(REPO, 'images/exterior/exterior-01.jpg')

const circle = (size) =>
  Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`)

async function roundIcon(size, out) {
  await sharp(LOGO)
    .resize(size, size, { fit: 'cover' })
    .composite([{ input: circle(size), blend: 'dest-in' }])
    .png({ palette: true, quality: 80 })
    .toFile(out)
}

await roundIcon(32, 'public/favicon-32.png')
await roundIcon(192, 'public/icon-192.png')
// Apple touch icons should be opaque.
await sharp(LOGO)
  .resize(180, 180, { fit: 'cover' })
  .flatten({ background: '#f6efe4' })
  .png({ palette: true, quality: 80 })
  .toFile('public/apple-touch-icon.png')

await sharp(OG_SRC)
  .rotate()
  .resize(1200, 630, { fit: 'cover', position: 'attention' })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile('public/og-image.jpg')

console.log('icons + og image written to public/')
