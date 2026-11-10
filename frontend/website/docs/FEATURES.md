# Features: required vs optional vs planned

Status is taken from `.agents/tasks/audit-40-points.md` (audit point in brackets). Done = shipped. Partial = exists with gaps. Not started = nothing in the repo. Some items were being worked on in parallel branches after the audit; re-check before launch.

Legend: **Required** = must ship before launch. **Optional** = post-launch. **Planned** = next phase (booking engine + auth).

## Required (launch)

| Area         | Feature                                                  | Status               | Note                                                                             |
| ------------ | -------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------- |
| Pages        | 8 routes + 404, prerendered                              | Done [10, 16]        | Home, Rooms, Weddings & Events, Dining, Gallery, About, FAQs & Policies, Contact |
| Pages        | Privacy policy                                           | Not started [29]     | Needed before analytics or the Maps embed                                        |
| Pages        | Error boundary / friendly crash page                     | Not started [6, 9]   | No `errorElement` yet                                                            |
| Forms        | Booking, event, contact (RHF + Zod)                      | Partial [11, 28]     | Client validation only; submit opens WhatsApp/mailto, no delivery proof          |
| Forms        | Double-submit guard, timeout, fallback                   | Not started [28]     |                                                                                  |
| Integrations | WhatsApp, tel, mailto CTAs                               | Done [10]            | Single source in `src/data/hotel.ts`                                             |
| Integrations | Google Maps embed with disclosure                        | Partial [29]         | Loads third-party with no notice                                                 |
| SEO          | Titles, canonicals, sitemap, robots                      | Done [16]            |                                                                                  |
| SEO          | JSON-LD (Hotel, Restaurant, EventVenue, FAQ, Breadcrumb) | Done [18]            | Not yet validated in Google tools                                                |
| SEO          | llms.txt, AI crawler rules                               | Done [20]            |                                                                                  |
| SEO          | Search Console verification                              | Not started [39]     |                                                                                  |
| A11y         | Skip link, landmarks, focus, 44px targets                | Done [26]            |                                                                                  |
| A11y         | axe + Lighthouse run on all 8 pages                      | Not started [26, 34] | No results in repo                                                               |
| Performance  | Responsive AVIF/WebP images                              | Partial [13]         | Oversized PNG and large WebP variants remain                                     |
| Performance  | Core Web Vitals measured                                 | Not started [23]     |                                                                                  |
| Hosting      | Hosting config (rewrites, 404, headers, cache)           | Not started [25, 35] | Domain: hoteldreamheavens.in                                                     |
| Security     | CSP and security headers                                 | Not started [27]     |                                                                                  |
| Reviews      | Real guest reviews only, no invented names               | Not started [15]     | Sample reviews must be replaced with the 10 supplied real reviews                |
| Reviews      | Link to Google Reviews                                   | Not started          | Needs the hotel's Google review URL (not in repo)                                |
| Quality      | Lint, typecheck, build, unit tests                       | Done [30]            | 31 tests pass                                                                    |
| Repo         | git init, README, Prettier, CI                           | Not started [7, 40]  |                                                                                  |
| Deps         | React 19.3.1                                             | Not started [40]     | Currently 19.3.0                                                                 |

## Optional (post-launch)

| Area        | Feature                                               | Status               | Note                                      |
| ----------- | ----------------------------------------------------- | -------------------- | ----------------------------------------- |
| Analytics   | Privacy-friendly analytics, WhatsApp/call/form events | Not started [38]     | Needs consent notice if cookies are used  |
| Analytics   | RUM and error tracking                                | Not started [39]     |                                           |
| Testing     | Component and e2e tests (Playwright)                  | Not started [31, 32] |                                           |
| Testing     | Cross-browser and device matrix                       | Not started [32]     |                                           |
| Testing     | Visual regression diffing                             | Partial [33]         | Screenshots exist, no diffing             |
| Content     | Aggregate rating schema                               | Not started [18]     | Only after real, verifiable reviews exist |
| Content     | Banquet e-brochure (PDF)                              | Not started          | Pattern from Samode; see COMPETITORS.md   |
| Content     | Per-plate banquet pricing, capacity table             | Not started          | Pattern from Heiwa/Titoz                  |
| Performance | Reduce entry bundle (147 KB gz)                       | Partial [21, 23]     |                                           |
| Ops         | Changelog, dependency update routine                  | Partial [40]         |                                           |
| i18n        | Hindi version                                         | Not started          | Optional; many reviews are Hinglish       |

## Planned (booking engine + auth)

| Area    | Feature                                         | Status           | Note                                              |
| ------- | ----------------------------------------------- | ---------------- | ------------------------------------------------- |
| Auth    | Login and signup pages only, no dashboards      | Not started      | Pages first, backend later                        |
| Booking | Availability calendar                           | Not started      | Calendar UI exists for date picking only [2]      |
| Booking | Room rates and rate rules                       | Partial          | Base rates in `src/data/rooms.ts`; no rate engine |
| Booking | Payments                                        | Not started      | Provider not chosen                               |
| Booking | Confirmation emails                             | Not started      | Needs a mail provider and verified sender         |
| Booking | Admin (inventory, bookings, rates)              | Not started      |                                                   |
| Booking | Server-side lead capture                        | Not started [11] | Replaces WhatsApp/mailto prefill                  |
| Privacy | Consent and data-retention rules for guest data | Not started [29] | Required before auth and payments go live         |

## Competitive bar (from COMPETITORS.md)

- Match: persistent Book Now CTA and a date/guest picker above the fold.
- Beat: crawlable content, real schema, honest pricing, WhatsApp plus banquet enquiry, attributed real reviews.
