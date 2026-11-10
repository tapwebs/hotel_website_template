import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, MapPin, MessageCircle, Navigation, Phone } from 'lucide-react'
import { Seo } from '@/components/Seo'
import { Picture } from '@/components/Picture'
import { PageIntro } from '@/components/sections/PageIntro'
import { contactHero } from '@/components/heroArt'
import { Button } from '@/components/ui/button'
import { playError } from '@/lib/sounds'
import { Textarea } from '@/components/ui/textarea'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { faqs } from '@/data/faqs'
import { policies } from '@/data/policies'
import { Field } from '@/components/forms/Field'
import { RequestReady } from '@/components/forms/RequestReady'
import { NamePhoneFields } from '@/components/forms/EnquiryFields'
import { useEnquirySend } from '@/components/forms/useEnquirySend'
import { MapEmbed } from '@/components/MapEmbed'
import { InstagramIcon } from '@/components/InstagramIcon'
import { buildGeneralMessage } from '@/components/booking/buildWhatsAppUrl'
import { phoneSchema } from '@/components/booking/phoneSchema'
import { images } from '@/data/images'
import { hotel } from '@/data/hotel'
import { cn, container, inlineLink } from '@/lib/utils'
import { PetalDecor } from '@/components/ui/PetalDecor'

const contacts = [
  { label: 'Call or WhatsApp (Direct)', value: hotel.phoneDisplayTertiary, href: hotel.phoneHrefTertiary, icon: Phone },
  { label: 'Call or WhatsApp (Front Desk)', value: hotel.phoneDisplay, href: hotel.phoneHref, icon: Phone },
  { label: 'Call or WhatsApp (Reservations)', value: hotel.phoneDisplaySecondary, href: hotel.phoneHrefSecondary, icon: Phone },
  { label: 'Email', value: hotel.email, href: `mailto:${hotel.email}`, icon: Mail },
  { label: 'Instagram', value: hotel.instagramHandle, href: hotel.instagramUrl, icon: InstagramIcon, external: true },
]

export default function Contact() {
  return (
    <>
      <Seo path="/contact" />
      <PageIntro
        {...contactHero}
        breadcrumb="Contact"
        title="Contact & directions"
        lede={
          <>
            {hotel.name}, {hotel.address.street}, {hotel.address.city}, {hotel.address.region}. Opposite the Bharat Petroleum pump. Park in
            the front forecourt.{' '}
            <a href="#faqs" className={inlineLink}>
              Check-in, policies and FAQs
            </a>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button asChild size="lg">
            <a href={hotel.directionsUrl} target="_blank" rel="noopener noreferrer">
              <Navigation aria-hidden="true" /> Get directions
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={hotel.phoneHrefTertiary}>
              <Phone aria-hidden="true" /> Call
              <span className="hidden sm:inline">{hotel.phoneDisplayTertiary}</span>
            </a>
          </Button>
        </div>
      </PageIntro>

      <section
        aria-labelledby="map-title"
        className={cn(container, 'relative isolate grid gap-4 pb-8 lg:grid-cols-[1.4fr_0.6fr] lg:gap-6 lg:pb-16')}
      >
        <PetalDecor variant="bottom" side="right" />
        <h2 id="map-title" className="sr-only">
          Map and directions
        </h2>
        <MapEmbed />
        <div className="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:gap-6">
          <Picture
            image={images.contact.arrival}
            sizes="(min-width: 1024px) 28vw, 100vw"
            className="aspect-[16/9] overflow-hidden rounded-md sm:aspect-[4/3] lg:aspect-[3/4]"
            showCaption={false}
          />
          <p className="flex gap-3 text-walnut">
            <MapPin className="mt-1 size-5 shrink-0 text-burgundy" aria-hidden="true" />
            Turn in at the gate opposite Bharat Petroleum. Parking is in the forecourt, right by the entrance steps.
          </p>
        </div>
      </section>

      <section
        id="directions"
        aria-labelledby="directions-title"
        className={cn(container, 'grid scroll-mt-24 gap-6 pb-12 lg:grid-cols-[1.4fr_0.6fr] lg:pb-20')}
      >
        <div className="m-reveal grid content-start gap-4">
          <h2 id="directions-title" className="text-h2 text-burgundy-deep">
            How do I get to {hotel.name}?
          </h2>
          <p className="max-w-[60ch] text-walnut">
            {hotel.name} is on {hotel.address.street}, {hotel.address.city}, directly opposite the Bharat Petroleum pump. Look for the lit
            sign, turn in at the gate and park in the front forecourt beside the entrance steps.
          </p>
          <ol className="grid max-w-[60ch] list-decimal gap-2 pl-5 text-walnut marker:font-semibold marker:text-burgundy">
            <li>Follow Agra Road (NH-21) to Bassi, {hotel.address.city}.</li>
            <li>Find the Bharat Petroleum pump: the hotel is directly opposite.</li>
            <li>Turn in at the gate and park on site in the front forecourt.</li>
            <li>Walk up the entrance steps to reception.</li>
          </ol>
          <p className="text-walnut">
            <a href={hotel.directionsUrl} target="_blank" rel="noopener noreferrer" className={inlineLink}>
              Get directions to {hotel.name} in Google Maps
            </a>{' '}
            or call{' '}
            <a href={hotel.phoneHref} className={inlineLink}>
              {hotel.phoneDisplay}
            </a>{' '}
            or{' '}
            <a href={hotel.phoneHrefSecondary} className={inlineLink}>
              {hotel.phoneDisplaySecondary}
            </a>{' '}
            or{' '}
            <a href={hotel.phoneHrefTertiary} className={inlineLink}>
              {hotel.phoneDisplayTertiary}
            </a>{' '}
            if you need help on the way.
          </p>
        </div>
        <div className="m-reveal grid content-start gap-3 rounded-md border border-border bg-ivory p-6 text-walnut max-md:p-4">
          <h3 className="text-h3 text-burgundy-deep">Address and timings</h3>
          <address className="grid gap-0.5 not-italic">
            <span className="font-semibold">{hotel.name}</span>
            <span>{hotel.address.street}</span>
            <span>{hotel.address.landmark}</span>
            <span>
              {hotel.address.city}, {hotel.address.region}, {hotel.address.country}
            </span>
            <a href={hotel.phoneHrefTertiary} className={cn('mt-2 w-fit', inlineLink)}>
              {hotel.phoneDisplayTertiary} (Direct)
            </a>
            <a href={hotel.phoneHref} className={cn('w-fit', inlineLink)}>
              {hotel.phoneDisplay} (Front Desk)
            </a>
            <a href={hotel.phoneHrefSecondary} className={cn('w-fit', inlineLink)}>
              {hotel.phoneDisplaySecondary} (Reservations)
            </a>
            <a href={`mailto:${hotel.email}`} className={cn('w-fit break-all', inlineLink)}>
              {hotel.email}
            </a>
          </address>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-border pt-3 text-sm">
            <dt className="font-semibold text-muted-foreground">Check-in</dt>
            <dd>{hotel.checkIn}</dd>
            <dt className="font-semibold text-muted-foreground">Check-out</dt>
            <dd>{hotel.checkOut}</dd>
          </dl>
        </div>
      </section>

      <section aria-labelledby="reach-title" className="pattern-jali bg-walnut text-cream">
        <div className={cn(container, 'grid gap-8 py-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14 lg:py-20')}>
          <div className="on-dark grid content-start gap-4 lg:gap-8">
            <h2 id="reach-title" className="text-h2 text-ivory">
              Reach the hotel
            </h2>
            <ul className="grid gap-2">
              {contacts.map(({ label, value, href, icon: Icon, external }) => (
                <li key={label}>
                  <a
                    href={href}
                    {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="grid min-h-11 grid-cols-[auto_1fr] items-center gap-x-4 rounded-md border-t border-cream/15 py-3 hover:text-gold-soft"
                  >
                    <Icon className="size-5 text-gold" aria-hidden="true" />
                    <span className="grid min-w-0">
                      <span className="text-sm text-cream/80">{label}</span>
                      <span className="font-display text-xl break-all sm:text-2xl">{value}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-sm text-cream/80">
              Check-in {hotel.checkIn}, check-out {hotel.checkOut}.
            </p>
          </div>
          <div className="m-reveal rounded-md bg-cream p-4 text-walnut sm:p-8">
            <h3 className="mb-4 text-h3 text-burgundy-deep">Send us a message</h3>
            <ContactForm />
          </div>
        </div>
      </section>
      {/* Merged from the old /faqs-policies page (301-redirected to /contact#faqs). */}
      <section id="faqs" aria-labelledby="policies-title" className={cn(container, 'relative isolate scroll-mt-24 py-20 lg:py-28')}>
        <PetalDecor variant="bottom" side="left" />
        <h2 id="policies-title" className="mb-3 text-h2 text-burgundy-deep">
          What are the hotel policies?
        </h2>
        <p className="mb-10 max-w-[60ch] text-walnut max-md:mb-6">
          The essentials before you stay: check-in and check-out are both at {hotel.checkIn}, every adult needs a government-issued photo
          ID, and cash, UPI and cards are accepted. Children and visitors are welcome.
        </p>
        <dl className="m-reveal grid gap-px overflow-hidden rounded-md border border-border bg-border max-md:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3">
          {policies.map((p) => (
            <div key={p.title} className="grid content-start gap-2 bg-ivory p-6 max-md:gap-1.5 max-md:p-4 max-md:last:col-span-2">
              <dt className="text-sm font-semibold text-muted-foreground">{p.title}</dt>
              <dd className="grid gap-2">
                <span className="font-display text-3xl leading-tight text-burgundy-deep max-md:text-xl">{p.value}</span>
                <span className="text-sm text-walnut">{p.detail}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="faq-title" className="pattern-buti bg-ivory">
        <div className={cn(container, 'grid gap-10 py-20 max-md:gap-6 lg:grid-cols-[0.7fr_1.3fr] lg:py-28')}>
          <div className="grid content-start gap-4">
            <h2 id="faq-title" className="text-h2 text-burgundy-deep">
              Questions guests ask about booking and staying
            </h2>
            <p className="text-walnut">
              Answers on booking, prices, check-in, payments and the location. Something else? Call{' '}
              <a href={hotel.phoneHrefTertiary} className={inlineLink}>
                {hotel.phoneDisplayTertiary}
              </a>
              {', '}
              <a href={hotel.phoneHref} className={inlineLink}>
                {hotel.phoneDisplay}
              </a>{' '}
              or{' '}
              <a href={hotel.phoneHrefSecondary} className={inlineLink}>
                {hotel.phoneDisplaySecondary}
              </a>{' '}
              or use the message form above.
            </p>
            <p className="text-walnut">
              More detail by topic: read the{' '}
              <Link to="/rooms#faq" className={inlineLink}>
                room questions
              </Link>
              ,{' '}
              <Link to="/dining#faq" className={inlineLink}>
                restaurant questions
              </Link>{' '}
              and{' '}
              <Link to="/weddings-events#faq" className={inlineLink}>
                wedding and event questions
              </Link>
              , or see{' '}
              <Link to="/about#facilities" className={inlineLink}>
                every facility at the hotel
              </Link>
              .
            </p>
            <p className="text-walnut">
              Ready to stay?{' '}
              <Link to="/rooms" className={inlineLink}>
                Compare Deluxe and Super Deluxe room prices
              </Link>
              .
            </p>
          </div>
          <Accordion type="single" collapsible className="m-reveal border-t border-border">
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`faq-${i}`} className="border-border">
                <AccordionTrigger className="min-h-14 py-4 font-display text-xl font-medium max-md:text-lg text-walnut hover:text-burgundy hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                {/* forceMount keeps every answer in the prerendered HTML; closed answers are hidden visually. */}
                <AccordionContent forceMount className="max-w-[62ch] text-base text-walnut in-data-[state=closed]:hidden">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </>
  )
}

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your name.'),
  phone: phoneSchema,
  message: z.string().trim().min(5, 'Write a short message.').max(800, 'Keep your message under 800 characters.'),
})
type ContactValues = z.infer<typeof schema>

function ContactForm() {
  const { ready, clear, open } = useEnquirySend()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactValues>({ resolver: zodResolver(schema), defaultValues: { name: '', phone: '', message: '' } })

  const send = (channel: 'whatsapp' | 'email') =>
    handleSubmit((v) => {
      const message = buildGeneralMessage(v)
      open(channel, message, 'Enquiry from the website')
    }, playError)

  if (ready) return <RequestReady {...ready} onEdit={clear} />

  return (
    <form noValidate onSubmit={send('whatsapp')} className="grid gap-5" aria-label="General enquiry">
      <div className="grid gap-5 sm:grid-cols-2">
        <NamePhoneFields
          nameId="ct-name"
          phoneId="ct-phone"
          nameProps={register('name')}
          phoneProps={register('phone')}
          nameError={errors.name?.message}
          phoneError={errors.phone?.message}
        />
      </div>
      <Field id="ct-message" label="Message" error={errors.message?.message}>
        {(aria) => (
          <Textarea
            {...aria}
            {...register('message')}
            rows={4}
            autoComplete="off"
            placeholder="Enter your message"
          />
        )}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button type="submit" size="lg">
          <MessageCircle aria-hidden="true" /> Send on WhatsApp
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={send('email')}>
          <Mail aria-hidden="true" /> Send by Email
        </Button>
      </div>
    </form>
  )
}
