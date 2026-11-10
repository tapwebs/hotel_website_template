// Post-build prerender. Renders every route in src/seo/routes.ts to static HTML with its own
// head tags and JSON-LD, then writes sitemap.xml, robots.txt and llms-full.txt from the same data.
// Run after `vite build` and `vite build --ssr src/entry-server.tsx --outDir dist-ssr`.
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const ssrDir = join(root, 'dist-ssr')

// Browser-only feature checks that read navigator during render get an empty object
// when the runtime has none, and fall back to the static path instead of throwing.
globalThis.navigator ??= {}

const ssr = await import(pathToFileURL(join(ssrDir, 'entry-server.js')).href)
const { render, sitemapImagesFor, routeMeta, indexablePaths, pageMeta, headTagsHtml, absoluteUrl, SITE_URL } = ssr

const template = await readFile(join(dist, 'index.html'), 'utf8')
if (!template.includes('<div id="root"></div>')) throw new Error('dist/index.html has no empty #root (already prerendered?)')

// Preload the two latin faces used above the fold (body text and display headings).
const assets = await readdir(join(dist, 'assets'))
const fontPreloads = [/^manrope-latin-400-normal-.*\.woff2$/, /^cormorant-garamond-latin-500-normal-.*\.woff2$/]
  .map((re) => assets.find((f) => re.test(f)))
  .filter(Boolean)
  .map((f) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/${f}">`)

// React 19 emits <title>/<meta>/<link> from <Seo> into the body string; the head gets them instead.
const HOISTED = [
  /<title>[\s\S]*?<\/title>/g,
  /<meta (?:name|property)="(?:description|robots|creator|og:title|og:description|og:url|twitter:title|twitter:description|og:image:alt|og:image:width|og:image:height|og:image|twitter:image:alt|twitter:image)"[^>]*\/?>/g,
  /<link rel="canonical"[^>]*\/?>/g,
  /<link rel="alternate" hreflang=[^>]*\/?>/g,
]
const stripHoisted = (html) => HOISTED.reduce((h, re) => h.replace(re, ''), html)

/** Preload for the page's LCP image: the AVIF source of the <picture> holding the fetchpriority="high" img. */
function lcpPreload(html) {
  const pic = html.match(/<picture>(?:(?!<\/picture>)[\s\S])*?fetchPriority="high"[\s\S]*?<\/picture>/i)?.[0]
  const avif = pic?.match(/<source type="image\/avif" srcSet="([^"]+)" sizes="([^"]+)"/i)
  return avif
    ? `<link rel="preload" as="image" type="image/avif" imagesrcset="${avif[1]}" imagesizes="${avif[2]}" fetchpriority="high">`
    : ''
}

function outFile(path) {
  if (path === '/') return join(dist, 'index.html')
  if (path === '/404') return join(dist, '404.html')
  return join(dist, path.slice(1), 'index.html')
}

let failed = false
for (const path of Object.keys(routeMeta)) {
  if (routeMeta[path].prerender === false) {
    console.log(`skipped ${path} (prerender: false)`)
    continue
  }
  try {
    const { html } = await render(path)
    const body = stripHoisted(html)
    if (!body.trim()) throw new Error('rendered empty HTML')
    const head = [headTagsHtml(pageMeta(path)), ...fontPreloads, lcpPreload(body)].filter(Boolean).join('\n    ')
    const page = template
      .replace(/<!-- Fallbacks for the dev server[\s\S]*?-->\s*/, '')
      .replace(/<meta\s+data-prerender\s+(?:property|name)="(?:og:image[^"]*|twitter:image)"[^>]*>\s*/g, '')
      .replace(/<title data-prerender>[\s\S]*?<\/title>\s*/, '')
      .replace(/<meta\s+data-prerender\s+name="description"[^>]*>\s*/, '')
      .replace('</head>', () => `  ${head}\n  </head>`)
      .replace('<div id="root"></div>', () => `<div id="root">${body}</div>`)
    if (page.match(/name="description"/g)?.length !== 1) throw new Error('expected exactly one meta description')
    const file = outFile(path)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, page)
    console.log(`prerendered ${path} -> ${file.slice(root.length + 1)} (${Math.round(page.length / 1024)} kB)`)
  } catch (err) {
    failed = true
    console.error(`prerender failed for ${path}:`, err)
  }
}
if (failed) process.exit(1)

// Sitemap and robots come from the same table: only indexable routes, no fake lastmod/priority.
// The xml-stylesheet line makes browsers show /sitemap.xsl (styled page); crawlers read the plain XML.
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${indexablePaths.map((p) => `  <url><loc>${absoluteUrl(p)}</loc>${sitemapImagesFor(p).map((u) => `<image:image><image:loc>${u}</image:loc></image:image>`).join('')}</url>`).join('\n')}
</urlset>
`
await writeFile(join(dist, 'sitemap.xml'), sitemap)

// One group for every bot: a crawler that matches a named group ignores `*`, so the rules must be shared.
// Search and AI answer crawlers are allowed. Only the private/app paths are blocked (all noindex anyway).
const bots = [
  'Googlebot',
  'Bingbot',
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot',
  'Applebot-Extended',
  'Amazonbot',
  'DuckAssistBot',
  '*',
]
// /dining/ (with slash) is the guest ordering app; /dining itself stays crawlable.
const privatePaths = ['/account', '/book', '/login', '/signup', '/admin', '/app/', '/api/', '/hub/', '/dine/', '/dining/']
const robots = `${bots.map((b) => `User-agent: ${b}`).join('\n')}
Allow: /
${privatePaths.map((p) => `Disallow: ${p}`).join('\n')}

Sitemap: ${SITE_URL}/sitemap.xml
`
await writeFile(join(dist, 'robots.txt'), robots)

// llms-full.txt: llms.txt plus every FAQ and policy, generated so it can't go stale.
const { hotel, rooms, roomAmenities, venues, faqs, pageFaqs, policies, facilities, meals, cuisineHighlights } = ssr
const qa = (list) => list.map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n')
// Topic FAQs, grouped under the page that shows them (label and URL from the route table).
const topicFaqs = Object.entries(pageFaqs)
  .map(([path, list]) => `## ${routeMeta[path].label}: questions (${absoluteUrl(path)})\n\n${qa(list)}`)
  .join('\n\n')
const llms = await readFile(join(dist, 'llms.txt'), 'utf8')
const full = `${llms.split('\n## Optional')[0].trim()}

## Rooms

${rooms.map((r) => `- ${r.name}: ₹${r.rate.toLocaleString('en-IN')} a night. ${r.bed}, ${r.occupancy.toLowerCase()}. ${r.summary}`).join('\n')}
- In every room: ${roomAmenities.join(', ')}.

## Venues

${venues.map((v) => `- ${v.name}: ${v.capacityLabel.split(', ')[1]} ${v.capacity} guests. ${v.detail}`).join('\n')}

## Dining

${[...meals, ...cuisineHighlights].map((m) => `- ${m.name}: ${m.detail}`).join('\n')}

## Facilities

${facilities.map((f) => `- ${f.name}${f.comingSoon ? ' (coming soon)' : ''}: ${f.detail}`).join('\n')}

## Policies

${policies.map((p) => `- ${p.title}: ${p.value}. ${p.detail}`).join('\n')}

## Frequently asked questions (${absoluteUrl('/contact')}#faqs)

${qa(faqs)}

${topicFaqs}

## Contact

- Phone and WhatsApp: ${hotel.phoneDisplay}, ${hotel.phoneDisplaySecondary}
- Email: ${hotel.email}
- Instagram: ${hotel.instagramUrl}
- Address: ${hotel.address.street}, ${hotel.address.landmark.toLowerCase()}, ${hotel.address.city}, ${hotel.address.region}, ${hotel.address.country}

Website designed and developed by Tapwebs (https://tapwebs.in).
`
await writeFile(join(dist, 'llms-full.txt'), full)

await rm(ssrDir, { recursive: true, force: true })
console.log(`sitemap.xml (${indexablePaths.length} URLs), robots.txt, llms-full.txt written`)

// No pre-compressed .br/.gz files: Hostinger serves a sibling `x.js.br` as `x.js` and then compresses it
// again, so browsers got double-encoded JS, nothing ran, and the 3D view never loaded. The server compresses on the fly.
async function dropWoff(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    // Every browser that matters loads the .woff2 from the same @font-face; the .woff fallbacks are never requested.
    if (entry.isDirectory()) await dropWoff(fullPath)
    else if (entry.name.endsWith('.woff')) await rm(fullPath)
  }
}
await dropWoff(dist)
