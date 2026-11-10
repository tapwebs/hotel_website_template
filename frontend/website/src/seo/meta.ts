// One function for every page's head tags, so title, description, canonical, Open Graph and
// Twitter can't drift apart. <Seo> renders these as JSX; the prerender writes them as HTML.
import { developer } from '@/data/hotel'
import { absoluteUrl, fitDescription, fitTitle, SITE_URL } from './fit'
import { routeMeta } from './routes'
import { socialImageFor } from './schema'

const DEFAULT_IMAGE = {
  url: `${SITE_URL}/banner.jpeg`,
  alt: 'Hotel Dream Heaven’s banner - Luxury rooms, restaurant, banquet hall, and lawn in Bassi, Jaipur',
}

export interface HeadTag {
  tag: 'title' | 'meta' | 'link'
  attrs: Record<string, string>
  text?: string
}

export interface PageMeta {
  title: string
  description: string
  canonical: string | null
  indexable: boolean
  robots?: string
  image: { url: string; alt: string }
}

/** Route-table entry first; props only for paths not in the table. */
export function pageMeta(path: string, fallback: { title?: string; description?: string } = {}): PageMeta {
  const known = routeMeta[path]
  const indexable = known?.indexable ?? false
  return {
    title: known?.title ?? fitTitle([fallback.title ?? 'Page']),
    description: known?.description ?? fitDescription([fallback.description ?? '']),
    // Canonical is always the page's own URL, never a site-wide default. Noindex pages get none.
    canonical: indexable ? absoluteUrl(path) : null,
    indexable,
    robots: known?.robots,
    image: socialImageFor(path) ?? DEFAULT_IMAGE,
  }
}

export function headTags(meta: PageMeta): HeadTag[] {
  const tags: HeadTag[] = [
    { tag: 'title', attrs: {}, text: meta.title },
    { tag: 'meta', attrs: { name: 'description', content: meta.description } },
  ]
  if (meta.canonical) {
    tags.push(
      { tag: 'link', attrs: { rel: 'canonical', href: meta.canonical } },
      // Single-language site: self-referencing hreflang plus x-default.
      { tag: 'link', attrs: { rel: 'alternate', hreflang: 'en-IN', href: meta.canonical } },
      { tag: 'link', attrs: { rel: 'alternate', hreflang: 'x-default', href: meta.canonical } },
    )
  }
  // Indexable pages allow large image previews and full snippets (featured snippets, AI answers).
  tags.push({
    tag: 'meta',
    attrs: {
      name: 'robots',
      content: meta.indexable ? 'index, follow, max-image-preview:large, max-snippet:-1' : (meta.robots ?? 'noindex, follow'),
    },
  })
  tags.push(
    { tag: 'meta', attrs: { property: 'og:title', content: meta.title } },
    { tag: 'meta', attrs: { property: 'og:description', content: meta.description } },
  )
  if (meta.canonical) tags.push({ tag: 'meta', attrs: { property: 'og:url', content: meta.canonical } })
  tags.push(
    { tag: 'meta', attrs: { name: 'twitter:title', content: meta.title } },
    { tag: 'meta', attrs: { name: 'twitter:description', content: meta.description } },
    { tag: 'meta', attrs: { property: 'og:image', content: meta.image.url } },
    { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
    { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
    { tag: 'meta', attrs: { property: 'og:image:alt', content: meta.image.alt } },
    { tag: 'meta', attrs: { name: 'twitter:image', content: meta.image.url } },
    { tag: 'meta', attrs: { name: 'twitter:image:alt', content: meta.image.alt } },
    // Site credit (the schema's WebSite.creator says the same).
    { tag: 'meta', attrs: { name: 'creator', content: `${developer.name} (${developer.url})` } },
  )
  return tags
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** HTML string for the prerender. Each tag carries data-prerender so the client can drop it before hydrating. */
export function headTagsHtml(meta: PageMeta): string {
  return headTags(meta)
    .map(({ tag, attrs, text }) => {
      const a = Object.entries(attrs)
        .map(([k, v]) => ` ${k}="${escapeHtml(v)}"`)
        .join('')
      return tag === 'title' ? `<title data-prerender>${escapeHtml(text ?? '')}</title>` : `<${tag} data-prerender${a}>`
    })
    .join('\n    ')
}

/** JSON for a <script> body. Escaping `<` stops a value containing </script> from closing the tag. */
export const jsonLdString = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c')
