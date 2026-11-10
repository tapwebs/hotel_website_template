import { describe, expect, it } from 'vitest'
import { DESCRIPTION_RANGE, fitTitle, SITE_NAME, TITLE_RANGE } from './fit'
import { headTags, jsonLdString, pageMeta } from './meta'
import { indexablePaths, routeMeta } from './routes'
import { schemaFor } from './schema'
import { faqs, faqsFor, pageFaqs } from '@/data/faqs'
import { hotel } from '@/data/hotel'

describe('fitTitle', () => {
  it('adds the site name to a short title', () => {
    expect(fitTitle(['Luxury Rooms & Suites'])).toBe(`Luxury Rooms & Suites | ${SITE_NAME}`)
  })
  it('drops the site name when it would push the title past 60', () => {
    const long = 'A headline that is already fifty-three characters long'
    expect(fitTitle([long])).toBe(long)
  })
  it('picks the candidate closest to the range', () => {
    expect(fitTitle(['x'.repeat(80), 'Contact & Guest Services'])).toBe(
      `Contact & Guest Services | ${SITE_NAME}`,
    )
  })
})

describe('route table', () => {
  it.each(indexablePaths)('%s has a title and description in range', (path) => {
    const { title, description } = routeMeta[path]
    expect(title.length).toBeGreaterThanOrEqual(TITLE_RANGE.min)
    expect(title.length).toBeLessThanOrEqual(TITLE_RANGE.max)
    expect(description.length).toBeGreaterThanOrEqual(DESCRIPTION_RANGE.min)
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_RANGE.max)
  })
  it('canonical is the page’s own URL, never the home page', () => {
    expect(pageMeta('/rooms').canonical).toBe(`${hotel.url}/rooms`)
    expect(pageMeta('/').canonical).toBe(`${hotel.url}/`)
  })
  it('404 is noindex, follow with no canonical and is not in the sitemap list', () => {
    const tags = headTags(pageMeta('/404'))
    expect(tags.find((t) => t.attrs.name === 'robots')?.attrs.content).toBe('noindex, follow')
    expect(tags.some((t) => t.attrs.rel === 'canonical')).toBe(false)
    expect(indexablePaths).not.toContain('/404')
  })
})

describe('schema', () => {
  it.each(indexablePaths)('%s has a JSON-LD graph', (path) => {
    expect(schemaFor(path)?.['@graph']).toBeInstanceOf(Array)
  })
  it('escapes < so </script> cannot close the tag', () => {
    expect(jsonLdString({ x: '</script>' })).not.toContain('</script>')
  })
  it('home has a Hotel with telephone and address, and the TAPWEBS creator', () => {
    const graph = schemaFor('/')!['@graph'] as Record<string, unknown>[]
    const hotelNode = graph.find((n) => n['@type'] === 'Hotel')!
    expect(hotelNode.telephone).toEqual(['+91-0000000000', '+91-0000000001'])
    expect(hotelNode.address).toMatchObject({ addressLocality: hotel.address.city, addressRegion: hotel.address.region })
    expect(graph.find((n) => n['@type'] === 'WebSite')?.creator).toMatchObject({ name: 'TAPWEBS' })
  })
  it('emits no rating markup (rating markup is intentionally omitted) and none for 404', () => {
    for (const p of indexablePaths) expect(JSON.stringify(schemaFor(p))).not.toMatch(/aggregateRating|"Review"/)
    expect(schemaFor('/404')).toBeNull()
  })
  it('rooms page has one HotelRoom offer per room', () => {
    expect(JSON.stringify(schemaFor('/rooms')).match(/"HotelRoom"/g)).toHaveLength(2)
  })
})

describe('page FAQs', () => {
  const all = [...faqs, ...Object.values(pageFaqs).flat()]
  it('each question appears on one page only', () => {
    expect(new Set(all.map((f) => f.q)).size).toBe(all.length)
  })
  it.each(
    Object.values(pageFaqs)
      .flat()
      .map((f) => [f.q, f.a]),
  )('"%s" has a 40-60 word answer', (_q, a) => {
    const words = a.split(/\s+/).length
    expect(words).toBeGreaterThanOrEqual(40)
    expect(words).toBeLessThanOrEqual(60)
  })
  it.each(indexablePaths)('%s marks up exactly its visible FAQs', (path) => {
    const faq = (schemaFor(path)!['@graph'] as Record<string, unknown>[]).find((n) => n['@type'] === 'FAQPage')
    const expected = faqsFor(path).map((f) => f.q)
    expect(((faq?.mainEntity as { name: string }[] | undefined) ?? []).map((q) => q.name)).toEqual(expected)
  })
})
describe('/admin route', () => {
  it('is noindex, nofollow, has no canonical, is not prerendered and is not in the sitemap list', () => {
    const tags = headTags(pageMeta('/admin'))
    expect(tags.find((t) => t.attrs.name === 'robots')?.attrs.content).toBe('noindex, nofollow')
    expect(tags.some((t) => t.attrs.rel === 'canonical')).toBe(false)
    expect(routeMeta['/admin'].prerender).toBe(false)
    expect(indexablePaths).not.toContain('/admin')
  })
})
describe('account and booking routes', () => {
  it.each(['/account', '/account/bookings', '/account/profile', '/account/security', '/book', '/book/confirmation'])(
    '%s is noindex, nofollow, has no canonical, is not prerendered and is not in the sitemap list',
    (path) => {
      const tags = headTags(pageMeta(path))
      expect(tags.find((t) => t.attrs.name === 'robots')?.attrs.content).toBe('noindex, nofollow')
      expect(tags.some((t) => t.attrs.rel === 'canonical')).toBe(false)
      expect(routeMeta[path].prerender).toBe(false)
      expect(indexablePaths).not.toContain(path)
    },
  )
})
