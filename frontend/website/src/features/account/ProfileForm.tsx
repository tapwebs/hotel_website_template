import { useState } from 'react'
import { Link } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Field, selectClass } from '@/components/forms/Field'
import type { AdminError } from '@/features/admin/adminTypes'
import { useAuth } from '@/features/auth/auth-context'
import { inlineLink } from '@/lib/utils'
import { play, playError } from '@/lib/sounds'
import { fieldIssues, getProfile, updateProfile } from './accountApi'
import { bedLabel, bedOptions, dietaryLabel, dietaryOptions, type Profile } from './accountTypes'
import { profileChanges, profileFormSchema, profileToForm, type ProfileFormValues } from './schemas'
import { useAccountResource } from './useAccountData'
import { ErrorPanel, Skeleton } from './ui'
export function ProfileForm() {
  const res = useAccountResource((signal) => getProfile({ signal }), 'nocache:profile')
  if (!res.data) return res.status === 'error' ? <ErrorPanel error={res.error} onRetry={res.reload} /> : <Skeleton rows={3} label="Loading your profile…" />
  return <Form initial={res.data} />
}
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="grid gap-4 rounded-md border border-border bg-ivory p-5 sm:grid-cols-2 sm:p-6">
    <legend className="px-2 font-display text-xl text-burgundy">{title}</legend>
    {children}
  </fieldset>
)
function Form({ initial }: { initial: Profile }) {
  const { auth, setUser, clear } = useAuth()
  const [profile, setProfile] = useState(initial)
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'saved' } | { kind: 'nochange' } | { kind: 'error'; error: AdminError }>({ kind: 'idle' })
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({ resolver: zodResolver(profileFormSchema), defaultValues: profileToForm(initial) })
  const optIn = useWatch({ control, name: 'marketingOptIn' })
  const onSubmit = async (v: ProfileFormValues) => {
    if (profile.phone && v.phone.trim() === '') {
      setError('phone', { message: 'A saved phone number cannot be removed. Enter a new one to change it.' })
      play('error')
      return
    }
    const patch = profileChanges(profile, v)
    if (Object.keys(patch).length === 0) return setState({ kind: 'nochange' })
    setState({ kind: 'idle' })
    const r = await updateProfile(patch)
    if (r.ok) {
      setProfile(r.data)
      reset(profileToForm(r.data))
      setState({ kind: 'saved' })
      play('success')
      if (auth.status === 'authenticated' && auth.user.name !== r.data.name) setUser({ ...auth.user, name: r.data.name })
      return
    }
    if (r.error.kind === 'unauthenticated') return clear()
    play('error')
    const issues = fieldIssues(r.error)
    const known = Object.keys(profileFormSchema.shape)
    for (const [k, message] of Object.entries(issues)) if (known.includes(k)) setError(k as keyof ProfileFormValues, { message })
    setState({ kind: 'error', error: r.error })
  }
  return (
    <form noValidate onSubmit={handleSubmit(onSubmit, playError)} aria-label="Edit profile" className="grid gap-6">
      <h2 className="font-display text-h3 text-walnut">Profile</h2>
      <Section title="Personal details">
        <Field id="pf-name" label="Full name" error={errors.name?.message}>
          {(aria) => <Input {...aria} {...register('name')} className="h-12" autoComplete="name" />}
        </Field>
        <Field id="pf-phone" label="Mobile number" hint="10-digit Indian mobile number." error={errors.phone?.message}>
          {(aria) => <Input {...aria} {...register('phone')} className="h-12" type="tel" inputMode="tel" autoComplete="tel-national" />}
        </Field>
        <Field id="pf-email" label="Email" hint="Email cannot be changed here." className="sm:col-span-2">
          {(aria) => <Input {...aria} value={profile.email} readOnly className="h-12 bg-muted" type="email" autoComplete="email" />}
        </Field>
      </Section>
      <Section title="Address">
        <Field id="pf-country" label="Country" optional error={errors.country?.message}>
          {(aria) => <Input {...aria} {...register('country')} className="h-12" autoComplete="country-name" placeholder="Enter country" />}
        </Field>
        <Field id="pf-line1" label="Address line 1" optional error={errors.addressLine1?.message}>
          {(aria) => <Input {...aria} {...register('addressLine1')} className="h-12" autoComplete="address-line1" />}
        </Field>
        <Field id="pf-line2" label="Address line 2" optional error={errors.addressLine2?.message}>
          {(aria) => <Input {...aria} {...register('addressLine2')} className="h-12" autoComplete="address-line2" />}
        </Field>
        <Field id="pf-city" label="City" optional error={errors.city?.message}>
          {(aria) => <Input {...aria} {...register('city')} className="h-12" autoComplete="address-level2" />}
        </Field>
        <Field id="pf-state" label="State" optional error={errors.state?.message}>
          {(aria) => <Input {...aria} {...register('state')} className="h-12" autoComplete="address-level1" />}
        </Field>
        <Field id="pf-postcode" label="Postcode" optional error={errors.postcode?.message}>
          {(aria) => <Input {...aria} {...register('postcode')} className="h-12" autoComplete="postal-code" />}
        </Field>
      </Section>
      <Section title="Stay preferences">
        <Field id="pf-bed" label="Bed" error={errors.bed?.message}>
          {(aria) => (
            <select {...aria} {...register('bed')} className={selectClass}>
              {bedOptions.map((o) => (
                <option key={o} value={o}>
                  {bedLabel[o]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field id="pf-dietary" label="Dietary" error={errors.dietary?.message}>
          {(aria) => (
            <select {...aria} {...register('dietary')} className={selectClass}>
              {dietaryOptions.map((o) => (
                <option key={o} value={o}>
                  {dietaryLabel[o]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field id="pf-notes" label="Notes" optional className="sm:col-span-2" error={errors.notes?.message}>
          {(aria) => <Textarea {...aria} {...register('notes')} rows={3} placeholder="Anything we should know before you arrive" />}
        </Field>
      </Section>
      <fieldset className="grid gap-3 rounded-md border border-border bg-ivory p-5 sm:p-6">
        <legend className="px-2 font-display text-xl text-burgundy">Offers</legend>
        <div className="flex items-start gap-3">
          <Switch id="pf-marketing" checked={optIn} onCheckedChange={(c) => setValue('marketingOptIn', c, { shouldDirty: true })} aria-describedby="pf-marketing-hint" />
          <div className="grid gap-1">
            <label htmlFor="pf-marketing" className="text-sm font-semibold text-walnut">
              Send me offers by email or WhatsApp
            </label>
            <p id="pf-marketing-hint" className="text-sm text-muted-foreground">
              Off by default. You can change this at any time. See the{' '}
              <Link to="/privacy-policy" className={inlineLink}>
                privacy policy
              </Link>
              .
            </p>
          </div>
        </div>
      </fieldset>
      <div aria-live="polite" className="empty:hidden">
        {state.kind === 'saved' ? <p role="status" className="font-semibold text-walnut">Saved.</p> : null}
        {state.kind === 'nochange' ? <p role="status" className="text-walnut">Nothing to save, no changes yet.</p> : null}
        {state.kind === 'error' ? <p role="alert" className="font-medium text-destructive">{state.error.message}</p> : null}
      </div>
      <div>
        <Button type="submit" size="lg" className="h-12 max-sm:w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
