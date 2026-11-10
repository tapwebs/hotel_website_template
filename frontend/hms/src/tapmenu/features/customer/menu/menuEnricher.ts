import type { Category, MenuItem } from '../../../types/customer'

export interface StructuredAddOnItem {
  id: string
  name: string
  price: number
  image?: string
}

export interface StructuredAddOns {
  extras: StructuredAddOnItem[]
  beverages: StructuredAddOnItem[]
  sides: StructuredAddOnItem[]
}

export interface EnrichedMenuItem extends MenuItem {
  originalPrice?: number
  kcal?: number
  structuredAddOns: StructuredAddOns
}

export interface EnrichedCategory extends Category {
  image: string
}

// Category thumbnails — keyword-based only, no hardcoded tenant category IDs
const FALLBACK_CATEGORY_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop'

const CATEGORY_KEYWORD_IMAGES: Array<{ keywords: string[]; image: string }> = [
  {
    keywords: ['popular', 'best', 'featured', 'special', 'recommend'],
    image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=300&auto=format&fit=crop',
  },
  {
    keywords: ['sushi', 'roll', 'sashimi', 'maki', 'nigiri'],
    image: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=300&auto=format&fit=crop',
  },
  {
    keywords: ['ramen', 'noodle', 'soup', 'yakisoba'],
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=300&auto=format&fit=crop',
  },
  {
    keywords: ['starter', 'appetizer', 'snack', 'side'],
    image: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=300&auto=format&fit=crop',
  },
  {
    keywords: ['dessert', 'sweet', 'ice cream', 'cake', 'mithai'],
    image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=300&auto=format&fit=crop',
  },
  {
    keywords: ['drink', 'beverage', 'tea', 'soda', 'juice', 'coffee', 'shake'],
    image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=300&auto=format&fit=crop',
  },
  {
    keywords: ['burger', 'sandwich', 'wrap'],
    image: 'https://images.unsplash.com/photo-1512152272829-e3139592d56f?w=300&auto=format&fit=crop',
  },
  {
    keywords: ['biryani', 'rice', 'pulao'],
    image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300&auto=format&fit=crop',
  },
  {
    keywords: ['pizza', 'pasta', 'bread', 'italian'],
    image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=300&auto=format&fit=crop',
  },
  {
    keywords: ['main', 'entrée', 'entree', 'mains', 'curry', 'dal', 'paneer'],
    image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=300&auto=format&fit=crop',
  },
]

function getCategoryImage(cat: Category): string {
  const lower = cat.name.toLowerCase()
  for (const entry of CATEGORY_KEYWORD_IMAGES) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.image
    }
  }
  return FALLBACK_CATEGORY_IMAGE
}

export function enrichCategories(categories: Category[]): EnrichedCategory[] {
  return categories.map((cat) => ({
    ...cat,
    image: getCategoryImage(cat),
  }))
}

export function enrichMenuItem(item: MenuItem, _allItems: MenuItem[] = []): EnrichedMenuItem {
  // Only display authentic original price if set by the restaurant owner
  const originalPrice = (item as any).originalPrice ?? (item as any).original_price ?? undefined

  // Only show calories if set by the restaurant owner
  const kcal = (item as any).kcal ?? undefined

  // Only use real add-ons configured in the database.
  // Never generate synthetic add-on IDs — they would corrupt the cart/order payload.
  const extras: StructuredAddOnItem[] = (item.addOns || []).map((a) => ({
    id: a.id,
    name: a.name,
    price: a.price,
    image: (a as any).image,
  }))

  return {
    ...item,
    originalPrice,
    kcal,
    structuredAddOns: {
      extras,
      beverages: [],
      sides: [],
    },
  }
}
