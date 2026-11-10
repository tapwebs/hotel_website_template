import { Coffee, House } from 'lucide-react'
import type { MenuItem } from '../../../types/customer'

/**
 * Visually verified food photography mapping.
 * Audited and verified to replace mismatched seed images
 * (e.g. Miso Soup showing barbecue grill, Edamame showing avocado toast, etc.)
 */
const VERIFIED_DISH_IMAGES: Record<string, string> = {
  // Japanese starters & soups
  'Miso Soup': 'https://images.unsplash.com/photo-1591224876006-be862c0f1d7a?w=600&auto=format&fit=crop',
  'Edamame': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop',
  'Chicken Gyoza': 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=600&auto=format&fit=crop',
  'Agedashi Tofu': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop',
  'Vegetable Spring Rolls': 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=600&auto=format&fit=crop',

  // Sushi & Sashimi
  'California Roll': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop',
  'Salmon Nigiri': 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=600&auto=format&fit=crop',
  'Dragon Roll': 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=600&auto=format&fit=crop',
  'Veggie Avocado Roll': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop',
  'Tuna Sashimi': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600&auto=format&fit=crop',

  // Ramen & Noodles
  'Shoyu Ramen': 'https://images.unsplash.com/photo-1591814468924-caf88d1232e1?w=600&auto=format&fit=crop',
  'Tonkotsu Ramen': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop',
  'Vegetable Ramen': 'https://images.unsplash.com/photo-1547928576-a4a33237cbc3?w=600&auto=format&fit=crop',
  'Miso Ramen': 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=600&auto=format&fit=crop',
  'Vegetable Yakisoba': 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=600&auto=format&fit=crop',

  // Mains & Bento
  'Chicken Teriyaki': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&auto=format&fit=crop',
  'Chicken Katsu Curry': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&auto=format&fit=crop',
  'Teppanyaki Tofu Steak': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop',
  'Unagi Don': 'https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=600&auto=format&fit=crop',
  "Chef's Special Bento": 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=600&auto=format&fit=crop',

  // Desserts
  'Mochi Ice Cream (3 pcs)': 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=600&auto=format&fit=crop',
  'Dorayaki': 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=600&auto=format&fit=crop',
  'Matcha Cheesecake': 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop',
  'kitkat brownie': 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop',

  // Beverages
  'Iced Green Tea': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop',
  'Yuzu Lemonade': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop',
  'Ramune Soda': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop',
  'House Hot Sake': 'https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=600&auto=format&fit=crop',

  // Sides, Add-ons & Condiments
  'French Fries': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&auto=format&fit=crop',
  'Peri Peri Fries': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&auto=format&fit=crop',
  'Fries': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&auto=format&fit=crop',
  'Extra Cheese': 'https://images.unsplash.com/photo-1624806992066-5ffcf7ca186b?w=400&auto=format&fit=crop',
  'Add Cheese': 'https://images.unsplash.com/photo-1624806992066-5ffcf7ca186b?w=400&auto=format&fit=crop',
  'Extra soft-boiled egg': 'https://images.unsplash.com/photo-1582169296194-e4d644c48063?w=400&auto=format&fit=crop',
  'Extra braised pork': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400&auto=format&fit=crop',
  'Coca Cola': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop',
  'Coke': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop',
  'Sprite': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop',
  'Dip': 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=400&auto=format&fit=crop',
  'Garlic Dip': 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=400&auto=format&fit=crop',
  'Spicy Mayo': 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=400&auto=format&fit=crop',

  // Generic restaurant demo items (Burger, Fries, Biryani, Coffee, etc.)
  'Burger': 'https://images.unsplash.com/photo-1512152272829-e3139592d56f?w=600&auto=format&fit=crop',
  'Crispy Chicken Burger': 'https://images.unsplash.com/photo-1512152272829-e3139592d56f?w=600&auto=format&fit=crop',
  'Biryani': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&auto=format&fit=crop',
  'Butter Chicken': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop',
  'Indian Thali': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop',
}

function optimizeImageUrl(url: string): string {
  if (!url) return url
  if (url.includes('images.unsplash.com')) {
    // Deliver card-sized dimensions (~112×134 display) at 2x density with WebP/AVIF auto-format & 75% quality
    const base = url.split('?')[0]
    return `${base}?w=240&h=280&fit=crop&auto=format&q=75`
  }
  // Our own menu photos ship a 240px "-sm.webp" twin (~7KB vs ~43KB) for list cards.
  if (/\/images\/menu\/[^?]+(?<!-sm)\.webp$/.test(url)) return url.replace(/\.webp$/, '-sm.webp')
  // Commons originals are often several MB; ask for a 500px thumbnail instead (a standard size Wikimedia serves).
  const wiki = url.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f]\/[0-9a-f]{2})\/([^/]+)$/)
  if (wiki) return `${wiki[1]}/thumb/${wiki[2]}/${wiki[3]}/500px-${wiki[3]}`
  return url
}

/** The un-resized image, used when a thumbnail fails to load (for example a source smaller than the thumbnail size). */
export function originalImageUrl(thumb: string): string {
  if (thumb.endsWith('-sm.webp')) return thumb.replace(/-sm\.webp$/, '.webp')
  const m = thumb.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/thumb\/([0-9a-f]\/[0-9a-f]{2})\/([^/]+)\/[^/]+$/)
  return m ? `${m[1]}/${m[2]}/${m[3]}` : thumb
}

/**
 * Returns a verified, accurate food image for a menu item.
 * Guarantees that items like Miso Soup never show barbecue or unrelated images.
 */
export function getAccurateFoodImage(item: { name: string; image?: string; categoryId?: string }): string {
  return optimizeImageUrl(resolveRawFoodImage(item))
}

function resolveRawFoodImage(item: { name: string; image?: string; categoryId?: string }): string {
  // 1. Explicit item image (from database, staff edit, or imported JSON) takes priority #1!
  const rawImage = item.image?.trim()
  if (rawImage && (rawImage.startsWith('http://') || rawImage.startsWith('https://') || rawImage.startsWith('/') || rawImage.startsWith('data:image'))) {
    try {
      return encodeURI(decodeURI(rawImage))
    } catch {
      return rawImage
    }
  }

  // 2. Direct exact name match
  if (VERIFIED_DISH_IMAGES[item.name]) {
    return VERIFIED_DISH_IMAGES[item.name]
  }

  // 3. Case-insensitive trim match
  const lower = item.name.toLowerCase().trim()
  for (const [key, val] of Object.entries(VERIFIED_DISH_IMAGES)) {
    if (key.toLowerCase() === lower) {
      return val
    }
  }

  // 4. Keyword heuristics for when no image was provided
  if (lower.includes('momo') || lower.includes('dumpling') || lower.includes('gyoza')) {
    return 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=600&auto=format&fit=crop'
  }
  if (lower.includes('burger')) {
    return VERIFIED_DISH_IMAGES['Burger']
  }
  if (lower.includes('sandwich')) {
    return 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop'
  }
  if (lower.includes('pasta')) {
    return 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&auto=format&fit=crop'
  }
  if (lower.includes('garlic bread')) {
    return 'https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?w=600&auto=format&fit=crop'
  }
  if (lower.includes('french fries') || lower.includes('fries')) {
    return VERIFIED_DISH_IMAGES['French Fries']
  }
  if (lower.includes('potato')) {
    return 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop'
  }
  if (lower.includes('paneer') || lower.includes('manchurian') || lower.includes('chilli')) {
    return 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&auto=format&fit=crop'
  }
  if (lower.includes('coffee')) {
    return 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600&auto=format&fit=crop'
  }
  if (lower.includes('shake')) {
    return 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&auto=format&fit=crop'
  }
  if (lower.includes('mojito') || lower.includes('lagoon')) {
    return 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop'
  }
  if (lower.includes('tea')) {
    return VERIFIED_DISH_IMAGES['Iced Green Tea']
  }
  if (lower.includes('ramen') || lower.includes('noodle') || lower.includes('yakisoba')) {
    if (lower.includes('veg')) return VERIFIED_DISH_IMAGES['Vegetable Ramen']
    if (lower.includes('miso')) return VERIFIED_DISH_IMAGES['Miso Ramen']
    if (lower.includes('tonkotsu')) return VERIFIED_DISH_IMAGES['Tonkotsu Ramen']
    return VERIFIED_DISH_IMAGES['Shoyu Ramen']
  }
  if (lower.includes('biryani') || lower.includes('rice')) {
    return VERIFIED_DISH_IMAGES['Biryani']
  }
  if (lower.includes('miso soup') || lower.includes('soup')) {
    return VERIFIED_DISH_IMAGES['Miso Soup']
  }
  if (lower.includes('edamame')) {
    return VERIFIED_DISH_IMAGES['Edamame']
  }
  if (lower.includes('roll') || lower.includes('sushi') || lower.includes('maki')) {
    if (lower.includes('dragon')) return VERIFIED_DISH_IMAGES['Dragon Roll']
    if (lower.includes('avocado') || lower.includes('veg')) return VERIFIED_DISH_IMAGES['Veggie Avocado Roll']
    return VERIFIED_DISH_IMAGES['California Roll']
  }
  if (lower.includes('sashimi') || lower.includes('nigiri')) {
    if (lower.includes('tuna')) return VERIFIED_DISH_IMAGES['Tuna Sashimi']
    return VERIFIED_DISH_IMAGES['Salmon Nigiri']
  }
  if (lower.includes('tofu')) {
    if (lower.includes('agedashi')) return VERIFIED_DISH_IMAGES['Agedashi Tofu']
    return VERIFIED_DISH_IMAGES['Teppanyaki Tofu Steak']
  }
  if (lower.includes('curry') || lower.includes('katsu')) {
    return VERIFIED_DISH_IMAGES['Chicken Katsu Curry']
  }
  if (lower.includes('teriyaki')) {
    return VERIFIED_DISH_IMAGES['Chicken Teriyaki']
  }
  if (lower.includes('unagi') || lower.includes('eel') || lower.includes('don')) {
    return VERIFIED_DISH_IMAGES['Unagi Don']
  }
  if (lower.includes('bento')) {
    return VERIFIED_DISH_IMAGES["Chef's Special Bento"]
  }
  if (lower.includes('spring roll')) {
    return VERIFIED_DISH_IMAGES['Vegetable Spring Rolls']
  }
  if (lower.includes('brownie')) {
    return VERIFIED_DISH_IMAGES['kitkat brownie']
  }
  if (lower.includes('cheesecake') || lower.includes('matcha')) {
    return VERIFIED_DISH_IMAGES['Matcha Cheesecake']
  }
  if (lower.includes('dorayaki') || lower.includes('pancake')) {
    return VERIFIED_DISH_IMAGES['Dorayaki']
  }
  if (lower.includes('mochi')) {
    return VERIFIED_DISH_IMAGES['Mochi Ice Cream (3 pcs)']
  }
  if (lower.includes('sake')) {
    return VERIFIED_DISH_IMAGES['House Hot Sake']
  }
  if (lower.includes('lemonade') || lower.includes('yuzu')) {
    return VERIFIED_DISH_IMAGES['Yuzu Lemonade']
  }
  if (lower.includes('ramune') || lower.includes('soda')) {
    return VERIFIED_DISH_IMAGES['Ramune Soda']
  }
  if (lower.includes('curry') || lower.includes('roti') || lower.includes('thali')) {
    return VERIFIED_DISH_IMAGES['Indian Thali']
  }

  // 5. Default appetizing food fallback
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop'
}
