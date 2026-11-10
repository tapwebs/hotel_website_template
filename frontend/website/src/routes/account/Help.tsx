import { Seo } from '@/components/Seo'
import { Help } from '@/features/account/Help'
export default function AccountHelp() {
  return (
    <>
      <Seo path="/account/help" />
      <Help />
    </>
  )
}
