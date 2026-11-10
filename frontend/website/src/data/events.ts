// Weddings & events (DESIGN-PLAN §2, §3). Package pricing was not supplied: "on enquiry".

export type VenueId = 'hall' | 'lawn' | 'both'

export const venues = [
  {
    id: 'hall' as const,
    name: 'Indoor banquet hall',
    capacity: '120',
    capacityLabel: 'guests, around',
    detail: 'Marble floors, crystal chandeliers and carved jali ceilings, sized for engagements, birthdays and corporate dinners.',
  },
  {
    id: 'lawn' as const,
    name: 'Outdoor function lawn',
    capacity: '2,000',
    capacityLabel: 'guests, up to around',
    detail:
      'Open sky for the big day. Room for a full baraat, mandap, stage and dining for 1,500 to 2,000 guests, with power backup on hand.',
  },
]

export const packages = [
  {
    name: 'Venue and catering',
    includes: ['Banquet hall or lawn', 'Menu planned with our kitchen', 'Power backup and parking'],
  },
  {
    name: 'Wedding stay',
    includes: [
      'Venue and catering',
      'Rooms for family and guests',
      'Room service through the celebrations',
      'Planned with you on WhatsApp or a call',
    ],
  },
]

export const occasions = [
  {
    name: 'Weddings & receptions',
    detail: 'The lawn holds the main event for 1,500 to 2,000 guests, with baraat, mandap and stage; the hall suits intimate rituals.',
  },
  { name: 'Engagements', detail: 'Ring ceremonies and sagai in the banquet hall, with dinner for family from our kitchen.' },
  {
    name: 'Haldi, mehndi & sangeet',
    detail: 'Pre-wedding functions planned with you in the banquet hall or on the lawn, with catering from our kitchen.',
  },
  { name: 'Birthdays & anniversaries', detail: 'The hall for around 120, your theme and a menu for all ages.' },
  { name: 'Retirement & farewell parties', detail: 'A dinner for colleagues and family in the banquet hall, with power backup and on-site parking.' },
  { name: 'Corporate events', detail: 'Dinners, meetings and team gatherings with power backup and on-site parking.' },
] as const

export const eventTypes = ['Wedding', 'Reception', 'Haldi', 'Mehndi', 'Sangeet', 'Engagement', 'Birthday', 'Anniversary', 'Retirement party', 'Corporate event', 'Other'] as const
