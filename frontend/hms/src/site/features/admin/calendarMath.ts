/** YYYY-MM-DD plus `n` days (UTC arithmetic, no time zones involved). */
export const addDaysYmd = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
