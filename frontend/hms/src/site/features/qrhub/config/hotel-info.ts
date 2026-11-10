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
  website: 'https://example.com',
  menuUrl: 'https://example.com/dining',
  tapwebsUrl: 'https://example.com',
  phoneDisplay: '+91 00000 00000',
  phoneE164: '+910000000000',
  whatsappDigits: '910000000000',
  phoneDisplaySecondary: '+91 00000 00001',
  phoneE164Secondary: '+910000000001',
  whatsappDigitsSecondary: '910000000001',

  /** TODO(owner): check-in time was not provided. Empty hides the row. Check-out was given as 11 AM. */
  checkIn: { en: '', hi: '' } as Bi,
  checkOut: { en: '11 AM', hi: 'सुबह 11 बजे' } as Bi,

  receptionHours: { en: '24x7', hi: '24x7' } as Bi,
  servicesHours: { en: '24x7', hi: '24x7' } as Bi,
  restaurantHours: { en: '10 AM – 10 PM', hi: 'सुबह 10 – रात 10 बजे' } as Bi,

  address: {
    en: '100 Hospitality Boulevard, Metropolis, Country',
    hi: '100 हॉस्पिटैलिटी बुलेवार्ड, मेट्रोपोलिस',
  } as Bi,
  landmark: { en: 'City Center', hi: 'सिटी सेंटर' } as Bi,

  /** TODO(owner): parking details were not provided. Empty hides the row. */
  parking: { en: '', hi: '' } as Bi,

  /** TODO(owner): no separate emergency number was given; falls back to the main phone. */
  emergencyPhone: '',

  /** TODO(owner): Google review URL. The API's review_url wins when set; empty hides the link. */
  reviewUrl: '',
}

export const WIFI = {
  WIFI_NAME: 'TapMenu-Guest-WiFi',
  WIFI_PASS: 'TapMenu@Guest2026',
}
