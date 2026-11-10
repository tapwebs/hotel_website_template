const date = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const dateTime = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const num = new Intl.NumberFormat('en-IN')

export const fmtNumber = (n: number) => num.format(n)
/** "14 Oct 2026", or the fallback for null / unparseable input. */
export const fmtDate = (iso: string | null, fallback = 'Never') => {
  const d = iso ? new Date(iso) : null
  return d && !Number.isNaN(d.getTime()) ? date.format(d) : fallback
}
export const fmtDateTime = (iso: string | null, fallback = 'Never') => {
  const d = iso ? new Date(iso) : null
  return d && !Number.isNaN(d.getTime()) ? dateTime.format(d) : fallback
}
