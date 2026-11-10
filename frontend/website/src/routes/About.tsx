import { Link } from 'react-router'
import { Accessibility } from 'lucide-react'
import { Seo } from '@/components/Seo'
import { Picture } from '@/components/Picture'
import { PageIntro } from '@/components/sections/PageIntro'
import { aboutHero } from '@/components/heroArt'
import { Facilities } from '@/components/sections/Facilities'
import { BookNowButton } from '@/components/booking/BookNowButton'
import { images } from '@/data/images'
import { hotel } from '@/data/hotel'
import { formatINR } from '@/lib/format'
import { cn, container, inlineLink } from '@/lib/utils'
import { PetalDecor } from '@/components/ui/PetalDecor'
import { PageFaqs } from '@/components/sections/PageFaqs'
import { rooms } from '@/data/rooms'
import { venues } from '@/data/events'

const materials = [
  {
    title: 'Murals',
    body: 'Peacocks by a lake palace, golden peonies, a wishing tree. Painted and relief murals bring Rajasthan’s storytelling indoors.',
  },
  {
    title: 'Wood',
    body: 'Stepped and slatted wood ceilings, walnut doors and carved jali panels warm every corridor and landing.',
  },
  {
    title: 'Marble',
    body: 'Polished marble underfoot, from the reception counter to the banquet hall floor, keeps the rooms bright and cool.',
  },
]

// Every value comes from src/data/* (hotel, rooms, events). Owner, team, opening year and awards are
// not in the data, so they are not shown (owner TODO).
const { address } = hotel
const glance: [string, React.ReactNode][] = [
  ['Address', `${address.street}, ${address.landmark.replace(/^O/, 'o')}, ${address.city}, ${address.region}, ${address.country}`],
  [
    'Phone and WhatsApp',
    <>
      <a key="phone" href={hotel.phoneHref} className={inlineLink}>
        {hotel.phoneDisplay}
      </a>
      {', '}
      <a key="phone2" href={hotel.phoneHrefSecondary} className={inlineLink}>
        {hotel.phoneDisplaySecondary}
      </a>
    </>,
  ],
  [
    'Email',
    <a key="email" href={`mailto:${hotel.email}`} className={inlineLink}>
      {hotel.email}
    </a>,
  ],
  ['Check-in and check-out', `Check-in from ${hotel.checkIn}, check-out by ${hotel.checkOut}`],
  ['Rooms', rooms.map((r) => `${r.name} ${formatINR(r.rate)} a night (${r.occupancy.toLowerCase()})`).join('; ')],
  ['Restaurant', 'Ground floor: North Indian kitchen and fast food, with room service'],
  ['Event venues', venues.map((v) => `${v.name}, ${v.capacityLabel.replace('guests, ', '')} ${v.capacity} guests`).join('; ')],
  ['Access and parking', 'Wheelchair accessible, lift to the guest floors, on-site parking in the front forecourt'],
]

export default function About() {
  return (
    <>
      <Seo path="/about" />
      <PageIntro
        {...aboutHero}
        breadcrumb="About"
        title={`About ${hotel.name}`}
        lede="We built TapMenu Grand for travellers and families who want the feel of a luxury resort stay, without a grand bill."
      />

      <section aria-labelledby="what-is-title" className={cn(container, 'relative isolate grid gap-3 pb-16')}>
        <PetalDecor variant="dots" side="left" />
        <h2 id="what-is-title" className="text-h3 text-burgundy-deep">
          What is {hotel.name}?
        </h2>
        <p className="max-w-[64ch] text-walnut">
          {hotel.name} is a premier resort and hotel with fine dining and event venues on {hotel.address.street}, {hotel.address.city}, {hotel.address.region}.
          It offers{' '}
          <Link to="/rooms" className={inlineLink}>
            Deluxe and Super Deluxe rooms
          </Link>{' '}
          from {formatINR(hotel.priceFrom)} a night, a{' '}
          <Link to="/dining" className={inlineLink}>
            North Indian restaurant
          </Link>
          , and a{' '}
          <Link to="/weddings-events" className={inlineLink}>
            banquet hall and wedding lawn
          </Link>
          , with wheelchair access, a lift and on-site parking.{' '}
          <Link to="/contact" className={inlineLink}>
            Find us and get directions
          </Link>
          .
        </p>
      </section>

      <section
        aria-labelledby="story-title"
        className={cn(container, 'relative isolate grid gap-12 pb-20 max-md:gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:pb-28')}
      >
        <PetalDecor variant="bottom" side="right" />
        {/* Photo is mostly sky at the top: a square crop anchored low frames the building, not the clouds. */}
        <Picture
          image={images.about.hero}
          sizes="(max-width: 767px) calc(100vw - 2rem), (min-width: 1024px) 36vw, 448px"
          className="m-reveal mx-auto aspect-square w-full max-w-md overflow-hidden rounded-md border-b-4 border-gold"
          imgClassName="object-[50%_85%]"
        />
        <div className="grid gap-5">
          <h2 id="story-title" className="text-h2 text-burgundy-deep">
            A contemporary luxury destination
          </h2>
          <p className="max-w-[56ch] text-walnut">
            Our architectural tower, with its elegant wood-clad strip and gold trim, offers serene views of the central gardens.
            Beside it runs a modern two-storey wing. The restaurant is on the ground floor, the banquet hall is in the basement,
            and a large open lawn made for celebrations lies beside the resort.
          </p>
          <p className="max-w-[56ch] text-walnut">
            Inside, the idea is simple: premium interiors at accessible prices. Rooms start at ₹2,000 a night, and every one comes with a
            balcony, AC and Wi-Fi.
          </p>
        </div>
      </section>

      <section aria-labelledby="design-title" className="pattern-jali on-dark bg-walnut text-cream">
        <div className={cn(container, 'py-20 lg:py-28')}>
          <h2 id="design-title" className="mb-12 max-md:mb-8 max-w-[22ch] text-h2 text-ivory">
            Murals, wood and marble
          </h2>
          <div className="m-stagger grid gap-6 md:grid-cols-12 max-md:gap-4">
            <Picture
              image={images.about.muralPeacock}
              sizes="(min-width: 768px) 58vw, 100vw"
              className="aspect-[4/3] overflow-hidden rounded-md md:col-span-7"
            />
            <Picture
              image={images.about.muralPeony}
              sizes="(min-width: 768px) 40vw, 100vw"
              className="aspect-[4/3] overflow-hidden rounded-md md:col-span-5 md:mt-24 md:aspect-[3/4]"
            />
          </div>
          <dl className="m-stagger mt-14 grid gap-10 md:grid-cols-3 max-md:mt-10 max-md:gap-6">
            {materials.map((m) => (
              <div key={m.title} className="grid content-start gap-2 border-t border-gold/50 pt-5">
                <dt className="font-display text-3xl text-gold-soft">{m.title}</dt>
                <dd className="text-cream/85">{m.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section
        aria-labelledby="arrival-title"
        className={cn(container, 'relative isolate grid gap-6 py-20 md:grid-cols-2 lg:py-28 max-md:grid-cols-2 max-md:gap-3')}
      >
        <PetalDecor variant="top" side="left" />
        <div className="grid content-start gap-5 md:col-span-2 md:mb-6 max-md:col-span-2 max-md:mb-3">
          <h2 id="arrival-title" className="text-h2 text-burgundy-deep">
            Your arrival
          </h2>
          <p className="max-w-[56ch] text-walnut">
            A white marble reception framed by sculpted leaf pillars, then the lift lobby under a stepped wood ceiling. Check-in is from{' '}
            {hotel.checkIn}.
          </p>
        </div>
        <Picture
          image={images.about.arrival}
          sizes="(max-width: 767px) 50vw, (min-width: 768px) 46vw, 100vw"
          className="m-reveal aspect-[4/5] overflow-hidden rounded-md"
        />
        <Picture
          image={images.about.wood}
          sizes="(max-width: 767px) 50vw, (min-width: 768px) 46vw, 100vw"
          className="m-reveal aspect-[4/5] overflow-hidden rounded-md md:mt-16"
        />
      </section>

      <Facilities id="facilities" title="Facilities at the hotel" className="pt-0 lg:pt-0" />

      <section aria-labelledby="access-title" className="pattern-buti bg-ivory">
        <div className={cn(container, 'grid gap-6 py-16 md:grid-cols-[auto_1fr_auto] md:items-center')}>
          <Accessibility className="size-10 text-burgundy" aria-hidden="true" />
          <div className="grid gap-2">
            <h2 id="access-title" className="text-h3 text-burgundy-deep">
              Accessibility
            </h2>
            <p className="max-w-[60ch] text-walnut">
              The hotel is wheelchair accessible, with a lift serving the guest floors. Tell us about any access needs in your request and
              we will prepare for your arrival.
            </p>
          </div>
          <BookNowButton size="lg" className="justify-self-start" />
        </div>
      </section>

      <section aria-labelledby="glance-title" className={cn(container, 'grid gap-6 py-20 max-md:gap-4 max-md:py-12 lg:py-28')}>
        <h2 id="glance-title" className="text-h2 text-burgundy-deep">
          {hotel.name} at a glance
        </h2>
        <p className="max-w-[64ch] text-walnut">
          The key facts in one place: where we are, how to reach the front desk, room rates and what is on site. For directions and the map,
          see{' '}
          <Link to="/contact" className={inlineLink}>
            contact and directions
          </Link>
          ; to see the murals, lobby and banquet hall, browse the{' '}
          <Link to="/gallery" className={inlineLink}>
            hotel photo gallery
          </Link>
          .
        </p>
        <div className="m-reveal max-w-4xl overflow-x-auto">
          <table className="w-full border-t border-border text-left text-walnut">
            <caption className="sr-only">Key facts about {hotel.name}</caption>
            <tbody>
              {glance.map(([label, value]) => (
                <tr key={label} className="border-b border-border align-top">
                  <th scope="row" className="w-1/3 py-3 pr-4 font-semibold max-md:w-2/5 max-md:text-sm">
                    {label}
                  </th>
                  <td className="py-3 max-md:text-sm">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <PageFaqs path="/about" title="Questions about the hotel and its facilities" />
    </>
  )
}
