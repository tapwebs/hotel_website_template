import { useEffect, useMemo, type ReactNode } from 'react'
import { forceResetBodyScroll } from '../../lib/scrollLock'
import { loadBrandFont, applyWhiteLabelPwaMeta, SUPPORTED_BRAND_FONTS } from '../../lib/whitelabel'

interface CustomerThemeProps {
  accent: string
  brandFont?: string
  pwaThemeColor?: string
  slug?: string
  name?: string
  logo?: string
  children: ReactNode
}

/**
 * Applies the restaurant's accent color and brand typography as CSS variables
 * scoped to the customer app, ensures customer routes remain cleanly in light mode
 * and scrollable, and automatically synchronizes dynamic PWA manifest and browser meta.
 */
export function CustomerTheme({
  accent,
  brandFont,
  pwaThemeColor,
  slug,
  name,
  logo,
  children,
}: CustomerThemeProps) {
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('dark')
      forceResetBodyScroll()
    }
  }, [])

  useEffect(() => {
    if (name || slug) {
      applyWhiteLabelPwaMeta({
        name: name || 'TapMenu',
        slug,
        logo,
        accent,
        brandFont,
        pwaThemeColor,
      })
    } else {
      loadBrandFont(brandFont)
    }
  }, [name, slug, logo, accent, brandFont, pwaThemeColor])

  const fontFamily = useMemo(() => {
    const found = SUPPORTED_BRAND_FONTS.find(
      (f) => f.id.toLowerCase() === (brandFont || 'inter').toLowerCase()
    )
    return found ? found.family : "'Inter', system-ui, -apple-system, sans-serif"
  }, [brandFont])

  return (
    <div
      className="min-h-full w-full"
      style={
        {
          '--customer-accent': accent,
          '--customer-accent-soft': `${accent}1a`, // ~10% opacity via hex alpha suffix
          '--customer-brand-font': fontFamily,
          fontFamily: 'var(--customer-brand-font)',
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  )
}
