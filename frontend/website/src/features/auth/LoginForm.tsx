import { Link, useLocation, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/forms/Field'
import { AuthUnavailable } from './AuthUnavailable'
import { PasswordInput } from './PasswordInput'
import { googleClientId, signIn, type SessionUser } from './authService'
import { GoogleSignInButton } from './GoogleSignInButton'
import { loginSchema, type LoginValues } from './schemas'
import { useAuthSubmit } from './useAuthSubmit'
import { playError } from '@/lib/sounds'
import { safeNext, useAuth } from './auth-context'
import { Lock } from 'lucide-react'
import { inlineLink } from '@/lib/utils'
export function LoginForm() {
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
  const { status, submit } = useAuthSubmit<LoginValues>(
    (v) => signIn(v),
    (r) => {
      if (!r.user) return
      setUser(r.user)
      const next = safeNext(new URLSearchParams(location.search).get('next'))
      const from = safeNext((location.state as { from?: unknown } | null)?.from)
      void navigate(from ?? (r.user.role === 'admin' ? next : null) ?? (r.user.role === 'admin' ? '/admin' : '/account'), { replace: true })
    },
  )
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '', remember: false } })
  if (status.state === 'unavailable') return <AuthUnavailable />
  return (
    <form noValidate onSubmit={handleSubmit(submit, playError)} aria-label="Log in" className="grid gap-4">
      {hasGoogleAuth && (
        <div className="flex flex-col gap-3">
          <GoogleSignInButton mode="signin" onSuccess={onGoogleSuccess} />
          <div className="relative my-1 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <span className="relative bg-ivory px-3 text-xs tracking-wider uppercase text-muted-foreground font-medium">
              Or continue with password
            </span>
          </div>
        </div>
      )}
      <Field id="li-email" label="Email" error={errors.email?.message}>
        {(aria) => <Input {...aria} {...register('email')} className="h-12" type="email" inputMode="email" autoComplete="email" placeholder="Enter your email address" />}
      </Field>
      <Field id="li-password" label="Password" error={errors.password?.message}>
        {(aria) => <PasswordInput {...aria} {...register('password')} autoComplete="current-password" placeholder="Enter your password" />}
      </Field>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-x-4">
        <label htmlFor="li-remember" className="flex min-h-11 items-center gap-3 text-sm text-walnut">
          <input id="li-remember" type="checkbox" className="size-5 shrink-0 accent-burgundy" {...register('remember')} />
          Remember me
        </label>
        <span className="text-xs text-muted-foreground sm:text-right sm:text-sm">Password reset is coming soon.</span>
      </div>
      <div aria-live="polite" role="alert" className="min-h-0 text-sm font-medium text-destructive">
        {status.state === 'error' ? status.message : null}
      </div>
      {status.state === 'done' && (
        <p role="status" className="font-semibold text-walnut">
          Signed in.
        </p>
      )}
      <Button type="submit" size="lg" className="h-12 w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Logging in…' : 'Log in'}
      </Button>
      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground sm:text-sm">
        <Lock className="size-4 shrink-0" aria-hidden="true" />
        Your details are used only for your account
      </p>
      <p className="text-center text-walnut">
        New here?{' '}
        <Link to="/signup" state={location.state} className={inlineLink}>
          Create an account
        </Link>
      </p>
    </form>
  )
}
