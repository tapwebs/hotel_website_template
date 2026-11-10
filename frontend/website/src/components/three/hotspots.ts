// Hotspots for the 3D property explorer.
// Follows the real property layout: unified main building (+20% size) with basement banquet hall,
// ground floor restaurant and upper floor rooms, expansive 2X function lawn on the left,
// swimming pool on the right (coming soon), EV charging in the forecourt (coming soon),
// and an expansive front parking forecourt.

export type HotspotId = 'rooms' | 'restaurant' | 'banquet' | 'lawn' | 'pool' | 'ev'

export interface Hotspot {
  id: HotspotId
  label: string
  copy: string
  subtitle?: string
  specs?: string[]
  link?: { to: string; label: string }
  comingSoon?: boolean
  /** Marker position in the scene. */
  position: [number, number, number]
  /** Where the camera flies to when this hotspot is chosen. */
  camera: [number, number, number]
  /** Target point for camera lookAt */
  target?: [number, number, number]
}

export const hotspots: Hotspot[] = [
  {
    id: 'rooms',
    label: 'Rooms & Suites',
    subtitle: 'Upper Floors • Deluxe & Super Deluxe',
    copy: 'Deluxe, Super Deluxe rooms and Royal Suites across the upper floors of the main hotel, each featuring private viewing balconies, AC, high-speed Wi-Fi, television and modern luxuries, all served by a 24/7 guest elevator.',
    specs: ['Lift Access', 'Private Balconies', 'Air Conditioned', 'Free High-Speed Wi-Fi'],
    link: { to: '/rooms', label: 'See Rooms' },
    position: [3.8, 16.2, 4.4],
    camera: [18, 22, 28],
    target: [3.8, 14.0, 2.0],
  },
  {
    id: 'restaurant',
    label: 'Restaurant (Ground Floor)',
    subtitle: 'Ground Floor • Panoramic Lawn Views',
    copy: 'Located on the ground floor of the hotel with panoramic floor-to-ceiling picture windows overlooking the grand lawn, serving authentic North Indian favourites, rich Rajasthani specialities, multi-cuisine delicacies and fast food.',
    specs: ['Indoor & Terrace Dining', 'Panoramic Lawn Views', 'North Indian & Rajasthani', 'Fast Food & Beverages'],
    link: { to: '/dining', label: 'See Dining' },
    position: [-7.0, 4.2, 1.4],
    camera: [-18, 11, 18],
    target: [-7.0, 3.5, 0.0],
  },
  {
    id: 'banquet',
    label: 'Banquet Hall (Basement)',
    subtitle: 'Basement Level • Indoor Ballroom',
    copy: 'Directly in the hotel’s basement, reached via the wide forecourt granite steps: a grand air-conditioned indoor banquet ballroom with polished Italian marble floors, decorative stage and sparkling crystal chandeliers, comfortably seating 150+ guests.',
    specs: ['150+ Seating Capacity', 'Italian Marble Flooring', 'Crystal Chandeliers', 'Dedicated Sunken Entry'],
    link: { to: '/weddings-events', label: 'Plan an Event' },
    position: [10.8, 0.9, 8.0],
    camera: [12, 9, 18],
    target: [10.2, 0.0, 6.0],
  },
  {
    id: 'lawn',
    label: 'Grand Function Lawn (2X)',
    subtitle: 'Left Wing • Expansive Celebration Lawn',
    copy: 'Beside the hotel on the left, the expansive 2X grand celebration lawn hosts 1,500 to 2,000+ guests for royal weddings, grand receptions and family celebrations under a canopy of festoon fairy lights, complete with a wedding mandap, royal fountain and promenade walkway.',
    specs: ['1,500 – 2,000+ Capacity', 'Royal Wedding Mandap', 'Festoon Light Canopy', 'Centerpiece Fountain'],
    link: { to: '/weddings-events', label: 'Plan a Wedding' },
    position: [-30.0, 3.5, -6.0],
    camera: [-20, 26, 32],
    target: [-30.0, 2.0, -6.0],
  },
  {
    id: 'pool',
    label: 'Pool & Cabana',
    subtitle: 'Right Wing • Luxury Sun Deck (Soon)',
    copy: 'A luxury swimming pool with travertine stone sun deck, comfortable loungers, parasols and poolside cabana are being built on the right side of the property. Coming soon.',
    comingSoon: true,
    specs: ['Travertine Sun Deck', 'Poolside Cabana', 'Sun Loungers & Parasols', 'Underwater Lighting'],
    position: [20.0, 2.0, -8.5],
    camera: [18, 15, 14],
    target: [20.0, 1.0, -8.5],
  },
  {
    id: 'ev',
    label: 'EV Charging Hub',
    subtitle: 'Front Forecourt • Green Mobility (Soon)',
    copy: 'Dedicated fast EV charging bays sheltered by a modern solar canopy are being installed in the front parking forecourt for hotel guests and highway travellers. Coming soon.',
    comingSoon: true,
    specs: ['Fast Charging Bays', 'Modern Solar Canopy', 'Dedicated Parking Forecourt', '24/7 Access'],
    position: [18.5, 3.0, 10.0],
    camera: [24, 11, 20],
    target: [18.5, 2.0, 10.0],
  },
]
