# Hotel Dream Heaven’s

Marketing site for Hotel Dream Heaven’s, a budget hotel with a restaurant in Bassi, Jaipur. Live at https://hoteldreamheavens.in.

## Stack

Vite 8, React 19, TypeScript, Tailwind CSS 4, react-router 7, static prerender. Tests: Vitest. Lint: oxlint. Format: Prettier.

## Scripts

| Script                            | What it does                                  |
| --------------------------------- | --------------------------------------------- |
| `npm run dev`                     | Dev server                                    |
| `npm run build`                   | Typecheck, client build, SSR build, prerender |
| `npm run preview`                 | Serve the built site                          |
| `npm test`                        | Vitest, single run                            |
| `npm run lint`                    | oxlint                                        |
| `npm run typecheck`               | `tsc -b`                                      |
| `npm run format` / `format:check` | Prettier write / check                        |
| `npm run images`                  | Optimize source photos into `public/images`   |
| `npm run icons`                   | Generate favicons and app icons               |

Use Node 24 (see `.nvmrc`).

## Structure

- `src/routes` pages, `src/components` UI, `src/data` content and image manifest
- `src/seo` meta tags, JSON-LD, route list
- `scripts` image, icon and prerender tooling
- `public` static assets (images, llms.txt, manifest, `.htaccess`)
- deployment, competitor and feature docs live in the `docs`

## Build and prerender

`npm run build` type-checks, builds the client bundle, builds an SSR bundle from `src/entry-server.tsx` into `dist-ssr`, then `scripts/prerender.mjs` writes static HTML for every route into `dist`.

## Images

Originals live in `images` (AI-generated ones in `images/ai-generated`). Run `npm run images`. It emits AVIF and WebP at multiple widths into `public/images`, rendered by the `Picture` component.

## SEO assets

`sitemap.xml`, `robots.txt` and `llms-full.txt` are generated into `dist` by the prerender step (from `src/seo/routes.ts` and `src/data`); `llms.txt` is hand-written in `public`, so update it when pages, prices or contact details change. Per-page meta and JSON-LD come from `src/seo`.

## Environment

Copy `.env.example` to `.env`. `VITE_AUTH_API_URL` (commented by default) is the base URL of the auth API. When you set it, also add that exact origin (scheme+host[+port]) to `connect-src` in `public/.htaccess`, or the browser's CSP will block the requests. `VITE_SITE_URL` (commented by default) sets the canonical origin used for canonicals, sitemap and JSON-LD at build time; it defaults to the production URL.

## Deploy

Hosting is Hostinger shared web hosting (Apache/LiteSpeed). Run `npm run build`, then upload the contents of `dist/` to `public_html`, including the hidden `dist/.htaccess` (HTTPS and www redirects, clean URLs, real 404, cache and security headers, CSP). Deployment happens later; step-by-step guide, CSP notes and the post-deploy smoke tests are in [docs/DEPLOY.md](docs/DEPLOY.md).

## Docs

- [docs/COMPETITORS.md](docs/COMPETITORS.md) competitor notes
- [docs/FEATURES.md](docs/FEATURES.md) required vs optional features
- [docs/DEPLOY.md](docs/DEPLOY.md) hosting config

## Auth and privacy

Login and signup pages exist as UI only (no dashboards). They need `VITE_AUTH_API_URL` and the API in `../backend` (see its README; locally use `VITE_AUTH_API_URL=http://localhost:3001`). The API issues no session yet, so a successful login only shows a confirmation. A privacy policy page is part of the site.
