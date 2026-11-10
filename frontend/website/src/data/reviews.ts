// Owner-supplied guest reviews, shown anonymously (no names, dates or platform attribution).
// Verbatim: the owner wrote "Hotel Dream Heaven" (singular). Never emit rating JSON-LD or an average.

export interface Review {
  quote: string
  lang: 'hi-Latn' | 'en'
  rating: 4 | 5
}

export const reviews: Review[] = [
  {
    quote:
      'Bassi, Jaipur mein budget hotel dhoondh rahe the aur Hotel Dream Heaven ek perfect choice nikla. Rooms bahut clean the, bedsheets fresh the aur bathroom ekdum saaf. Paise ke hisaab se best budget hotel in Bassi Jaipur. Highly recommended!',
    lang: 'hi-Latn',
    rating: 5,
  },
  {
    quote:
      'Hum apni family ke saath Hotel Dream Heaven mein ruke the. Kids ko bhi bahut pasand aaya. Staff itna friendly hai ki ghar jaisa feel hua. Bassi Jaipur mein family ke liye safe aur clean hotel chahiye toh yahi best hai.',
    lang: 'hi-Latn',
    rating: 5,
  },
  {
    quote:
      'Honeymoon ke liye humne Hotel Dream Heaven, Bassi Jaipur book kiya tha. Room neat aur peaceful tha, couples ke liye ekdum sahi. Budget mein itni acchi stay milna mushkil hai. Couple friendly hotel in Jaipur ki talash ho toh yahan zaroor aaiye!',
    lang: 'hi-Latn',
    rating: 5,
  },
  {
    quote:
      'Hotel Dream Heaven ka restaurant kamaal ka hai! Khana ekdum swadisht aur ghar jaisa tha, especially dal baati churma aur paneer dishes. Bassi mein hotel with restaurant dhoondh rahe ho toh bina soche yahan jao.',
    lang: 'hi-Latn',
    rating: 5,
  },
  {
    quote:
      'Staff ka behaviour bahut accha tha. Check-in smooth tha aur har request pe turant help mili. Room clean tha aur sasta bhi. Bassi, Jaipur mein affordable hotel with clean rooms ke liye Hotel Dream Heaven ko 5 mein se 5!',
    lang: 'hi-Latn',
    rating: 4,
  },
  {
    quote:
      'Jaipur trip pe budget mein achhi stay chahiye thi, aur Hotel Dream Heaven ne dil jeet liya. Saaf-suthre rooms, tasty food aur helpful staff, aur kya chahiye? Bassi Jaipur ka best budget hotel for couples and families. Dobara zaroor aayenge!',
    lang: 'hi-Latn',
    rating: 5,
  },
  {
    quote:
      'Stayed at Hotel Dream Heaven in Bassi, Jaipur with my family and loved it. The rooms were spotless, the beds comfortable, and the staff went out of their way to help. Easily one of the best budget hotels in Bassi Jaipur for families.',
    lang: 'en',
    rating: 5,
  },
  {
    quote:
      'We chose Hotel Dream Heaven for our honeymoon trip near Jaipur, and it was a lovely, peaceful stay. Clean room, warm hospitality and great value for money. A truly couple-friendly budget hotel in Bassi, Jaipur.',
    lang: 'en',
    rating: 5,
  },
  {
    quote:
      "The in-house restaurant at Hotel Dream Heaven pleasantly surprised us. The food was fresh, flavorful and reasonably priced. Combined with clean rooms and courteous staff, it's a great hotel with restaurant in Bassi, Jaipur.",
    lang: 'en',
    rating: 5,
  },
  {
    quote:
      'Looking for an affordable hotel in Bassi, Jaipur with clean rooms and friendly service? Hotel Dream Heaven ticks every box. Smooth check-in, tidy rooms and delicious meals. Highly recommended for families and couples.',
    lang: 'en',
    rating: 4,
  },
]
