# Guest accounts and bookings (backend)

Backend reference for the guest dashboard. The authoritative contract is `.agents/tasks/account-dashboard-plan.md` section 3; `backend/README.md` has the endpoint table.

## Data model (migration `0002_account_bookings.sql`)
- `users` gains `country, address_line1/2, city, state, postcode, preferences jsonb, marketing_opt_in, marketing_opt_in_at`.
- `bookings`: id, unique `reference` (`HDH-XXXXXX`), `user_id` (FK, `ON DELETE SET NULL` = anonymised), `client_request_id` (unique per user, double-submit guard), room snapshot (`room_id, room_name, rate_per_night`), `room_count, check_in, check_out, nights, adults, children, extra_bed, special_requests`, `total_amount` (integer rupees, server computed), `currency`, `payment_status`, `status`, `cancelled_at`, timestamps, and nullable `external_hms_booking_id` / `external_pos_folio_id` (unique when set). CHECK constraints keep dates, nights and `cancelled_at` consistent.
- Ownership is enforced inside SQL (`WHERE id = $1 AND user_id = $2`); another user's booking reads as 404.

## Lifecycle
`pending` (created by the guest) -> `confirmed` (hotel) -> `completed`; `pending|confirmed` -> `cancelled` (guest before check-in, or hotel). `cancelled` and `completed` are terminal.

## Seams for later work
- **HMS booking / POS folio**: write the returned ids to the two external columns (a future `setBookingExternalIds`), implement `BookingSyncHooks` in `backend/src/integrations/types.ts`, and replace the local `ROOMS` table and the missing availability check with HMS data. Nothing calls an HMS or POS today.
- **Online payment (frontend, later)**: the browser may start a payment, but only a server-verified step (gateway webhook or verify endpoint) may set `payment_status = 'paid'` (and `refunded`). Users cannot write `payment_status` through any `/me` endpoint.

## Operations
Run `npm run migrate` in `backend/` before deploying. Rollback SQL is at the bottom of the migration. The HMS/POS and payment seams need no new env vars yet.
