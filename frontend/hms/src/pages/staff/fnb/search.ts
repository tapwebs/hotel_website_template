import { searchMenuItems } from '../../../tapmenu/features/customer/menu/semanticSearch';
import type { MenuItem } from '../../../types/pms';

type Shaped = { categoryName: string; tags: string[] };
// One stable shaped copy per original item, so semanticSearch's WeakMap index cache is reused across keystrokes.
const shapedCache = new WeakMap<object, object>();
const origOf = new WeakMap<object, object>();
/** TapMenu's typo-tolerant, synonym-aware search ("panir tika", "something sweet") over our menu items. */
export function smartSearch<T extends Pick<MenuItem, 'id' | 'name' | 'category' | 'description'> & { tags?: string[] }>(items: T[], query: string): T[] {
  const q = query.trim();
  if (!q) return items;
  const shaped = items.map((i) => {
    let s = shapedCache.get(i);
    if (!s) { s = { ...i, categoryName: i.category.replace(/_/g, ' '), tags: i.tags ?? [] }; shapedCache.set(i, s); origOf.set(s, i); }
    return s as T & Shaped;
  });
  return searchMenuItems(shaped, q).map((s) => (origOf.get(s as object) as T | undefined) ?? (s as unknown as T));
}

/** Plain search for non-menu lists (tables, reservations, coupons): every word must appear somewhere. */
export function textMatch(hay: (string | number | null | undefined)[], query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const text = hay.filter((x) => x != null).join(' ').toLowerCase();
  return words.every((w) => text.includes(w));
}
