// Server entry for scripts/prerender.mjs (built with `vite build --ssr`). No CSS or font imports.
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { prerender } from 'react-dom/static'
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from 'react-router'
import { routes } from './router'
import { SITE_URL } from './seo/fit'

export { routeMeta, indexablePaths } from './seo/routes'
export { sitemapImagesFor } from './seo/schema'
export { pageMeta, headTagsHtml } from './seo/meta'
export { SITE_URL, absoluteUrl } from './seo/fit'
export { hotel, nav } from './data/hotel'
export { rooms, roomAmenities } from './data/rooms'
export { venues } from './data/events'
export { faqs, pageFaqs } from './data/faqs'
export { policies } from './data/policies'
export { facilities } from './data/facilities'
export { meals, cuisineHighlights } from './data/dining'

export async function render(path: string): Promise<{ html: string; status: number }> {
  const handler = createStaticHandler(routes)
  const context = await handler.query(new Request(`${SITE_URL}${path}`))
  if (context instanceof Response) throw new Error(`${path}: unexpected ${context.status} response`)
  const router = createStaticRouter(handler.dataRoutes, context)
  const app = () => (
    <StrictMode>
      <StaticRouterProvider router={router} context={context} />
    </StrictMode>
  )
  // First pass waits for every React.lazy() chunk (e.g. the booking form) to load. The second pass
  // then renders them inline, so the HTML has their content instead of a Suspense fallback.
  await prerender(app())
  const html = renderToString(app())
  return { html, status: context.statusCode }
}
