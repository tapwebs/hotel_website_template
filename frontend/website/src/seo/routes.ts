// Per-route SEO table. The prerender, sitemap, robots.txt and <Seo> all read from here.
import { hotel, nav } from '@/data/hotel'
import { rooms } from '@/data/rooms'
import { venues } from '@/data/events'
import { formatINR } from '@/lib/format'
import { fitDescription, fitTitle } from './fit'

export interface RouteMeta {
  title: string
  description: string
  /** false = noindex, follow, and left out of the sitemap. */
  indexable: boolean
  /** Overrides the default robots value for noindex pages (default "noindex, follow"). */
  robots?: string
  /** false = not prerendered; served by the SPA shell (index.html). */
  prerender?: false
  /** Breadcrumb label (from `nav`, "Home" for /). */
  label: string
}

const [deluxe, superDeluxe] = rooms
const minRate = formatINR(Math.min(...rooms.map((r) => r.rate)))
const hall = venues.find((v) => v.id === 'hall')!
const label = (to: string) => nav.find((n) => n.to === to)?.label ?? to

export const routeMeta: Record<string, RouteMeta> = {
  '/': {
    title: fitTitle([`${hotel.name} | Rooms & Suites from ${minRate}`]),
    description: fitDescription([
      `${hotel.name}: luxury rooms from ${minRate} a night, a multi-cuisine restaurant, banquet hall for ${hall.capacity} guests and an event lawn.`,
    ]),
    indexable: true,
    label: 'Home',
  },
  '/rooms': {
    title: fitTitle([`Rooms & Suites: Deluxe ${formatINR(deluxe.rate)}, Super Deluxe ${formatINR(superDeluxe.rate)}`]),
    description: fitDescription([
      `${deluxe.name} with king-size bed at ${formatINR(deluxe.rate)} a night, Super Deluxe at ${formatINR(superDeluxe.rate)}. Every room has AC, Wi-Fi, TV, balcony and geyser. Check-in ${hotel.checkIn}.`,
    ]),
    indexable: true,
    label: label('/rooms'),
  },
  '/hotel-in-bassi-jaipur': {
    title: fitTitle(['Hotel in Bassi, Jaipur on Agra Road: Rooms, Dining, Events', 'Hotel in Bassi, Jaipur on Agra Road']),
    description: fitDescription([
      `${hotel.name} is a premier resort in the region: rooms from ${minRate}, a restaurant, banquet hall and lawn. Rated 4.3 on Google.`,
      `A comfortable resort in the region: rooms from ${minRate} a night, a restaurant, a banquet hall and a wedding lawn.`,
    ]),
    indexable: true,
    label: 'Hotel in Bassi',
  },
  '/wedding-venue-in-bassi': {
    title: fitTitle(['Wedding Venue in Bassi, Near Dausa & Jaipur', 'Wedding Venue in Bassi, Jaipur']),
    description: fitDescription([
      `Wedding venue on main highway: a lawn for 1,500 to 2,000 guests, a banquet hall for about ${hall.capacity}, catering and rooms.`,
      `Wedding venue with an event lawn for 1,500 to 2,000 guests, banquet hall for about ${hall.capacity}, complete catering and accommodation rooms.`,
    ]),
    indexable: true,
    label: 'Wedding venue in Bassi',
  },
  '/hotel-near-dausa': {
    title: fitTitle(['Hotel Near Regional Highway Corridor & Metropolis City', 'Hotel Near Major Highway Corridor & Metropolis']),
    description: fitDescription([
      `${hotel.name} is conveniently situated near regional highways: rooms from ${minRate} a night, a pure veg restaurant, a banquet hall and a lawn.`,
    ]),
    indexable: true,
    label: 'Hotel near Dausa',
  },
  '/dining': {
    title: fitTitle(['Multi-Cuisine Vegetarian Restaurant & Dining', 'Fine Dining & Banquet Catering']),
    description: fitDescription([
      `Pure vegetarian North Indian, regional specialties and Chinese dishes, tandoor breads and snacks at ${hotel.name}. Event catering available.`,
    ]),
    indexable: true,
    label: label('/dining'),
  },
  '/weddings-events': {
    title: fitTitle(['Wedding Lawn & Banquet Hall on Agra Road, Bassi, Jaipur', 'Banquet Hall & Wedding Lawn in Bassi']),
    description: fitDescription([
      `Weddings, haldi, mehndi, sangeet, birthdays and corporate events: banquet hall for about ${hall.capacity} guests, lawn for 2,000, and catering.`,
    ]),
    indexable: true,
    label: label('/weddings-events'),
  },
  '/gallery': {
    title: fitTitle(['Hotel Photos, Facade, Banquet Hall & Murals', 'Photo Gallery: Facade, Lobby, Banquet Hall and Murals']),
    description: fitDescription([
      `Photos of the glass and wood facade, marble lobby, guest corridors, banquet hall, brass lights and murals at ${hotel.name}.`,
      `Photos taken at ${hotel.name}: the glass and wood facade, marble lobby, guest corridors, banquet hall, brass lights and murals.`,
    ]),
    indexable: true,
    label: label('/gallery'),
  },
  '/about': {
    // The About page also covers the facilities (there is no separate Facilities page).
    title: fitTitle(['About Us & Hotel Facilities: Modern Hospitality Stays', 'About TapMenu Grand Resort & Facilities Stays']),
    description: fitDescription([
      `${hotel.name}: modern architectural interiors, plus a restaurant, banquet hall, outdoor lawn, lift, parking, power backup and CCTV security.`,
    ]),
    indexable: true,
    label: label('/about'),
  },
  // Also holds the hotel policies and FAQs (the old /faqs-policies page, 301-redirected here).
  '/contact': {
    title: fitTitle([
      'Contact, Directions & FAQs: Grand Central Plaza',
      'Contact, Directions & FAQs: Hospitality Boulevard',
      'Contact, Directions & FAQs',
    ]),
    description: fitDescription([
      `Find ${hotel.name} at ${hotel.address.street}. Call or WhatsApp ${hotel.phoneDisplay} / ${hotel.phoneDisplaySecondary}. Check-in, photo ID, payments and FAQs.`,
      `Find ${hotel.name} at ${hotel.address.street}. Call or WhatsApp ${hotel.phoneDisplay} or ${hotel.phoneDisplaySecondary}. Hotel policies and FAQs.`,
    ]),
    indexable: true,
    label: label('/contact'),
  },
  '/privacy-policy': {
    title: fitTitle(['Privacy Policy: Your Data Protection and Privacy Rights', 'Privacy Policy: Data Protection Rights']),
    description: fitDescription([
      `What ${hotel.name} collects when you enquire or book, how it is used and protected, and how to request access, correction or removal.`,
    ]),
    indexable: true,
    label: 'Privacy Policy',
  },
  // Auth pages: prerendered so the SPA fallback works, but noindex+nofollow and left out of the sitemap and llms.txt.
  '/login': {
    title: fitTitle(['Log in']),
    description: `Log in to your ${hotel.name} account. Log in to see your bookings and manage your profile.`,
    indexable: false,
    robots: 'noindex, nofollow',
    label: 'Log in',
  },
  '/signup': {
    title: fitTitle(['Create an account']),
    description: `Create a ${hotel.name} account. Sign up to reserve rooms online and keep your bookings in one place.`,
    indexable: false,
    robots: 'noindex, nofollow',
    label: 'Sign up',
  },
  // Staff-only dashboard: client-rendered behind login, so it is never prerendered, noindex+nofollow, and out of the sitemap.
  // The staff console moved into the HMS app; /admin only forwards there. Never indexed.
  '/admin': {
    title: fitTitle(['Staff console']),
    description: 'Staff-only console for Hotel Dream Heaven’s.',
    indexable: false,
    robots: 'noindex, nofollow',
    prerender: false,
    label: 'Admin',
  },
  // /app/... only forwards to the HMS host. Never indexed.
  '/app': {
    title: fitTitle(['Staff console']),
    description: 'Staff-only console for Hotel Dream Heaven’s.',
    indexable: false,
    robots: 'noindex, nofollow',
    prerender: false,
    label: 'Staff app',
  },
  // Signed-in guest area and booking flow: client-rendered behind login, never prerendered, noindex+nofollow, out of the sitemap.
  '/account': {
    title: fitTitle(['My account']),
    description: 'Your Hotel Dream Heaven’s account overview.',
    indexable: false,
    robots: 'noindex, nofollow',
    prerender: false,
    label: 'My account',
  },
  '/account/bookings': {
    title: fitTitle(['My bookings']),
    description: 'Your Hotel Dream Heaven’s bookings.',
    indexable: false,
    robots: 'noindex, nofollow',
    prerender: false,
    label: 'My bookings',
  },
  '/account/profile': {
    title: fitTitle(['My profile']),
    description: 'Your Hotel Dream Heaven’s profile and preferences.',
    indexable: false,
    robots: 'noindex, nofollow',
    prerender: false,
    label: 'Profile',
  },
  '/account/help': {
    title: fitTitle(['Help and hotel info']),
    description: 'Contact the hotel, directions, check-in details and answers to common questions.',
    indexable: false,
    robots: 'noindex, nofollow',
    prerender: false,
    label: 'Help',
  },
  '/account/security': {
    title: fitTitle(['Account security']),
    description: 'Change your password or delete your Hotel Dream Heaven’s account.',
    indexable: false,
    robots: 'noindex, nofollow',
    prerender: false,
    label: 'Security',
  },
  '/book': {
    title: fitTitle(['Reserve a room']),
    description: 'Reserve a room at Hotel Dream Heaven’s.',
    indexable: false,
    robots: 'noindex, nofollow',
    prerender: false,
    label: 'Reserve',
  },
  '/book/confirmation': {
    title: fitTitle(['Booking received']),
    description: 'Your Hotel Dream Heaven’s booking request.',
    indexable: false,
    robots: 'noindex, nofollow',
    prerender: false,
    label: 'Booking received',
  },
  '/404': {
    title: fitTitle(['Page Not Found: Hotel in Bassi']),
    description: `This page does not exist. Find rooms, dining and events at ${hotel.name}, Agra Road, Bassi, Jaipur. Use the links below to keep browsing.`,
    indexable: false,
    label: 'Page not found',
  },
}

export const indexablePaths = Object.keys(routeMeta).filter((p) => routeMeta[p].indexable)
