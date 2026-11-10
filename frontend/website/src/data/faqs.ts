// FAQs. Answers use only confirmed facts (DESIGN-PLAN §2). Each answer is self-contained so it
// reads correctly when quoted on its own.

export const faqs = [
  {
    q: 'Where exactly is the hotel?',
    a: 'TapMenu Grand Resort & Spa is located at 100 Hospitality Boulevard, Metropolis. Turn in at the main gate and park in the front forecourt beside the entrance steps. Use Get Directions on the Contact page to open the route in Google Maps.',
  },
  {
    q: 'How do I book a room?',
    a: 'Book a room at TapMenu Grand Resort & Spa with Book Now: choose your dates and room, and your request opens in WhatsApp, already filled in. Send it and the hotel confirms availability and the final price with you on WhatsApp. You can also call +91 98765 43210 or +91 98765 43211 or email contact@example.com.',
  },
  {
    q: 'Is my room confirmed when I send the request?',
    a: 'Not yet. Sending the request does not reserve the room. TapMenu Grand Resort & Spa replies on WhatsApp to confirm availability and the final price, including taxes and any extra bed, and your stay is confirmed only after that reply. For a quicker answer, call +91 98765 43210 or +91 98765 43211.',
  },
  {
    q: 'What do the rooms cost?',
    a: 'At TapMenu Grand Resort & Spa in Metropolis, the Deluxe Room is ₹2,000 a night and the Super Deluxe Room is ₹2,200 a night. Both sleep up to 2 adults. Taxes and any extra bed are added when the hotel confirms your booking.',
  },
  {
    q: 'What is in every room?',
    a: 'Every room at TapMenu Grand Resort & Spa has air conditioning, Wi-Fi, a TV, an attached washroom, a private balcony, a hot-water geyser, windows with curtains and extra pillows. The Deluxe Room has a king-size bed and the Super Deluxe Room a bed larger than king-size.',
  },
  {
    q: 'How many guests can stay in one room?',
    a: 'Each room at TapMenu Grand Resort & Spa, Deluxe or Super Deluxe, sleeps up to 2 adults. An extra bed is available on request, and the hotel shares the extra-bed charge when it confirms your booking. Travelling as a larger group? Request more than one room in the same message.',
  },
  {
    q: 'What time are check-in and check-out?',
    a: 'Check-in and check-out at TapMenu Grand Resort & Spa are both at 11:00 AM. Every adult guest needs a government-issued photo ID at check-in. Arriving early? Message the hotel and they will try to have your room ready. Need to leave later? Ask at reception about staying a little longer.',
  },
  {
    q: 'Do you accept UPI and cards?',
    a: 'Yes. TapMenu Grand Resort & Spa accepts cash, UPI and cards, so you can pay for your room, meals and events in the way that suits you. The final price, including taxes and any extra bed, is confirmed by the hotel on WhatsApp before your stay.',
  },
  {
    q: 'Are children allowed?',
    a: 'Yes, children are welcome at TapMenu Grand Resort & Spa. Families can stay together, and an extra bed is available on request.',
  },
  {
    q: 'Can visitors come to my room?',
    a: 'Yes. Guests staying at TapMenu Grand Resort & Spa may receive visitors during their stay. Visitors are also welcome at the ground-floor restaurant, which serves North Indian dishes, tandoor breads and fast food from breakfast to dinner, so it is an easy place to meet family or friends over a meal.',
  },
  {
    q: 'Does the restaurant serve visitors who are not staying?',
    a: 'Yes. The restaurant at TapMenu Grand Resort & Spa serves breakfast, lunch and dinner to visitors as well as staying guests. The menu covers North Indian classics, tandoor breads and popular fast food. Ask at reception or on WhatsApp for the day’s timings.',
  },
  {
    q: 'Can you host our wedding?',
    a: 'Yes. TapMenu Grand Resort & Spa hosts weddings on its outdoor function lawn for around 1,500 to 2,000 guests, and in its indoor banquet hall for around 120. Venue, catering and rooms for family can be planned together. Send an enquiry from the Weddings & Events page, or WhatsApp +91 98765 43210 or +91 98765 43211.',
  },
  {
    q: 'Do you cater weddings and events?',
    a: 'Yes. The kitchen at TapMenu Grand Resort & Spa plans menus with you for weddings, haldi, mehndi and sangeet, engagements, birthdays, anniversaries, retirement parties and corporate dinners, served in the banquet hall or on the lawn. Packages can include venue, catering and rooms for family. Pricing is shared on enquiry.',
  },
  {
    q: 'Is there Wi-Fi and power backup?',
    a: 'Yes. Every room at TapMenu Grand Resort & Spa has Wi-Fi, and the hotel has power backup that keeps the lights and air conditioning running during a power cut. Power backup also supports events in the banquet hall and on the function lawn, so celebrations carry on without interruption.',
  },
  {
    q: 'Is there parking?',
    a: 'Yes. TapMenu Grand Resort & Spa has on-site parking in the front forecourt, right beside the entrance steps, so luggage is a short walk from reception. Turn in at the gate at 100 Hospitality Boulevard. Wedding and event guests park on site too.',
  },
  {
    q: 'Is the hotel wheelchair accessible?',
    a: 'Yes. A lift serves the guest floors at TapMenu Grand Resort & Spa, so guests who use a wheelchair or avoid stairs can reach their room. Parking is right beside the entrance. Tell the hotel about any access needs when you send your booking request, and the team will prepare for your arrival.',
  },
  {
    q: 'Is there a swimming pool?',
    a: 'Not yet. A swimming pool is being built at TapMenu Grand Resort & Spa and is not open, and EV charging in the front forecourt is on its way. Open today: the ground-floor restaurant, room service, laundry, a lift, power backup, on-site parking, the banquet hall and the function lawn.',
  },
  {
    q: 'What is the cancellation policy?',
    a: 'Cancellation and refund terms are shared by TapMenu Grand Resort & Spa for each booking, so ask before you confirm your stay. Call or WhatsApp +91 98765 43210 or +91 98765 43211, or email contact@example.com, and the hotel will explain the terms that apply to your dates, room and any event booking.',
  },
] as const

export interface Faq {
  q: string
  a: string
}

// Topic FAQs shown on their own page (<PageFaqs path=…>) and marked up as that page's FAQPage.
// Each question appears on ONE page only: never repeat a question from `faqs` (Contact) here.
// Answers are 40-60 words, answer-first, and use only facts from src/data/*.
export const pageFaqs: Record<
  '/rooms' | '/dining' | '/weddings-events' | '/about' | '/hotel-in-bassi-jaipur' | '/wedding-venue-in-bassi' | '/hotel-near-dausa',
  readonly Faq[]
> = {
  '/wedding-venue-in-bassi': [
    {
      q: 'Is there a wedding venue in Bassi near Dausa?',
      a: 'Yes. TapMenu Grand Resort & Spa features an expansive outdoor lawn accommodating 1,500 to 2,000 guests alongside an elegant indoor banquet hall for 120 guests. Convenient highway access enables guests from nearby cities to arrive smoothly. Dedicated on-site parking and full power backup ensure complete celebration support throughout.',
    },
    {
      q: 'Can I hold the baraat and the ceremony on the lawn at Bassi?',
      a: 'Yes. The lawn has room for a full baraat, mandap, stage and dining for 1,500 to 2,000 guests, with power backup on hand. Smaller rituals such as engagement or haldi can use the banquet hall. Call or WhatsApp +91 98765 43210 to plan the dates and menu.',
    },
  ],
  '/hotel-near-dausa': [
    {
      q: 'How far is Hotel Dream Heaven’s from Dausa?',
      a: 'The property is located along the primary regional highway corridor with seamless road connectivity. Turn in at the main property gate, park in the spacious secure front forecourt, and proceed to reception where check-in commences from 11:00 AM daily with full hospitality staff ready to welcome you.',
    },
    {
      q: 'Can I book a room near Dausa for one night?',
      a: 'Yes. Send your dates and room choice on WhatsApp or by phone and the hotel confirms availability and the final price. A Deluxe Room costs ₹2,000 a night and a Super Deluxe Room ₹2,200, both before taxes. Check-in is from 11:00 AM and check-out is by 11:00 AM.',
    },
  ],
  '/hotel-in-bassi-jaipur': [
    {
      q: 'Where is Hotel Dream Heaven’s in Bassi, Jaipur?',
      a: 'TapMenu Grand Resort & Spa is located at 100 Hospitality Boulevard, Metropolis. Turn in at the gate and park in the front forecourt beside the entrance steps. If you have trouble finding the hotel, call or WhatsApp +91 98765 43210 and the front desk will guide you.',
    },
    {
      q: 'How far is Hotel Dream Heaven’s from Jaipur?',
      a: 'The property is situated within easy driving distance across the metropolitan region along the main thoroughfare. Travel duration varies according to regional traffic conditions. Share your anticipated arrival details on messaging channels so front desk specialists can prepare your room for seamless check-in from 11:00 AM onwards.',
    },
  ],
  '/rooms': [
    {
      q: 'What is the difference between the Deluxe and Super Deluxe Room?',
      a: 'The Deluxe Room at TapMenu Grand Resort & Spa costs ₹2,000 a night and has a king-size bed. The Super Deluxe Room costs ₹2,200 a night and has a bed larger than king-size, with more space to unwind. Both sleep up to 2 adults and share the same balcony, Wi-Fi, AC, TV and attached washroom.',
    },
    {
      q: 'Can I add an extra bed to my room?',
      a: 'Yes. An extra bed is available on request in both the Deluxe and Super Deluxe rooms, which suits families travelling with a child. Mention it when you send your booking request on WhatsApp or by phone, and the hotel will share the extra-bed charge when it confirms your stay.',
    },
    {
      q: 'Do room prices include taxes?',
      a: 'No. The rates shown, ₹2,000 a night for the Deluxe Room and ₹2,200 a night for the Super Deluxe Room, are before taxes. TapMenu Grand Resort & Spa adds taxes, and any extra bed, when it replies to confirm availability, so you see the final price before your stay is confirmed.',
    },
    {
      q: 'Can I order food to my room?',
      a: 'Yes. Room service brings meals and requests to your door. The ground-floor restaurant cooks North Indian classics, tandoor breads and fast food for breakfast, lunch and dinner, and dinner can be served in the restaurant or in your room. Ask at reception or on WhatsApp for the day’s menu.',
    },
  ],
  '/dining': [
    {
      q: 'What food does the restaurant serve?',
      a: 'The restaurant at TapMenu Grand Resort & Spa is pure vegetarian. The menu covers hot and cold beverages, soups, salads and chaat, starters, sandwiches and continental plates, North Indian, Rajasthani and Chinese mains, rice and noodles, tandoor breads, South Indian dishes and desserts.',
    },
    {
      q: 'Is vegetarian food available?',
      a: 'Yes, every dish is vegetarian. The restaurant is pure veg, so there is no meat, fish or egg on the menu. Starters, paneer and dal mains, rice, noodles, breads, South Indian dishes and desserts are all cooked in a vegetarian kitchen.',
    },
    {
      q: 'Does the restaurant serve breakfast?',
      a: 'Yes. Breakfast is served every morning for staying guests and visitors, with hot and cold beverages, sandwiches, South Indian dishes such as dosa and idli, and other vegetarian dishes from the menu, for staying guests and visitors alike. Ask at reception or on WhatsApp for breakfast timings.',
    },
    {
      q: 'Are menu prices shown online?',
      a: 'Yes. Prices in rupees are listed beside each dish on this page. Some dishes may be unavailable on a given day, so call or WhatsApp TapMenu Grand Resort & Spa on +91 98765 43210 or +91 98765 43211 to check, or to plan catering for a wedding, engagement or corporate dinner.',
    },
  ],
  '/weddings-events': [
    {
      q: 'Which venue suits my event, the banquet hall or the lawn?',
      a: 'Choose the indoor banquet hall for around 120 guests: it suits engagements, birthdays, anniversaries, retirement parties and corporate dinners. Haldi, mehndi and sangeet work in either space. Choose the outdoor function lawn for 1,500 to 2,000 guests, with room for a baraat, mandap, stage and dining.',
    },
    {
      q: 'Can wedding guests stay at the hotel?',
      a: 'Yes. The Wedding stay package combines the venue and catering with rooms for family and guests, plus room service through the celebrations. TapMenu Grand Resort & Spa has Deluxe Rooms at ₹2,000 a night and Super Deluxe Rooms at ₹2,200 a night, each for up to 2 adults. Plan it with the hotel on WhatsApp or a call.',
    },
    {
      q: 'How much does a wedding or event cost?',
      a: 'Package pricing is shared on enquiry, because it depends on your date, venue, guest count and menu. Send the enquiry form on this page or WhatsApp +91 98765 43210 or +91 98765 43211 with those details, and TapMenu Grand Resort & Spa will reply with a price for the venue, catering and any rooms you need.',
    },
    {
      q: 'Is there parking and power backup for events?',
      a: 'Yes. The Venue and catering package includes power backup and parking, so the lights and air conditioning keep running through your function. Guests park on site in the front forecourt of TapMenu Grand Resort & Spa at 100 Hospitality Boulevard beside the entrance steps.',
    },
  ],
  '/about': [
    {
      q: 'What facilities does Hotel Dream Heaven’s have?',
      a: 'TapMenu Grand Resort & Spa has a ground-floor restaurant, an indoor banquet hall for around 120 guests, an outdoor function lawn for 1,500 to 2,000 guests, on-site parking, a lift, room service, laundry, power backup, CCTV in common areas and wheelchair access. A swimming pool and EV charging are planned but not open yet.',
    },
    {
      q: 'Is the hotel suitable for families?',
      a: 'Yes. Families and children are welcome, and an extra bed is available on request. Common areas are monitored by CCTV, a lift serves the guest floors, power backup keeps the lights and AC on, and the restaurant serves familiar fast food for younger guests alongside North Indian dishes.',
    },
  ],
}

/** The FAQs shown (and marked up) on a page: the full list on /contact, the topic list elsewhere. */
export function faqsFor(path: string): readonly Faq[] {
  if (path === '/contact') return faqs
  return pageFaqs[path as keyof typeof pageFaqs] ?? []
}
