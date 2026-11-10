import { useEffect } from 'react'
import { useSession } from '../session/SessionContext'
import { useCartStore } from './cartStore'

/**
 * Syncs the cart store's persistence key from the session context.
 * Call this once near the top of any customer page that reads/writes the
 * cart (MenuPage, CartPage, CheckoutPage) — it's idempotent and cheap.
 */
export function useSyncCartKey() {
  const { cartKey } = useSession()
  const currentKey = useCartStore((s) => s.cartKey)
  const setCartKey = useCartStore((s) => s.setCartKey)

  useEffect(() => {
    if (cartKey && cartKey !== currentKey) {
      setCartKey(cartKey)
    }
  }, [cartKey, currentKey, setCartKey])
}
