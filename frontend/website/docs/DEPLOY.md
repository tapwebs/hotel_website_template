# Deploying hoteldreamheavens.in on Hostinger

Hosting is Hostinger shared web hosting (hPanel, Apache/LiteSpeed). The site is a static, prerendered build, so there is no server runtime: upload files, done. Deployment happens later; this guide is the checklist for that day.

`npm run build` (in `frontend/`) writes `frontend/dist/`: `index.html`, `<route>/index.html` for every route, `404.html`, hashed `assets/*`, `images/*`, `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`, `manifest.webmanifest` and the server config `.htaccess` (copied from `frontend/public/.htaccess`).

## 1. Build

```bash
nvm use            # Node 24, see .nvmrc
cd frontend
npm ci
npm run build
```

Check that `dist/.htaccess` exists: `ls -a dist | grep htaccess`.

## 2. Upload to public_html

In hPanel open **Files > File Manager** (or use FTP/SFTP with the credentials from **Files > FTP Accounts**) and open `public_html`.

- Upload the **contents** of `dist/`, not the `dist` folder itself, so `public_html/index.html` and `public_html/assets/` exist.
- Include the hidden `.htaccess`. Finder and many FTP clients hide dotfiles: in Finder press `Cmd+Shift+.`, in File Manager enable **Settings > Show hidden files**. Zipping `dist/` and using File Manager's **Extract** keeps it too (`cd dist && zip -r ../site.zip . -x '.DS_Store'`).
- Delete any default `public_html/default.php` or placeholder `index.html` that Hostinger created.
- On later deploys, upload over the old files. Hashed `assets/` from earlier builds can be deleted.

## 3. Enable free SSL and force HTTPS

1. hPanel > **Security > SSL**, install the free SSL for `hoteldreamheavens.in` (it covers `www`) and wait until it shows as active.
2. Turn on **Force HTTPS** in the same screen if offered. `.htaccess` also redirects http to https, so either is fine, and both together do not loop.

## 4. DNS and domain

- If the domain's nameservers are Hostinger's, hPanel sets the `A` record for the apex and a `www` record for you.
- If DNS lives elsewhere, point the apex `A` record to the hosting IP shown in hPanel > **Hosting > Details**, and `www` as a `CNAME` to the apex (or the same `A`).
- Add `hoteldreamheavens.in` as the primary domain of the plan. `www` is handled by `.htaccess`.
- Do not use a Hostinger CDN/proxy toggle that serves a cached older copy while you test; purge it if you turn it on.

## URL policy (what `.htaccess` enforces)

- Apex `https://hoteldreamheavens.in` is canonical. `www.` and `http://` both 301 to it.
- No trailing slash (matches canonicals and `sitemap.xml`): `/rooms/` 301s to `/rooms`, and `/rooms/index.html` 301s to `/rooms`. `/rooms` serves `rooms/index.html` internally.
- One hop, never a chain: the www/http redirects already drop a trailing slash and `/index.html`, so `http://www.hoteldreamheavens.in/rooms/` 301s straight to `https://hoteldreamheavens.in/rooms`. `/faqs-policies` (with or without a slash) 301s straight to `https://hoteldreamheavens.in/contact#faqs`.
- Unknown paths return `404.html` with a real 404 status. Directories without an index (`/assets`, `/images`) also return 404.
- `/admin` is NOT prerendered (client-rendered behind login): it falls back to the SPA shell `index.html`, with `X-Robots-Tag: noindex, nofollow`, and is left out of the sitemap. The API must share a registrable domain with the site (cookies are SameSite=Lax) and allow credentialed CORS. Post-deploy check: `/admin` returns 200 with `X-Robots-Tag: noindex, nofollow`.
- `/login` and `/signup` are prerendered files, served like any route, with `X-Robots-Tag: noindex, nofollow`, and left out of the sitemap. If they stop being prerendered, `.htaccess` falls back to the SPA shell `index.html`.
- Dotfiles (except `.well-known`, needed for SSL validation) and `*.map` files are blocked with 403.

## Caching

| Path                                                                 | Cache-Control                                              |
| -------------------------------------------------------------------- | ---------------------------------------------------------- |
| `/assets/*` (Vite content-hashed JS, CSS, fonts)                     | `public, max-age=31536000, immutable`                      |
| `/images/*` (names not hashed)                                       | `public, max-age=2592000, stale-while-revalidate=31536000` |
| Root icons and `og-image.jpg` (names not hashed)                     | `public, max-age=86400, stale-while-revalidate=604800`     |
| HTML, `sitemap.xml`, `robots.txt`, `llms*.txt`, manifest, `404.html` | `no-cache` (revalidate every request, ETag keeps it cheap) |

Text types are gzip/deflate compressed (and Brotli where the server has `mod_brotli`).

## Security headers

All set by `.htaccess` on every response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, a minimal `Permissions-Policy` (camera, microphone, geolocation, payment, usb off), `Strict-Transport-Security: max-age=31536000` (no `includeSubDomains`, no `preload`: add them only once every subdomain is HTTPS and you are sure), and the CSP below.

### Content-Security-Policy

```
default-src 'self'; script-src 'self' 'sha256-gOx3nRh8znDQR7T1VkI+fFXDgsNzf5enQqdi7NP11Vk='; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src https://www.google.com https://maps.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://wa.me; object-src 'none'; manifest-src 'self'; upgrade-insecure-requests
```

- The hash covers the one inline script (`window.__staticRouterHydrationData = ...`), identical on every page. JSON-LD blocks are `application/ld+json` data and are not governed by `script-src`.
- `style-src 'unsafe-inline'` is needed for `style="..."` attributes (animation and marquee variables). Scripts do not get `unsafe-inline`.
- `frame-src` allows the click-to-load Google Maps iframe. `wa.me`, `mailto:` and `tel:` links need no CSP entry.
- **Analytics (GA4 `G-2H1CX7HDVF`, GTM `GTM-T3VC563J`):** `script-src` also allows `https://www.googletagmanager.com` and the hashes of the two inline scripts in `index.html` (gtag init and GTM loader). `img-src` and `connect-src` allow the Google Analytics collection hosts. Editing either inline script, even whitespace, breaks its hash: recompute it with the same method as below and update `.htaccess`. Without these entries the browser silently blocks analytics.
- **If the inline hydration script changes** (React Router or React upgrade, or an added inline script), rebuild and recompute, then edit the `sha256-...` in `frontend/public/.htaccess` and in this file: `python3 -c "import re,hashlib,base64;h=open('dist/index.html').read();print('sha256-'+base64.b64encode(hashlib.sha256(re.search(r'<script>(window.__static.*?)</script>',h,re.S).group(1).encode()).digest()).decode())"`. A drifting hash shows as a CSP error in the browser console and the page will not hydrate.
- **Backend / auth API (added later):** when `VITE_AUTH_API_URL` is set (see `frontend/.env.example`), add that API origin (for example `https://api.hoteldreamheavens.in`) to `connect-src` in `frontend/public/.htaccess`, e.g. `connect-src 'self' https://api.hoteldreamheavens.in`. Any other new third-party origin (payment widget, analytics) goes into `script-src`/`frame-src`/`connect-src` the same way. Then rebuild and re-upload.

## QR Hub (part of the main app)

Admin at `/admin/qr-hub/*`, public hub at `/hub/<slug>`, scan entry at `/r/<slug>?p=<placement>`. It ships inside the main site build (`src/features/qrhub`), so the normal SPA fallback in `.htaccess` serves it.

1. Run migration `backend/migrations/0003_qr_hub.sql` on the production Postgres (same way as 0001 and 0002), then deploy the backend.
2. Build and upload the main site as usual (no separate QR Hub build).
3. In `frontend/public/.htaccess` replace `API_ORIGIN` in the `^r/(.+)$` rule with the API host (for example `api.hoteldreamheavens.in`). The API origin must also be in `connect-src` (see CSP above). Rebuild and re-upload the main site.
4. Backend env: `SITE_URL=https://hoteldreamheavens.in` (QR targets and redirects) and the existing `ALLOWED_ORIGIN`. GA4/GSC keys are optional.

Smoke tests:
- [ ] `curl -sI "https://hoteldreamheavens.in/r/hotel-dream-heavens?p=lobby"` shows `302` and a `Location` that keeps `p=lobby` (API redirect, then `/hub/hotel-dream-heavens?p=lobby`).
- [ ] `curl -s -o /dev/null -w "%{http_code}\n" https://hoteldreamheavens.in/hub/hotel-dream-heavens` prints `200`.
- [ ] `curl -sI https://hoteldreamheavens.in/admin/qr-hub` shows `200` and `X-Robots-Tag: noindex, nofollow` (same for `/hub/...`).
- [ ] Logged out, `/admin/qr-hub` redirects to `/login?next=/admin/qr-hub`; the admin sidebar has a "QR Hub" item.
- [ ] Browser: a QR preview renders in the admin with no CSP errors (`img-src` allows `data:` and `blob:`).

## Hostinger caveats

- `.htaccess` only works on Apache or LiteSpeed (what Hostinger shared hosting runs). On a server that is neither (for example a different plan type or a self-managed VPS), the `Header`, redirect and cache rules are **silently ignored**, so the security headers, HTTPS/www redirects, clean URLs and the 404 status will not apply. Run the smoke tests below to confirm they do.
- Each block is wrapped in `<IfModule>`, so a missing module disables that block instead of returning a 500. If the whole site returns a 500 after upload, rename `.htaccess` temporarily to confirm, then check hPanel > **Advanced > Error Logs**. The usual cause is a directive the plan's `AllowOverride` does not permit (`Options`); delete that line.
- LiteSpeed reads `.htaccess` changes automatically; Apache does too. No restart needed.

## Replacing a pre-launch page

If a hand-uploaded pre-launch page (for example an "Opening soon" `index.html`) is live, the upload below replaces it. Before and after:

- Upload the **contents** of `dist/` including the hidden `.htaccess`. Overwrite the old `index.html`; delete leftover teaser files that `dist/` does not contain.
- Purge the host/CDN cache after the upload (Hostinger serves through its own CDN, so stale pages can persist).
- Confirm the new home page, not the old one: `curl -s https://hoteldreamheavens.in/ | grep -ci 'rel="canonical"\|application/ld+json'` must be non-zero, and `curl -s https://hoteldreamheavens.in/ | grep -ci 'grand opening'` must be `0` unless you want that wording.
- Do not submit `sitemap.xml` in Search Console until `/sitemap.xml` returns 200.

## Post-deploy smoke tests

Run these after the first upload and after any change to `.htaccess`.

- [ ] All 8 public URLs return 200 over https: `/`, `/rooms`, `/dining`, `/weddings-events`, `/gallery`, `/about`, `/contact`, `/privacy-policy`. Plus `/login` and `/signup` (200, noindex).
      `for p in "" rooms dining weddings-events gallery about contact privacy-policy login signup; do curl -s -o /dev/null -w "%{http_code} /$p\n" https://hoteldreamheavens.in/$p; done`
- [ ] `/faqs-policies` (merged into Contact) returns 301 to `/contact#faqs`: `curl -sI https://hoteldreamheavens.in/faqs-policies | grep -i location`.
- [ ] Unknown path is a real 404 with the site's 404 page: `curl -sI https://hoteldreamheavens.in/nonexistent | head -1` shows `404`.
- [ ] http redirects to https: `curl -sI http://hoteldreamheavens.in/rooms` shows `301` and `Location: https://hoteldreamheavens.in/rooms`.
- [ ] www redirects to apex: `curl -sI https://www.hoteldreamheavens.in/rooms` shows `301` and `Location: https://hoteldreamheavens.in/rooms`.
- [ ] Trailing slash: `curl -sI https://hoteldreamheavens.in/rooms/` shows `301` to `/rooms` and there is no redirect loop.
- [ ] No redirect chain: `curl -sIL http://www.hoteldreamheavens.in/rooms/ | grep -ci '^location'` prints `1`.
- [ ] Security headers present: `curl -I https://hoteldreamheavens.in/` shows `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. And `curl -I https://hoteldreamheavens.in/login` also shows `X-Robots-Tag: noindex, nofollow`.
- [ ] Caching: a file in `/assets/` returns `immutable`; `/` returns `no-cache`; responses show `Content-Encoding: gzip` (or `br`) with `curl -sI -H 'Accept-Encoding: gzip, br' ...`.
- [ ] `/sitemap.xml`, `/robots.txt`, `/llms.txt` open and show `hoteldreamheavens.in` URLs.
- [ ] `/.htaccess` and any `/assets/*.map` return 403 or 404, never the file.
- [ ] In a browser: open `/contact`, click the map's load button; the Google Map appears and the console shows no CSP errors on any page. Click the WhatsApp link, it opens `wa.me`.
- [ ] Search Console (later): add the `hoteldreamheavens.in` domain property, verify via DNS, submit `https://hoteldreamheavens.in/sitemap.xml`.
