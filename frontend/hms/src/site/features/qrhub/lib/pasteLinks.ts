import type { LinkInput } from './types'

export const MAX_BULK = 500
const ALLOWED = new Set(['http:', 'https:', 'tel:', 'mailto:'])

export interface ParsedRow {
  /** 1-based line (or array position for JSON). */
  line: number
  link?: LinkInput
  error?: string
}

export function checkUrl(url: string): string | null {
  if (!url) return 'URL is required'
  try {
    return ALLOWED.has(new URL(url).protocol) ? null : 'Only http, https, tel and mailto links are allowed'
  } catch {
    return 'Not a valid URL'
  }
}

function toRow(line: number, title: string, url: string, category: string, title_hi: string): ParsedRow {
  title = title.trim()
  url = url.trim()
  if (!title) return { line, error: 'Title is required' }
  if (title.length > 120) return { line, error: 'Title is longer than 120 characters' }
  const bad = checkUrl(url)
  if (bad) return { line, error: bad }
  return {
    line,
    link: {
      title,
      destination_url: url,
      ...(category.trim() ? { category: category.trim() } : {}),
      ...(title_hi.trim() ? { title_hi: title_hi.trim() } : {}),
    },
  }
}

/**
 * Parses pasted links: one per line `Title | URL | category | Hindi title` (last two optional),
 * or a JSON array of `{ title, destination_url|url, category?, title_hi? }`.
 */
export function parsePastedLinks(text: string): ParsedRow[] {
  const src = text.trim()
  if (!src) return []
  let rows: ParsedRow[]
  if (src.startsWith('[')) {
    let arr: unknown
    try {
      arr = JSON.parse(src)
    } catch {
      return [{ line: 1, error: 'Invalid JSON' }]
    }
    if (!Array.isArray(arr)) return [{ line: 1, error: 'Expected a JSON array' }]
    rows = arr.map((x, i) => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
      const s = (v: unknown) => (typeof v === 'string' ? v : '')
      return toRow(i + 1, s(o.title), s(o.destination_url) || s(o.url), s(o.category), s(o.title_hi))
    })
  } else {
    rows = src
      .split(/\r?\n/)
      .map((raw, i) => ({ raw, line: i + 1 }))
      .filter(({ raw }) => raw.trim() && !raw.trim().startsWith('#'))
      .map(({ raw, line }) => {
        const [title = '', url = '', category = '', hi = ''] = raw.split('|')
        return toRow(line, title, url, category, hi)
      })
  }
  if (rows.length > MAX_BULK) return [{ line: 1, error: `At most ${MAX_BULK} links at once` }]
  return rows
}
