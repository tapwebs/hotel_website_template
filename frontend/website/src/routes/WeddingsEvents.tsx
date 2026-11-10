import { Link } from 'react-router'
import { Check } from 'lucide-react'
import { Seo } from '@/components/Seo'
import { Picture } from '@/components/Picture'
import { PageIntro } from '@/components/sections/PageIntro'
import { PageFaqs } from '@/components/sections/PageFaqs'
import { weddingsHero } from '@/components/heroArt'
import { hotel } from '@/data/hotel'
import { EventEnquiryForm } from '@/components/events/EventEnquiryForm'
import { images } from '@/data/images'
import { occasions, packages, venues } from '@/data/events'
import { cn, container, inlineLink } from '@/lib/utils'
import { PetalDecor } from '@/components/ui/PetalDecor'

// Facts from src/data/events.ts (venues, packages, occasions); nothing beyond them.
const venueComparison = [
  ['Guests', 'Around 120', '1,500 to 2,000'],
  ['Setting', 'Indoors: marble floors, crystal chandeliers, jali ceilings', 'Open sky, with room for baraat, mandap and stage'],
  ['Best for', 'Engagements, birthdays, anniversaries, retirement parties, corporate dinners, intimate rituals', 'Weddings and receptions'],
  ['Included', 'Catering from our kitchen, power backup, parking', 'Catering from our kitchen, power backup, parking'],
] as const

export default function WeddingsEvents() {
  return (
    <>
      <Seo path="/weddings-events" />

      <PageIntro
        {...weddingsHero}
        breadcrumb="Weddings & Events"
        title="Banquet Hall & Grand Wedding Lawn"
        lede="A marble hall for 120, an open lawn for up to 2,000, a kitchen that caters both and rooms for the family upstairs."
      />

      <section aria-labelledby="venues-title" className={cn(container, 'relative isolate py-20 lg:py-28')}>
        <PetalDecor variant="top" side="left" />
        <div className="mb-14 grid gap-3 max-md:mb-8">
          <h2 id="venues-title" className="text-h3 text-burgundy-deep">
            How many guests can the venues hold?
          </h2>
          <p className="max-w-[64ch] text-walnut">
            {hotel.name} on {hotel.address.street}, {hotel.address.city}, has two event venues. The indoor banquet hall seats around 120 guests, and the
            outdoor function lawn hosts around 1,500 to 2,000. Our kitchen offers{' '}
            <Link to="/dining" className={inlineLink}>
              catering from our kitchen
            </Link>{' '}
            for both, with{' '}
            <Link to="/rooms" className={inlineLink}>
              rooms for family and guests
            </Link>{' '}
            upstairs, plus power backup and on-site parking for both venues.
          </p>
        </div>
        <div className="m-stagger grid gap-14 md:grid-cols-2 md:gap-10 max-md:gap-8">
          {venues.map((v) => (
            <article key={v.id} className="grid content-start gap-4 border-t border-gold pt-6">
              <p className="font-display text-7xl leading-none text-burgundy tabular-nums sm:text-8xl max-md:text-6xl">
                {v.capacity}
                <span className="sr-only"> {v.capacityLabel}</span>
              </p>
              <h3 className="text-h3 text-burgundy-deep">{v.name}</h3>
              <p className="max-w-[46ch] text-walnut">{v.detail}</p>
            </article>
          ))}
        </div>
        <div className="m-reveal mt-14 overflow-x-auto max-md:mt-8">
          <table className="w-full min-w-[20rem] border-collapse text-left text-walnut max-md:text-sm">
            <caption className="mb-3 text-left font-display text-2xl text-burgundy">Banquet hall or lawn: at a glance</caption>
            <thead>
              <tr className="border-b border-gold">
                <th scope="col" className="py-3 pr-4 font-semibold text-burgundy-deep">
                  <span className="sr-only">Detail</span>
                </th>
                <th scope="col" className="py-3 pr-4 font-semibold text-burgundy-deep">
                  Indoor banquet hall
                </th>
                <th scope="col" className="py-3 font-semibold text-burgundy-deep">
                  Outdoor function lawn
                </th>
              </tr>
            </thead>
            <tbody>
              {venueComparison.map(([label, hall, lawn]) => (
                <tr key={label} className="border-b border-border align-top">
                  <th scope="row" className="py-3 pr-4 font-semibold text-burgundy-deep">
                    {label}
                  </th>
                  <td className="py-3 pr-4">{hall}</td>
                  <td className="py-3">{lawn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="packages-title" className="pattern-jali on-dark bg-walnut text-cream">
        <div className={cn(container, 'grid gap-12 py-20 max-md:gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:py-28')}>
          <Picture
            image={images.weddings.detail}
            sizes="(max-width: 767px) 100vw, (min-width: 1024px) 40vw, 100vw"
            className="m-reveal aspect-[4/5] overflow-hidden rounded-md max-md:aspect-[4/3]"
          />
          <div className="grid gap-10">
            <div className="grid gap-3">
              <h2 id="packages-title" className="text-h2 text-ivory">
                Wedding packages and catering
              </h2>
              <p className="max-w-[50ch] text-cream/85">
                Every celebration is different, so packages are planned with you: choose venue and catering, or add rooms for the family
                with a wedding stay. Share your date and guest count for pricing. See the{' '}
                <Link to="/gallery?category=Banquet" className="font-semibold text-gold-soft underline underline-offset-4">
                  banquet hall photos
                </Link>{' '}
                and the{' '}
                <Link to="/about#facilities" className="font-semibold text-gold-soft underline underline-offset-4">
                  lift, parking and power backup
                </Link>
                .
              </p>
            </div>
            <div className="m-stagger grid gap-8 sm:grid-cols-2">
              {packages.map((p) => (
                <div key={p.name} className="grid content-start gap-4 border-t border-gold/50 pt-5">
                  <h3 className="font-display text-2xl text-gold-soft">{p.name}</h3>
                  <ul className="grid gap-2 text-sm text-cream/90">
                    {p.includes.map((item) => (
                      <li key={item} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" /> {item}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm font-semibold text-cream">Pricing on enquiry</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <PageFaqs path="/weddings-events" title="Questions about weddings and events" />

      <section aria-labelledby="occasions-title" className={cn(container, 'relative isolate py-20 lg:py-28')}>
        <PetalDecor variant="bottom" side="right" />
        <h2 id="occasions-title" className="mb-10 max-md:mb-6 max-w-[22ch] text-h2 text-burgundy-deep">
          Which celebrations can you host?
        </h2>
        <ul className="m-stagger grid gap-x-10 gap-y-2 sm:grid-cols-2">
          {occasions.map((o) => (
            <li key={o.name} className="grid gap-1 border-t border-border py-5 max-md:py-4">
              <h3 className="font-display text-2xl text-burgundy">{o.name}</h3>
              <p className="text-walnut">{o.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="enquiry-title" className="pattern-buti bg-ivory">
        <div className={cn(container, 'grid gap-10 py-20 max-md:gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:py-28')}>
          <div className="grid content-start gap-4">
            <h2 id="enquiry-title" className="text-h2 text-burgundy-deep">
              Enquire about your date
            </h2>
            <p className="max-w-[44ch] text-walnut">
              Send the details on WhatsApp and the hotel will reply with availability and package options. Prefer to talk? Call{' '}
              <a href={hotel.phoneHref} className={inlineLink}>
                {hotel.phoneDisplay}
              </a>{' '}
              or{' '}
              <a href={hotel.phoneHrefSecondary} className={inlineLink}>
                {hotel.phoneDisplaySecondary}
              </a>{' '}
              or find{' '}
              <Link to="/contact" className={inlineLink}>
                directions to the resort
              </Link>
              .
            </p>
          </div>
          <EventEnquiryForm />
        </div>
      </section>
    </>
  )
}
