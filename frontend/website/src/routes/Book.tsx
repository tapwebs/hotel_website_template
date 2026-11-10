import { Seo } from '@/components/Seo'
import { ReservePage } from '@/features/reserve/ReservePage'
export default function Book() {
  return (
    <>
      <Seo path="/book" />
      <ReservePage />
    </>
  )
}
