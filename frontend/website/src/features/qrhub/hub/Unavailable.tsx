import { QrCode } from 'lucide-react'
import { readLang, t } from '@/features/qrhub/lib/i18n'
import { HeroArt } from './Decor'

export function Component() {
  const lang = readLang()
  return (
    <main
      lang={lang}
      className="hub-desk on-dark relative isolate grid min-h-dvh place-items-center overflow-hidden bg-gradient-to-b from-burgundy to-burgundy-deep px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-ivory"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[image:var(--tile-jali)] bg-[length:56px] opacity-[0.07] invert [mask-image:var(--pattern-fade)]"
      />
      <HeroArt />
      <div className="grid max-w-md justify-items-center gap-5 motion-safe:animate-page-in">
        <span className="grid size-20 place-items-center rounded-full border-2 border-gold bg-ivory text-burgundy shadow-lg ring-4 ring-gold/25">
          <QrCode className="size-9" aria-hidden />
        </span>
        <h1 className="text-h2 text-ivory">{t(lang, 'unavailableTitle')}</h1>
        <div className="hairline w-32" />
        <p className="text-lede text-ivory/90">{t(lang, 'unavailableBody')}</p>
        <a
          href="https://hoteldreamheavens.in"
          className="inline-flex min-h-13 items-center rounded-full bg-gold-soft px-7 font-semibold text-ink shadow-md transition-[transform,background-color] hover:bg-ivory active:scale-[0.97] motion-reduce:active:scale-100"
        >
          {t(lang, 'visitSite')}
        </a>
      </div>
    </main>
  )
}
