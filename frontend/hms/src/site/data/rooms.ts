// Room types offered when taking a booking at the desk. Rates here are only the preview; the website backend prices the booking
// (and, when the HMS is connected, the HMS owns the rates).
export type RoomId = 'deluxe' | 'super-deluxe'
export interface Room {
  id: RoomId
  name: string
  rate: number
  maxAdults: number
}
export const rooms: Room[] = [
  { id: 'deluxe', name: 'Deluxe Room', rate: 2000, maxAdults: 2 },
  { id: 'super-deluxe', name: 'Super Deluxe Room', rate: 2200, maxAdults: 2 },
]
