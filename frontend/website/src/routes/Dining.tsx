import { useState, type MouseEvent } from 'react'
import { Link } from 'react-router'
import { MessageCircle } from 'lucide-react'
import { Seo } from '@/components/Seo'
import { Picture } from '@/components/Picture'
import { Button } from '@/components/ui/button'
import { LineDivider } from '@/components/LineArt'
import { PageIntro } from '@/components/sections/PageIntro'
import { PageFaqs } from '@/components/sections/PageFaqs'
import { diningHero } from '@/components/heroArt'
import { buildWhatsAppUrl } from '@/components/booking/buildWhatsAppUrl'
import { images } from '@/data/images'
import { meals } from '@/data/dining'
import { menu, type Dish } from '@/data/dining-menu'
import { hotel } from '@/data/hotel'
import { cn, container, inlineLink } from '@/lib/utils'
import { formatINR } from '@/lib/format'
import { PetalDecor } from '@/components/ui/PetalDecor'

const tableUrl = buildWhatsAppUrl('Hello, I would like to ask about dining at the restaurant.')

function DishRow({ dish }: { dish: Dish }) {
  return (
    <li className="grid content-start gap-0.5 py-3">
      <div className="flex items-baseline gap-2">
        <h4 className="font-display text-xl font-semibold text-burgundy-deep">{dish.name}</h4>
        <span aria-hidden="true" className="min-w-4 flex-1 translate-y-[-0.2em] border-b-2 border-dotted border-gold" />
        <span className="shrink-0 text-sm font-medium text-burgundy">{formatINR(dish.price)}</span>
      </div>
      {dish.detail ? <p className="text-sm text-walnut max-md:text-base">{dish.detail}</p> : null}
    </li>
  )
}

export default function Dining() {
  // Phones show one menu category at a time (the chips switch it); md+ shows every category.
  const [activeCat, setActiveCat] = useState(menu[0].id)
  const pickCategory = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    setActiveCat(id)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() =>
      document.getElementById('menu-panel')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }),
    )
  }
  return (
    <>
      <Seo path="/dining" />
      <PageIntro
        {...diningHero}
        breadcrumb="Dining"
        title="Restaurant on Agra Road, Bassi"
        lede="Home-style North Indian cooking and popular fast food, from breakfast to dinner, for guests and visitors alike."
      />
      <section aria-labelledby="restaurant-answer-title" className={cn(container, 'relative isolate grid gap-2 pb-6 md:pb-10')}>
        <PetalDecor variant="dots" side="right" />
        <h2 id="restaurant-answer-title" className="text-h3 text-burgundy-deep">
          Is there a restaurant at the hotel?
        </h2>
        <p className="max-w-[64ch] text-sm text-walnut max-md:text-base md:text-base">
          Yes. {hotel.name} on {hotel.address.street}, Jaipur, has its own pure vegetarian restaurant serving North Indian dishes, tandoor breads and
          popular fast food for breakfast, lunch and dinner. It is open to visitors as well as staying guests, meals can be sent to your
          room, and the kitchen caters weddings and events. To stay the night,{' '}
          <Link to="/rooms" className={inlineLink}>
            book a Deluxe or Super Deluxe room
          </Link>
          .
        </p>
      </section>
      <div className={cn(container, 'relative isolate grid gap-5 pb-6 md:pb-8 lg:grid-cols-12 lg:gap-8')}>
        <PetalDecor variant="bottom" side="left" />
        <Picture
          image={images.dining.hero}
          sizes="(max-width: 767px) calc(100vw - 2rem), (min-width: 1024px) 40vw, 100vw"
          imgClassName="m-parallax"
          className="aspect-[16/9] overflow-hidden rounded-md lg:col-span-5 lg:aspect-[4/3] lg:self-center"
        />
        <section aria-labelledby="meals-title" className="m-reveal grid content-center gap-3 lg:col-span-7 lg:pl-6">
          <h2 id="meals-title" className="text-h2 text-burgundy-deep">
            Three meals, every day
          </h2>
          <dl className="grid gap-3">
            {meals.map((m) => (
              <div key={m.name} className="grid gap-0.5 border-t border-gold pt-3">
                <dt className="font-display text-2xl text-burgundy">{m.name}</dt>
                <dd className="text-sm text-walnut max-md:text-base md:text-base">{m.detail}</dd>
              </div>
            ))}
          </dl>
          <Button asChild variant="outline" className="min-h-11 justify-self-start">
            <a href={tableUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden="true" /> Ask on WhatsApp
            </a>
          </Button>
        </section>
      </div>

      <section aria-labelledby="menu-title" className="pattern-buti bg-ivory">
        <div className={cn(container, 'py-8 md:py-14')}>
          <header className="grid justify-items-center gap-2 text-center">
            <LineDivider className="h-5 w-40 text-gold" />
            <h2 id="menu-title" className="text-h2 text-burgundy-deep">
              The menu: pure vegetarian
            </h2>
            <p className="max-w-[48ch] text-sm text-walnut max-md:text-base">
              Our pure vegetarian menu, with prices in rupees. Some dishes may be unavailable on a given day, so{' '}
              <Link to="/contact" className={inlineLink}>
                call or WhatsApp to check
              </Link>
              .
            </p>
          </header>

          <nav
            aria-label="Menu categories"
            className="sticky top-16 z-20 max-md:top-14 -mx-4 mt-5 border-y border-gold/50 bg-ivory/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:top-[4.5rem]"
          >
            <ul className="flex snap-x gap-2 overflow-x-auto py-2 [scrollbar-width:none] lg:justify-center [&::-webkit-scrollbar]:hidden">
              {menu.map((c) => (
                <li key={c.id} className="shrink-0 snap-start">
                  <a
                    href={`#menu-${c.id}`}
                    onClick={(e) => pickCategory(e, c.id)}
                    aria-current={c.id === activeCat ? 'true' : undefined}
                    className="inline-flex min-h-11 items-center rounded-full border border-gold bg-cream px-4 text-sm font-medium text-walnut hover:bg-burgundy hover:text-ivory focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy aria-[current]:border-burgundy aria-[current]:bg-burgundy aria-[current]:text-ivory"
                  >
                    {c.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div id="menu-panel" className="mx-auto mt-6 max-w-4xl scroll-mt-32 md:scroll-mt-36">
            {menu.map((c) => (
              <section
                key={c.id}
                id={`menu-${c.id}`}
                aria-labelledby={`menu-${c.id}-title`}
                className={cn('rounded-md border border-gold/40 bg-cream/70 px-4 py-6 shadow-sm md:px-10 md:py-8', c.id !== activeCat && 'hidden')}
              >
                <header className="mb-4 grid gap-0.5 text-center">
                  <h3 id={`menu-${c.id}-title`} className="font-display text-3xl font-semibold text-burgundy md:text-4xl">
                    {c.name}
                  </h3>
                  <p className="text-sm italic text-muted-foreground max-md:text-base">
                    {c.blurb} <span className="not-italic">({c.dishes.length} dishes)</span>
                  </p>
                  <LineDivider className="mx-auto mt-1 h-4 w-28 text-gold" />
                </header>
                <ul className="grid gap-x-12 divide-y divide-gold/20 md:grid-cols-2 md:divide-y-0 md:[&>li]:border-b md:[&>li]:border-gold/20">
                  {c.dishes.map((d) => (
                    <DishRow key={d.name} dish={d} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="catering-title"
        className={cn(container, 'relative isolate grid gap-5 py-8 md:grid-cols-[1fr_0.8fr] md:items-center md:gap-10 md:py-14')}
      >
        <PetalDecor variant="top" side="right" />
        <div className="m-reveal grid gap-3">
          <h2 id="catering-title" className="text-h2 text-burgundy-deep">
            Can the kitchen cater my celebration?
          </h2>
          <p className="max-w-[50ch] text-sm text-walnut max-md:text-base md:text-base">
            Yes, we cater events. Our kitchen plans menus with you for weddings, engagements, birthdays and corporate dinners, served in the
            banquet hall for around 120 guests or on the lawn for 1,500 to 2,000. Power backup, parking and{' '}
            <Link to="/rooms" className={inlineLink}>
              rooms for family and guests
            </Link>{' '}
            are on site, and pricing is shared on enquiry.
          </p>
          <Button asChild size="lg" className="justify-self-start">
            <Link to="/weddings-events">Plan catering for your event</Link>
          </Button>
          <p className="text-sm text-walnut">
            See the{' '}
            <Link to="/gallery?category=Banquet" className={inlineLink}>
              banquet hall photos
            </Link>{' '}
            in our gallery, or the{' '}
            <Link to="/about#facilities" className={inlineLink}>
              hotel’s facilities
            </Link>
            .
          </p>
        </div>
        <Picture
          image={images.dining.kitchen}
          sizes="(max-width: 767px) calc(100vw - 2rem), (min-width: 768px) 40vw, 100vw"
          imgClassName="m-parallax"
          className="aspect-[16/10] overflow-hidden rounded-md"
        />
      </section>

      <PageFaqs path="/dining" title="Questions about the restaurant" />
    </>
  )
}
