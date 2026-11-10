import type { OrgInput } from './types'

export const EMPTY_ORG: OrgInput = {
  slug: '',
  name: '',
  category: 'Hotel',
  description: '',
  description_hi: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  maps_url: '',
  website_url: '',
  review_url: '',
  profile_image: '',
  logo: '',
  wifi_ssid: '',
  wifi_password: '',
  wifi_visible: false,
  qr_status: 'draft',
  status: 'published',
}

/** Client-side checks that mirror the server rules, so errors show before the round trip. */
export function validateOrg(v: OrgInput, requireSlug = true): string | null {
  if (!v.name.trim()) return 'Name is required.'
  if (requireSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.slug))
    return 'Slug may only contain lower-case letters, numbers and single dashes.'
  if (v.review_url && !v.review_url.startsWith('https://')) return 'The review link must start with https://'
  return null
}
