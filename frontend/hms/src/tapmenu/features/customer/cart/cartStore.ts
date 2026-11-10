import { create } from 'zustand'
import type { CartLine } from '../../../types/customer'

/**
 * Cart store. Persisted to localStorage under a key namespaced by the
 * session's cartKey (see setCartKey/persistence below) so a refresh never
 * loses the cart, and different tables/restaurants never cross-contaminate
 * each other's carts (per plan §5).
 *
 * Line-item pricing is NOT computed here — this store only tracks WHAT is
 * selected (item/variant/add-on ids and quantities). The authoritative
 * price comes from POST /api/quote (see pricing.ts's DISPLAY ONLY comment).
 */
interface CartState {
  lines: CartLine[]
  note: string
  couponCode: string | null
  /** Items whose "goes well with" upsell has already been shown this session, so it isn't repeated. */
  upsellShown: string[]
  cartKey: string | null

  addLine: (line: CartLine) => void
  /** Adjusts quantity for a plain line (no variant/add-ons) matching itemId, adding it if absent. */
  quickAdjust: (itemId: string, delta: number) => void
  updateLineQty: (index: number, delta: number) => void
  removeLine: (index: number) => void
  quantityFor: (itemId: string) => number
  totalCount: () => number
  setNote: (note: string) => void
  setCouponCode: (code: string | null) => void
  markUpsellShown: (itemId: string) => void
  clear: () => void
  setCartKey: (cartKey: string) => void
}

function sameLine(a: CartLine, b: { itemId: string; variantId?: string; addOnIds: string[] }): boolean {
  return (
    a.itemId === b.itemId &&
    a.variantId === b.variantId &&
    a.addOnIds.length === b.addOnIds.length &&
    a.addOnIds.every((id, i) => id === b.addOnIds[i])
  )
}

const STORAGE_PREFIX = 'tapmenu_cart_'

interface PersistedCart {
  lines: CartLine[]
  note: string
  couponCode: string | null
}

function loadPersisted(cartKey: string): PersistedCart | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${cartKey}`)
    if (!raw) return null
    return JSON.parse(raw) as PersistedCart
  } catch {
    return null
  }
}

function savePersisted(cartKey: string, data: PersistedCart) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${cartKey}`, JSON.stringify(data))
  } catch {
    // Ignore storage errors (private browsing, quota) — cart still works in-memory for this tab.
  }
}

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],
  note: '',
  couponCode: null,
  upsellShown: [],
  cartKey: null,

  addLine: (line) => {
    set((state) => {
      const existingIdx = state.lines.findIndex((l) => sameLine(l, line))
      if (existingIdx === -1) return { lines: [...state.lines, line] }
      const next = [...state.lines]
      next[existingIdx] = { ...next[existingIdx], qty: next[existingIdx].qty + line.qty }
      return { lines: next }
    })
    persist(get())
  },

  quickAdjust: (itemId, delta) => {
    set((state) => {
      let idx = state.lines.findIndex((l) => l.itemId === itemId && !l.variantId && l.addOnIds.length === 0)
      if (idx === -1) {
        const itemLines = state.lines.map((l, i) => ({ l, i })).filter((entry) => entry.l.itemId === itemId)
        if (itemLines.length > 0) {
          idx = itemLines[itemLines.length - 1].i
        }
      }
      if (idx === -1) {
        if (delta <= 0) return state
        return { lines: [...state.lines, { itemId, addOnIds: [], qty: 1 }] }
      }
      const nextQty = state.lines[idx].qty + delta
      if (nextQty <= 0) return { lines: state.lines.filter((_, i) => i !== idx) }
      const next = [...state.lines]
      next[idx] = { ...next[idx], qty: nextQty }
      return { lines: next }
    })
    persist(get())
  },

  updateLineQty: (index, delta) => {
    set((state) => {
      const line = state.lines[index]
      if (!line) return state
      const nextQty = line.qty + delta
      if (nextQty <= 0) return { lines: state.lines.filter((_, i) => i !== index) }
      const next = [...state.lines]
      next[index] = { ...next[index], qty: nextQty }
      return { lines: next }
    })
    persist(get())
  },

  removeLine: (index) => {
    set((state) => ({ lines: state.lines.filter((_, i) => i !== index) }))
    persist(get())
  },

  quantityFor: (itemId) => get().lines.filter((l) => l.itemId === itemId).reduce((sum, l) => sum + l.qty, 0),

  totalCount: () => get().lines.reduce((sum, l) => sum + l.qty, 0),

  setNote: (note) => {
    set({ note })
    persist(get())
  },

  setCouponCode: (couponCode) => {
    set({ couponCode })
    persist(get())
  },

  markUpsellShown: (itemId) => set((state) => ({ upsellShown: [...state.upsellShown, itemId] })),

  clear: () => {
    set({ lines: [], note: '', couponCode: null })
    persist(get())
  },

  setCartKey: (cartKey) => {
    const persisted = loadPersisted(cartKey)
    set({
      cartKey,
      lines: persisted?.lines ?? [],
      note: persisted?.note ?? '',
      couponCode: persisted?.couponCode ?? null,
    })
  },
}))

function persist(state: CartState) {
  if (!state.cartKey) return
  savePersisted(state.cartKey, { lines: state.lines, note: state.note, couponCode: state.couponCode })
}
