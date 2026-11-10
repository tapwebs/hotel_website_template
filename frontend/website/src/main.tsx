import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { createBrowserRouter, matchRoutes } from 'react-router'
import '@fontsource/cormorant-garamond/latin-500.css'
import '@fontsource/cormorant-garamond/latin-ext-500.css'
import '@fontsource/cormorant-garamond/latin-600.css'
import '@fontsource/cormorant-garamond/latin-ext-600.css'
import '@fontsource/cormorant-garamond/latin-500-italic.css'
import '@fontsource/cormorant-garamond/latin-ext-500-italic.css'
import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-ext-400.css'
import '@fontsource/manrope/latin-500.css'
import '@fontsource/manrope/latin-ext-500.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-ext-600.css'
import '@fontsource/noto-serif-devanagari/devanagari-400.css'
import '@fontsource/noto-serif-devanagari/devanagari-500.css'
import './index.css'
import App from './App.tsx'
import { routes } from './router'

async function start() {
  const root = document.getElementById('root')!
  // Resolve the lazy page for this URL first, so the first client render matches the prerendered HTML.
  for (const m of matchRoutes(routes, window.location) ?? []) {
    const { lazy } = m.route
    if (typeof lazy === 'function') Object.assign(m.route, await lazy(), { lazy: undefined })
  }
  const router = createBrowserRouter(routes)
  // Prerendered head tags are replaced by the ones <Seo> renders.
  document.head.querySelectorAll('[data-prerender]').forEach((el) => el.remove())
  const app = (
    <StrictMode>
      <App router={router} />
    </StrictMode>
  )
  if (root.hasChildNodes()) hydrateRoot(root, app)
  else createRoot(root).render(app)
}

void start()
