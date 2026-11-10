import { Seo } from '@/components/Seo'
import { BookingDetail } from '@/features/account/BookingDetail'
export default function AccountBookingDetail() {
  return (
    <>
      <Seo path="/account/bookings" />
      <BookingDetail />
    </>
  )
}
