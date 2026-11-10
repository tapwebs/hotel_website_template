// Fictional demonstration guest reviews, shown anonymously (no names, dates or platform attribution).

export interface Review {
  quote: string
  lang: 'hi-Latn' | 'en'
  rating: 4 | 5
}

export const reviews: Review[] = [
  {
    quote:
      'TapMenu Grand Resort ek perfect choice nikla. Rooms bahut clean the, bedsheets fresh the aur bathroom ekdum saaf. Highly recommended for comfortable luxury stays!',
    lang: 'hi-Latn',
    rating: 5,
  },
  {
    quote:
      'Hum apni family ke saath TapMenu Grand Resort mein ruke the. Kids ko bhi bahut pasand aaya. Staff itna friendly hai ki ghar jaisa feel hua. Safe aur clean hotel experience.',
    lang: 'hi-Latn',
    rating: 5,
  },
  {
    quote:
      'Vacation ke liye humne TapMenu Grand Resort book kiya tha. Room neat aur peaceful tha. Great hospitality and lovely amenities.',
    lang: 'hi-Latn',
    rating: 5,
  },
  {
    quote:
      'TapMenu Grand ka restaurant kamaal ka hai! Khana ekdum swadisht aur fresh tha, especially vegetarian and continental dishes.',
    lang: 'hi-Latn',
    rating: 5,
  },
  {
    quote:
      'Staff ka behaviour bahut accha tha. Check-in smooth tha aur har request pe turant help mili. Rooms clean the aur well-maintained.',
    lang: 'hi-Latn',
    rating: 4,
  },
  {
    quote:
      'Trip pe comfortable stay chahiye thi, aur TapMenu Grand Resort ne dil jeet liya. Saaf-suthre rooms, tasty food aur helpful staff. Dobara zaroor aayenge!',
    lang: 'hi-Latn',
    rating: 5,
  },
  {
    quote:
      'Stayed at TapMenu Grand Resort with my family and loved every moment. The rooms were spotless, the beds comfortable, and the staff went out of their way to help.',
    lang: 'en',
    rating: 5,
  },
  {
    quote:
      'A wonderful, peaceful stay at TapMenu Grand Resort. Clean rooms, warm hospitality and great value for modern travelers.',
    lang: 'en',
    rating: 5,
  },
  {
    quote:
      "The in-house dining at TapMenu Grand Resort pleasantly surprised us. The cuisine was fresh, flavorful and artfully served. Highly recommended.",
    lang: 'en',
    rating: 5,
  },
  {
    quote:
      'Looking for a relaxing resort with clean rooms and friendly service? TapMenu Grand Resort ticks every box. Smooth check-in, tidy rooms and delicious meals.',
    lang: 'en',
    rating: 4,
  },
]
