import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Field, FieldError } from '@/components/forms/Field'
import type { AdminError } from '@/features/admin/adminTypes'
import { PasswordInput } from '@/features/auth/PasswordInput'
import { passwordStrength } from '@/features/auth/schemas'
import { useAuth } from '@/features/auth/auth-context'
import { cn, inlineLink } from '@/lib/utils'
import { play, playError } from '@/lib/sounds'
import { changePassword, deleteAccount, fieldIssues } from './accountApi'
import { deleteFormSchema, passwordFormSchema, type DeleteFormValues, type PasswordFormValues } from './schemas'
import { Panel } from './ui'
const strengthColor = ['', 'bg-destructive', 'bg-gold', 'bg-burgundy']
export function SecurityPanel() {
  return (
    <div className="grid gap-6">
      <h2 className="font-display text-h3 text-walnut">Security</h2>
      <ChangePassword />
      <DeleteAccount />
    </div>
  )
}
export function ChangePassword() {
  const { clear } = useAuth()
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'done' } | { kind: 'error'; error: AdminError }>({ kind: 'idle' })
  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const strength = passwordStrength(useWatch({ control, name: 'newPassword' }) ?? '')
  const onSubmit = async (v: PasswordFormValues) => {
    setState({ kind: 'idle' })
    const r = await changePassword(v.currentPassword, v.newPassword)
    if (r.ok) {
      reset()
      play('success')
      return setState({ kind: 'done' })
    }
    if (r.error.kind === 'unauthenticated') return clear()
    play('error')
    const issues = fieldIssues(r.error)
    if (issues.currentPassword) setError('currentPassword', { message: issues.currentPassword })
    if (issues.newPassword) setError('newPassword', { message: issues.newPassword })
    setState({ kind: 'error', error: r.error })
  }
  return (
    <Panel aria-labelledby="pw-title">
      <form noValidate onSubmit={handleSubmit(onSubmit, playError)} aria-labelledby="pw-title" className="grid max-w-xl gap-4">
        <h3 id="pw-title" className="font-display text-xl text-burgundy">
          Change password
        </h3>
        <Field id="pw-current" label="Current password" error={errors.currentPassword?.message}>
          {(aria) => <PasswordInput {...aria} {...register('currentPassword')} autoComplete="current-password" />}
        </Field>
        <Field id="pw-new" label="New password" error={errors.newPassword?.message}>
          {(aria) => <PasswordInput {...aria} {...register('newPassword')} autoComplete="new-password" />}
        </Field>
        <div className="flex items-center gap-3">
          <div aria-hidden="true" className="grid flex-1 grid-cols-3 gap-1.5">
            {[1, 2, 3].map((i) => (
              <span key={i} className={cn('h-1.5 rounded-full', i <= strength.score ? strengthColor[strength.score] : 'bg-border')} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm">8+ characters. Strength: {strength.label}.</p>
        </div>
        <Field id="pw-confirm" label="Confirm new password" error={errors.confirmPassword?.message}>
          {(aria) => <PasswordInput {...aria} {...register('confirmPassword')} autoComplete="new-password" />}
        </Field>
        <div aria-live="polite" className="empty:hidden">
          {state.kind === 'done' ? (
            <p role="status" className="font-semibold text-walnut">
              Password changed. Other devices were signed out.
            </p>
          ) : null}
          {state.kind === 'error' ? (
            <p role="alert" className="font-medium text-destructive">
              {state.error.kind === 'validation' ? 'Please check the highlighted fields.' : state.error.message}
            </p>
          ) : null}
        </div>
        <div>
          <Button type="submit" size="lg" className="h-12 max-sm:w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Changing…' : 'Change password'}
          </Button>
        </div>
      </form>
    </Panel>
  )
}
function DeleteAccount() {
  const { clear } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<AdminError | null>(null)
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<DeleteFormValues>({ resolver: zodResolver(deleteFormSchema), defaultValues: { password: '', understand: false } })
  const onSubmit = async (v: DeleteFormValues) => {
    setError(null)
    const r = await deleteAccount(v.password)
    if (r.ok) {
      // Leave the account area first; clearing the session while still on /account would redirect to /login.
      await navigate('/', { replace: true, state: { accountDeleted: true } })
      clear()
      return
    }
    if (r.error.kind === 'unauthenticated') return clear()
    play('error')
    const issues = fieldIssues(r.error)
    if (issues.password) setFieldError('password', { message: issues.password })
    setError(r.error)
  }
  return (
    <Panel aria-labelledby="del-title" className="border-destructive/30">
      <form noValidate onSubmit={handleSubmit(onSubmit, playError)} aria-labelledby="del-title" className="grid max-w-xl gap-4">
        <h3 id="del-title" className="font-display text-xl text-destructive">
          Delete account
        </h3>
        <p className="text-walnut">
          You can only delete your account when you have no upcoming or ongoing stays: cancel them first, or contact the hotel. Your past
          booking records are kept by the hotel without your personal details.
        </p>
        <Field id="del-password" label="Your password" error={errors.password?.message}>
          {(aria) => <PasswordInput {...aria} {...register('password')} autoComplete="current-password" />}
        </Field>
        <div className="grid gap-2">
          <div className="flex items-start gap-3">
            <input
              id="del-understand"
              type="checkbox"
              {...register('understand')}
              aria-invalid={Boolean(errors.understand)}
              aria-describedby={errors.understand ? 'del-understand-error' : undefined}
              className="mt-1 size-5 shrink-0 accent-burgundy"
            />
            <label htmlFor="del-understand" className="text-sm text-walnut">
              I understand this cannot be undone.
            </label>
          </div>
          {errors.understand ? <FieldError id="del-understand-error">{errors.understand.message}</FieldError> : null}
        </div>
        <div aria-live="polite" className="empty:hidden">
          {error && error.kind !== 'validation' ? (
            <p role="alert" className="grid gap-1 font-medium text-destructive">
              {error.message}
              {error.code === 'upcoming_bookings' ? (
                <Link to="/account/bookings?filter=upcoming" className={inlineLink}>
                  View upcoming bookings
                </Link>
              ) : null}
            </p>
          ) : null}
        </div>
        <div>
          <Button type="submit" variant="destructive" size="lg" className="h-12 max-sm:w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Deleting…' : 'Delete my account'}
          </Button>
        </div>
      </form>
    </Panel>
  )
}
