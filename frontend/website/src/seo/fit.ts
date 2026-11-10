import { hotel } from '@/data/hotel'

export const SITE_NAME = hotel.name
/** Single source for absolute URLs. VITE_SITE_URL overrides it (e.g. a staging host). */
export const SITE_URL: string = (import.meta.env?.VITE_SITE_URL || hotel.url).replace(/\/+$/, '')

export const TITLE_RANGE = { min: 50, max: 60 } as const
export const DESCRIPTION_RANGE = { min: 120, max: 155 } as const

type Range = { min: number; max: number }

const distance = (length: number, { min, max }: Range) => Math.max(min - length, length - max, 0)

/** Keep the candidate closest to the range. Ties go to the earlier candidate. */
const closest = (candidates: string[], range: Range) =>
  candidates.reduce((best, c) => (distance(c.length, range) < distance(best.length, range) ? c : best))

/** Tries each candidate with and without the site name and keeps the one closest to 50-60 chars. */
export const fitTitle = (candidates: string[]) =>
  closest(
    candidates.flatMap((t) => [`${t} | ${SITE_NAME}`, t]),
    TITLE_RANGE,
  )

/** Keeps the candidate closest to 120-155 chars. */
export const fitDescription = (candidates: string[]) => closest(candidates, DESCRIPTION_RANGE)

/** Absolute URL for a site path. The home page keeps its trailing slash. */
export const absoluteUrl = (path: string) => (path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`)
