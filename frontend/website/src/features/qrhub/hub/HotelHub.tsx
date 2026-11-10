import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router'
import {
  ArrowUpRight,
  BedDouble,
  BookOpenCheck,
  BellRing,
  Check,
  ChevronDown,
  Clock,
  ConciergeBell,
  Copy,
  Globe,
  MapPin,
  Phone,
  ScanLine,
  Sparkles,
  Star,
  UserPlus,
  Utensils,
  Wifi,
} from 'lucide-react'
import { HOTEL, WIFI, type Bi } from '@/features/qrhub/config/hotel-info'
import { api, ApiError } from '@/features/qrhub/lib/api'
import { closedLabel, isOpenNow } from '@/features/qrhub/lib/hours'
import { LANG_KEY, pick, readLang, t, type Lang, type TextKey } from '@/features/qrhub/lib/i18n'
import { saveBlob } from '@/features/qrhub/lib/download'
import type { PublicHub, PublicLink, PublicOrg } from '@/features/qrhub/lib/types'
import { buildVCard } from '@/features/qrhub/lib/vcard'
import { cn } from '@/features/qrhub/lib/utils'
import { WhatsAppIcon } from '@/features/qrhub/components/icons/WhatsAppIcon'
import { BRAND_ICONS, hubIcon } from './icons'
import { HeroArt, Ornament, PageDecor } from './Decor'

type Loaded = Exclude<PublicHub, { inactive: true }>

const isBook = (l: PublicLink) => /book/i.test(l.title) || /\/book(\/|$|\?)/.test(l.destination_url)
const isWhatsApp = (l: PublicLink) => /wa\.me|whatsapp/i.test(l.destination_url)
const isCall = (l: PublicLink) => l.destination_url.startsWith('tel:')
const isExternal = (url: string) => /^https?:/.test(url)
const CONNECT = new Set(['connect', 'social', 'booking'])

/** Shared press/hover/focus feel for every tappable surface. */
const press =
  'transition-[transform,box-shadow,border-color,background-color] duration-200 ease-(--ease-soft) active:scale-[0.97] motion-reduce:active:scale-100'
const card = 'rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(59_42_32/0.06),0_4px_14px_-8px_rgb(59_42_32/0.18)]'
const cardHover =
  'hover:border-burgundy/40 hover:shadow-[0_2px_4px_rgb(59_42_32/0.06),0_12px_24px_-12px_rgb(110_30_43/0.35)] lg:hover:-translate-y-0.5 lg:hover:border-gold lg:hover:shadow-[0_0_0_1px_rgb(198_161_91/0.55),0_14px_28px_-14px_rgb(110_30_43/0.4),0_0_22px_-6px_rgb(198_161_91/0.55)]'

/** True from the `lg` breakpoint (64rem). Desktop-only branches key off this; phones and tablets never see them. */
const DESKTOP_QUERY = '(min-width: 64rem)'
function useDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP_QUERY)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  )
}

const GROUP_ICONS = { groupStay: BedDouble, groupServices: ConciergeBell, groupLocation: MapPin, groupContact: Phone }

function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div
      role="group"
      aria-label={t(lang, 'language')}
      className="inline-flex rounded-full border border-gold-soft/50 bg-burgundy-deep/40 p-1 text-sm backdrop-blur-sm"
    >
      {(['en', 'hi'] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          onClick={() => onChange(l)}
          className={cn(
            'min-h-11 min-w-12 rounded-full px-3 font-semibold transition-colors',
            lang === l ? 'bg-gold-soft text-ink shadow-sm' : 'text-ivory hover:bg-ivory/10',
          )}
        >
          {l === 'en' ? 'EN' : 'हिं'}
        </button>
      ))}
    </div>
  )
}

function Logo({ org, lang }: { org: PublicOrg; lang: Lang }) {
  const [failed, setFailed] = useState(false)
  const cls = 'size-20 rounded-full border-2 border-gold bg-ivory shadow-lg ring-4 ring-gold/25 md:size-24 lg:size-28'
  return failed ? (
    <div aria-hidden className={cn(cls, 'grid place-items-center font-display text-4xl text-burgundy md:text-5xl lg:text-6xl')}>
      {org.name.charAt(0)}
    </div>
  ) : (
    <img
      src={`${import.meta.env.BASE_URL}logo.png`}
      alt={`${org.name} ${t(lang, 'logoAlt')}`}
      width={96}
      height={96}
      onError={() => setFailed(true)}
      className={cn(cls, 'object-cover')}
    />
  )
}

/** Copy to clipboard, falling back to a hidden textarea where the async API is unavailable (older webviews, http). */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="mb-3 flex items-center gap-3 text-2xl text-burgundy after:h-px after:flex-1 after:bg-gradient-to-r after:from-gold/70 after:to-transparent lg:mb-6 lg:justify-center lg:text-3xl lg:before:h-px lg:before:flex-1 lg:before:bg-gradient-to-l lg:before:from-gold/70 lg:before:to-transparent lg:after:bg-gradient-to-l"
    >
      <Ornament />
      {children}
      <Ornament />
    </h2>
  )
}

function HubBody({ hub, slug, placementCode }: { hub: Loaded; slug: string; placementCode?: string }) {
  const [lang, setLangState] = useState<Lang>(() => readLang())
  const [now, setNow] = useState(() => new Date())
  const [showBar, setShowBar] = useState(false)
  const [toast, setToast] = useState(false)
  const desktop = useDesktop()
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const heroCtas = useRef<HTMLDivElement>(null)
  const { organization: org, links, offers, placement } = hub

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => () => clearTimeout(toastTimer.current), [])
  const copyPass = async () => {
    await copyText(WIFI.WIFI_PASS)
    setToast(true)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(false), 2000)
  }
  const setLang = (l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(LANG_KEY, l)
    } catch {
      /* private mode: the choice just isn't remembered */
    }
  }
  useEffect(() => {
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en-IN'
    document.title = org.name
  }, [lang, org.name])
  // Paint the phone's status bar in the hero colour while the hub is open.
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const prev = meta?.content
    meta?.setAttribute('content', '#6e1e2b')
    return () => {
      if (meta) meta.content = prev ?? ''
    }
  }, [])
  // The sticky bar only slides in once the hero buttons have scrolled away, so the two never show at once.
  useEffect(() => {
    const el = heroCtas.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShowBar(true)
      return
    }
    // Mostly scrolled off (a sliver left at the top edge) counts as gone: the sliver isn't tappable.
    const io = new IntersectionObserver(([e]) => setShowBar(e.intersectionRatio < 0.6), { threshold: [0, 0.6, 1] })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const bookLink = links.find(isBook)
  const waLink = links.find(isWhatsApp)
  const callLink = links.find(isCall)
  const bookHref = bookLink?.destination_url ?? (org.website_url ? `${org.website_url.replace(/\/+$/, '')}/book` : '')
  const waDigits = (org.whatsapp ?? '').replace(/\D/g, '')
  const waHref = waLink?.destination_url ?? (waDigits ? `https://wa.me/${waDigits}` : '')
  const callHref = callLink?.destination_url ?? (org.phone ? `tel:${org.phone.replace(/[^\d+]/g, '')}` : '')
  const rest = links.filter((l) => l !== bookLink && l !== waLink && l !== callLink)
  const connect = rest.filter((l) => CONNECT.has(l.category.toLowerCase()))
  const explore = rest.filter((l) => !CONNECT.has(l.category.toLowerCase()))
  const offer = offers[0]
  const L = (b: Bi) => b[lang]
  const reviewUrl = org.review_url || HOTEL.reviewUrl
  const waRoomHref = `https://wa.me/${waDigits || HOTEL.whatsappDigits}?text=${encodeURIComponent(t(lang, 'roomServiceMsg'))}`
  const callReception = `tel:${HOTEL.phoneE164}`
  const emergency = HOTEL.emergencyPhone || HOTEL.phoneE164

  const click = useCallback((id: string) => api.publicClick(slug, id, placementCode), [slug, placementCode])
  const track = (l?: PublicLink) => () => l && click(l.id)

  const saveContact = () =>
    saveBlob(
      new Blob(
        [
          buildVCard({
            name: org.name,
            phone: org.phone,
            whatsapp: org.whatsapp,
            email: org.email,
            address: org.address,
            website_url: org.website_url,
          }),
        ],
        { type: 'text/vcard;charset=utf-8' },
      ),
      `${slug}.vcf`,
    )

  const text = useMemo(() => ({ closed: t(lang, 'closedNow'), opens: t(lang, 'opens') }), [lang])
  const newTab = <span className="sr-only"> ({t(lang, 'newTab')})</span>

  /** Connect = compact icon tiles, Explore = larger cards with an arrow. Closed links stay visible but inert. */
  const item = (l: PublicLink, kind: 'tile' | 'card') => {
    const Icon = hubIcon(l.icon, l.destination_url)
    const closed = l.hours ? !isOpenNow(l.hours, now) : false
    const label = closedLabel(l.hours, now, text)
    const title = pick(lang, l.title, l.title_hi)
    const desc = pick(lang, l.description ?? '', l.description_hi)
    const ext = isExternal(l.destination_url)
    const status = label && (
      <span className="text-xs leading-tight font-semibold text-burgundy">
        {/* Tiles are too narrow at 320px for the clock icon plus text; the muted tile already reads as closed. */}
        {kind === 'card' && <Clock className="mr-1 inline size-3 align-[-0.125em]" aria-hidden />}
        {label}
      </span>
    )
    const icon = (
      <span
        className={cn(
          'grid shrink-0 place-items-center rounded-full transition-colors',
          kind === 'tile' ? 'size-12' : 'size-11',
          closed
            ? 'bg-muted text-muted-foreground'
            : l.is_featured
              ? 'bg-burgundy text-ivory'
              : kind === 'tile'
                ? 'bg-burgundy/[0.08] text-burgundy group-hover:bg-burgundy group-hover:text-ivory'
                : 'bg-gold-soft text-ink group-hover:bg-burgundy group-hover:text-ivory',
        )}
      >
        <Icon className={BRAND_ICONS.has(Icon) ? 'size-6' : 'size-5'} />
      </span>
    )
    const body =
      kind === 'tile' ? (
        <>
          {icon}
          <span className="text-sm leading-tight font-semibold text-walnut">{title}</span>
          {status}
        </>
      ) : (
        <>
          <span className="flex items-start justify-between gap-2">
            {icon}
            {!closed && (
              <ArrowUpRight
                className="size-5 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-burgundy"
                aria-hidden
              />
            )}
          </span>
          <span className="grid gap-1">
            <span className="font-display text-xl leading-tight font-semibold text-walnut">{title}</span>
            {desc && <span className="line-clamp-2 text-sm text-muted-foreground">{desc}</span>}
            {status}
          </span>
        </>
      )
    const cls = cn(
      'group flex h-full w-full',
      card,
      kind === 'tile'
        ? 'min-h-28 flex-col items-center justify-center gap-2 px-2 py-3 text-center lg:min-h-24 lg:flex-row lg:justify-start lg:gap-4 lg:px-6 lg:text-left'
        : 'min-h-32 flex-col justify-between gap-4 p-4',
      l.is_featured && !closed && 'border-gold ring-1 ring-gold/60',
      closed ? 'bg-muted/60 shadow-none' : cn(press, cardHover),
    )
    return (
      <li key={l.id}>
        {closed ? (
          <div className={cls} aria-disabled="true">
            {body}
          </div>
        ) : (
          <a
            href={l.destination_url}
            className={cls}
            target={ext ? '_blank' : undefined}
            rel="noopener noreferrer"
            onClick={() => click(l.id)}
          >
            {body}
            {ext && newTab}
          </a>
        )}
      </li>
    )
  }

  const rows = (r: { key: TextKey; value: string; href?: string }[]) => r.filter((x) => x.value)
  const groups = [
    {
      key: 'groupStay' as const,
      rows: rows([
        { key: 'checkIn', value: L(HOTEL.checkIn) },
        { key: 'checkOut', value: L(HOTEL.checkOut) },
      ]),
    },
    {
      key: 'groupServices' as const,
      rows: rows([
        { key: 'reception', value: L(HOTEL.receptionHours) },
        { key: 'restaurant', value: L(HOTEL.restaurantHours) },
        { key: 'hotelServices', value: L(HOTEL.servicesHours) },
      ]),
    },
    {
      key: 'groupLocation' as const,
      rows: rows([
        { key: 'address', value: org.address || L(HOTEL.address) },
        { key: 'landmark', value: L(HOTEL.landmark) },
        { key: 'parking', value: L(HOTEL.parking) },
      ]),
    },
    {
      key: 'groupContact' as const,
      rows: rows([
        { key: 'phone', value: HOTEL.phoneDisplay, href: callReception },
        { key: 'emergency', value: HOTEL.emergencyPhone || HOTEL.phoneDisplay, href: `tel:${emergency}` },
        { key: 'leaveReview', value: reviewUrl ? t(lang, 'leaveReview') : '', href: reviewUrl },
      ]),
    },
  ].filter((g) => g.rows.length)
  const cta = cn('inline-flex min-h-13 items-center justify-center gap-2 rounded-full px-5 text-base font-semibold', press)
  const reveal = 'motion-safe:animate-page-in'

  return (
    <div lang={lang} className="hub-desk min-h-dvh pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0 lg:relative lg:isolate">
      <PageDecor />
      <header className="on-dark relative isolate overflow-hidden rounded-b-[2rem] bg-gradient-to-b from-burgundy to-burgundy-deep text-ivory shadow-[0_18px_40px_-24px_rgb(74_17_27/0.8)] md:rounded-b-[3rem]">
        {org.profile_image && <img src={org.profile_image} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-25" />}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[image:var(--tile-jali)] bg-[length:56px] opacity-[0.07] invert [mask-image:var(--pattern-fade)]"
        />
        <HeroArt arch />
        <div className="px-safe mx-auto flex max-w-3xl flex-col items-center gap-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-10 text-center md:pb-14 lg:max-w-6xl lg:pb-20">
          <div className="flex w-full justify-end">
            <LangToggle lang={lang} onChange={setLang} />
          </div>
          <Logo org={org} lang={lang} />
          {/* No cn() here: tailwind-merge reads the custom text-h1 size as a colour and would drop it next to text-ivory. */}
          <h1 className={`mt-1 text-h1 text-ivory ${reveal}`}>{org.name}</h1>
          {placement && (
            <p className="inline-flex items-center gap-1.5 rounded-full border border-gold-soft/50 bg-ivory/[0.06] px-3.5 py-1.5 text-sm text-gold-soft">
              <ScanLine className="size-4 shrink-0" aria-hidden />
              <span>
                {t(lang, 'scannedAt')}: <strong className="font-semibold text-ivory">{placement.label}</strong>
              </span>
            </p>
          )}
          {(org.description || org.description_hi) && (
            <p className="max-w-md text-lede text-ivory/90 lg:max-w-xl">{pick(lang, org.description, org.description_hi)}</p>
          )}
          <div className="hairline my-1 w-32" />
          <div ref={heroCtas} className="flex w-full max-w-xl flex-wrap gap-3 lg:max-w-2xl">
            {bookHref && (
              <a
                href={bookHref}
                className={cn(cta, 'basis-full bg-gold-soft text-ink shadow-md hover:bg-ivory sm:flex-[2] sm:basis-0')}
                onClick={track(bookLink)}
              >
                <BookOpenCheck className="size-5" aria-hidden /> {t(lang, 'bookStay')}
              </a>
            )}
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(cta, 'flex-1 border border-gold-soft/60 bg-ivory/[0.06] text-ivory hover:bg-ivory/15')}
                onClick={track(waLink)}
              >
                <WhatsAppIcon className="size-6" /> {t(lang, 'whatsapp')}
                {newTab}
              </a>
            )}
            {callHref && (
              <a
                href={callHref}
                className={cn(cta, 'flex-1 border border-gold-soft/60 bg-ivory/[0.06] text-ivory hover:bg-ivory/15')}
                onClick={track(callLink)}
              >
                <Phone className="size-5" aria-hidden /> {t(lang, 'call')}
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="px-safe mx-auto grid max-w-3xl grid-cols-1 gap-8 pt-7 pb-8 md:pt-10 md:pb-12 lg:max-w-6xl lg:gap-14 lg:pt-14 lg:pb-16">
        {offer && (
          <section
            aria-label={t(lang, 'offer')}
            className={cn('flex items-start gap-3 rounded-2xl border border-gold bg-gold-soft/45 p-4', reveal)}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-burgundy text-gold-soft">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-widest text-burgundy uppercase">{t(lang, 'offer')}</p>
              {offer.link_url ? (
                <a
                  href={offer.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 flex min-h-11 items-center font-display text-xl text-burgundy-deep underline decoration-gold underline-offset-4 hover:decoration-burgundy"
                >
                  {pick(lang, offer.text, offer.text_hi)}
                  {newTab}
                </a>
              ) : (
                <p className="mt-0.5 font-display text-xl text-burgundy-deep">{pick(lang, offer.text, offer.text_hi)}</p>
              )}
            </div>
          </section>
        )}

        {reviewUrl && (
          <a
            href={reviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => org.review_url && click('review')}
            className={cn(
              'on-dark group flex min-h-20 items-center gap-4 rounded-2xl bg-gradient-to-br from-burgundy to-burgundy-deep p-4 text-ivory shadow-md hover:shadow-lg',
              press,
            )}
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-gold-soft text-ink">
              <Star className="size-6 fill-current" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-xl">{t(lang, 'rateStay')}</span>
              <span className="block text-sm text-ivory/85">{t(lang, 'rateHint')}</span>
            </span>
            <ArrowUpRight
              className="size-5 shrink-0 text-gold-soft transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden
            />
            {newTab}
          </a>
        )}

        <section aria-labelledby="h-connect" className={reveal}>
          <SectionTitle id="h-connect">{t(lang, 'connect')}</SectionTitle>
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(5.25rem,1fr))] gap-3 lg:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] lg:gap-5">
            {connect.map((l) => item(l, 'tile'))}
            <li>
              <a
                href={HOTEL.website}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'group flex h-full min-h-28 w-full flex-col items-center justify-center gap-2 px-2 py-3 text-center lg:min-h-24 lg:flex-row lg:justify-start lg:gap-4 lg:px-6 lg:text-left',
                  card,
                  press,
                  cardHover,
                )}
              >
                <span className="grid size-12 place-items-center rounded-full bg-burgundy/[0.08] text-burgundy transition-colors group-hover:bg-burgundy group-hover:text-ivory">
                  <Globe className="size-5" aria-hidden />
                </span>
                <span className="text-sm leading-tight font-semibold text-walnut">{t(lang, 'website')}</span>
                {newTab}
              </a>
            </li>
          </ul>
        </section>

        <section aria-labelledby="h-quick" className={reveal}>
          <SectionTitle id="h-quick">{t(lang, 'quickServices')}</SectionTitle>
          <div className="grid gap-3 lg:grid-cols-2 lg:gap-5">
            <a
              href={placement?.order_url || HOTEL.menuUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'on-dark flex min-h-16 items-center gap-3 rounded-2xl bg-gradient-to-br from-burgundy to-burgundy-deep p-3 text-ivory shadow-md hover:shadow-lg lg:min-h-28 lg:gap-5 lg:p-6',
                press,
              )}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gold-soft text-ink lg:size-14">
                <Utensils className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-xl leading-tight">{t(lang, 'orderFood')}</span>
                <span className="block text-sm text-ivory/85">{L(HOTEL.restaurantHours)}</span>
              </span>
              <ArrowUpRight className="size-5 shrink-0 text-gold-soft" aria-hidden />
              {newTab}
            </a>
            <a
              href={waRoomHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={track(waLink)}
              className={cn('group flex min-h-16 items-center gap-3 p-3 lg:min-h-28 lg:gap-5 lg:p-6', card, press, cardHover)}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gold-soft text-ink transition-colors group-hover:bg-burgundy group-hover:text-ivory lg:size-14">
                <BellRing className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-xl leading-tight font-semibold text-walnut">{t(lang, 'roomService')}</span>
                <span className="block text-sm text-muted-foreground">{L(HOTEL.servicesHours)}</span>
              </span>
              <ArrowUpRight className="size-5 shrink-0 text-muted-foreground group-hover:text-burgundy" aria-hidden />
              {newTab}
            </a>
            <div className={cn(card, 'p-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:flex-col lg:justify-center lg:p-6')}>
              <h3 className="mb-2 flex items-center gap-2 font-display text-xl font-semibold text-walnut lg:mb-4 lg:text-2xl">
                <Wifi className="size-5 text-burgundy" aria-hidden /> {t(lang, 'wifi')}
              </h3>
              <dl className="grid gap-2 lg:grid-cols-2 lg:gap-4">
                <div className="min-w-0 rounded-xl bg-muted/60 p-3 lg:p-4">
                  <dt className="text-xs text-muted-foreground uppercase">{t(lang, 'wifiName')}</dt>
                  <dd className="font-semibold break-words">{WIFI.WIFI_NAME}</dd>
                </div>
                <div className="min-w-0 rounded-xl bg-muted/60 p-3 lg:p-4">
                  <dt className="text-xs text-muted-foreground uppercase">{t(lang, 'password')}</dt>
                  <dd className="font-mono font-semibold break-all">{WIFI.WIFI_PASS}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={copyPass}
                className={cn(
                  'on-dark mt-3 inline-flex min-h-11 w-full lg:mt-5 lg:min-h-12 items-center justify-center gap-2 rounded-full bg-burgundy px-4 text-sm font-semibold text-ivory hover:bg-burgundy-deep',
                  press,
                )}
              >
                <Copy className="size-4" aria-hidden /> {t(lang, 'copyPassword')}
              </button>
            </div>
          </div>
        </section>

        {explore.length > 0 && (
          <section aria-labelledby="h-explore" className={reveal}>
            <SectionTitle id="h-explore">{t(lang, 'explore')}</SectionTitle>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] lg:grid-cols-4 lg:gap-5">
              {explore.map((l) => item(l, 'card'))}
            </ul>
          </section>
        )}

        <section aria-labelledby="h-info" className={reveal}>
          <SectionTitle id="h-info">{t(lang, 'hotelInfo')}</SectionTitle>
          <div className="grid gap-3 lg:grid-cols-2 lg:gap-5">
            {groups.map((g, i) => {
              if (desktop) {
                // Desktop: every group is open, so it is a plain card (no summary), stretched to the row height.
                const GroupIcon = GROUP_ICONS[g.key]
                return (
                  <section key={g.key} aria-labelledby={`h-info-${g.key}`} className={cn(card, 'flex flex-col')}>
                    <h3
                      id={`h-info-${g.key}`}
                      className="flex items-center gap-3 border-b border-border px-6 py-4 font-display text-2xl font-semibold text-walnut"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-soft text-ink">
                        <GroupIcon className="size-5" aria-hidden />
                      </span>
                      {t(lang, g.key)}
                    </h3>
                    <dl className="flex flex-1 flex-col px-6">
                      {g.rows.map((r) => (
                        <div
                          key={r.key}
                          className="flex min-w-0 flex-1 flex-col justify-center border-b border-border/70 py-3.5 last:border-b-0"
                        >
                          <dt className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{t(lang, r.key)}</dt>
                          <dd
                            className={cn(
                              'mt-0.5 text-base leading-snug font-semibold break-words text-walnut',
                              g.rows.length === 1 && 'font-display text-4xl font-medium text-burgundy [font-variant-numeric:lining-nums]',
                            )}
                          >
                            {r.href ? (
                              <a
                                href={r.href}
                                {...(isExternal(r.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                                className="inline-flex min-h-11 items-center text-burgundy underline decoration-gold underline-offset-4 hover:decoration-burgundy"
                              >
                                {r.value}
                              </a>
                            ) : (
                              r.value
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )
              }
              return (
                <details key={g.key} open={i === 0} className={cn(card, 'group/d')}>
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 font-display text-xl font-semibold text-walnut marker:hidden hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
                    {t(lang, g.key)}
                    <ChevronDown
                      className="size-5 shrink-0 text-burgundy transition-transform group-open/d:rotate-180 motion-reduce:transition-none"
                      aria-hidden
                    />
                  </summary>
                  <dl className="grid gap-3 px-4 pb-4">
                    {g.rows.map((r) => (
                      <div key={r.key} className="min-w-0">
                        <dt className="text-xs text-muted-foreground uppercase">{t(lang, r.key)}</dt>
                        <dd className="font-semibold break-words text-walnut">
                          {r.href ? (
                            <a
                              href={r.href}
                              {...(isExternal(r.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                              className="inline-flex min-h-11 items-center text-burgundy underline decoration-gold underline-offset-4 hover:decoration-burgundy"
                            >
                              {r.value}
                            </a>
                          ) : (
                            r.value
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )
            })}
            <div className="flex flex-wrap gap-3 lg:col-span-2 lg:mt-3 lg:justify-center lg:gap-5">
              <a
                href={callReception}
                onClick={track(callLink)}
                className={cn(
                  cta,
                  'on-dark min-h-12 flex-1 bg-burgundy text-ivory hover:bg-burgundy-deep lg:w-72 lg:max-w-none lg:flex-none',
                )}
              >
                <Phone className="size-5" aria-hidden /> {t(lang, 'callReception')}
              </a>
              <button
                type="button"
                onClick={saveContact}
                className={cn(
                  cta,
                  'min-h-12 flex-1 border border-border bg-card text-burgundy hover:border-burgundy/40 lg:w-72 lg:max-w-none lg:flex-none',
                )}
              >
                <UserPlus className="size-5" aria-hidden /> {t(lang, 'saveContact')}
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-safe mx-auto max-w-3xl pb-8 md:pb-12 lg:max-w-6xl">
        <div className="hairline mb-5" />
        <p className="flex items-start justify-center gap-2 text-center text-sm text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0 text-burgundy" aria-hidden /> {org.address || L(HOTEL.address)}
        </p>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {t(lang, 'madeBy')}{' '}
          <a
            href={HOTEL.tapwebsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center px-1.5 font-semibold text-[#7a5a14] underline decoration-gold/60 underline-offset-4 hover:text-burgundy"
          >
            TAPWEBS
            {newTab}
          </a>
        </p>
      </footer>

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 md:bottom-8"
      >
        {toast && (
          <p className="on-dark inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-ivory shadow-lg motion-safe:animate-page-in">
            <Check className="size-4 text-gold-soft" aria-hidden /> {t(lang, 'passwordCopied')}
          </p>
        )}
      </div>

      {(bookHref || waHref || callHref) && (
        <nav
          aria-label={t(lang, 'quickActions')}
          inert={!showBar}
          className={cn(
            'on-dark fixed inset-x-0 bottom-0 z-20 border-t border-gold/40 bg-burgundy-deep/95 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(36_24_18/0.6)] backdrop-blur-md transition-transform duration-300 ease-(--ease-soft) md:hidden',
            showBar ? 'translate-y-0' : 'translate-y-full',
          )}
        >
          <div className="px-safe mx-auto flex max-w-md gap-2">
            {bookHref && (
              <a
                href={bookHref}
                onClick={track(bookLink)}
                className={cn(
                  'inline-flex min-h-13 flex-[1.6] items-center justify-center gap-2 rounded-full bg-gold-soft px-3 text-[0.9375rem] leading-tight font-semibold text-ink',
                  press,
                )}
              >
                <BookOpenCheck className="size-5 shrink-0 max-[359px]:hidden" aria-hidden /> {t(lang, 'bookStay')}
              </a>
            )}
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={track(waLink)}
                className={cn(
                  'inline-flex min-h-13 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-semibold text-ivory hover:bg-ivory/10',
                  press,
                )}
              >
                <WhatsAppIcon className="size-6" /> {t(lang, 'whatsapp')}
                {newTab}
              </a>
            )}
            {callHref && (
              <a
                href={callHref}
                onClick={track(callLink)}
                className={cn(
                  'inline-flex min-h-13 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-semibold text-ivory hover:bg-ivory/10',
                  press,
                )}
              >
                <Phone className="size-5" aria-hidden /> {t(lang, 'call')}
              </a>
            )}
          </div>
        </nav>
      )}
    </div>
  )
}

export function Component() {
  const { slug = '' } = useParams()
  const [sp] = useSearchParams()
  const placementCode = sp.get('p') ?? undefined
  return <HubLoader key={`${slug}|${placementCode ?? ''}`} slug={slug} placementCode={placementCode} />
}

function HubLoader({ slug, placementCode }: { slug: string; placementCode?: string }) {
  const [state, setState] = useState<{ hub?: PublicHub; error?: 'notfound' | 'failed' }>({})
  const [attempt, setAttempt] = useState(0)
  const lang = readLang()

  useEffect(() => {
    let live = true
    api.publicHub(slug, placementCode).then(
      (hub) => live && setState({ hub }),
      (e) => live && setState({ error: e instanceof ApiError && e.status === 404 ? 'notfound' : 'failed' }),
    )
    return () => {
      live = false
    }
  }, [slug, placementCode, attempt])

  // ponytail: QR scans are already counted by /r/<slug>. A visit is only reported here when the page was opened from
  // another site (referrer), once per session; camera scans have no referrer. Upgrade: a server-set cookie from /r.
  useEffect(() => {
    if (!state.hub || ('inactive' in state.hub && state.hub.inactive)) return
    const ref = document.referrer
    const key = `qrhub.visit.${slug}`
    if (!ref || new URL(ref).origin === window.location.origin || sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    void api.publicVisit(slug).catch(() => undefined)
  }, [state.hub, slug])

  if (state.error === 'notfound') return <Navigate to="/hub/unavailable" replace />
  if (state.hub && 'inactive' in state.hub && state.hub.inactive) return <Navigate to="/hub/unavailable" replace />
  if (state.error === 'failed')
    return (
      <main className="hub-desk grid min-h-dvh place-items-center p-6 text-center lg:relative lg:isolate" lang={lang}>
        <PageDecor />
        <div className="grid max-w-sm gap-4">
          <p className="text-lede">{t(lang, 'notFound')}</p>
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className={cn('mx-auto min-h-12 rounded-full bg-burgundy px-6 font-semibold text-ivory hover:bg-burgundy-deep', press)}
          >
            {t(lang, 'retry')}
          </button>
        </div>
      </main>
    )
  if (!state.hub)
    // Skeleton in the page's own shape so a slow 4G load doesn't flash a blank cream screen.
    return (
      <div role="status" aria-live="polite" lang={lang} className="hub-desk min-h-dvh lg:relative lg:isolate">
        <PageDecor />
        <span className="sr-only">{t(lang, 'loading')}</span>
        <div
          aria-hidden
          className="h-80 rounded-b-[2rem] bg-gradient-to-b from-burgundy to-burgundy-deep md:rounded-b-[3rem] lg:relative lg:isolate lg:overflow-hidden"
        >
          <HeroArt arch />
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 pt-20 lg:max-w-6xl">
            <div className="size-20 rounded-full bg-ivory/15 motion-safe:animate-pulse" />
            <div className="h-8 w-56 rounded-full bg-ivory/15 motion-safe:animate-pulse" />
            <div className="h-4 w-64 rounded-full bg-ivory/10 motion-safe:animate-pulse" />
          </div>
        </div>
        <div aria-hidden className="px-safe mx-auto mt-8 grid max-w-3xl grid-cols-3 gap-3 lg:mt-14 lg:max-w-6xl lg:gap-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-muted motion-safe:animate-pulse" />
          ))}
        </div>
      </div>
    )
  return <HubBody hub={state.hub as Loaded} slug={slug} placementCode={placementCode} />
}
