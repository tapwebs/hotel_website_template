/**
 * Timezone and Date Synchronization Utilities for Hotel Dream Heavens HMS.
 * Authoritative Application Timezone: Asia/Kolkata (IST: UTC+05:30).
 */

export const APPLICATION_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns today's calendar date in Asia/Kolkata formatted as 'YYYY-MM-DD'.
 */
export function getKolkataCalendarDate(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: APPLICATION_TIMEZONE }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Formats a 'YYYY-MM-DD' ISO date string into a localized string using Asia/Kolkata timezone.
 * Parses at 12:00:00 UTC to prevent any boundary shifts or daylight savings anomalies.
 */
export function formatKolkataDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }
): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts.map(Number);
  if (!year || !month || !day) return dateStr;

  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: APPLICATION_TIMEZONE,
    ...options
  }).format(date);
}

/**
 * Calculates exact milliseconds remaining until midnight (00:00:00) in Asia/Kolkata.
 */
export function getMillisUntilKolkataMidnight(): number {
  const now = new Date();
  const offsetMs = (5 * 60 + 30) * 60 * 1000;
  const kolkataMs = now.getTime() + offsetMs;
  const msIntoDay = kolkataMs % (24 * 60 * 60 * 1000);
  return (24 * 60 * 60 * 1000) - msIntoDay;
}

/**
 * Helper to check if two YYYY-MM-DD date strings match.
 */
export function isSameDate(d1?: string | null, d2?: string | null): boolean {
  if (!d1 || !d2) return false;
  return d1.trim() === d2.trim();
}
