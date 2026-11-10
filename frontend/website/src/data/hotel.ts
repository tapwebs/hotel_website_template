// Hotel facts (DESIGN-PLAN §1, §2). Single source for contact details.

export const hotel = {
  name: 'TapMenu Grand Resort & Spa',
  shortName: 'TapMenu Grand',
  domain: 'localhost',
  url: 'http://localhost:5173',
  phoneDisplay: '+91 00000 00000',
  phoneHref: 'tel:+910000000000',
  whatsappNumber: '910000000000',
  phoneDisplaySecondary: '+91 00000 00001',
  phoneHrefSecondary: 'tel:+910000000001',
  whatsappNumberSecondary: '910000000001',
  phoneDisplayTertiary: '+91 00000 00002',
  phoneHrefTertiary: 'tel:+910000000002',
  whatsappNumberTertiary: '910000000002',
  contactLines: [
    {
      id: 'direct',
      label: 'Direct Line',
      phoneDisplay: '+91 00000 00002',
      phoneHref: 'tel:+910000000002',
      whatsappNumber: '910000000002',
    },
    {
      id: 'primary',
      label: 'Front Desk',
      phoneDisplay: '+91 00000 00000',
      phoneHref: 'tel:+910000000000',
      whatsappNumber: '910000000000',
    },
    {
      id: 'secondary',
      label: 'Reservations (Alt)',
      phoneDisplay: '+91 00000 00001',
      phoneHref: 'tel:+910000000001',
      whatsappNumber: '910000000001',
    },
  ] as const,
  phones: ['+91 00000 00000', '+91 00000 00001'] as const,
  email: 'contact@example.com',
  instagramHandle: '@tapmenu_hospitality',
  instagramUrl: 'https://instagram.com/example',
  address: {
    street: '100 Hospitality Boulevard',
    landmark: 'Grand Central Plaza',
    city: 'Metropolis',
    region: 'Metro State',
    postalCode: '100001',
    country: 'India',
  },
  mapEmbedUrl: 'https://www.google.com/maps?q=Hospitality+Boulevard&hl=en&z=15&output=embed',
  directionsUrl: 'https://maps.google.com',
  checkIn: '11:00 AM',
  checkOut: '11:00 AM',
  priceFrom: 2000,
} as const

/** Public Google Business Profile rating, owner-supplied. Update `asOf` whenever the numbers change. */
export const googleReviews = { rating: 4.3, count: 14, asOf: 'November 2026' } as const

/** Date the page facts (rates, rating, hours) were last checked. Bump when content changes. Feeds WebPage.dateModified. */
export const siteUpdated = '2026-11-01'

export const nav = [
  { to: '/rooms', label: 'Rooms' },
  { to: '/weddings-events', label: 'Weddings & Events' },
  { to: '/dining', label: 'Dining' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
] as const

/** Website developer credit. One source for the footer, head tags and structured data. */
export const developer = { name: 'TAPWEBS', url: 'https://tapwebs.in' } as const
