// Placeholders only. The real HMS / POS APIs are not known yet; nothing here makes HTTP calls.

// TODO(hms): shape depends on the real HMS API. Replace once its docs/auth scheme are known.
export interface HmsClient {
  findGuestByEmail(email: string): Promise<{ externalId: string } | undefined>
}

// TODO(pos): shape depends on the real POS API. Replace once its docs/auth scheme are known.
export interface PosClient {
  findCustomerByEmail(email: string): Promise<{ externalId: string } | undefined>
}

// TODO(link): linking would write users.external_hms_id / users.external_pos_id via a future
// UserStore.setExternalIds(). AdminUser and the `lifecycle` stats already expose these columns.

import type { AdminBooking } from '../stores/store.ts'
/**
 * Attachment point for the HMS booking / POS folio seam. Optional hooks, called AFTER a booking is created, cancelled
 * by its owner, or changed by an admin. Failures are logged and never block the request (see account.ts).
 * TODO(hms): an implementation must (1) call the HMS with the booking, (2) write the returned id into
 * bookings.external_hms_booking_id, (3) source live availability and rates from the HMS (the local ROOMS table in
 * bookings.ts and the absence of an availability check are placeholders). Admins can link ids by hand today via
 * PATCH /admin/bookings/:id.
 * TODO(pos): same for bookings.external_pos_folio_id (a folio opened/closed around the stay and its payments).
 * Both writes would go through a future UserStore.setBookingExternalIds(). No HMS/POS API is invented here.
 */
export interface BookingSyncHooks {
  onBookingCreated?(booking: AdminBooking): Promise<void>
  onBookingChanged?(booking: AdminBooking): Promise<void>
}
