export const MAX_RANGE = 500

/** First and last code/label a placement range would create, for the preview line. Null when the range is invalid. */
export function rangePreview(r: { prefix: string; labelPrefix: string; from: number; to: number }) {
  if (!Number.isInteger(r.from) || !Number.isInteger(r.to) || r.from < 0 || r.to < r.from) return null
  const count = r.to - r.from + 1
  if (count > MAX_RANGE) return null
  const code = r.prefix.replace(/-+$/, '') // the API joins prefix and number with '-'
  const one = (n: number) => `${code}-${n} (${r.labelPrefix} ${n})`
  return { count, text: count === 1 ? one(r.from) : `${one(r.from)} … ${one(r.to)}` }
}
