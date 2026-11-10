/**
 * Shared Client-Side Review and Contact Validation Engine
 * Runs before form submission with real-time friendly feedback.
 */

const KEYBOARD_MASH_PATTERNS = [
  /qwerty/i,
  /asdfgh/i,
  /zxcvb/i,
  /poiuy/i,
  /lkjhg/i,
  /mnbvc/i,
  /qazwsx/i,
  /wsxedc/i,
  /edcrfv/i,
  /12345/i,
  /abcdef/i,
]

const LOW_EFFORT_PHRASES = new Set([
  'good',
  'nice',
  'ok',
  'okay',
  'test',
  'testing',
  'asdf',
  'asdfgh',
  'qwerty',
  'cool',
  'fine',
  'bad',
  'super',
  'yummy',
  'great',
  'worst',
])

export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateCustomerName(name: string): ValidationResult {
  const trimmed = name.trim()

  if (!trimmed || trimmed.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters long' }
  }

  if (trimmed.length > 50) {
    return { valid: false, error: 'Name cannot exceed 50 characters' }
  }

  if (!/^[a-zA-Z]+(?: [a-zA-Z]+)*$/.test(trimmed)) {
    return { valid: false, error: 'Name can only contain letters and spaces (no numbers or symbols)' }
  }

  if (/([a-zA-Z])\1{2,}/i.test(trimmed)) {
    return { valid: false, error: 'Please enter a genuine name without repeated characters' }
  }

  for (const pattern of KEYBOARD_MASH_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'Please enter a valid real name' }
    }
  }

  if (/^(.{2,4})\1{2,}$/i.test(trimmed)) {
    return { valid: false, error: 'Please enter a genuine name' }
  }

  const lettersOnly = trimmed.toLowerCase().replace(/[^a-z]/g, '')
  const uniqueCount = new Set(lettersOnly).size
  if (lettersOnly.length >= 7 && uniqueCount <= 3) {
    return { valid: false, error: 'Please enter a genuine name' }
  }

  const words = trimmed.split(/\s+/)
  for (const word of words) {
    if (word.length >= 4 && !/[aeiouyAEIOUY]/.test(word)) {
      return { valid: false, error: 'Please enter a valid name' }
    }
  }

  return { valid: true }
}

export function validateIndianMobile(phone: string): ValidationResult {
  const clean = phone.replace(/[\s\-\+]/g, '').trim()

  if (!/^[6-9]\d{9}$/.test(clean)) {
    return {
      valid: false,
      error: 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9',
    }
  }

  if (/^(\d)\1{9}$/.test(clean)) {
    return { valid: false, error: 'Please provide a genuine mobile number' }
  }

  return { valid: true }
}

export function validateReviewText(comment: string): ValidationResult {
  const trimmed = comment.trim()

  if (trimmed.length < 15) {
    return {
      valid: false,
      error: `Please share a little more feedback (minimum 15 characters, currently ${trimmed.length})`,
    }
  }

  if (trimmed.length > 600) {
    return { valid: false, error: 'Review is too long (maximum 600 characters)' }
  }

  const lettersOnly = trimmed.replace(/[^a-zA-Z]/g, '')
  if (lettersOnly.length < 10) {
    return { valid: false, error: 'Please write your review in meaningful words rather than only symbols or emojis' }
  }

  if (/([a-zA-Z])\1{3,}/i.test(trimmed)) {
    return { valid: false, error: 'Please avoid repeated letters and describe your meal experience' }
  }

  for (const pattern of KEYBOARD_MASH_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'Review appears to contain keyboard mash text. Please share honest feedback.' }
    }
  }

  if (/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{5,}/.test(trimmed)) {
    return { valid: false, error: 'Please write meaningful words to describe your dining experience' }
  }

  const uniqueChars = new Set(lettersOnly.toLowerCase())
  if (uniqueChars.size < 5) {
    return { valid: false, error: 'Please provide more specific and meaningful feedback' }
  }

  const rawWords = trimmed.toLowerCase().split(/[\s,.\-!?;:]+/).filter(Boolean)
  if (rawWords.length < 2) {
    return { valid: false, error: 'Please write at least 2 or 3 words describing your meal' }
  }

  const nonLowEffort = rawWords.filter((w) => !LOW_EFFORT_PHRASES.has(w) && w.length >= 3)
  if (nonLowEffort.length === 0) {
    return {
      valid: false,
      error: 'Please tell us what specifically you liked or what could be improved (e.g. taste, service, ambiance)',
    }
  }

  return { valid: true }
}
