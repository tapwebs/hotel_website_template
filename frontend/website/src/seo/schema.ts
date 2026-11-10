// Per-page JSON-LD graphs. Only facts from src/data/*. No aggregateRating or review markup:
// reviews.ts holds owner-supplied, anonymous reviews with no source, and Google ignores
// self-serving review markup on a LodgingBusiness anyway.
// The Hotel node is the single business entity: Hotel ⊂ LodgingBusiness ⊂ LocalBusiness ⊂
// Organization and Place, so it also fills the Organization and Place roles without a duplicate.
import { developer, hotel, siteUpdated } from '@/data/hotel'
import { roomAmenities, rooms } from '@/data/rooms'
import { facilities } from '@/data/facilities'
import { faqsFor } from '@/data/faqs'
import { venues } from '@/data/events'
import { fallbackSrc, gallery, images, type ImageSlug, type SiteImage } from '@/data/images'
import { absoluteUrl, SITE_URL } from './fit'
import { routeMeta } from './routes'

type Node = Record<string, unknown>

const HOTEL_ID = `${SITE_URL}/#hotel`
const WEBSITE_ID = `${SITE_URL}/#website`
const ref = (id: string) => ({ '@id': id })

const rates = rooms.map((r) => r.rate)
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`
const telephone = hotel.phoneHref.replace('tel:', '').replace(/^\+91/, '+91-')
const telephoneSecondary = hotel.phoneHrefSecondary.replace('tel:', '').replace(/^\+91/, '+91-')
const telephones = [telephone, telephoneSecondary]

/** ImageObject for a real photo (AI renders are never marked up). Width/height match the fallback file. */
const imageObject = (image: SiteImage): Node => {
  const src = fallbackSrc(image)
  const w = Number(src.match(/-(\d+)\.webp$/)![1])
  return {
    '@type': 'ImageObject',
    contentUrl: `${SITE_URL}${src}`,
    name: image.alt.split(':')[0].slice(0, 110),
    caption: image.alt,
    creditText: hotel.name,
    creator: ref(HOTEL_ID),
    copyrightNotice: `© 2026 ${hotel.name}`,
    width: w,
    height: Math.round((image.height * w) / image.width),
  }
}

const fromGallery = (slug: ImageSlug) => gallery.find((g) => g.image.slug === slug)!.image

// The photo in each page's hero (the same images as components/heroArt; keep in sync). Photos only:
// /contact uses the arrival photo on the page because its hero image is an AI render.
const pageImage: Record<string, SiteImage> = {
  '/': images.home.hero,
  '/rooms': fromGallery('room-window-view'),
  '/dining': images.home.diningTeaser,
  '/weddings-events': images.weddings.hero,
  '/gallery': fromGallery('lobby-jali-chandelier'),
  '/about': images.home.hero,
  '/contact': images.contact.arrival,
  '/hotel-in-bassi-jaipur': images.home.hero,
  '/hotel-near-dausa': images.home.hero,
  '/wedding-venue-in-bassi': images.weddings.hero,
}

/** Per-page share image (1200x630 JPEG in public/og, made by scripts/make-og-images.mjs). Pages not listed use /banner.jpeg. */
const socialImages: Record<string, SiteImage> = {
  '/rooms': fromGallery('room-window-view'),
  '/dining': images.home.diningTeaser,
  '/weddings-events': images.weddings.hero,
  '/gallery': fromGallery('lobby-jali-chandelier'),
  '/about': images.about.hero,
  '/contact': images.contact.arrival,
}
export const socialImageFor = (path: string) => {
  const image = socialImages[path]
  return image ? { url: `${SITE_URL}/og/${image.slug}.jpg`, alt: image.alt } : null
}

/** Absolute URLs of the real photos shown on a page, for the image sitemap. */
export const sitemapImagesFor = (path: string): string[] => {
  const list = path === '/gallery' ? gallery.filter((g) => g.image.kind === 'photo').map((g) => g.image) : []
  const hero = pageImage[path]
  return [...new Set([...(hero ? [hero] : []), ...list].map((i) => `${SITE_URL}${fallbackSrc(i)}`))]
}

const address = {
  '@type': 'PostalAddress',
  streetAddress: `${hotel.address.street}, ${hotel.address.landmark.toLowerCase()}`,
  addressLocality: hotel.address.city,
  addressRegion: hotel.address.region,
  postalCode: hotel.address.postalCode,
  addressCountry: 'IN',
}

const hotelNode: Node = {
  '@type': 'Hotel',
  '@id': HOTEL_ID,
  name: hotel.name,
  alternateName: ['TapMenu Grand', 'TapMenu Grand Resort', 'TapMenu Luxury Resort & Spa'],
  disambiguatingDescription: 'Luxury resort and restaurant at 100 Hospitality Boulevard, Metropolis.',
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/icon-192.png`,
  image: [`${SITE_URL}/banner.jpeg`, imageObject(images.home.hero)],
  telephone: telephones,
  email: hotel.email,
  address,
  geo: { '@type': 'GeoCoordinates', latitude: 28.6139, longitude: 77.2090 },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '00:00',
      closes: '23:59',
    },
  ],
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'reservations',
      telephone,
      email: hotel.email,
      areaServed: 'IN',
      availableLanguage: ['en', 'hi'],
    },
    {
      '@type': 'ContactPoint',
      contactType: 'reservations',
      telephone: telephoneSecondary,
      email: hotel.email,
      areaServed: 'IN',
      availableLanguage: ['en', 'hi'],
    },
  ],
  hasMap: hotel.directionsUrl,
  checkinTime: '11:00',
  checkoutTime: '11:00',
  priceRange: `${inr(Math.min(...rates))}–${inr(Math.max(...rates))}`,
  currenciesAccepted: 'INR',
  paymentAccepted: 'Cash, UPI, Credit Card, Debit Card',
  amenityFeature: facilities
    .filter((f) => !f.comingSoon)
    .map((f) => ({ '@type': 'LocationFeatureSpecification', name: f.name, value: true })),
  sameAs: [hotel.instagramUrl, hotel.directionsUrl],
}

const websiteNode: Node = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  url: `${SITE_URL}/`,
  name: hotel.name,
  inLanguage: 'en-IN',
  publisher: ref(HOTEL_ID),
  // The developer is credited as creator only; the hotel stays the publisher and copyright holder.
  creator: { '@type': 'Organization', '@id': `${developer.url}/#organization`, name: developer.name, url: developer.url },
  copyrightHolder: ref(HOTEL_ID),
  copyrightYear: 2026,
}

const webPage = (path: string, type = 'WebPage', extra: Node = {}): Node => ({
  '@type': type,
  '@id': `${absoluteUrl(path)}#webpage`,
  url: absoluteUrl(path),
  name: routeMeta[path].title,
  description: routeMeta[path].description,
  isPartOf: ref(WEBSITE_ID),
  inLanguage: 'en-IN',
  dateModified: siteUpdated,
  ...(pageImage[path] ? { primaryImageOfPage: imageObject(pageImage[path]) } : {}),
  ...(path === '/' ? {} : { breadcrumb: ref(`${absoluteUrl(path)}#breadcrumb`) }),
  ...extra,
})

const breadcrumb = (path: string): Node => ({
  '@type': 'BreadcrumbList',
  '@id': `${absoluteUrl(path)}#breadcrumb`,
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
    { '@type': 'ListItem', position: 2, name: routeMeta[path].label, item: absoluteUrl(path) },
  ],
})

/** FAQPage for exactly the questions visible on the page (faqsFor), or nothing. */
const faqPage = (path: string): Node[] => {
  const items = faqsFor(path)
  if (!items.length) return []
  return [
    {
      '@type': 'FAQPage',
      '@id': `${absoluteUrl(path)}#faq`,
      isPartOf: ref(`${absoluteUrl(path)}#webpage`),
      mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ]
}

const pageNodes: Record<string, () => Node[]> = {
  '/': () => [hotelNode, websiteNode, webPage('/', 'WebPage', { about: ref(HOTEL_ID) })],
  '/rooms': () => [
    webPage('/rooms', 'WebPage', { about: ref(HOTEL_ID) }),
    ...rooms.map((r) => ({
      '@type': 'Offer',
      name: r.name,
      url: absoluteUrl('/rooms'),
      price: r.rate,
      priceCurrency: 'INR',
      priceSpecification: { '@type': 'UnitPriceSpecification', price: r.rate, priceCurrency: 'INR', unitText: 'per night' },
      offeredBy: ref(HOTEL_ID),
      itemOffered: {
        '@type': 'HotelRoom',
        name: r.name,
        description: r.summary,
        image: imageObject(r.image),
        bed: { '@type': 'BedDetails', typeOfBed: r.bed },
        occupancy: { '@type': 'QuantitativeValue', maxValue: r.maxAdults, unitText: 'adults' },
        amenityFeature: roomAmenities.map((a) => ({ '@type': 'LocationFeatureSpecification', name: a, value: true })),
      },
    })),
  ],
  '/dining': () => [
    webPage('/dining'),
    {
      '@type': 'Restaurant',
      '@id': `${SITE_URL}/#restaurant`,
      name: `Restaurant at ${hotel.name}`,
      servesCuisine: ['North Indian', 'Rajasthani', 'Chinese', 'Fast food'],
      address,
      geo: { '@type': 'GeoCoordinates', latitude: 26.8821594, longitude: 76.2272955 },
      priceRange: '₹30–₹450',
      telephone: telephones,
      url: absoluteUrl('/dining'),
      hasMenu: absoluteUrl('/dining'),
      image: imageObject(images.dining.kitchen),
      containedInPlace: ref(HOTEL_ID),
    },
  ],
  '/weddings-events': () => [
    webPage('/weddings-events'),
    ...venues.map((v) => ({
      '@type': 'EventVenue',
      '@id': `${SITE_URL}/#${v.id === 'hall' ? 'banquet-hall' : 'function-lawn'}`,
      name: v.name,
      description: v.detail,
      geo: { '@type': 'GeoCoordinates', latitude: 26.8821594, longitude: 76.2272955 },
      maximumAttendeeCapacity: Number(v.capacity.replace(/,/g, '')),
      // No real photo of the lawn exists; the hall uses the banquet photo from the page hero.
      ...(v.id === 'hall' ? { image: imageObject(images.weddings.hero) } : {}),
      address,
      containedInPlace: ref(HOTEL_ID),
    })),
  ],
  '/gallery': () => [
    webPage('/gallery', 'ImageGallery', {
      about: ref(HOTEL_ID),
      image: gallery.filter((g) => g.image.kind === 'photo').map((g) => imageObject(g.image)),
    }),
  ],
  '/hotel-in-bassi-jaipur': () => [webPage('/hotel-in-bassi-jaipur', 'WebPage', { about: ref(HOTEL_ID) })],
  '/hotel-near-dausa': () => [webPage('/hotel-near-dausa', 'WebPage', { about: ref(HOTEL_ID) })],
  '/wedding-venue-in-bassi': () => [webPage('/wedding-venue-in-bassi', 'WebPage', { about: ref(HOTEL_ID) })],
  '/about': () => [webPage('/about', 'AboutPage', { about: ref(HOTEL_ID) })],
  '/privacy-policy': () => [webPage('/privacy-policy')],
  '/contact': () => [webPage('/contact', 'ContactPage', { mainEntity: ref(HOTEL_ID) })],
}

/** One @graph per page, or null for pages without schema (404). Inner pages get a BreadcrumbList. */
export function schemaFor(path: string): Node | null {
  const nodes = pageNodes[path]
  if (!nodes) return null
  // Inner pages carry the Hotel and WebSite nodes too, so every @id reference resolves on the page itself.
  const graph = path === '/' ? [...nodes(), ...faqPage(path)] : [hotelNode, websiteNode, ...nodes(), ...faqPage(path), breadcrumb(path)]
  return { '@context': 'https://schema.org', '@graph': graph }
}
