import { Field, Select } from '@/site/features/qrhub/components/ui/field'
import { Input } from '@/site/features/qrhub/components/ui/input'
import { Switch } from '@/site/features/qrhub/components/ui/switch'
import { Textarea } from '@/site/features/qrhub/components/ui/textarea'
import { CATEGORIES, type OrgInput } from '@/site/features/qrhub/lib/types'

type Section = 'basics' | 'contact' | 'wifi' | 'status'
interface Props {
  value: OrgInput
  onChange: (v: OrgInput) => void
  sections: Section[]
  slugLocked?: boolean
}

/** Organization form groups, shared by the new-organization wizard and the Profile tab. */
export function OrgFields({ value: v, onChange, sections, slugLocked }: Props) {
  const set = <K extends keyof OrgInput>(k: K, val: OrgInput[K]) => onChange({ ...v, [k]: val })
  const text = (k: keyof OrgInput, label: string, extra: { hint?: string; type?: string; placeholder?: string } = {}) => (
    <Field label={label} hint={extra.hint}>
      {(id) => (
        <Input
          id={id}
          type={extra.type ?? 'text'}
          placeholder={extra.placeholder}
          value={String(v[k] ?? '')}
          onChange={(e) => set(k, e.target.value as never)}
        />
      )}
    </Field>
  )
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {sections.includes('basics') && (
        <section className="grid gap-4 sm:grid-cols-2" aria-label="Basics">
          {text('name', 'Name')}
          <Field label="Slug" hint="Lower-case letters, numbers and dashes. It is part of the QR address, so it cannot change later.">
            {(id) => (
              <Input
                id={id}
                value={v.slug}
                disabled={slugLocked}
                onChange={(e) => set('slug', e.target.value.toLowerCase())}
                placeholder="hotel-dream-heavens"
              />
            )}
          </Field>
          <Field label="Category">
            {(id) => (
              <Select id={id} value={v.category} onChange={(e) => set('category', e.target.value as OrgInput['category'])}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
          <span />
          <Field label="Description (English)" className="sm:col-span-2">
            {(id) => <Textarea id={id} rows={3} value={v.description} onChange={(e) => set('description', e.target.value)} />}
          </Field>
          <Field label="Description (Hindi, optional)" className="sm:col-span-2" hint="Falls back to English when empty.">
            {(id) => (
              <Textarea id={id} lang="hi" rows={3} value={v.description_hi} onChange={(e) => set('description_hi', e.target.value)} />
            )}
          </Field>
        </section>
      )}
      {sections.includes('contact') && (
        <section className="grid gap-4 sm:grid-cols-2" aria-label="Contact">
          {text('phone', 'Phone', { type: 'tel', placeholder: '+919876543210' })}
          {text('whatsapp', 'WhatsApp number', { type: 'tel', placeholder: '919876543210' })}
          {text('email', 'Email', { type: 'email' })}
          {text('website_url', 'Website', { type: 'url', placeholder: 'https://example.com' })}
          <div className="sm:col-span-2">{text('address', 'Address')}</div>
          {text('maps_url', 'Directions link (Google Maps)', { type: 'url' })}
          {text('review_url', 'Review link (Tap-One)', {
            type: 'url',
            hint: 'https only. Shows a “Rate your stay” card on the hub. Leave empty to hide it.',
          })}
          {text('logo', 'Logo path or URL', { hint: 'For example /images/logo-badge-320.webp' })}
          {text('profile_image', 'Cover image path or URL')}
        </section>
      )}
      {sections.includes('wifi') && (
        <section className="grid gap-4 sm:grid-cols-2" aria-label="Wi-Fi">
          {text('wifi_ssid', 'Wi-Fi network name')}
          {text('wifi_password', 'Wi-Fi password')}
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch id="wifi-visible" checked={v.wifi_visible} onCheckedChange={(c) => set('wifi_visible', c)} />
            <label htmlFor="wifi-visible" className="text-sm font-semibold">
              Show the Wi-Fi card on the public hub
            </label>
          </div>
        </section>
      )}
      {sections.includes('status') && (
        <section className="grid gap-4 sm:grid-cols-2" aria-label="Status">
          <Field label="QR status" hint="Inactive sends scans to the “unavailable” page.">
            {(id) => (
              <Select id={id} value={v.qr_status} onChange={(e) => set('qr_status', e.target.value as OrgInput['qr_status'])}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="draft">Draft</option>
              </Select>
            )}
          </Field>
          <Field label="Hub page">
            {(id) => (
              <Select id={id} value={v.status} onChange={(e) => set('status', e.target.value as OrgInput['status'])}>
                <option value="published">Published</option>
                <option value="unpublished">Unpublished</option>
                <option value="archived">Archived</option>
              </Select>
            )}
          </Field>
        </section>
      )}
    </div>
  )
}
