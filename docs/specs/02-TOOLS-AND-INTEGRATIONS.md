# Tools and Integrations — Implementation Contract

> Read with `01-OVERVIEW.md`. Recommendations are architecture choices, not claims about currently installed TapMenu or HMS APIs. Validate existing code, licenses, credentials and property processes before implementation.

## 1. System map and source of truth

| Domain | Authoritative system | Website interaction | Failure behavior |
|---|---|---|---|
| Property copy, photos, offers editorial content | Headless CMS | Read published content | Serve last published content; no invented fallback rates |
| Inventory, rate plans, booking policies | HMS/PMS or one contracted booking provider | Server-side availability and price quote | Stop checkout, explain, offer contact; never sell stale stock |
| Reservation status | Same reservation authority | Create/modify/cancel via server API | Retry by idempotency key; manual queue for exception |
| Card/UPI payment | Licensed payment gateway | Server-created payment order and verified callback/webhook | Pending status until verified; reconcile, never imply success on client return alone |
| Restaurant orders / KDS / POS | TapMenu service | Authenticated in-stay QR and staff actions | Show unavailable state; do not queue duplicate charges blindly |
| Room folio and tax invoice | HMS billing ledger | Read scoped balance, post approved charges | Invalidate stale balance; staff resolves exceptions |
| Guest contact and marketing consent | Property CRM/consent store | Explicit form purpose and preference | Collect minimum info; do not send marketing without valid consent |

If an existing PMS already controls OTA channels, integrate through its supported API/booking engine. Do not build a second independently editable room calendar. A channel manager is a specialist integration with certification, conflict handling and reconciliation, not merely API calls to named OTAs.

## 2. Recommended implementation stack

| Layer | Recommended tool/approach | Why / boundaries |
|---|---|---|
| Public frontend | React + Vite + TypeScript | High-performance SPA/preview with Motion for React; for future multi-route production, use React Router with static prerendering (SSG) for crawlable search indexation and route metadata |
| UI | Tailwind CSS + accessible component primitives + small design-token layer | Fast consistent responsive builds without a heavy component theme |
| Motion | CSS transitions and selectively loaded Motion for React | Animate only meaningful moments; honor reduced motion |
| Editorial CMS | Supabase-backed content models (or approved headless CMS if separate team prefers) | Structured room, offer, policy and media models; publishing roles and preview without mandating Sanity |
| API boundary | Supabase Edge Functions / Serverless routes with schema validation | Secure server-side execution; keep payment secrets, service-role keys, and PMS credentials strictly off the browser; never expose service keys in `VITE_` variables |
| Persistence | Supabase Postgres | Project database platform: property-scoped records, Row Level Security (RLS), inquiry records, and guest preferences; separate from the operational PMS inventory engine |
| Media & Storage | Supabase Storage + Image CDN with responsive AVIF/WebP | Media bucket with signed admin upload and public CDN delivery; isolate guest identity documents behind private RLS storage |
| Identity & Auth | Supabase Auth | Role-based authentication for staff and future authenticated guest portals; table QR table access remains unauthenticated session |
| Monitoring | Error tracking + server logs + uptime check | Trace bookings, webhooks, KDS and payment discrepancies with redacted PII |
| Deployment | Existing approved host/CI with staging and rollback | Confirm ownership, backup, secrets and operational support |

No vendor commitment is necessary until the client inventory and TapMenu V3 code/API audit. Crucially, calling Supabase the project database does not make Supabase the hotel's reservation authority; live room availability, inventory locks (`POST /hold`), and master folios remain with the contracted HMS/PMS. Avoid adding an AI chatbot to the critical booking path. A narrow FAQ assistant may be added after an approved knowledge base, clear human handoff and privacy review.

## 3. Booking integration contract

1. `GET availability`: property ID, local check-in/check-out dates, adults/children, room count; return bookable room/rate plan IDs, capacity, inclusions, taxes/fees, cancellation summary, price expiry and quote ID.
2. `POST hold`: server revalidates the selected quote, applies capacity and inventory rules atomically and returns a short expiry. A hold expires and releases stock automatically.
3. `POST reservation`: use authenticated server path or signed guest checkout; idempotency key; immutable quote snapshot, guest identity, policy acceptance and consent records.
4. `POST payment order`: amount derived server-side from the same reservation/quote; never trust a browser-supplied amount.
5. Gateway callback and webhook: when prepayment is required, validate signatures, payment status and amount, de-duplicate events; transition `PENDING_PAYMENT` → `CONFIRMED` exactly once. For an approved pay-at-property rate plan, confirm only after the reservation authority accepts it under that plan's deposit/guarantee rules. Send the confirmation after the authoritative reservation and applicable payment state agree.
6. Cancellation/refund: calculate from the booked policy version, obtain required staff approval, process gateway refund, adjust availability and notify guest; log each state transition.

Define local hotel timezone, inventory cut-off, check-in/check-out date arithmetic, child ages, extra beds, package inclusions and tax calculations centrally. Acceptance: two concurrent attempts for the last room can produce at most one confirmed booking; a retried webhook produces one payment and one confirmation.

## 4. TapMenu / HMS integration contract

- Map property IDs and room IDs; do not use a public room number as authorization.
- Table QR (`/t/[token]`) and room QR (`/r/[token]`) are **separate contexts**. A printed room QR may retain a stable location identifier; it never authorizes access by itself. Require a verified, time-bound guest-stay session before showing personal folio data or permitting “charge to room.” Revoke the guest session on checkout or room move; reissue the printed room code if its location token is compromised.
- Orders carry unique source/order IDs, station routing, item modifiers, accepted/pending/ready/delivered states and itemized price/tax snapshots.
- Folio posting is idempotent and links to the source order; void/refund creates an adjustment, not a silent deletion. Reconcile KDS/POS orders against folio lines each shift.
- Housekeeping and maintenance use staff roles and current room state. An out-of-order room cannot be sold even if a CMS room card is visible.
- Staff login uses MFA for finance/admin, least privilege, short sessions and audit logs. Guest and property records are tenant-scoped in queries and authorization, not only in UI filters.

The schema in `HMS.md` is illustrative. Review its tenancy foreign keys, record deletion behavior, room availability model, money range, tax configuration, ID document storage and security controls before using it as production DDL.

## 5. External services, decision points and privacy

| Integration | Use | Requirement / caution |
|---|---|---|
| Razorpay or approved India-capable gateway | Deposit/full booking payment, UPI and refunds | Merchant verification, server-created orders, signature verification and webhook reconciliation; [Razorpay server integration](https://razorpay.com/docs/server-integration/python/test-app/) |
| WhatsApp Business Platform or approved BSP | Transactional confirmation/service updates, optional assisted sales | Template approval, opt-in/opt-out and human ownership; click-to-chat link can be G1 without API |
| Email/SMS provider | Booking receipts and support | Transactional templates, deliverability monitoring and retry queue |
| Google Maps | Directions | Load embedded map after intent to protect speed/privacy; static address and directions link always available |
| GA4 / Search Console / GBP | Website measurement and local discoverability | Consent-sensitive analytics; verified property account; avoid promises of rankings; [Search structured data guidance](https://developers.google.com/search/docs/appearance/structured-data/local-business) |
| Google hotel booking links / OTA | Future distribution | Requires appropriate hotel connectivity setup or partner; [Google integration overview](https://developers.google.com/hotels/hotel-prices/dev-guide/data-feeds) |
| Translation | English/Hindi editorial content | Human review for room policies, fees and booking terms; preserve language through checkout |
| AI FAQ assistant | Optional G3+ helper | Approved property facts only, no unsupported promises; never access folio or alter booking without authenticated workflow |

## 6. Tax, security and data controls

Tax rules are **effective-dated, jurisdiction- and service-specific configuration** approved by the property's accountant. The fixed “12% under ₹7,500 / 18% above” and universal “5% F&B” table in `HMS.md` must not be copied into checkout logic: official rates and hotel-premises definitions change and may affect the restaurant treatment. Confirm invoice requirements, place of supply, SAC/HSN and ITC treatment for each property and product before G2. Sources: [CBIC service rates](https://cbic-gst.gov.in/hindi/gst-goods-services-rates.html), [GST Council 55th press release](https://cbic-gst.gov.in/pdf/Press-Release%20-55-GST-Council.pdf).

Store amounts in integer minor units. Use the gateway's hosted payment collection; never store raw card details. Encrypt sensitive guest data at rest and in transit; isolate ID proof behind limited roles, retention and deletion procedures; redact it from analytics and logs. Protect forms with rate limiting and abuse controls. Back up and test restoration of reservations, folios and CMS. Document incident ownership, access review, and a support runbook.

## 7. Integration validation before build

- Inventory: actual room types and counts, overbooking policy, existing PMS, channel manager, rates source.
- TapMenu: deployed components, API schemas, auth, tenant model, KDS/POS operating devices, room charge flow.
- Gateway: merchant account, settlement name, refund capabilities, sandbox and webhook endpoint.
- Content: source files, license, brand, legal policies and translation review.
- Operations: who confirms manual inquiries, handles failed payment, resends receipts and resolves booking conflicts.

Mark each connection `Available`, `Requires build`, `Requires vendor`, or `Blocked` in the implementation backlog. UI must reflect the real status.
