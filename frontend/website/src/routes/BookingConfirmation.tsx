import { Seo } from '@/components/Seo'
import { RequireAuth } from '@/features/account/RequireAuth'
import { Confirmation } from '@/features/reserve/Confirmation'
export default function BookingConfirmation() {
  return (
    <>
      <Seo path="/book/confirmation" />
      <RequireAuth>
        <Confirmation />
      </RequireAuth>
    </>
  )
}
