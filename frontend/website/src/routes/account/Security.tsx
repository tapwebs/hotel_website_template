import { Seo } from '@/components/Seo'
import { SecurityPanel } from '@/features/account/SecurityPanel'
export default function AccountSecurity() {
  return (
    <>
      <Seo path="/account/security" />
      <SecurityPanel />
    </>
  )
}
