# Hotel Dream Heavens API

Signup/login, guest account and booking API for the frontend. Node 24 + TypeScript, Fastify and zod only.

## Code layout
```
src/
  server.ts            entry point (reads env, builds the app)
  app.ts               buildApp(): wires stores, guards and routes
  core/                http helpers, sessions, password hashing, db pool, user-agent classifier
  domain/              bookings (pricing, dates), zod schemas, QR Hub JSON/CSV helpers
  stores/              UserStore and QrStore (memory + Postgres), test database helper
  routes/              account, admin, admin-bookings, qr-hub (+ their tests)
  integrations/        HMS sync and staff bridge, GA4, Search Console, config
  scripts/             migrate, create-admin
migrations/            SQL, applied in order by `npm run migrate`
```

## Endpoints
JSON in and out. Cookie-authenticated calls need `credentials: 'include'`. Full contract: `.agents/tasks/admin-dashboard-plan.md` section 3 (admin) and `.agents/tasks/account-dashboard-plan.md` section 3 (account and bookings). Details, schema and seams: `docs/ACCOUNT_BOOKINGS.md`.
| Method and path | Notes |
| --- | --- |
| `GET /health` | `{status:"ok"}` |
| `POST /auth/signup` | `{name, email, phone: "+91"+10 digits, password (8+), consent: true}` -> 201, 400, 409 `email_taken`, 429. Creates a `guest`, issues no session |
| `POST /auth/login` | `{email, password, remember?}` -> 200 `{ok, user}` + `hdh_session` cookie, 400, 401, 403 `account_disabled`, 429 |
| `GET /auth/me` | 200 `{user}` or 401 |
| `POST /auth/logout` | 204 always; Origin must match `ALLOWED_ORIGIN` |
| `GET /admin/users` | admin only. `page, pageSize, q, role, status, sort, order` |
| `GET /admin/users/:id` | admin only |
| `PATCH /admin/users/:id/role` | `{role}`; 409 `self_modification_forbidden` / `last_admin` |
| `PATCH /admin/users/:id/status` | `{status}`; disabling kills that user's sessions |
| `GET /admin/stats` | totals, signups, lifecycle (incl. `everBooked`), `bookings` counts, 30 days of signups |
| `GET /admin/bookings` | admin only. `page, pageSize (<=100), q, status, paymentStatus, from, to, sort (createdAt\|checkIn\|totalAmount), order` -> `{items: AdminBooking[], page, pageSize, total, totalPages}` |
| `PATCH /admin/bookings/:id` | admin only. At least one of `status, paymentStatus, externalHmsBookingId, externalPosFolioId`; 409 `invalid_transition` / `external_id_taken` |
| `GET /me/profile`, `PATCH /me/profile` | any signed-in role. Name, phone, address, preferences, marketing opt-in. Email is not editable |
| `POST /me/password` | `{currentPassword, newPassword}`; 422 on wrong current password, revokes the user's other sessions, 429 |
| `DELETE /me` | `{password}`; guests only; 409 `upcoming_bookings` / `not_allowed_for_role`; clears the cookie |
| `GET /me/bookings` | `page, pageSize (<=50), filter (all\|upcoming\|past\|cancelled)` -> items, paging, `counts` |
| `GET /me/bookings/:id` | 404 for a missing booking AND for another user's booking |
| `POST /me/bookings` | `{requestId?, roomId, checkIn, checkOut, rooms, adults, children?, extraBed?, specialRequests?}` -> 201 (200 on a replayed `requestId`), 409 `booking_limit`, 429. Totals are never accepted from the client |
| `POST /me/bookings/:id/cancel` | no body; 200 (also when already cancelled), 409 `not_cancellable` |
Errors (admin and `/me`): 401 `unauthenticated`, 403 `forbidden` / `forbidden_origin`, 404 `not_found`, 409, 422 `validation_failed` with `issues`.
## QR Hub
Multi-organization QR landing pages (migration `0003_qr_hub.sql`, seeded with Hotel Dream Heaven's). Code: `src/routes/qr-hub.ts` (routes), `src/stores/qr-store.ts` (Postgres), `src/domain/qr-hub-io.ts` (JSON import/export, CSV, opening hours), `src/core/ua.ts` (user-agent classifier), `src/integrations/{ga4,gsc,google}.ts`. Tests: `src/routes/qr-hub.test.ts` (Postgres only; skipped without `TEST_DATABASE_URL`).
Admin routes live under `/qr-hub/admin/` and use the same admin guard as `/admin/*` (session cookie, role `admin`, Origin check on unsafe methods). Only the import and bulk routes accept bodies up to 1 MB; everything else keeps the 10 kB limit.
| Method and path (under `/qr-hub/admin/`) | Notes |
| --- | --- |
| `GET organizations?search=&category=&status=` | `{items}` with link/placement/visit/click counts |
| `POST organizations` | org fields + optional `links[]` (and optional `slug`, else derived from `name`) -> 201 `{organization, links, placements, offers}`; 409 `slug_taken` |
| `GET/PATCH/DELETE organizations/:slug`, `PATCH organizations/:slug/status` | slug is immutable (printed QRs must not break) |
| `POST organizations/:slug/links`, `PATCH/DELETE links/:id`, `PUT organizations/:slug/links/order` | `destination_url`: http, https, tel, mailto only. Order body `{ids}` must be exactly the organization's link ids (else 409 `ids_mismatch`) |
| `POST organizations/:slug/links/bulk`, `POST links/bulk-to-organizations`, `POST bulk` | All-or-nothing, max 500. Bad rows -> 400 `{error, errors:[{row,path,message}]}`. `bulk` is `{entity: links|placements|organizations, ids, action: enable|disable|delete}` |
| `GET/POST organizations/:slug/placements`, `POST organizations/:slug/placements/bulk`, `PATCH/DELETE placements/:id` | Range body `{kind, prefix, labelPrefix, from, to}` creates `prefix-N` / `labelPrefix N` (max 500); existing codes -> 409 `code_taken` with `conflicts` |
| `GET/POST organizations/:slug/offers`, `PATCH/DELETE offers/:id` | Shown on the hub only between `starts_at` and `ends_at` (either may be null) |
| `GET analytics?from=&to=`, `GET organizations/:slug/analytics?from=&to=` | `YYYY-MM-DD` in Asia/Kolkata, default last 30 days, max 366. Totals, daily, devices, browsers, referrers, topLinks, `byPlacement`, `byHour` (24), `byWeekday` (7, 0 = Sunday) |
| `GET export.csv?type=visits\|clicks&slug=&from=&to=` | Attachment; cells starting with `= + - @` are prefixed with `'` |
| `GET export.json?slugs=a,b\|all&includeWifi=0\|1` | Versioned `dream-heavens-qr-hub` file, no ids or analytics, Wi-Fi password only with `includeWifi=1` |
| `POST import.json?mode=skip\|update&dryRun=1\|0` | Body is the export format. `dryRun` defaults to 1 and changes nothing; `dryRun=0` applies everything in one transaction or nothing. Limits: 1 MB, 200 organizations, 500 links and 500 placements per organization. Response `{preview:[{slug,action,links,placements,offers}], errors, applied}`; any error -> nothing applied (400 when applying) |
| `GET/PUT settings` | `baseUrl` (https, used in exported QR urls), `posterCta` |
| `GET organizations/:slug/integrations?days=` | GA4 and Search Console summary for `/hub/<slug>`, or `not_connected` |
Public (no auth, per-IP in-memory rate limit of 300 requests a minute, `TRUST_PROXY=1` required behind a proxy): `GET /r/:slug?p=<code>` logs a scan and 302s to `<SITE_URL>/hub/<slug>?p=<code>` (or `/hub/unavailable`; bots and over-limit clients are redirected without logging), `GET /qr-hub/public/hub/:slug?p=`, `POST /qr-hub/public/visit` `{slug}`, `POST /qr-hub/public/click` `{slug, linkId | "review", placement?}` (both 204, 1 kB body limit). Only coarse device/browser/OS labels and the referrer host are stored: no IP, no raw user agent.
| Env var | Meaning |
| --- | --- |
| `SITE_URL` | Optional. Public site origin for `/r/:slug` redirects; defaults to `ALLOWED_ORIGIN` |
| `GA4_PROPERTY_ID`, `GA4_CLIENT_EMAIL`, `GA4_PRIVATE_KEY` | Optional. Google service account for the GA4 Data API (read only) |
| `GSC_SITE_URL`, `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY` | Optional. Google service account for Search Console (read only) |
## Run
Postgres 16 is required. Local Docker database (dev-only credentials):
```bash
docker run -d --name hdh-postgres --restart unless-stopped \
  -e POSTGRES_USER=hdh -e POSTGRES_PASSWORD=hdh_local_dev -e POSTGRES_DB=hotel_dream_heavens \
  -p 127.0.0.1:5432:5432 -v hdh-pgdata:/var/lib/postgresql/data postgres:16-alpine
docker exec hdh-postgres createdb -U hdh hotel_dream_heavens_test
```
```bash
cp .env.example .env     # set ALLOWED_ORIGIN, DATABASE_URL, TEST_DATABASE_URL
npm ci
npm run migrate          # applies migrations/*.sql in order, idempotent
npm run create-admin -- admin@example.com 'a-throwaway-password'   # creates or promotes an admin
npm run dev              # watch mode, Node strips types natively
npm run build && npm start
npm run typecheck
npm test                 # uses TEST_DATABASE_URL (must end in _test; tables are truncated)
```
`create-admin` never prints the password; argv can show in shell history or `ps`, so use a throwaway password (or `ADMIN_PASSWORD`) and change it.
| Env var | Meaning |
| --- | --- |
| `PORT` | Listen port, default 3001 |
| `ALLOWED_ORIGIN` | Required. The single frontend origin allowed by CORS (no wildcard). Credentials are allowed for it only |
| `DATABASE_URL` | Required. Postgres connection string |
| `TEST_DATABASE_URL` | Tests only; a separate `*_test` database |
| `TRUST_PROXY` | **Mandatory (`1`) behind any reverse proxy or load balancer**; leave unset when exposed directly |
| `HMS_BASE_URL`, `HMS_API_KEY`, `POS_BASE_URL`, `POS_API_KEY` | Optional, unused until the integration is written |
## HMS and POS
Bookings carry nullable, unique-when-set `external_hms_booking_id` and `external_pos_folio_id` (admin responses only; admins can link them by hand via `PATCH /admin/bookings/:id`). `src/integrations/types.ts` defines optional `BookingSyncHooks` (`onBookingCreated`, `onBookingChanged`) passed to `buildApp`; they run after create, owner cancel and admin change, and a failing hook is logged and never fails the request. Live availability and rates are expected to come from the HMS later; the HMS and POS APIs are not invented here.
`users.external_hms_id` and `users.external_pos_id` exist (unique when set) and are exposed by the admin API and the `lifecycle` stats. The env vars above are read by `src/integrations/config.ts` (`integrationConfig()`), and `src/integrations/types.ts` holds TODO interfaces (`HmsClient`, `PosClient`); no HMS/POS API is called anywhere. To integrate: implement those clients in `src/integrations/`, build them from `integrationConfig()` in `server.ts`, pass them to `buildApp`, and call them after signup or from a new admin "link" endpoint that writes the external ids (a future `UserStore.setExternalIds`). Keep the keys server-side. Which system is the source of truth is a decision for the HMS/POS vendors.
## Account and bookings
- A booking is a **reservation request**: created `pending`, the hotel moves it to `confirmed` (admin PATCH). Nothing is auto-confirmed and there is no availability check yet. No cancellation window or refund rule is encoded anywhere.
- **Pricing**: `total = nights x ratePerNight x rooms`, whole rupees (INR), excluding taxes and extra bed. Rates live in the `ROOMS` table in `src/domain/bookings.ts`, mirrored from `frontend/src/data/rooms.ts` (change both). Rate, room name and total are snapshotted on the row. Bodies with `totalAmount`, `ratePerNight`, `status` or `paymentStatus` are rejected with 422.
- **Dates** are `YYYY-MM-DD`; "today" is Asia/Kolkata. Limits: check-in not in the past and within 365 days, 1-30 nights, 1-5 rooms, adults between rooms and 2 x rooms, up to 10 active upcoming bookings per user.
- **Cancel**: allowed while `pending`/`confirmed` and check-in is today or later; cancelling twice returns 200 with the unchanged booking.
- **Account deletion**: needs the password; blocked (409 `upcoming_bookings`) while any pending/confirmed booking has not ended; otherwise remaining bookings are anonymised (`user_id` NULL, `special_requests` wiped; reference, dates, room and amounts stay) and the user and sessions are deleted. Staff/admin accounts cannot self-delete.
- **Payment seam**: `payment_status` (`unpaid | pay_at_hotel | paid | refunded`, default `pay_at_hotel`) is stored only. Users cannot set it. When online payment is added in the frontend, a server-verified path (gateway webhook or verify endpoint) must set `paid`; never accept `paid` from the browser. No payment processing exists here.
- **Rate limits** (same in-memory limiter as login): `pw:<userId>` and `del:<userId>` count failed password attempts only; `book:<userId>` counts every booking creation. 429 with `Retry-After`.
- Migration `0002_account_bookings.sql` is additive. Manual rollback SQL is at the bottom of the file. No new environment variables.

## Security notes

- Passwords are hashed with scrypt (`node:crypto`, per-user salt) and compared with `timingSafeEqual`. Unknown emails run a dummy hash check so timing does not reveal accounts.
- CORS allows exactly `ALLOWED_ORIGIN`. Security headers are set on every response. Bodies are limited to 10 kB.
- Rate limit, in memory: signup 10 requests per 15 minutes per IP. Login counts **failed** attempts only (10 per 15 minutes per IP and, separately, per email); a successful login does not use up the budget. Over the limit returns 429 with `Retry-After`.
- **`TRUST_PROXY=1` is mandatory behind a reverse proxy or load balancer.** Without it every client shares the proxy's IP, so one user could lock everyone out. To avoid trusting a spoofable header, when `TRUST_PROXY` is unset the API logs a startup warning and answers `POST /auth/*` requests that carry `X-Forwarded-For` with 400 `untrusted_proxy_header`. Only set it when a proxy you control overwrites that header.
- Signup returns 409 `email_taken` for an existing email, which lets a caller test whether an email has an account (enumeration). Accepted tradeoff: there is no email verification, so the only alternative (a fake 201) would tell a real person they signed up when they did not. The signup limit slows bulk probing. The frontend treats every 4xx as one generic message, so it does not depend on the code. Revisit when email verification exists.
- Startup checks the database (`select 1`); if it is unreachable the process exits 1 with `Cannot connect to the database: ...` (the URL is never printed).
- Sessions: opaque 32-byte token in an `HttpOnly; SameSite=Lax` cookie (`Secure` when `ALLOWED_ORIGIN` is https); only its SHA-256 is stored. Role and status are read from the DB on every request, so changes and disabling apply immediately. CSRF defence is SameSite=Lax plus an Origin check on cookie-authenticated unsafe requests. Frontend and API must be same-site (shared registrable domain) in production.
- Admin: role re-checked per request, zod on all input, parameterized SQL, whitelisted sort columns, no password hashes in any response, admins cannot change themselves, the last active admin is protected (advisory lock + transaction).
- Not included: password reset, email verification.

## Limits and deploy
- Users and sessions are in Postgres. Only the rate-limit counters are per process, so run one instance until they move to a shared store.
- Needs a Node-capable host. Hostinger shared hosting serving the static site cannot run it.
- After deploying, set `VITE_AUTH_API_URL` for the frontend build and add the API origin to `connect-src` in `frontend/public/.htaccess`.
