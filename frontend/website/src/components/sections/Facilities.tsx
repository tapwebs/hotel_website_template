import {
  Accessibility,
  ArrowUpDown,
  Bell,
  Car,
  Cctv,
  Landmark,
  PlugZap,
  Shirt,
  Trees,
  Utensils,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { LineDivider } from '@/components/LineArt'
import { Badge } from '@/components/ui/badge'
import { facilities, type FacilityIcon } from '@/data/facilities'
import { cn, container } from '@/lib/utils'
import { PetalDecor } from '@/components/ui/PetalDecor'
import { useReveal } from '@/lib/useReveal'

const icons: Record<FacilityIcon, LucideIcon> = {
  utensils: Utensils,
  landmark: Landmark,
  trees: Trees,
  car: Car,
  'arrow-up-down': ArrowUpDown,
  bell: Bell,
  shirt: Shirt,
  zap: Zap,
  cctv: Cctv,
  accessibility: Accessibility,
  waves: Waves,
  'plug-zap': PlugZap,
}

interface FacilitiesProps {
  title?: string
  headingLevel?: 'h2' | 'h3'
  className?: string
  /** Anchor id, e.g. "facilities" on /about so other pages can link to /about#facilities. */
  id?: string
}

export function Facilities({ title = 'Everything for an easy stay', headingLevel: H = 'h2', className, id }: FacilitiesProps) {
  const listRef = useReveal<HTMLUListElement>()
  return (
    <section
      id={id}
      aria-labelledby="facilities-title"
      className={cn(container, 'pattern-buti py-10 md:py-16 lg:py-28', id && 'scroll-mt-24', className)}
    >
      <PetalDecor variant="bottom" side="right" />
      <LineDivider className="mb-4 h-5 w-48 md:mb-6 text-gold" />
      <H id="facilities-title" className="mb-5 max-w-[20ch] md:mb-12 text-h2 text-burgundy-deep">
        {title}
      </H>
      <ul ref={listRef} className="grid grid-cols-2 gap-2 md:gap-x-10 md:gap-y-0 lg:grid-cols-3">
        {facilities.map((f, i) => {
          const Icon = icons[f.icon]
          return (
            <li
              key={f.name}
              style={{ '--d': `${Math.min(i, 8) * 40}ms` } as React.CSSProperties}
              className="reveal flex gap-2 rounded-md border border-border bg-ivory/60 p-2.5 active:scale-[0.98] md:gap-4 md:rounded-none md:border-0 md:border-t md:bg-transparent md:py-5 md:px-0 md:active:scale-100"
            >
              <Icon
                className={cn('mt-0.5 size-4 shrink-0 md:size-5', f.comingSoon ? 'text-muted-foreground' : 'text-burgundy')}
                aria-hidden="true"
              />
              <div className="grid min-w-0 gap-1">
                <p className="flex flex-wrap items-center gap-1 text-sm font-semibold leading-tight [overflow-wrap:anywhere] text-walnut md:gap-2 md:text-base">
                  {f.name}
                  {f.comingSoon ? (
                    <Badge variant="outline" className="border-gold text-walnut">
                      Coming soon
                    </Badge>
                  ) : null}
                </p>
                <p className="hidden text-sm text-muted-foreground md:block">{f.detail}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
