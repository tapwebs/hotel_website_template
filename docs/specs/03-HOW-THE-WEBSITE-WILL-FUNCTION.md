# How the Website Will Function

> Functional handoff for Antigravity. Define a real hotel guest experience backed by one reservation authority. The precise brand and property details are pending client approval.

## 1. Public discovery

A guest lands on the homepage from search, Maps, a shared link or campaign. The top of the page communicates the hotel's genuine location and proposition, shows real photography, and makes `Check availability` (G2) or `Enquire about a stay` (G1) clear. The guest can browse room categories, a comparison view, dining, facilities, offers, FAQs and directions. A sticky, compact mobile booking action remains visible without obscuring content. Call/WhatsApp links open the verified property contact; contact submission produces a reference and goes to an assigned staff inbox.

Every room page has its own canonical URL. Its content describes the actual room type; live availability and total prices are fetched only when dates and party size are provided. No “only one room left” or countdown UI unless a true, current inventory response supports it and the business approves it.

## 2. Direct reservation state machine (G2)

| State | Guest sees | Server responsibility |
|---|---|---|
| Search | Dates, guest count, rooms | Validate range, timezone, occupancy and accessible options |
| Results | Eligible room/rate plans, inclusions, itemized total and cancellation terms | Query reservation authority; show timestamp and quote expiry |
| Held | Summary and guest form | Atomic hold/TTL; recalculate total and taxes from trusted data |
| Payment pending, when required | Secure gateway, clear status | Create signed payment order tied to reservation; idempotent retry |
| Confirmed | Booking reference, dates, policy, payment/deposit status, support | Verify reservation and payment when required; release notifications once |
| Failed/expired | Plain-language explanation and recovery | Release hold if appropriate; reconcile late payment and prevent double charge |
| Cancelled/changed | Policy and refund result | Apply booked policy version; adjust inventory/folio; audit and notify |

On a payment redirect, show “Verifying your booking” until the server confirms it. A successful browser callback alone does not create a confirmed reservation. If payment succeeds but booking finalization fails, surface a pending case and alert operations for reconciliation; do not ask the guest to pay again without checking the transaction. A pay-at-property plan may bypass online payment only when its guarantee and confirmation rules are explicitly supported by the reservation authority.

### Guest detail and policy rules

- Collect the minimum guest contact fields required for the reservation; keep optional marketing consent separate from required terms acceptance.
- Before payment, show per-night rate where appropriate, taxes/fees, deposit, balance due, occupancy, inclusions, cancellation deadline in hotel local time and support contact.
- Persist immutable policy/rate snapshot on the reservation so a later CMS edit cannot rewrite agreed terms.
- Send email/approved WhatsApp confirmation containing reference and safe management link. Do not put sensitive PII in query strings.
- Offer human assistance from search, checkout and errors without resetting the guest's chosen dates unnecessarily.

## 3. Inquiry-only behavior (G1)

If live booking is not ready, the date widget becomes a request form: selected dates, party size, desired room, contact, message and consent. The confirmation explicitly says **“Request sent — the hotel will confirm availability and price”**. No payment button, final price or booking reference is shown. Staff must have a response owner and monitored inbox. Where possible, preserve inquiry attribution without exposing personal details to analytics.

## 4. In-stay digital dining and service (G3)

1. Front desk checks in the guest and activates a stay-scoped credential. The printed room QR identifies room context but does not itself grant access to a guest's details.
2. Guest scans, verifies the active stay with an appropriate private challenge, sees a lightweight room-service menu and today's hours/availability.
3. Guest chooses modifiers, dietary note, quantity and checkout method. Before submission, show full order total and delivery expectations. “Charge to room” requires an active folio, allowance and explicit confirmation; otherwise offer payment or front desk help.
4. TapMenu records the order once, routes kitchen tickets by station, updates order states, and records delivery. A failed KDS acknowledgment alerts staff instead of falsely saying the kitchen accepted it.
5. The HMS posts an itemized charge to the master folio once. A guest can view a limited, authenticated folio preview; finance handles adjustments, credit limits and final GST invoice.
6. On checkout or room move, revoke the previous access. The property can still accept restaurant table QR orders, which do not inherit room billing rights by default.

Restaurant games/reward coupons described in the PDF are an optional dining engagement feature and should stay outside the primary luxury guest journey. Coupons may reward repeat visits or purchases, **never a Google review**.

## 5. Staff and owner surfaces (separate from the public site)

| Role | Primary flow | Guardrail |
|---|---|---|
| Front desk | Reservation queue, allocation, check-in/out, exceptions | Conflict warning, verified guest identity, audit trail |
| Housekeeping | Dirty → cleaning → cleaned → inspected; report maintenance | Only inspected/ready rooms sellable; state change linked to staff |
| Restaurant/cashier | Table or room order, KDS, POS, settle/post charge | Prevent duplicate KOT, receipt and folio line |
| Finance | Advances, split tender, refunds, tax invoices, night audit | No edits that silently erase settled transactions |
| Owner/GM | Occupancy, ADR, RevPAR, source mix, F&B and service performance | Property-scoped permissions and metric definitions |

Staff apps require authentication and role-based access. Their navigation, typography density and actions can be operational rather than guest-facing luxury editorial design, while sharing reliable brand tokens.

## 6. Content, data boundaries and search

Read/write boundaries are strictly enforced:
- **Published Property Content (Read-heavy):** Room category definitions, photos, dining descriptions, seasonal packages, policies, and FAQs may be fetched from approved, published Supabase Postgres tables with public read access controlled via Row Level Security (RLS).
- **Guest Inquiries & Profiles (Write/Auth):** Lead inquiries, contact submissions, and consent records write to property-scoped Supabase tables. Authenticated guest profiles or staff portals require Supabase Auth with strict role-based RLS policies.
- **Authoritative Inventory & Reservations (Isolated):** Operational rates, real-time availability, hold requests, and booking confirmations must **never** be written to or calculated from client-side Supabase queries alone; they remain strictly routed to the one verified hotel reservation authority (HMS/PMS) via authenticated server routes / Edge Functions.

English is the base content; add Hindi only when full translated room details, form errors, policies and checkout copy are reviewed. Language is reflected in URLs or stable locale routing, `hreflang`, and the booking flow.

Use prerendered metadata, sitemap, canonical URLs, Open Graph images, descriptive alternative text and property-consistent `Hotel`/`LocalBusiness` structured data where valid. Mark private confirmations, guest sessions and staff routes `noindex`; do not claim a rich result will appear. Search Console and GBP are monitoring and profile tools, not automatic ranking guarantees.

## 7. Notification and failure matrix

| Event | Guest response | Staff/system response |
|---|---|---|
| Inquiry accepted | Reference and response expectation | Assigned staff notification; retry if delivery fails |
| Booking held | Visible timer and preserved data | Stock reserved until expiry; logs hold ID |
| Payment verified | Confirmation reference and receipt | Reconciliation event and front desk booking |
| Payment uncertain | Pending message; support contact | Alert and investigate before repeat payment |
| Availability changed | Fresh choices, explain price difference | Release obsolete hold; log conflict |
| Room-service station offline | “Request received, awaiting kitchen acceptance” only if safely queued | Explicit acknowledgment/alert and no phantom folio charge |
| Cancellation complete | Policy calculation and refund timeline | Inventory released, payment and folio audit |

## 8. Essential acceptance scenarios

Test desktop and mobile with keyboard and screen reader: unavailable dates, invalid occupancy, last-room concurrency, price change before hold, expired hold, payment timeout, webhook retry/out-of-order event, failed payment with eventual success, duplicate room-service submit, checkout token revocation, staff role violation, partial refund, Hindi checkout if enabled, and no-network assisted contact. Validate actual policies and taxes with property staff and accountant before launch.
