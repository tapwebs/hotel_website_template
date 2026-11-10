import { Seo } from '@/components/Seo'
import { SignupForm } from '@/features/auth/SignupForm'
import { AuthShell } from '@/features/auth/AuthShell'
import { images } from '@/data/images'

export default function Signup() {
  return (
    <>
      <Seo path="/signup" />
      <AuthShell
        breadcrumb="Sign up"
        eyebrow="Join us"
        title="Create an account"
        intro="Create an account to reserve rooms online and keep your bookings in one place."
        tagline="Your stay begins at TapMenu Grand"
        image={images.about.arrival}
        focal="50% 55%"
        wide
      >
        <SignupForm />
      </AuthShell>
    </>
  )
}
