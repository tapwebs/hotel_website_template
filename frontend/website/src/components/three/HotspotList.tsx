import { Link } from 'react-router'
import { MapPin, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BookNowButton } from '@/components/booking/BookNowButton'
import { cn } from '@/lib/utils'
import { play } from '@/lib/sounds'
import { hotspots, type HotspotId } from './hotspots'

interface HotspotListProps {
  selected: HotspotId | null
  onSelect: (id: HotspotId | null) => void
}

/** Accessible list of the property's areas plus the detail panel. Used by the 3D view and its fallback. */
export function HotspotList({ selected, onSelect }: HotspotListProps) {
  const active = hotspots.find((h) => h.id === selected)

  return (
    <div className="grid content-start gap-5">
      <ul className="grid gap-2" aria-label="Areas of the property">
        {hotspots.map((h) => {
          const isSelected = selected === h.id
          return (
            <li key={h.id}>
              <button
                type="button"
                aria-pressed={isSelected}
                aria-controls="explorer-panel"
                onClick={() => {
                  play('whoosh')
                  onSelect(isSelected ? null : h.id)
                }}
                className={cn(
                  'group flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-left font-semibold transition-all',
                  isSelected
                    ? 'border-burgundy bg-burgundy text-ivory shadow-md ring-1 ring-gold/40'
                    : 'border-border bg-ivory text-walnut hover:border-burgundy/60 hover:text-burgundy hover:shadow-sm',
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'grid size-7 place-items-center rounded-full transition-transform group-hover:scale-105',
                      isSelected ? 'bg-gold-soft text-burgundy' : 'bg-gold/15 text-gold-deep',
                    )}
                  >
                    <MapPin className="size-3.5" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="text-sm leading-tight">{h.label}</div>
                    {h.subtitle ? (
                      <div
                        className={cn('text-[11px] font-normal leading-tight opacity-75', isSelected ? 'text-ivory/80' : 'text-walnut/70')}
                      >
                        {h.subtitle}
                      </div>
                    ) : null}
                  </div>
                </div>
                {h.comingSoon ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-wider',
                      isSelected ? 'border-gold-soft bg-gold-soft/20 text-ivory' : 'border-gold/60 text-walnut/80',
                    )}
                  >
                    Coming soon
                  </Badge>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>

      <div
        id="explorer-panel"
        aria-live="polite"
        className="min-h-48 rounded-xl border border-gold/40 bg-ivory/95 p-5 shadow-sm transition-all"
      >
        {active ? (
          <div className="grid gap-3.5 animate-fadeIn">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-h3 text-burgundy-deep">{active.label}</h3>
                {active.comingSoon ? (
                  <Badge variant="outline" className="border-gold text-walnut text-[11px]">
                    In Development
                  </Badge>
                ) : null}
              </div>
              {active.subtitle ? (
                <p className="text-xs font-medium text-gold-deep tracking-wide uppercase mt-0.5">{active.subtitle}</p>
              ) : null}
            </div>

            <p className="text-sm leading-relaxed text-walnut">{active.copy}</p>

            {/* Spec tags */}
            {active.specs && active.specs.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {active.specs.map((spec, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-full bg-gold/10 border border-gold/25 px-2.5 py-0.5 text-[11px] font-medium text-walnut"
                  >
                    <Sparkles className="size-2.5 text-gold-deep" />
                    {spec}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {active.id === 'rooms' ? <BookNowButton size="sm" /> : null}
              {active.link ? (
                <Button asChild size="sm" variant="outline" className="border-burgundy/40 text-burgundy hover:bg-burgundy hover:text-ivory">
                  <Link to={active.link.to}>{active.link.label}</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
            <MapPin className="size-8 text-gold/50 mb-2" />
            <p className="font-medium text-walnut/70">Select an area on the 3D model or list</p>
            <p className="text-xs text-muted-foreground mt-0.5">Explore the rooms, banquet hall, dining & grand 2X lawn</p>
          </div>
        )}
      </div>
    </div>
  )
}
