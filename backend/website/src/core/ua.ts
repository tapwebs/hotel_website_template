export interface UaInfo {
  device: 'mobile' | 'tablet' | 'desktop' | 'unknown'
  browser: string
  os: string
  bot: boolean
}
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|curl|wget|python-requests|headless|lighthouse/i
/** Small, dependency-free user-agent classifier. Only these coarse labels are stored, never the raw string. */
export function parseUa(ua: string | undefined): UaInfo {
  if (!ua) return { device: 'unknown', browser: 'unknown', os: 'unknown', bot: false }
  const bot = BOT.test(ua)
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /CrOS/.test(ua)
            ? 'ChromeOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'unknown'
  const browser = /EdgA?\/|Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser/.test(ua)
        ? 'Samsung Internet'
        : /Firefox\/|FxiOS/.test(ua)
          ? 'Firefox'
          : /Chrome\/|CriOS/.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'unknown'
  const device = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))
    ? 'tablet'
    : /Mobi|iPhone|iPod|Android/.test(ua)
      ? 'mobile'
      : os === 'unknown'
        ? 'unknown'
        : 'desktop'
  return { device, browser, os, bot }
}
/** Host of a Referer header, or null. */
export function refererHost(ref: string | undefined): string | null {
  if (!ref) return null
  try {
    return new URL(ref).hostname.slice(0, 100) || null
  } catch {
    return null
  }
}
