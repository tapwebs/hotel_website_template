/** Browser icon from Hotel settings > Branding. Falls back to the built-in icons if the link is missing or broken. */
import { API_BASE_URL } from '../services/apiServices';

const DEFAULT = '/favicon-32.png';

export function applyFavicon(url: string | null | undefined) {
  if (typeof document === 'undefined') return;
  const target = url && (url.startsWith('https://') || (url.startsWith('/') && !url.startsWith('//'))) ? url : DEFAULT;
  const set = (href: string) => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-branding]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.dataset.branding = 'true';
      document.head.appendChild(link); // the last icon link wins
    }
    link.href = href;
  };
  // Only swap once the image actually loads, so a bad link never leaves the tab without an icon.
  const img = new Image();
  img.onload = () => set(target);
  img.onerror = () => set(DEFAULT);
  img.src = target;
}

/** Load the configured icon at startup. Public endpoint: works before login and on guest pages. */
export async function loadBrandingFavicon() {
  try {
    const res = await fetch(`${API_BASE_URL}/settings/public/branding`, { cache: 'no-store' });
    if (res.ok) applyFavicon((await res.json()).faviconUrl);
  } catch {
    // offline: keep the built-in icon
  }
}
