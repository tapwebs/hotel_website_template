import { AccountLayout } from '@/features/account/AccountLayout'
// Signed-in guests only: noindex, not prerendered (see seo/routes.ts), not in the sitemap.
export default function Account() {
  return <AccountLayout />
}
