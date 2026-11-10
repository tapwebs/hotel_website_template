const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const longDate = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

/** ₹2,000 */
export const formatINR = (amount: number) => inr.format(amount)

/** Tue, 14 Oct 2026 */
export const formatDate = (date: Date) => longDate.format(date)
