import { z } from 'zod'
import { isIndianMobile, normalizeIndianPhone, PHONE_ERROR } from '@/components/booking/buildWhatsAppUrl'
import type { ProfilePatch } from './accountApi'
import { bedOptions, dietaryOptions, type Profile } from './accountTypes'
/** Optional free text: empty is allowed; when present it must fit the limits the API enforces. */
const text = (label: string, max: number, min = 0) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || v.length >= min, `${label} must be at least ${min} characters.`)
    .refine((v) => v.length <= max, `${label} must be ${max} characters or fewer.`)
export const profileFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(100, 'Name must be 100 characters or fewer.'),
  phone: z.string().refine((v) => v.trim() === '' || isIndianMobile(v), PHONE_ERROR),
  country: text('Country', 80, 2),
  addressLine1: text('Address', 120),
  addressLine2: text('Address line 2', 120),
  city: text('City', 80),
  state: text('State', 80),
  postcode: z.string().trim().refine((v) => v === '' || /^[A-Za-z0-9 -]{3,12}$/.test(v), 'Enter a valid postcode.'),
  bed: z.enum(bedOptions),
  dietary: z.enum(dietaryOptions),
  notes: z.string().max(500, 'Keep notes under 500 characters.'),
  marketingOptIn: z.boolean(),
})
export type ProfileFormValues = z.infer<typeof profileFormSchema>
/** Profile -> form values (phone shown as the 10 digits; the +91 is added back on save). */
export const profileToForm = (p: Profile): ProfileFormValues => ({
  name: p.name,
  phone: p.phone ? normalizeIndianPhone(p.phone) : '',
  country: p.country ?? '',
  addressLine1: p.addressLine1 ?? '',
  addressLine2: p.addressLine2 ?? '',
  city: p.city ?? '',
  state: p.state ?? '',
  postcode: p.postcode ?? '',
  bed: p.preferences.bed,
  dietary: p.preferences.dietary,
  notes: p.preferences.notes,
  marketingOptIn: p.marketingOptIn,
})
/** Wire format for a phone number typed in the form. */
export const toWirePhone = (v: string) => `+91${normalizeIndianPhone(v)}`
const textKeys = ['country', 'addressLine1', 'addressLine2', 'city', 'state', 'postcode'] as const
/** Only the fields that differ from the saved profile; an emptied optional field is sent as null. */
export function profileChanges(p: Profile, v: ProfileFormValues): ProfilePatch {
  const out: ProfilePatch = {}
  if (v.name.trim() !== p.name) out.name = v.name.trim()
  if (v.phone.trim() !== '' && toWirePhone(v.phone) !== p.phone) out.phone = toWirePhone(v.phone)
  for (const k of textKeys) {
    const next = v[k].trim() || null
    if (next !== (p[k] ?? null)) out[k] = next
  }
  if (v.bed !== p.preferences.bed || v.dietary !== p.preferences.dietary || v.notes !== p.preferences.notes)
    out.preferences = { bed: v.bed, dietary: v.dietary, notes: v.notes }
  if (v.marketingOptIn !== p.marketingOptIn) out.marketingOptIn = v.marketingOptIn
  return out
}
export const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z.string().min(8, 'Use at least 8 characters.').max(200, 'Use 200 characters or fewer.'),
    confirmPassword: z.string().min(1, 'Re-enter your new password.'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Choose a different password.' })
export type PasswordFormValues = z.infer<typeof passwordFormSchema>
export const deleteFormSchema = z.object({
  password: z.string().min(1, 'Enter your password to confirm.'),
  understand: z.boolean().refine((v) => v, 'Please confirm that you understand.'),
})
export type DeleteFormValues = z.infer<typeof deleteFormSchema>
