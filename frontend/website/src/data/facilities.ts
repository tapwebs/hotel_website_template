// Facilities (DESIGN-PLAN §2). Icon names map to lucide-react icons in the Facilities section.

export type FacilityIcon =
  | 'utensils'
  | 'landmark'
  | 'trees'
  | 'car'
  | 'arrow-up-down'
  | 'bell'
  | 'shirt'
  | 'zap'
  | 'cctv'
  | 'accessibility'
  | 'waves'
  | 'plug-zap'

export interface Facility {
  name: string
  detail: string
  icon: FacilityIcon
  comingSoon?: boolean
}

export const facilities: Facility[] = [
  { name: 'Restaurant & dining', detail: 'On the ground floor: North Indian kitchen and fast food, all day', icon: 'utensils' },
  { name: 'Indoor banquet hall', detail: 'In the basement, seats around 120 guests', icon: 'landmark' },
  { name: 'Outdoor function lawn', detail: 'Hosts around 1,500 to 2,000 guests', icon: 'trees' },
  { name: 'Parking', detail: 'On-site, in the front forecourt', icon: 'car' },
  { name: 'Lift', detail: 'Serving the guest floors', icon: 'arrow-up-down' },
  { name: 'Room service', detail: 'Meals and requests to your door', icon: 'bell' },
  { name: 'Laundry', detail: 'Ask at reception', icon: 'shirt' },
  { name: 'Power backup', detail: 'Keeps the lights and AC on', icon: 'zap' },
  { name: 'CCTV & security', detail: 'Monitored common areas', icon: 'cctv' },
  { name: 'Wheelchair accessible', detail: 'Lift access; tell us your needs ahead', icon: 'accessibility' },
  { name: 'Swimming pool', detail: 'Being built now', icon: 'waves', comingSoon: true },
  { name: 'EV charging', detail: 'On its way, in the front forecourt', icon: 'plug-zap', comingSoon: true },
]
