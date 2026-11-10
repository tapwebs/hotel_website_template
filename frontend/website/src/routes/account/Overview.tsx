import { Seo } from '@/components/Seo'
import { Overview } from '@/features/account/Overview'
export default function AccountOverview() {
  return (
    <>
      <Seo path="/account" />
      <Overview />
    </>
  )
}
