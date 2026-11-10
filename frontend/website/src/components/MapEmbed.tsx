import { useState } from 'react'
import { Link } from 'react-router'
import { MapPin, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { hotel } from '@/data/hotel'
import { inlineLink } from '@/lib/utils'
/** Click-to-load Google Maps: no third-party request until the guest asks for the map. */
export function MapEmbed() {
  const [loaded, setLoaded] = useState(false)
  const title = `Map showing ${hotel.name} on Agra Road, Bassi, Jaipur`
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-muted lg:aspect-auto lg:h-full lg:min-h-96">
      {loaded ? (
        <iframe
          title={title}
          src={hotel.mapEmbedUrl}
          className="absolute inset-0 size-full border-0"
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <div className="absolute inset-0 grid items-end justify-items-center p-3 sm:p-6">
          <MapArt />
          <div className="relative grid max-w-md justify-items-center gap-2 rounded-md border border-border bg-ivory/90 p-3 text-center sm:gap-3 shadow-sm backdrop-blur-[2px] sm:p-6">
            <p className="max-w-[44ch] text-sm text-walnut">
              Map by Google. It loads only when you ask, which shares your visit with Google.{' '}
              <Link to="/privacy-policy" className={inlineLink}>
                Privacy policy
              </Link>
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={() => setLoaded(true)} aria-label="Load map of the hotel location from Google Maps">
                <MapPin aria-hidden="true" /> Load map
              </Button>
              <Button asChild variant="outline">
                <a href={hotel.directionsUrl} target="_blank" rel="noopener noreferrer">
                  <Navigation aria-hidden="true" />
                  <span>
                    Open in <span className="hidden sm:inline">Google </span>Maps
                  </span>
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Static, decorative street-map line art behind the load prompt (no network request). */
function MapArt() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="absolute inset-0 size-full"
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      <rect width="400" height="300" fill="var(--color-cream)" />
      {/* City blocks */}
      <g fill="var(--muted)">
        <rect x="18" y="20" width="70" height="48" rx="3" />
        <rect x="104" y="14" width="56" height="62" rx="3" />
        <rect x="250" y="22" width="64" height="40" rx="3" />
        <rect x="330" y="30" width="56" height="54" rx="3" />
        <rect x="24" y="200" width="60" height="70" rx="3" />
        <rect x="290" y="196" width="80" height="44" rx="3" />
        <rect x="300" y="254" width="70" height="36" rx="3" />
      </g>
      {/* Green patch */}
      <path d="M170 210c20-16 58-12 70 6s-6 52-38 54-52-40-32-60z" fill="#e4e2c9" />
      {/* Minor streets */}
      <g stroke="#e2d4bf" strokeWidth="6" strokeLinecap="round">
        <path d="M0 90h400M0 186h400M96 0v300M240 0v300M322 0v300" />
      </g>
      {/* Agra Road (main, diagonal) */}
      <path d="M-20 260C80 220 150 170 210 150S340 90 420 40" stroke="var(--color-gold-soft)" strokeWidth="16" strokeLinecap="round" />
      <path d="M-20 260C80 220 150 170 210 150S340 90 420 40" stroke="var(--color-gold)" strokeWidth="1.5" strokeDasharray="8 8" />
      {/* Hotel pin */}
      <g transform="translate(300 56)">
        <ellipse cx="0" cy="42" rx="10" ry="3" fill="var(--color-walnut)" opacity="0.2" />
        <path d="M0 42C-14 24-18 14-18 4a18 18 0 0 1 36 0c0 10-4 20-18 38z" fill="var(--color-burgundy)" />
        <circle cx="0" cy="4" r="6" fill="var(--color-ivory)" />
      </g>
    </svg>
  )
}
