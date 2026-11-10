// Dining (DESIGN-PLAN §2). No prices or opening hours were supplied, so none are shown.

export const meals = [
  { name: 'Breakfast', detail: 'Fresh, hot and served every morning for staying guests and visitors.' },
  { name: 'Lunch', detail: 'North Indian thalis, curries and breads, or a quick bite from the fast-food menu.' },
  { name: 'Dinner', detail: 'Slow-cooked dals, paneer and tandoor favourites in the restaurant or your room.' },
] as const

export const cuisineHighlights = [
  {
    name: 'North Indian classics',
    detail: 'Dal makhani, paneer butter masala and the rich gravies guests come back for.',
  },
  {
    name: 'From the tandoor',
    detail: 'Rotis, naans and tandoori starters, made to order.',
  },
  {
    name: 'Popular fast food',
    detail: 'Quick, familiar plates for travellers on the move and younger guests.',
  },
  {
    name: 'Catering for events',
    detail: 'Menus planned with you for weddings, engagements and corporate dinners.',
  },
] as const
