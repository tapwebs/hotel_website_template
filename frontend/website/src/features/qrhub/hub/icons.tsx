import { BedDouble, CalendarCheck, CalendarHeart, ExternalLink, Globe, Image, Mail, Phone, Star, Utensils, Wifi } from 'lucide-react'
import type { ComponentType } from 'react'
import { GoogleMapsIcon } from '@/features/qrhub/components/icons/GoogleMapsIcon'
import { InstagramIcon } from '@/features/qrhub/components/icons/InstagramIcon'
import { WhatsAppIcon } from '@/features/qrhub/components/icons/WhatsAppIcon'

/** Brand glyphs are drawn at ~24px (size-6) inside the circle; line icons stay at size-5. */
export const BRAND_ICONS = new Set<unknown>([GoogleMapsIcon, InstagramIcon, WhatsAppIcon])

type HubIcon = ComponentType<{ className?: string }>

const BY_NAME: Record<string, HubIcon> = {
  phone: Phone,
  call: Phone,
  'map-pin': GoogleMapsIcon,
  map: GoogleMapsIcon,
  directions: GoogleMapsIcon,
  'bed-double': BedDouble,
  bed: BedDouble,
  rooms: BedDouble,
  'calendar-check': CalendarCheck,
  // lucide 1.x has no brand icons, so Instagram is drawn above
  instagram: InstagramIcon,
  utensils: Utensils,
  dining: Utensils,
  'party-popper': CalendarHeart,
  calendar: CalendarHeart,
  events: CalendarHeart,
  image: Image,
  gallery: Image,
  globe: Globe,
  mail: Mail,
  'message-circle': WhatsAppIcon,
  whatsapp: WhatsAppIcon,
  star: Star,
  wifi: Wifi,
}

/** Icon for a hub link: the admin's icon name if we know it, otherwise guessed from the destination. */
export function hubIcon(name: string, url: string): HubIcon {
  const byName = BY_NAME[name.trim().toLowerCase()]
  if (byName) return byName
  if (url.startsWith('tel:')) return Phone
  if (url.startsWith('mailto:')) return Mail
  if (/wa\.me|whatsapp/i.test(url)) return WhatsAppIcon
  if (/maps|goo\.gl|share\.google/i.test(url)) return GoogleMapsIcon
  if (/instagram\.com/i.test(url)) return InstagramIcon
  return ExternalLink
}
