import { createContext, useContext } from 'react'
import type { RoomId } from '@/data/rooms'

export interface BookingPrefill {
  roomId?: RoomId
}

export interface BookingContextValue {
  openBooking: (prefill?: BookingPrefill) => void
  /** Start downloading the booking form chunk (call on hover/focus of a Book Now button). */
  preloadBooking: () => void
}

export const BookingContext = createContext<BookingContextValue | null>(null)

export function useBooking(): BookingContextValue {
  const ctx = useContext(BookingContext)
  if (!ctx) throw new Error('useBooking must be used inside <BookingProvider>')
  return ctx
}

export const loadBookingForm = () => import('./BookingForm')
