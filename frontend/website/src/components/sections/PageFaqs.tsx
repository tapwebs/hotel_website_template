import { Link } from 'react-router'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { faqsFor } from '@/data/faqs'
import { hotel } from '@/data/hotel'
import { cn, container, inlineLink } from '@/lib/utils'

interface PageFaqsProps {
  /** Route path; the questions come from `faqsFor(path)` and match the page's FAQPage JSON-LD. */
  path: string
  /** Section h2, e.g. "Questions about the rooms". */
  title: string
  className?: string
}

/**
 * Topic FAQ block for an inner page, styled like the Contact FAQs. Questions render as h3 (Radix
 * Accordion header) and every answer stays in the prerendered HTML (forceMount). Links to the full
 * policies and FAQs on /contact.
 */
export function PageFaqs({ path, title, className }: PageFaqsProps) {
  const items = faqsFor(path)
  if (!items.length) return null
  return (
    <section id="faq" aria-labelledby="page-faq-title" className={cn('pattern-buti scroll-mt-24 bg-ivory', className)}>
      <div className={cn(container, 'grid gap-10 py-20 max-md:gap-6 max-md:py-12 lg:grid-cols-[0.7fr_1.3fr] lg:py-28')}>
        <div className="grid content-start gap-4">
          <h2 id="page-faq-title" className="text-h2 text-burgundy-deep">
            {title}
          </h2>
          <p className="text-walnut">
            Check-in times, photo ID and payments are covered in our{' '}
            <Link to="/contact#faqs" className={inlineLink}>
              hotel policies and FAQs
            </Link>
            . Something else? Call{' '}
            <a href={hotel.phoneHref} className={inlineLink}>
              {hotel.phoneDisplay}
            </a>{' '}
            or{' '}
            <a href={hotel.phoneHrefSecondary} className={inlineLink}>
              {hotel.phoneDisplaySecondary}
            </a>
            .
          </p>
        </div>
        <Accordion type="single" collapsible className="m-reveal border-t border-border">
          {items.map((f, i) => (
            <AccordionItem key={f.q} value={`page-faq-${i}`} className="border-border">
              <AccordionTrigger className="min-h-14 py-4 font-display text-xl font-medium text-walnut hover:text-burgundy hover:no-underline max-md:text-lg">
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
  )
}
