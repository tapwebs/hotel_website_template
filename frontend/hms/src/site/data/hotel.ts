// Hotel facts (DESIGN-PLAN §1, §2). Single source for contact details.

export const hotel = {
  name: 'TapMenu Grand Resort & Spa',
  shortName: 'TapMenu Grand',
  domain: 'localhost',
  url: 'http://localhost:5173',
  phoneDisplay: '+91 98765 43210',
  phoneHref: 'tel:+919876543210',
  whatsappNumber: '919876543210',
  phoneDisplaySecondary: '+91 98765 43211',
  phoneHrefSecondary: 'tel:+919876543211',
  whatsappNumberSecondary: '919876543211',
  phones: ['+91 98765 43210', '+91 98765 43211'] as const,
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

export const nav = [
  { to: '/rooms', label: 'Rooms' },
  { to: '/weddings-events', label: 'Weddings & Events' },
  { to: '/dining', label: 'Dining' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
] as const
