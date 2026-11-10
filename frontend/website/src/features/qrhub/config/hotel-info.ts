/** English + Hindi text for one config value. */
export interface Bi {
  en: string
  hi: string
}

/**
 * Single place to edit static hotel details shown on the QR hub.
 * Empty strings hide the matching row/link. Name, tagline, social links and Explore links still come from the API.
 */
export const HOTEL = {
  website: 'https://hoteldreamheavens.in',
  menuUrl: 'https://hoteldreamheavens.in/dining',
  tapwebsUrl: 'https://tapwebs.in',
  phoneDisplay: '+91 87399 82231',
  phoneE164: '+918739982231',
  whatsappDigits: '918739982231',
  phoneDisplaySecondary: '+91 88752 06571',
  phoneE164Secondary: '+918875206571',
  whatsappDigitsSecondary: '918875206571',

  /** TODO(owner): check-in time was not provided. Empty hides the row. Check-out was given as 11 AM. */
  checkIn: { en: '', hi: '' } as Bi,
  checkOut: { en: '11 AM', hi: 'सुबह 11 बजे' } as Bi,

  receptionHours: { en: '24x7', hi: '24x7' } as Bi,
  servicesHours: { en: '24x7', hi: '24x7' } as Bi,
  restaurantHours: { en: '10 AM – 10 PM', hi: 'सुबह 10 – रात 10 बजे' } as Bi,

  address: {
    en: 'Agra Road, Bassi, Opposite Bharat Petroleum, Jaipur, Rajasthan, India',
    hi: 'आगरा रोड, बस्सी, भारत पेट्रोलियम के सामने, जयपुर, राजस्थान, भारत',
  } as Bi,
  landmark: { en: 'Opp. Bharat Petroleum', hi: 'भारत पेट्रोलियम के सामने' } as Bi,

  /** TODO(owner): parking details were not provided. Empty hides the row. */
  parking: { en: '', hi: '' } as Bi,

  /** TODO(owner): no separate emergency number was given; falls back to the main phone. */
  emergencyPhone: '',

  /** TODO(owner): Google review URL. The API's review_url wins when set; empty hides the link. */
  reviewUrl: '',
}

export const WIFI = {
  WIFI_NAME: "hotel dream heaven's",
  WIFI_PASS: 'Heavens@Hotel',
}
