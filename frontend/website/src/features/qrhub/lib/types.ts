// Shapes of the QR Hub API (see .agents/tasks/qr-hub-plan.md sections 4 and 5).

export const CATEGORIES = ['Hotel', 'Restaurant / Dining', 'Banquet / Weddings', 'Rooms', 'Events', 'Other'] as const
export type Category = (typeof CATEGORIES)[number]
export const PLACEMENT_KINDS = ['room', 'table', 'lobby', 'hall', 'desk', 'other'] as const
export type PlacementKind = (typeof PLACEMENT_KINDS)[number]
export type QrStatus = 'active' | 'inactive' | 'draft'
export type OrgStatus = 'published' | 'unpublished' | 'archived'

export interface Hours {
  open: string
  close: string
}

export interface Organization {
  id: string
  slug: string
  name: string
  category: Category
  description: string
  description_hi: string
  phone: string
  whatsapp: string
  email: string
  address: string
  maps_url: string
  website_url: string
  review_url: string
  profile_image: string
  logo: string
  wifi_ssid: string
  wifi_password: string
  wifi_visible: boolean
  qr_status: QrStatus
  status: OrgStatus
  created_at?: string
  updated_at?: string
}
export type OrgInput = Omit<Organization, 'id' | 'created_at' | 'updated_at'>

export interface OrgWithStats extends Organization {
  link_count: number
  placement_count: number
  visits: number
  clicks: number
}

export interface Link {
  id: string
  title: string
  title_hi: string
  destination_url: string
  category: string
  icon: string
  description: string
  sort_order: number
  is_featured: boolean
  status: 'active' | 'disabled'
  show_from: string | null
  show_until: string | null
  hours: Hours | null
  click_count: number
  last_clicked_at?: string | null
}
export type LinkInput = Partial<Omit<Link, 'id' | 'click_count' | 'last_clicked_at' | 'sort_order'>> & {
  title: string
  destination_url: string
}

export interface Placement {
  id: string
  code: string
  label: string
  kind: PlacementKind
  status: 'active' | 'disabled'
}
export interface PlacementRange {
  kind: PlacementKind
  prefix: string
  labelPrefix: string
  from: number
  to: number
  /** Append an unguessable suffix to each code. */
  random?: boolean
}

export interface Offer {
  id: string
  text: string
  text_hi: string
  link_url: string
  starts_at: string
  ends_at: string
}
export type OfferInput = Omit<Offer, 'id'>

export interface Workspace {
  organization: Organization
  links: Link[]
  placements: Placement[]
  offers: Offer[]
}

export interface NameCount {
  name: string
  count: number
}
export interface PlacementStat {
  code: string
  label: string
  scans: number
  clicks: number
}
export interface Analytics {
  totals: { visits: number; scans: number; clicks: number }
  daily: { date: string; visits: number; clicks: number }[]
  devices: NameCount[]
  browsers: NameCount[]
  referrers: NameCount[]
  topLinks: { id: string; title: string; clicks: number }[]
  byPlacement: PlacementStat[]
  byHour: number[] // 24 values, Asia/Kolkata
  byWeekday: number[] // 7 values, Sunday = 0, Asia/Kolkata
}

export interface PublicLink {
  id: string
  title: string
  title_hi: string
  destination_url: string
  category: string
  icon: string
  description: string
  description_hi?: string | null
  is_featured: boolean
  hours: Hours | null
  open_now: boolean
}
export interface PublicOffer {
  id: string
  text: string
  text_hi: string
  link_url: string
}
export interface PublicOrg {
  slug: string
  name: string
  description: string
  description_hi: string
  phone: string
  whatsapp: string
  email: string
  address: string
  maps_url: string
  website_url: string
  review_url: string
  logo: string
  profile_image: string
  wifi_ssid: string | null
  wifi_password: string | null
}
export type PublicHub =
  | { inactive: true }
  | {
      inactive?: false
      organization: PublicOrg
      links: PublicLink[]
      offers: PublicOffer[]
      placement: { code: string; label: string; order_url?: string } | null
    }

export interface SessionUser {
  id: string
  name: string
  email: string
  role: 'guest' | 'staff' | 'admin'
}

export type BulkEntity = 'links' | 'placements' | 'organizations'
export type BulkAction = 'enable' | 'disable' | 'delete'

export interface ImportPreviewRow {
  slug: string
  action: 'create' | 'update' | 'skip'
  links: number
  placements: number
  offers: number
}
export interface ImportResult {
  preview: ImportPreviewRow[]
  errors: string[]
}

export interface RowError {
  index: number
  message: string
}

export interface QrSettings {
  base_url?: string
  poster_cta?: string
  poster_support?: string
  timezone?: string
  [key: string]: unknown
}
export interface IntegrationSummary {
  connected: boolean
  [key: string]: unknown
}
