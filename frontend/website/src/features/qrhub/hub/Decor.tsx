/**
 * Desktop-only decoration (>= 1024px). All of it is CSS/inline-SVG, aria-hidden and non-interactive.
 * Below 1024px the .hub-* classes are display:none (see index.css), so phones and tablets are untouched.
 */

/** Cream pages: vignette + linen grain + gold line-art side panels, fixed behind the content. */
export function PageDecor() {
  return (
    <div aria-hidden className="hub-decor">
      <span className="hub-decor-side hub-decor-left" />
      <span className="hub-decor-side hub-decor-right" />
    </div>
  )
}

/** Maroon panels: double-rule frame, jharokha arches and vines. `arch` adds the arch behind a centred logo. */
export function HeroArt({ arch = false }: { arch?: boolean }) {
  return (
    <div aria-hidden className="hub-hero-art">
      {arch && <span className="hub-hero-arch" />}
    </div>
  )
}

/** Small gold diamond flanking desktop section titles. */
export function Ornament() {
  return (
    <svg aria-hidden viewBox="0 0 24 12" className="hub-orn" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M12 1.5 16.5 6 12 10.5 7.5 6Z" />
      <path d="M1 6h4.5M18.5 6H23" strokeLinecap="round" />
    </svg>
  )
}
