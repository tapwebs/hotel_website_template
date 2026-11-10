/**
 * Variant and size formatting utilities for TapMenu.
 * Handles portion sizes with Name, Number/Value, and Unit across Menu, POS, Waiter, and KDS.
 */

export interface FormattableVariant {
  name?: string
  label?: string
  value?: number | string | null
  unit?: string | null
  price?: number
}

/**
 * Formats a variant for clear, readable display:
 * - Both name and value+unit: "Small (250 ml)" or "Medium (500 ml)"
 * - Value and unit only: "250 ml" or "500 ml"
 * - Name only: "Regular" or "Large"
 * - Avoids duplication if name already contains the value and unit (e.g. "6 pcs" + 6 pcs -> "6 pcs").
 */
export function formatVariantLabel(v?: FormattableVariant | null): string {
  if (!v) return ''
  const name = (v.name || v.label || '').trim()
  const valStr = v.value != null && String(v.value).trim() !== '' ? String(v.value).trim() : ''
  const unitStr = (v.unit || '').trim()

  const sizePart = valStr && unitStr ? `${valStr} ${unitStr}` : valStr || unitStr

  if (!name && !sizePart) return 'Regular'
  if (!sizePart) return name
  if (!name) return sizePart

  // Check if name already includes the sizePart (case-insensitive & whitespace-flexible)
  const normName = name.toLowerCase().replace(/\s+/g, '')
  const normSize = sizePart.toLowerCase().replace(/\s+/g, '')
  if (normName.includes(normSize)) {
    return name
  }

  return `${name} (${sizePart})`
}

/**
 * Compact pill/chip representation:
 * Returns e.g. "250ml", "500ml", "Large", or "Small • 250ml".
 */
export function formatVariantShort(v?: FormattableVariant | null): string {
  if (!v) return ''
  const name = (v.name || v.label || '').trim()
  const valStr = v.value != null && String(v.value).trim() !== '' ? String(v.value).trim() : ''
  const unitStr = (v.unit || '').trim()

  if (valStr && unitStr) {
    const compactSize = `${valStr}${unitStr}`
    if (name && !name.toLowerCase().includes(valStr.toLowerCase())) {
      return `${name} ${compactSize}`
    }
    return compactSize
  }

  return name || (valStr ? `${valStr}${unitStr}` : 'Regular')
}
