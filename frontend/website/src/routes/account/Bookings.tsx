import { Seo } from '@/components/Seo'
import { BookingsList } from '@/features/account/BookingsList'
export default function AccountBookings() {
  return (
    <>
      <Seo path="/account/bookings" />
      <BookingsList />
    </>
  )
}
