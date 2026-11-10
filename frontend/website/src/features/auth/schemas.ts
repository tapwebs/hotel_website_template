import { z } from 'zod'
import { phoneSchema } from '@/components/booking/phoneSchema'
const email = z.string().trim().min(1, 'Enter your email address.').pipe(z.email('Enter a valid email address.'))
export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
  remember: z.boolean().optional(),
})
export const signupSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name.'),
    email,
    phone: phoneSchema,
    password: z.string().min(8, 'Use at least 8 characters.'),
    confirmPassword: z.string().min(1, 'Re-enter your password.'),
    consent: z.boolean().refine((v) => v, 'Please accept the privacy policy to continue.'),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' })
export type LoginValues = z.infer<typeof loginSchema>
export type SignupValues = z.infer<typeof signupSchema>
/** Rough hint only (length and character mix). Never a substitute for server-side checks. */
export function passwordStrength(password: string): { label: 'Too short' | 'Weak' | 'Fair' | 'Strong'; score: 0 | 1 | 2 | 3 } {
  if (password.length < 8) return { label: 'Too short', score: 0 }
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length
  if (password.length >= 12 && kinds >= 3) return { label: 'Strong', score: 3 }
  if (kinds >= 3 || password.length >= 12) return { label: 'Fair', score: 2 }
  return { label: 'Weak', score: 1 }
}
