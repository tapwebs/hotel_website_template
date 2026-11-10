export function resolveSiteUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin.toLowerCase();
    if (origin.startsWith('http')) {
      return window.location.origin;
    }
  }
  const envVal = (import.meta?.env?.VITE_SITE_URL as string | undefined)?.trim().replace(/\/+$/, '');
  if (envVal) {
    return envVal;
  }
  return 'https://example.com';
}

export function resolveHmsUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin.toLowerCase();
    if (origin.startsWith('http')) {
      return window.location.origin;
    }
  }
  const envVal = (import.meta?.env?.VITE_HMS_URL as string | undefined)?.trim().replace(/\/+$/, '');
  if (envVal) {
    return envVal;
  }
  return 'https://example.com';
}

/** Canonical origin the printed website/hub QR codes point at. */
export const SITE_URL = resolveSiteUrl();

/** Canonical origin the printed HMS / Dining QR codes point at. */
export const HMS_URL = resolveHmsUrl();

/** The exact URL a QR encodes: https://hoteldreamheavens.in/r/<slug>[?p=<code>]. It never changes when links change. */
export function buildQrUrl(slug: string, placementCode?: string | null, origin?: string): string {
  const effectiveOrigin = (origin ?? resolveSiteUrl()).replace(/\/+$/, '');
  const base = `${effectiveOrigin}/r/${encodeURIComponent(slug)}`;
  return placementCode ? `${base}?p=${encodeURIComponent(placementCode)}` : base;
}

/** In-room dining QR destination: https://hoteldreamheavens.in/dining/r/<token> */
export function buildRoomDiningQrUrl(token: string, origin?: string): string {
  const effectiveOrigin = (origin ?? resolveSiteUrl()).replace(/\/+$/, '');
  return `${effectiveOrigin}/dining/r/${encodeURIComponent(token)}`;
}

/** Table dining QR destination: https://hoteldreamheavens.in/dining/t/<token> */
export function buildTableDiningQrUrl(token: string, origin?: string): string {
  const effectiveOrigin = (origin ?? resolveSiteUrl()).replace(/\/+$/, '');
  return `${effectiveOrigin}/dining/t/${encodeURIComponent(token)}`;
}

/** Where the redirect lands (used for "Preview hub" links). */
export function hubPath(slug: string, placementCode?: string | null): string {
  const base = `/hub/${encodeURIComponent(slug)}`;
  return placementCode ? `${base}?p=${encodeURIComponent(placementCode)}` : base;
}
