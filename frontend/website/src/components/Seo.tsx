import { headTags, pageMeta } from '@/seo/meta'
import { JsonLd } from '@/seo/JsonLd'
import { schemaFor } from '@/seo/schema'

interface SeoProps {
  path: string
  /** Used only when `path` is not in src/seo/routes.ts. */
  title?: string
  /** Used only when `path` is not in src/seo/routes.ts. */
  description?: string
}

// JSX spells the attribute hrefLang; the prerender HTML string keeps the plain hreflang.
const jsxAttrs = ({ hreflang, ...rest }: Record<string, string>) => (hreflang ? { ...rest, hrefLang: hreflang } : rest)

/** Per-route head tags (React 19 hoists them into <head>) plus the page's JSON-LD. */
export function Seo({ path, title, description }: SeoProps) {
  const schema = schemaFor(path)
  return (
    <>
      {headTags(pageMeta(path, { title, description })).map(({ tag: Tag, attrs, text }, i) =>
        Tag === 'title' ? <title key={i}>{text}</title> : <Tag key={i} {...jsxAttrs(attrs)} />,
      )}
      {schema ? <JsonLd data={schema} /> : null}
    </>
  )
}
