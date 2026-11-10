import type { MenuItem } from '../../../types/customer'

/**
 * Semantic synonym mappings mapping common user intents, cravings,
 * and attributes to food keywords and dish categories.
 */
export const SEMANTIC_SYNONYMS: Record<string, string[]> = {
  sandwich: [
    'sandwich', 'swich', 'sub', 'toast', 'panini', 'grilled cheese',
    'club sandwich', 'wrap'
  ],
  burger: [
    'burger', 'burgir', 'patty', 'bun', 'slider', 'cheeseburger', 'whopper'
  ],
  noodles: [
    'noodles', 'noodle', 'nodles', 'chowmein', 'ramen', 'hakka',
    'schezwan noodles', 'spaghetti', 'pasta', 'maggi'
  ],
  momo: [
    'momo', 'momos', 'dumpling', 'gyoza', 'dimsum', 'wonton', 'bao'
  ],
  pizza: [
    'pizza', 'piza', 'slice', 'crust', 'calzone', 'margherita'
  ],
  pasta: [
    'pasta', 'penne', 'macaroni', 'fusilli', 'lasagna', 'alfredo', 'arrabbiata'
  ],
  chinese: [
    'chinese', 'noodles', 'manchurian', 'fried rice', 'chilli', 'schezwan',
    'spring roll', 'wonton', 'dimsum'
  ],
  sweet: [
    'dessert', 'brownie', 'ice cream', 'cake', 'mochi', 'tiramisu',
    'chocolate', 'sweet', 'pastry', 'cookie', 'shake', 'gulab jamun',
    'kulfi', 'halwa', 'sundae', 'lava', 'custard', 'donut'
  ],
  healthy: [
    'salad', 'miso soup', 'soup', 'edamame', 'steamed', 'fresh',
    'green', 'cucumber', 'avocado', 'protein', 'tofu', 'boiled',
    'diet', 'light', 'raw', 'sashimi', 'clear'
  ],
  spicy: [
    'hot', 'chilli', 'chili', 'spicy', 'wasabi', 'schezwan', 'tikka',
    'masala', 'peri peri', 'jalapeno', 'curry', 'fiery', 'pepper',
    'mirchi', 'tangy'
  ],
  drink: [
    'beverage', 'tea', 'green tea', 'coffee', 'latte', 'cappuccino',
    'soda', 'coke', 'pepsi', 'sprite', 'cold brew', 'water', 'lassi',
    'shake', 'cooler', 'beer', 'wine', 'sake', 'mocktail', 'juice',
    'lemonade', 'espresso', 'frappe', 'chai', 'mojito'
  ],
  cold: [
    'ice', 'iced', 'cold', 'gelato', 'ice cream', 'sashimi', 'shake',
    'cold brew', 'cooler', 'salad', 'frozen', 'smoothie'
  ],
  warm: [
    'soup', 'hot', 'warm', 'curry', 'ramen', 'tea', 'coffee',
    'steamed', 'tandoor', 'grilled', 'fried', 'gravy', 'broth'
  ],
  snack: [
    'starter', 'appetizer', 'side', 'fries', 'gyoza', 'dimsum',
    'spring roll', 'edamame', 'nachos', 'wings', 'rings', 'garlic bread',
    'bites', 'slider', 'finger food', 'chips', 'nuggets'
  ],
  chicken: ['chicken', 'poultry', 'tikka', 'wings', 'tori', 'katsu', 'murgh'],
  seafood: [
    'fish', 'salmon', 'tuna', 'prawn', 'shrimp', 'crab', 'seafood',
    'sushi', 'sashimi', 'eel', 'unagi', 'calamari', 'ebi'
  ],
  cheese: ['cheese', 'cheesy', 'mozzarella', 'parmesan', 'paneer', 'cheddar', 'queso'],
  crispy: ['crispy', 'crunchy', 'fried', 'tempura', 'chips', 'nachos', 'papad', 'crust'],
  veg: ['vegetarian', 'vegan', 'plant', 'veg', 'paneer', 'tofu', 'dal', 'greens'],
  rice: ['rice', 'biryani', 'pulao', 'fried rice', 'sushi rice', 'steamed rice', 'bowl'],
  bread: ['naan', 'roti', 'garlic bread', 'bun', 'croissant', 'toast', 'kulcha', 'paratha', 'pita'],
  paneer: ['paneer', 'panir', 'cottage cheese'],
  tandoor: ['tandoor', 'tandoori', 'tikka', 'kebab', 'kabab', 'grilled', 'roast'],
  biryani: ['biryani', 'biriyani', 'pulao', 'fried rice', 'dum rice'],
  rolls: ['roll', 'kathi roll', 'wrap', 'frankie', 'burrito'],
}

/**
 * Calculate Levenshtein distance for typo-tolerant matching
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Jaro-Winkler similarity algorithm to measure string closeness
 * specifically optimized for sound-alikes and restaurant menu typos (0.0 to 1.0).
 */
export function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0
  if (!s1 || !s2) return 0

  const m = Math.floor(Math.max(s1.length, s2.length) / 2) - 1
  const s1Matches = new Array(s1.length).fill(false)
  const s2Matches = new Array(s2.length).fill(false)

  let matches = 0
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - m)
    const end = Math.min(i + m + 1, s2.length)
    for (let j = start; j < end; j++) {
      if (!s2Matches[j] && s1[i] === s2[j]) {
        s1Matches[i] = true
        s2Matches[j] = true
        matches++
        break
      }
    }
  }
  if (matches === 0) return 0

  let k = 0
  let transpositions = 0
  for (let i = 0; i < s1.length; i++) {
    if (s1Matches[i]) {
      while (!s2Matches[k]) k++
      if (s1[i] !== s2[k]) transpositions++
      k++
    }
  }

  const sim = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3
  const p = 0.1
  let l = 0
  while (s1[l] === s2[l] && l < 4) l++
  return sim + l * p * (1 - sim)
}

/**
 * Check if sub is a character subsequence of str (e.g. "swich" in "sandwich").
 */
export function isSubsequence(sub: string, str: string): boolean {
  if (!sub || !str || sub.length > str.length) return false
  if (sub.length < 3) return false
  let i = 0
  let j = 0
  while (i < sub.length && j < str.length) {
    if (sub[i] === str[j]) i++
    j++
  }
  return i === sub.length
}

/**
 * Check if a token matches another word with typo tolerance, sound-alike similarity,
 * or abbreviation matching.
 */
export function isFuzzyMatch(queryWord: string, targetWord: string): boolean {
  if (!queryWord || !targetWord) return false
  const q = queryWord.trim().toLowerCase()
  const t = targetWord.trim().toLowerCase()
  if (!q || !t) return false
  if (q === t) return true

  // Substring match: only if query is at least 2 chars, or target is at least 3 chars
  if (q.length >= 2 && t.includes(q)) return true
  if (t.length >= 3 && q.includes(t)) return true

  // Jaro-Winkler similarity threshold (e.g. "swich" vs "sandwich" = 0.887, "burgir" vs "burger" = 0.933)
  if (q.length >= 3 && t.length >= 3) {
    const sim = jaroWinkler(q, t)
    if (sim >= 0.82) return true
  }

  // Character subsequence match (e.g. "swich" -> "sandwich")
  if (q.length >= 4 && isSubsequence(q, t)) {
    return true
  }

  // Levenshtein distance for close edits
  const maxDistance = q.length >= 6 ? 2 : q.length >= 4 ? 1 : 0
  if (maxDistance > 0) {
    if (levenshteinDistance(q, t) <= maxDistance) {
      return true
    }
    // Prefix distance (e.g. "chiken" vs "chickengyoza")
    if (t.length > q.length) {
      const prefix = t.slice(0, q.length + 1)
      if (levenshteinDistance(q, prefix) <= maxDistance) {
        return true
      }
    }
  }

  return false
}

export interface SearchableItem {
  id: string
  name: string
  categoryId?: string
  category_id?: string
  categoryName?: string
  category_name?: string
  prep_station?: string
  prepStation?: string
  dietary_type?: string
  dietaryType?: string
  description?: string
  ingredients?: string[]
  tags?: string[]
  [key: string]: any
}

export interface SearchMatchResult<T = SearchableItem> {
  item: T
  score: number
  matchedReason?: string
}

interface IndexedSearchItem<T> {
  item: T
  nameLower: string
  nameWords: string[]
  catLower: string
  catWords: string[]
  stationLower: string
  descLower: string
  ingredientsLower: string[]
  tagsLower: string[]
  allWords: string[]
}

const searchIndexCache = new WeakMap<object, IndexedSearchItem<any>>()

export function getIndexedSearchItem<T extends SearchableItem>(item: T): IndexedSearchItem<T> {
  if (typeof item === 'object' && item !== null) {
    const cached = searchIndexCache.get(item)
    if (cached) return cached
  }

  const nameLower = (item.name || '').toLowerCase()
  const catLower = (item.categoryName || item.category_name || item.categoryId || item.category_id || '').toLowerCase()
  const stationLower = (item.prep_station || item.prepStation || '').toLowerCase()
  const descLower = (item.description || '').toLowerCase()
  const ingredientsLower = (item.ingredients || []).map((i: string) => (i || '').toLowerCase())
  const tagsLower = (item.tags || []).map((t: string) => (t || '').toLowerCase())

  const nameWords = nameLower.split(/[\s,._\-/]+/).filter(Boolean)
  const catWords = catLower.split(/[\s,._\-/]+/).filter(Boolean)

  const allWords = [
    ...nameWords,
    ...catWords,
    ...stationLower.split(/[\s,._\-/]+/),
    ...descLower.split(/[\s,._\-/]+/),
    ...ingredientsLower.flatMap((i) => i.split(/[\s,._\-/]+/)),
    ...tagsLower.flatMap((t) => t.split(/[\s,._\-/]+/)),
  ].map((w) => w.trim()).filter(Boolean)

  const indexed: IndexedSearchItem<T> = {
    item,
    nameLower,
    nameWords,
    catLower,
    catWords,
    stationLower,
    descLower,
    ingredientsLower,
    tagsLower,
    allWords,
  }

  if (typeof item === 'object' && item !== null) {
    searchIndexCache.set(item, indexed)
  }
  return indexed
}

/**
 * Performs fast vector-inspired semantic search with cheap-first hierarchy:
 * exact -> prefix -> substring -> keyword -> candidate-only fuzzy typo tolerance.
 */
export function searchMenuItems<T extends SearchableItem>(
  items: T[],
  query: string
): T[] {
  const cleanQuery = query.trim().toLowerCase()
  if (!cleanQuery) return items

  const queryWords = cleanQuery.split(/[\s,._\-/]+/).filter((w) => w.length > 0)
  if (queryWords.length === 0) return items

  const scoredItems: SearchMatchResult<T>[] = []

  // Extract all relevant semantic synonyms for query words
  const semanticTargets: string[] = []
  for (const qWord of queryWords) {
    for (const [concept, synonyms] of Object.entries(SEMANTIC_SYNONYMS)) {
      if (concept.startsWith(qWord) || synonyms.some((syn) => syn.startsWith(qWord))) {
        semanticTargets.push(...synonyms, concept)
      }
    }
  }

  for (const item of items) {
    const indexed = getIndexedSearchItem(item)
    let itemScore = 0
    let matchReason = ''

    // 1. Exact full query match in title (cheapest & highest relevance)
    if (indexed.nameLower.startsWith(cleanQuery)) {
      itemScore += 120
      matchReason = 'Title prefix match'
    } else if (indexed.nameLower.includes(cleanQuery)) {
      itemScore += 80
      matchReason = 'Title match'
    }

    // 2. Individual query words evaluation (cheap string checks)
    for (const qWord of queryWords) {
      // Exact in name words
      if (indexed.nameWords.some((w) => w === qWord)) {
        itemScore += 60
        if (!matchReason) matchReason = `Name match on "${qWord}"`
      } else if (indexed.nameWords.some((w) => w.startsWith(qWord) || (qWord.length >= 3 && w.includes(qWord)))) {
        itemScore += 45
        if (!matchReason) matchReason = `Name partial match on "${qWord}"`
      }

      // Exact in category words
      if (indexed.catWords.some((w) => w === qWord)) {
        itemScore += 50
        if (!matchReason) matchReason = `Category match on "${qWord}"`
      } else if (indexed.catWords.some((w) => qWord.length >= 3 && w.includes(qWord))) {
        itemScore += 35
        if (!matchReason) matchReason = `Category partial match on "${qWord}"`
      }

      // Exact in ingredients
      if (indexed.ingredientsLower.some((ing) => ing.includes(qWord))) {
        itemScore += 35
        if (!matchReason) matchReason = `Ingredient match on "${qWord}"`
      }

      // Exact in description
      if (indexed.descLower.includes(qWord)) {
        itemScore += 20
        if (!matchReason) matchReason = `Description match on "${qWord}"`
      }

      // 3. Typo-tolerant / fuzzy match ONLY if this item hasn't matched strongly yet
      if (itemScore === 0 && qWord.length >= 3) {
        const hasFuzzyTitle = indexed.nameWords.some((w) => isFuzzyMatch(qWord, w))
        if (hasFuzzyTitle) {
          itemScore += 40
          if (!matchReason) matchReason = `Typo-tolerant title match on "${qWord}"`
        } else {
          const hasFuzzyWord = indexed.allWords.slice(0, 15).some((w) => isFuzzyMatch(qWord, w))
          if (hasFuzzyWord) {
            itemScore += 30
            if (!matchReason) matchReason = `Typo-tolerant match on "${qWord}"`
          }
        }
      }
    }

    // 4. Semantic Synonyms evaluation
    if (semanticTargets.length > 0) {
      for (const target of semanticTargets) {
        if (
          indexed.nameLower.includes(target) ||
          indexed.catLower.includes(target) ||
          indexed.ingredientsLower.some((ing) => ing.includes(target)) ||
          indexed.descLower.includes(target)
        ) {
          itemScore += 45
          if (!matchReason) matchReason = `Semantic match for "${cleanQuery}"`
          break
        }
      }
    }

    if (itemScore > 0) {
      // Bonus for popularity / ratings
      if (indexed.tagsLower.includes('bestseller')) itemScore += 5
      if (indexed.tagsLower.includes('trending')) itemScore += 3

      scoredItems.push({
        item,
        score: itemScore,
        matchedReason: matchReason,
      })
    }
  }

  // Sort descending by match score
  scoredItems.sort((a, b) => b.score - a.score)

  return scoredItems.map((entry) => entry.item)
}
