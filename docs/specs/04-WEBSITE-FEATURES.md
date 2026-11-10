# Website Features — Prioritized Product Backlog

> Status legend: **G1** brand/lead capture, **G2** live booking, **G3** connected stay, **G4** distribution/intelligence. A feature's gate is a release condition, not an assertion that the platform already implements it. In this initial visual preview, all backend features are simulated or marked as prototypes.
> 
> **Supabase Mapping (Future Implementation):**
> - **Content & Media (G1):** Published rooms, offers, amenities, dining menus, and FAQs map to Supabase Postgres with Supabase Storage for assets.
> - **Inquiries & Consent (G1):** Guest contact, stay inquiries, and DPDP consent logs map to property-scoped Supabase tables with RLS and Edge Function notification dispatch.
> - **Direct Booking (G2):** Quotes, hold logic (`POST /hold`), and payment verification belong to the authoritative HMS/PMS and payment gateway; Supabase Postgres may store non-sensitive guest preferences and booking audit logs.
> - **Connected Stay (G3):** In-room QR tokens, KDS tickets, and master folios interface with TapMenu / HMS.

## A. Public guest site

| ID | Feature | Expected behavior / acceptance | Gate |
|---|---|---|---|
| W01 | Property-led homepage | Real imagery, location, clear value and visible primary action above first scroll | G1 |
| W02 | Room comparison | Scan occupancy, bed, size, key inclusions and category difference; price only when sourced/qualified | G1/G2 |
| W03 | Detailed room pages | Unique content and photos; amenities, accessibility facts, policy and date-based quote | G1/G2 |
| W04 | Editorial dining | Actual restaurants, hours, sample menu and allergen/dietary notice; optional table inquiry | G1 |
| W05 | Facilities and experiences | Accurate amenities, practical details and nearby context; hide unsupported modules | G1 |
| W06 | Authentic gallery | Licensed media, clear captions, tags and keyboard-operable lightbox | G1 |
| W07 | Offers | Eligibility, inventory limits, expiry and restrictions; coupon applied to verified quote | G1/G2 |
| W08 | Events inquiry | Venue capacity, setups, needs form and staff response owner, only if property offers events | Conditional G1 |
| W09 | Location and contact | Text address, directions, call/email/WhatsApp, accessible inquiry | G1 |
| W10 | Policies and FAQ | Clear check-in, cancellation, child, payment, accessibility and privacy terms | G1 |
| W11 | Bilingual site | Full human-reviewed Hindi and English content, forms, policy and booking parity | Optional, after translation |
| W12 | Social proof | Approved real guest quotes or a link to genuine third-party reviews; no fabricated scores | G1 |

## B. Direct booking

| ID | Feature | Expected behavior / acceptance | Gate |
|---|---|---|---|
| B01 | Availability search | Hotel-local dates and party size validated; actual sellable stock returned | G2 |
| B02 | Rate plan selection | Tax/fees, meals, deposit and cancellation compared without hidden charges | G2 |
| B03 | Inventory hold | Expiry and last-room concurrency protected at reservation authority | G2 |
| B04 | Secure payment, when applicable | Gateway order created server-side, signatures verified and duplicate callbacks ignored | G2 |
| B05 | Confirmation | Only after authoritative reservation and applicable payment/guarantee state verified; safe reference and support | G2 |
| B06 | Manage booking | Authenticated lookup; policy-bound modification/cancellation/refund flow | G2 |
| B07 | Assisted recovery | Pending-payment case, retry-safe checkout and human path | G2 |

## C. Connected guest stay

| ID | Feature | Expected behavior / acceptance | Gate |
|---|---|---|---|
| S01 | Room QR access | Printed room location identifier plus revocable private active-stay verification | G3 |
| S02 | In-room menu/order | Current items/modifiers, live availability, clear delivery status | G3 |
| S03 | Pay now / charge to room | Both require valid pricing; room charge requires active folio and credit rules | G3 |
| S04 | Service requests | Housekeeping, amenities and maintenance routed to a staffed queue with status | G3 |
| S05 | Folio preview | Authenticated itemized balance; payments/adjustments reflected without leaking other guests | G3 |
| S06 | Post-stay feedback | Private feedback and neutral request for genuine Google review after eligible stay | Optional G3 |

## D. Operational modules — separate authenticated application

The PDF explicitly describes restaurant QR ordering, table floor plan, KDS, inventory BOM/alerts, POS, split billing, loyalty and owner analytics. `HMS.md` proposes PMS, housekeeping, unified folio, tax, payment and multi-property capability. Confirm actual implementation before building UI against assumed endpoints.

| Module | Core staff outcome | Dependency / proof |
|---|---|---|
| Reservations and room matrix | One view of direct, walk-in and supported OTA bookings | PMS authority; channel sync contract and reconciliation |
| Housekeeping/maintenance | Clean/inspected and OOO status controls sellable inventory | Staff mobile workflow; room state audit |
| Restaurant POS + table plan | Dine-in/takeaway/room order with KOT | Existing TapMenu V3 inventory and devices |
| KDS | Station routing, ticket status and explicit pickup alert | Durable delivery/acknowledgment; offline procedure |
| Inventory | Recipe/BOM deduction, purchase, wastage and alerts | Ingredient model, stock adjustment rules and audit |
| Master folio | Itemized room/F&B/extra charges, advances, split settlement | Idempotent source posting and accountant-approved tax rules |
| Owner dashboard | Occupancy, ADR, RevPAR, direct mix, F&B and service metrics | Defined metric formulas, proper permissions and data completeness |

## E. Site-wide quality features

- Responsive header/footer; prominent phone, directions and booking/inquiry; no stack of competing floating widgets.
- Accessible menus, forms, date picker, gallery, checkout status and error announcements; target WCAG 2.2 AA.
- Original metadata, descriptive URLs, sitemap, local business information and valid schema that matches visible facts.
- Image optimization, font discipline, lazy noncritical embeds, critical-path script restraint and field monitoring.
- Security: server-side validation, CSRF/session controls, rate limits, access logging, tenant isolation, backup and recovery.
- Content governance: CMS preview, media rights, timed offers, stale-content owner, Hindi translation approval if enabled.
- Analytics events: room_view, availability_search, rate_selected, checkout_started, payment_pending, booking_confirmed, inquiry_submitted; avoid raw PII in event payloads.

## F. Deliberately conditional or excluded from an initial launch

- AI chat is optional, grounded in approved FAQs, with human handoff; never make up rates or modify reservations.
- Dynamic pricing, OTA/channel manager, Google free booking links and multi-property controls need actual certified integrations and property approval.
- Digital room key, ID scans, guest blacklists and in-room folio access require detailed privacy/security and operational design.
- In-dining games and coupons from the restaurant PDF may fit a casual venue; do not push them into the hotel homepage or booking flow by default.
- Do not publish metrics such as “35% faster turns,” “2x reviews,” “zero errors,” guaranteed revenue lift, award badges or testimonials without independently verifiable evidence and approval.
- Reward loyalty for eligible visits/purchases, not review submission or ratings. Google prohibits incentives and selective positive review solicitation: [official policy](https://support.google.com/contributionpolicy/answer/7400114?hl=en).

## G. Definition of done

G1: all published property facts approved, contact forms delivered and owned, policy links correct, responsive and accessible, metadata validated, staging content removed. G2: end-to-end live/sandbox-to-production bookings reconciled, last-room race and payment retry tests passed, tax approved, operational support trained. G3: room token security and checkout revocation tested, order/KDS/folio reconciliation passed, exception owner assigned. G4: vendor certification and channel drift monitoring demonstrated. Each gate requires a go/no-go signoff from the hotel operator and TAPWEBS delivery owner.
