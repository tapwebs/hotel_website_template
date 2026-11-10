import { Seo } from '@/components/Seo'
import { LoginForm } from '@/features/auth/LoginForm'
import { AuthShell } from '@/features/auth/AuthShell'
import { images } from '@/data/images'

export default function Login() {
  return (
    <>
      <Seo path="/login" />
      <AuthShell
        breadcrumb="Log in"
        eyebrow="Welcome back"
        title="Log in"
        intro="Log in to see your bookings and manage your profile."
        tagline="Welcome back to TapMenu Grand"
        image={images.about.wood}
        focal="50% 40%"
      >
        <LoginForm />
      </AuthShell>
    </>
  )
}
