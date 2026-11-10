import { Link } from 'react-router'
import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { buildWhatsAppUrl } from '@/components/booking/buildWhatsAppUrl'
import { hotel } from '@/data/hotel'
import { Panel } from './ui'

const faqs: [string, string][] = [
  ['How do I know my booking is confirmed?', 'A new booking is a request. It shows "Awaiting confirmation" until the hotel confirms it, then it turns "Confirmed" on My stays.'],
  ['Can I cancel or change a booking?', 'You can cancel a pending or confirmed booking from its page until check-in. To change dates or rooms, call or WhatsApp the hotel with your reference.'],
  ['How do I pay?', 'Payment is at the hotel unless the hotel tells you otherwise. Nothing is charged online.'],
  ['What are check-in and check-out times?', `Check-in is from ${hotel.checkIn} and check-out is by ${hotel.checkOut}. Ask the hotel if you need an early check-in or a late check-out.`],
  ['Can I add an extra bed or ask for a special meal?', 'Yes. Mention it in special requests when booking, or save bed and meal preferences in your Profile. The hotel confirms extra bed charges.'],
  ['Where can I read the full policies?', 'See FAQs and policies on the Contact page.'],
]

export function Help() {
  const tiles = [
    { icon: Phone, label: 'Call', sub: `${hotel.phoneDisplay} / ${hotel.phoneDisplaySecondary}`, href: hotel.phoneHref },
    { icon: MessageCircle, label: 'WhatsApp', sub: 'Chat with the hotel', href: buildWhatsAppUrl('Hello, I have a question about TapMenu Grand Resort.'), ext: true },
    { icon: MapPin, label: 'Directions', sub: 'Open in Maps', href: hotel.directionsUrl, ext: true },
    { icon: Mail, label: 'Email', sub: hotel.email, href: `mailto:${hotel.email}` },
  ]
  return (
    <div className="grid gap-6">
      <h2 className="font-display text-h3 text-walnut">Help and hotel info</h2>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ icon: Icon, label, sub, href, ext }) => (
          <li key={label}>
            <a
              href={href}
              {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="grid h-full gap-1 rounded-md border border-border bg-ivory p-4 outline-none transition-transform active:scale-[0.98] hover:border-burgundy focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Icon className="size-5 text-burgundy" aria-hidden="true" />
              <span className="font-semibold text-walnut">
                {label}
                {ext ? <span className="sr-only"> (opens in a new tab)</span> : null}
              </span>
              <span className="text-xs break-words text-muted-foreground">{sub}</span>
            </a>
          </li>
        ))}
      </ul>
      <Panel aria-labelledby="stay-info" className="grid gap-3">
        <h3 id="stay-info" className="flex items-center gap-2 font-semibold text-walnut">
          <Clock className="size-4 text-burgundy" aria-hidden="true" /> Your stay
        </h3>
        <dl className="grid grid-cols-2 gap-3 text-walnut">
          <div>
            <dt className="text-xs font-semibold text-muted-foreground uppercase">Check-in</dt>
            <dd>From {hotel.checkIn}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted-foreground uppercase">Check-out</dt>
            <dd>By {hotel.checkOut}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs font-semibold text-muted-foreground uppercase">Address</dt>
            <dd>
              {hotel.address.street}, {hotel.address.landmark}, {hotel.address.city}, {hotel.address.region}
            </dd>
          </div>
        </dl>
      </Panel>
      <Panel aria-labelledby="faq-title" className="grid gap-2">
        <h3 id="faq-title" className="font-semibold text-walnut">
          Common questions
        </h3>
        <Accordion type="single" collapsible>
          {faqs.map(([q, a], i) => (
            <AccordionItem key={q} value={`f${i}`}>
              <AccordionTrigger className="text-base text-walnut">{q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <Button asChild variant="outline" className="w-fit">
          <Link to="/contact#faqs">All FAQs and policies</Link>
        </Button>
      </Panel>
    </div>
  )
}
