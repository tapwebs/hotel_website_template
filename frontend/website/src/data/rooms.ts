// Room facts (DESIGN-PLAN §2). Sizes and the extra-bed charge are unconfirmed, so they are
// never stated as numbers.

import { images, type SiteImage } from './images'

export type RoomId = 'deluxe' | 'super-deluxe'

export interface Room {
  id: RoomId
  name: string
  rate: number
  bed: string
  occupancy: string
  maxAdults: number
  summary: string
  image: SiteImage
}

export const roomAmenities = [
  'Air conditioning',
  'Wi-Fi',
  'TV',
  'Attached washroom',
  'Balcony',
  'Geyser',
  'Windows with curtains',
  'Extra pillows',
] as const

export const rooms: Room[] = [
  {
    id: 'deluxe',
    name: 'Deluxe Room',
    rate: 2000,
    bed: 'King-size bed',
    occupancy: 'Up to 2 adults',
    maxAdults: 2,
    summary: 'A calm, well-lit room with a king-size bed, a private balcony and everything you need for a restful night on the Agra Road.',
    image: images.rooms.deluxe,
  },
  {
    id: 'super-deluxe',
    name: 'Super Deluxe Room',
    rate: 2200,
    bed: 'Bed larger than king-size',
    occupancy: 'Up to 2 adults',
    maxAdults: 2,
    summary: 'Our most generous room. A bed wider than a king, more space to unwind and the same balcony, Wi-Fi and room service.',
    image: images.rooms.superDeluxe,
  },
]

export const extraBedNote = 'Extra bed available, charge on request'

export function getRoom(id: RoomId): Room {
  return rooms.find((r) => r.id === id) ?? rooms[0]
}
