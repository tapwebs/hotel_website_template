import { Pizza, Wine } from 'lucide-react'
export interface BrandFontOption {
  id: string
  name: string
  family: string
  category: 'sans-serif' | 'serif'
  description: string
  sample: string
  googleFontQuery: string
}

export const SUPPORTED_BRAND_FONTS: BrandFontOption[] = [
  {
    id: 'Inter',
    name: 'Inter',
    family: "'Inter', system-ui, -apple-system, sans-serif",
    category: 'sans-serif',
    description: 'Clean, modern tech aesthetic with optimal legibility on mobile screens.',
    sample: 'Artisanal Dining & Fresh Kitchen',
    googleFontQuery: 'Inter:wght@400;500;600;700',
  },
  {
    id: 'Outfit',
    name: 'Outfit',
    family: "'Outfit', sans-serif",
    category: 'sans-serif',
    description: 'Friendly, contemporary geometric sans designed for modern restaurant brands.',
    sample: 'Handcrafted Rolls & Signature Cocktails',
    googleFontQuery: 'Outfit:wght@400;500;600;700;800',
  },
  {
    id: 'Playfair Display',
    name: 'Playfair Display',
    family: "'Playfair Display', Georgia, serif",
    category: 'serif',
    description: 'Luxurious high-contrast serif ideal for bistros, fine dining, and patisseries.',
    sample: 'Gourmet Degustation & Fine Wine Pairing',
    googleFontQuery: 'Playfair+Display:ital,wght@0,500;0,700;1,400',
  },
  {
    id: 'Cinzel',
    name: 'Cinzel',
    family: "'Cinzel', Georgia, serif",
    category: 'serif',
    description: 'Classical, regal aesthetic inspired by European architectural inscriptions.',
    sample: 'Grand Reserve & Royal Cuisine',
    googleFontQuery: 'Cinzel:wght@500;700;900',
  },
  {
    id: 'Montserrat',
    name: 'Montserrat',
    family: "'Montserrat', sans-serif",
    category: 'sans-serif',
    description: 'Architectural, bold urban sans suited for gourmet burger joints and breweries.',
    sample: 'Smash Burgers & Woodfired Pizza',
    googleFontQuery: 'Montserrat:wght@400;600;700;800',
  },
  {
    id: 'Plus Jakarta Sans',
    name: 'Plus Jakarta Sans',
    family: "'Plus Jakarta Sans', sans-serif",
    category: 'sans-serif',
    description: 'Refined, highly polished contemporary typography with premium weight contrast.',
    sample: 'Fresh Poke Bowls & Matcha Bar',
    googleFontQuery: 'Plus+Jakarta+Sans:wght@400;500;600;700;800',
  },
]

export const PRESET_HERO_BANNERS = [
  {
    title: 'Japanese & Sushi Dining',
    category: 'Japanese',
    url: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=1600&auto=format&fit=crop&q=80',
  },
  {
    title: 'Fine Dining & Bistro',
    category: 'Fine Dining',
    url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=1600&auto=format&fit=crop&q=80',
  },
  {
    title: 'Artisanal Cafe & Bakery',
    category: 'Cafe',
    url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1600&auto=format&fit=crop&q=80',
  },
  {
    title: 'Gourmet Burgers & Grill',
    category: 'Grill',
    url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=1600&auto=format&fit=crop&q=80',
  },
  {
    title: 'Woodfired Pizza & Italian',
    category: 'Italian',
    url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1600&auto=format&fit=crop&q=80',
  },
  {
    title: 'Cocktail Lounge & Speakeasy',
    category: 'Bar',
    url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=1600&auto=format&fit=crop&q=80',
  },
]

/**
 * Loads the selected Google Font dynamically without layout shift or duplicate links.
 */
export function loadBrandFont(fontName?: string) {
  if (typeof document === 'undefined') return
  const selected = SUPPORTED_BRAND_FONTS.find(
    (f) => f.id.toLowerCase() === (fontName || 'inter').toLowerCase()
  ) || SUPPORTED_BRAND_FONTS[0]!

  const href = `https://fonts.googleapis.com/css2?family=${selected.googleFontQuery}&display=swap`
  const existingLink = document.getElementById('tm-brand-font-link') as HTMLLinkElement | null

  if (existingLink) {
    if (existingLink.href !== href) {
      existingLink.href = href
    }
  } else {
    const link = document.createElement('link')
    link.id = 'tm-brand-font-link'
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
  }

  return selected.family
}

/**
 * Injects and synchronizes white-label PWA manifest, theme-color meta, and title tags.
 */
export function applyWhiteLabelPwaMeta(restaurant: {
  slug?: string
  id?: string
  name: string
  logo?: string
  accent?: string
  pwaAppName?: string
  pwaThemeColor?: string
  brandFont?: string
}) {
  if (typeof document === 'undefined') return

  // 1. Dynamic Font
  loadBrandFont(restaurant.brandFont)

  // 2. Dynamic Title
  const appTitle = restaurant.pwaAppName || restaurant.name
  if (appTitle) {
    document.title = `${appTitle} | Digital Menu`
  }

  // 3. Dynamic Web App Manifest link
  const slug = restaurant.slug || restaurant.id
  if (slug) {
    const manifestHref = `/manifest/${slug}.json`
    let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (!manifestLink) {
      manifestLink = document.createElement('link')
      manifestLink.rel = 'manifest'
      document.head.appendChild(manifestLink)
    }
    manifestLink.href = manifestHref
  }

  // 4. Dynamic Theme Color (mobile browser URL bar)
  const themeColor = restaurant.pwaThemeColor || restaurant.accent || '#00E599'
  let metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!metaTheme) {
    metaTheme = document.createElement('meta')
    metaTheme.name = 'theme-color'
    document.head.appendChild(metaTheme)
  }
  metaTheme.content = themeColor

  // 5. Dynamic Apple Touch Icon
  if (restaurant.logo) {
    let appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
    if (!appleIcon) {
      appleIcon = document.createElement('link')
      appleIcon.rel = 'apple-touch-icon'
      document.head.appendChild(appleIcon)
    }
    appleIcon.href = restaurant.logo
  }
}
