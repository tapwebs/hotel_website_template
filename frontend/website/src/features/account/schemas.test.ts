import { describe, expect, it } from 'vitest'
import type { Profile } from './accountTypes'
import { deleteFormSchema, passwordFormSchema, profileChanges, profileFormSchema, profileToForm, toWirePhone } from './schemas'
const profile: Profile = {
  id: 'u1', name: 'Asha Sharma', email: 'a@b.co', phone: '+919876543210', country: null, addressLine1: null, addressLine2: null,
  city: null, state: null, postcode: null, preferences: { bed: 'no_preference', dietary: 'no_preference', notes: '' },
  marketingOptIn: false, role: 'guest', createdAt: '2026-01-01T00:00:00Z', lastLoginAt: null,
}
describe('profile form', () => {
  it('shows the phone as 10 digits and sends it back as +91…', () => {
    expect(profileToForm(profile).phone).toBe('9876543210')
    expect(toWirePhone('98765 43210')).toBe('+919876543210')
  })
  it('validates', () => {
    const ok = profileToForm(profile)
    expect(profileFormSchema.safeParse(ok).success).toBe(true)
    expect(profileFormSchema.safeParse({ ...ok, phone: '12345' }).success).toBe(false)
    expect(profileFormSchema.safeParse({ ...ok, postcode: '!!' }).success).toBe(false)
    expect(profileFormSchema.safeParse({ ...ok, notes: 'x'.repeat(501) }).success).toBe(false)
  })
  it('submits only changed fields; emptied optional fields become null', () => {
    const v = profileToForm(profile)
    expect(profileChanges(profile, v)).toEqual({})
    expect(profileChanges(profile, { ...v, name: ' Asha S ', city: 'Jaipur', marketingOptIn: true })).toEqual({ name: 'Asha S', city: 'Jaipur', marketingOptIn: true })
    const withCity = { ...profile, city: 'Jaipur' }
    expect(profileChanges(withCity, { ...profileToForm(withCity), city: '' })).toEqual({ city: null })
    expect(profileChanges(profile, { ...v, bed: 'king' }).preferences).toEqual({ bed: 'king', dietary: 'no_preference', notes: '' })
  })
})
describe('password and delete forms', () => {
  it('requires a different, matching new password of 8+ characters', () => {
    const ok = { currentPassword: 'oldpass12', newPassword: 'newpass123', confirmPassword: 'newpass123' }
    expect(passwordFormSchema.safeParse(ok).success).toBe(true)
    expect(passwordFormSchema.safeParse({ ...ok, newPassword: 'short', confirmPassword: 'short' }).success).toBe(false)
    expect(passwordFormSchema.safeParse({ ...ok, confirmPassword: 'other1234' }).success).toBe(false)
    expect(passwordFormSchema.safeParse({ ...ok, newPassword: 'oldpass12', confirmPassword: 'oldpass12' }).success).toBe(false)
  })
  it('delete needs a password and the confirmation', () => {
    expect(deleteFormSchema.safeParse({ password: 'x', understand: false }).success).toBe(false)
    expect(deleteFormSchema.safeParse({ password: 'x', understand: true }).success).toBe(true)
  })
})
