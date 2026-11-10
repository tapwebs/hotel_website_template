import { Seo } from '@/components/Seo'
import { ProfileForm } from '@/features/account/ProfileForm'
export default function AccountProfile() {
  return (
    <>
      <Seo path="/account/profile" />
      <ProfileForm />
    </>
  )
}
