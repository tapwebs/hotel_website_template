import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import meta from './image-meta.json'
import { gallery, images, type SiteImage } from './images'

const all: SiteImage[] = [...Object.values(images).flatMap((group) => Object.values(group) as SiteImage[]), ...gallery.map((g) => g.image)]

describe('image map', () => {
  it('uses every optimised scene exactly once', () => {
    const slugs = all.map((i) => i.slug).sort()
    expect(slugs).toEqual(Object.keys(meta).sort())
  })

  it('points at files that exist, AVIF and WebP for every width', () => {
    for (const i of all)
      for (const w of i.widths)
        for (const ext of ['avif', 'webp']) expect(existsSync(`public/images/${i.slug}-${w}.${ext}`), `${i.slug}-${w}.${ext}`).toBe(true)
  })

  it('gives every content image real alt text', () => {
    for (const i of all) if (i.kind !== 'decorative') expect(i.alt.length, i.slug).toBeGreaterThan(20)
  })
})
