import { Link, useLocation, useNavigate } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldError } from '@/components/forms/Field'
import { AuthUnavailable } from './AuthUnavailable'
import { PasswordInput } from './PasswordInput'
import { googleClientId, signUp, type SessionUser } from './authService'
import { GoogleSignInButton } from './GoogleSignInButton'
import { passwordStrength, signupSchema, type SignupValues } from './schemas'
import { useAuthSubmit } from './useAuthSubmit'
import { safeNext, useAuth } from './auth-context'
import { playError } from '@/lib/sounds'
import { Lock } from 'lucide-react'
import { cn, inlineLink } from '@/lib/utils'
const strengthColor = ['', 'bg-destructive', 'bg-gold', 'bg-burgundy']
export function SignupForm() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const hasGoogleAuth = Boolean(googleClientId())
  const onGoogleSuccess = (user: SessionUser) => {
    setUser(user)
    const next = safeNext(new URLSearchParams(location.search).get('next'))
    const from = safeNext((location.state as { from?: unknown } | null)?.from)
    void navigate(from ?? (user.role === 'admin' ? next : null) ?? (user.role === 'admin' ? '/admin' : '/account'), { replace: true })
  }
  const { status, submit } = useAuthSubmit<SignupValues>((v) => signUp(v))
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', phone: '', password: '', confirmPassword: '', consent: false },
  })
  const password = useWatch({ control, name: 'password' })
  const strength = passwordStrength(password ?? '')
  if (status.state === 'unavailable') return <AuthUnavailable />
  return (
    <form noValidate onSubmit={handleSubmit(submit, playError)} aria-label="Create an account" className="grid gap-4 md:grid-cols-2">
      {hasGoogleAuth && (
        <div className="md:col-span-2 flex flex-col gap-3">
          <GoogleSignInButton mode="signup" onSuccess={onGoogleSuccess} />
          <div className="relative my-1 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <span className="relative bg-ivory px-3 text-xs tracking-wider uppercase text-muted-foreground font-medium">
              Or register with email
            </span>
          </div>
        </div>
      )}
      <Field id="su-name" label="Full name" error={errors.name?.message}>
        {(aria) => <Input {...aria} {...register('name')} className="h-12" autoComplete="name" placeholder="Enter your name" />}
      </Field>
      <Field id="su-email" label="Email" error={errors.email?.message}>
        {(aria) => <Input {...aria} {...register('email')} className="h-12" type="email" inputMode="email" autoComplete="email" placeholder="Enter your email address" />}
      </Field>
      <Field id="su-password" label="Password" error={errors.password?.message}>
        {(aria) => <PasswordInput {...aria} {...register('password')} autoComplete="new-password" placeholder="Enter your password" />}
      </Field>
      <Field id="su-confirm" label="Confirm password" error={errors.confirmPassword?.message}>
        {(aria) => <PasswordInput {...aria} {...register('confirmPassword')} autoComplete="new-password" placeholder="Confirm your password" />}
      </Field>
      <div className="flex items-center gap-3 md:col-span-2">
        <div aria-hidden="true" className="grid flex-1 grid-cols-3 gap-1.5">
          {[1, 2, 3].map((i) => (
            <span key={i} className={cn('h-1.5 rounded-full', i <= strength.score ? strengthColor[strength.score] : 'bg-border')} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground sm:text-sm">8+ characters. Strength: {strength.label}.</p>
      </div>
      <Field id="su-phone" className="md:col-span-2" label="Mobile number" error={errors.phone?.message}>
        {(aria) => <Input {...aria} {...register('phone')} className="h-12" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="0000000000" />}
      </Field>
      <div className="grid gap-2 md:col-span-2">
        <div className="flex items-start gap-3">
          <input
            id="su-consent"
            type="checkbox"
            {...register('consent')}
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={errors.consent ? 'su-consent-error' : undefined}
            className="mt-1 size-5 shrink-0 accent-burgundy max-md:mt-0.5"
          />
          <label htmlFor="su-consent" className="text-sm text-walnut">
            I have read the{' '}
            <Link to="/privacy-policy" className={inlineLink}>
              privacy policy
            </Link>{' '}
            and agree to my details being used for my account.
          </label>
        </div>
        {errors.consent && <FieldError id="su-consent-error">{errors.consent.message}</FieldError>}
      </div>
      <div aria-live="polite" role="alert" className="text-sm font-medium text-destructive empty:hidden md:col-span-2">
        {status.state === 'error' ? status.message : null}
      </div>
      {status.state === 'done' && (
        <div role="status" className="grid gap-3 md:col-span-2">
          <p className="font-semibold text-walnut">Your account request was received.</p>
          {/* Signup issues no session: carry the return path (e.g. a booking selection) on to the login page. */}
          <Button asChild size="lg" className="h-12">
            <Link to="/login" state={location.state}>
              Log in to continue
            </Link>
          </Button>
        </div>
      )}
      <Button type="submit" size="lg" className="h-12 w-full md:col-span-2" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </Button>
      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground sm:text-sm md:col-span-2">
        <Lock className="size-4 shrink-0" aria-hidden="true" />
        Your details are used only for your account
      </p>
      <p className="text-center text-walnut md:col-span-2">
        Already have an account?{' '}
        <Link to="/login" state={location.state} className={inlineLink}>
          Log in
        </Link>
      </p>
    </form>
  )
}
