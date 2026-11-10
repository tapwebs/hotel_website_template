# Hotel Digital Experience — Project Overview

> Antigravity brief • 27 September 2026 • Prepared for TAPWEBS / TAP-ONE  
> Working definition: a premium website for **one client hotel property**, connected over time to the TapMenu HMS operating system. The hotel's name, location, brand assets, room inventory and exact contract scope have not been supplied. Use clearly marked internal content placeholders until the client confirms them; never publish invented facts.

## 1. The product in one sentence

Build a fast, elegant hotel website that helps guests choose a stay and book directly, while providing clean connections to reservations, in-room dining and the hotel's operations system.

## 2. Evidence and interpretation

| Input | What it establishes | Planning decision |
|---|---|---|
| `KITCHEN WORKING.pdf` | TapMenu restaurant suite: QR menus, table management, KOT/KDS, POS, inventory, loyalty, owner reports | Treat this as the **F&B operational scope**, not the public hotel's complete website specification. |
| `HMS.md` | Proposed TapMenu HMS expansion: PMS/front desk, housekeeping, room service, master folio, billing and owner dashboard | Treat this as a **product blueprint**. An item described in it is not proof that the integration or software is already deployed. |
| [RunHotel](https://runhotel.io/) | Reference is primarily a hotel software vendor's marketing site, with direct booking, PMS and channel management themes | Take inspiration from clarity and connected workflows. Design the client's site around the **guest's hotel**, not as a RunHotel clone or software sales page. |
| [TAPWEBS](https://tapwebs.in/) and [services](https://tapwebs.in/services/) | TAPWEBS positions itself as a technology studio; TAP-ONE appears as a managed growth platform | TAPWEBS/TAP-ONE are the delivery ecosystem. They do not replace the property's guest-facing identity. |
| `tap-one.app` | Direct page retrieval returned an error during research | Do not infer live API, booking or chatbot capabilities from its URL. Validate the actual implementation with the team. |

## 3. Product boundaries and data architecture

The public website is the **guest discovery and booking layer**. **Supabase** is the selected project database platform, providing structured storage (Supabase Postgres), asset storage (Supabase Storage), authentication (Supabase Auth), and secure server-side logic (Supabase Edge Functions) for website content, inquiries, guest preferences, and consent logs. 

Crucially, **Supabase is not assumed to be the authoritative hotel inventory or PMS engine**. The hotel's operational HMS/PMS remains the sole authority for live room stock, quote calculations, and master folios. The boundaries are strictly defined:
- **Public Website (React + Vite):** Guest presentation, room discovery, and direct booking entry point.
- **Project Data (Supabase):** Stores approved property content, room categories, media records, contact/stay inquiries, and consent records. Access is secured via Row Level Security (RLS).
- **Reservation Authority (HMS/PMS):** Manages real-time room availability, inventory locks (`POST /hold`), and authoritative confirmations. 
- **Operations (TapMenu):** Authenticated in-stay restaurant ordering, KDS ticket routing, and folio posting. A CMS or Supabase record updates editorial presentation but never writes directly to live room availability.

### Release gates

| Gate | Guest-visible outcome | Required dependency |
|---|---|---|
| G1 — Brand and lead capture | Hotel story, room categories, dining, amenities, contact, inquiry and call/WhatsApp | Approved property facts, photos, policies, contacts, consent wording |
| G2 — Direct reservations | Dates, occupancy, real rates, checkout, verified confirmation, modify/cancel path | Live PMS/booking engine, availability hold, payments, policy and tax configuration |
| G3 — Connected stay | Verified guest portal, room-service QR, service requests and folio preview | HMS identity/session, TapMenu order/KDS, posting and staff workflows |
| G4 — Distribution and intelligence | Channel sync, owner reporting, advanced campaigns | Certified channel integration, reconciliation, analytics consent |

Do not expose a working “Book Now” checkout until G2 passes. Before that, label the CTA “Enquire about a stay” and route to an honest inquiry workflow. G3–G4 are explicitly dependent on system readiness, not a promise for launch.

## 4. Guests and business goals

Primary guest jobs: compare rooms on mobile, understand total cost and cancellation conditions, see authentic property photography, find the location, book with confidence, and contact a person quickly. During a stay, find dining and service without repeated calls. Staff jobs: receive accurate reservation and inquiry records, avoid duplicate inventory, fulfil dining requests, and reconcile charges. Owner jobs: see direct booking contribution and guest experience issues without putting admin screens on the public site.

North-star measure: **confirmed direct reservations per qualified booking visit** when G2 is live. Supporting measures: room-detail-to-search progression, checkout completion, inquiry response time, booking reconciliation failures, mobile Core Web Vitals, and genuine review response coverage. Establish baselines before any percentage-growth claims.

## 5. Information architecture

Use a content-driven sitemap rather than forcing an arbitrary 15-page count. One template can serve every room category, with unique URLs and copy.

| Public route | Purpose / required content | Gate |
|---|---|---|
| `/` | Property-led hero, availability search or inquiry, room highlights, dining, location, proof, human contact | G1/G2 |
| `/stay` | Room category comparison with honest size, occupancy, inclusions and policy summary | G1 |
| `/stay/[room-slug]` | Unique photography, floor/bed details, accessibility, amenities, gallery, live dates/rates at G2 | G1/G2 |
| `/dining` | Venue(s), cuisine, genuine menu preview, hours, dietary notes, table inquiry/booking if operational | G1 |
| `/experiences` | Real property facilities and local experiences; only verified offerings | G1 |
| `/gallery` | Curated, tagged photos with descriptive alternatives | G1 |
| `/offers` and `/offers/[slug]` | Eligible dates, inclusions, exclusions, cancellation terms and valid promotion codes | G1/G2 |
| `/events` | Conditional: only if events/banquets exist; capacity, layouts, inquiry | G1 |
| `/about` | Hotel story and verified recognitions; avoid invented awards/team biographies | G1 |
| `/location` | Address, directions, landmarks, map on interaction, transport details | G1 |
| `/contact` | Click to call, WhatsApp, email, accessible inquiry and response expectation | G1 |
| `/faq` | Check-in/out, child/extra bed, ID, parking, dining, cancellation and accessibility | G1 |
| `/book` → `/book/confirm` | Live search, selection, guest details, payment, confirmed reference; confirmation private/noindex | G2 |
| `/privacy`, `/terms`, `/cancellation` | Property-approved legal/policy text | G1/G2 |

The guest portal and staff operations live under protected routes or separate apps; never present `/app/pos`, `/app/housekeeping`, folios or staff dashboards in the public sitemap.

## 6. Design direction

Editorial hospitality, calm and confident: authentic full-width property photography, generous spacing, restrained serif display type paired with legible sans-serif UI, warm neutral surfaces and a single deep accent. Motion reveals hierarchy and guides focus. No auto-playing hero video by default, cursor hijacking, continuous parallax, heavy canvas effects or forced loading screens. The room price and booking action should remain legible over every image.

Create an original composition and component system. The software reference may inform workflow architecture, but must not supply copied copy, screenshots, layout or iconography. See `05-UI-UX.md` and `06-BRAND-COLORS.md`.

## 7. Ownership and unresolved inputs

| Needed from client / TAPWEBS | Why it matters |
|---|---|
| Property legal name, location(s), domain and brand rights | Metadata, local SEO, navigation, identity |
| Room types, physical inventory, occupancy rules, rate plans, availability source | Genuine room pages and booking correctness |
| Approved photos/video, usage rights, amenity list, dining menu/hours, accessibility facts | Honest luxury presentation |
| Check-in/out, child/pet policies, deposits, cancellation/refund rules, tax/GSTIN and invoice owner | Accurate checkout and support |
| Whether TapMenu V3 and HMS modules are deployed, and API/auth docs | Gate assignment and integration design |
| Payment merchant, WhatsApp sender, email service, Google Business Profile access | Operational integrations |
| Languages actually supported by property staff | Whether Hindi/English toggle is useful and supportable |

Do not invent a property name, testimonial, awards, star rating, “best rate guarantee,” room categories, photos, prices, or third-party partnership. The sample commercial fees in `HMS.md` are **software subscription figures**, not guest room prices.

## 8. Five-layer verification applied to this brief

| Pass | Issue found in source/example | Correction reflected in this handoff | Verification for implementation |
|---|---|---|---|
| 1. Scope fidelity | Restaurant PDF and HMS blueprint were being conflated with a 15-page hotel example | Separate guest site, dining system and staff app; flexible content-led routes | Map every feature to its source and gate |
| 2. Journey integrity | A booking form alone could look like a confirmed reservation | Define quote, hold, authoritative confirmation, inquiry-only fallback and exception states | Last-room, payment retry and manual inquiry tests |
| 3. Integration feasibility | OTA, room QR, KDS and folio capabilities may be proposed rather than live | Require API audit and explicit G2–G4 dependencies; room QR is not guest authorization | Contract and security review before activation |
| 4. Trust and compliance | PDF/HMS contains unverified growth statistics, static GST slabs and review incentives | Remove claims, configure tax with accountant, keep neutral genuine review requests | Content signoff, tax scenarios and policy review |
| 5. Experience and build quality | Heavy luxury effects can compromise mobile use; focus colors can fail on dark surfaces | Budget motion and media, specify WCAG and Core Web Vitals, provide separate focus colors | Responsive/screen-reader tests and measured contrast/field metrics |

This is a five-pass **specification review**, not a claim that live software has been built or tested.

## 9. Research anchors

- [RunHotel home](https://runhotel.io/) and [direct booking engine](https://runhotel.io/direct-booking-engine/) — reference positioning, not a feature guarantee for this client.
- [Google LocalBusiness structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business) — structured data must match visible facts.
- [Google Maps review content policy](https://support.google.com/contributionpolicy/answer/7400114?hl=en) — no review incentives or selective positive solicitation.
- [Google Core Web Vitals](https://web.dev/articles/vitals/) and [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — performance and accessibility targets.
- [CBIC service tax rate listing](https://cbic-gst.gov.in/hindi/gst-goods-services-rates.html) and [55th GST Council release](https://cbic-gst.gov.in/pdf/Press-Release%20-55-GST-Council.pdf) — validate current applicability with the client's tax adviser; do not hardcode rates from the HMS draft.
