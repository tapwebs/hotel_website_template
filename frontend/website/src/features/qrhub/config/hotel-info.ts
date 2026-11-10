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
  website: 'http://localhost:5173',
  menuUrl: 'http://localhost:5173/dining',
  tapwebsUrl: 'https://example.com',
  phoneDisplay: '+91 00000 00000',
  phoneE164: '+910000000000',
  whatsappDigits: '910000000000',
  phoneDisplaySecondary: '+91 00000 00001',
  phoneE164Secondary: '+910000000001',
  whatsappDigitsSecondary: '910000000001',

  checkIn: { en: '11 AM', hi: 'सुबह 11 बजे' } as Bi,
  checkOut: { en: '11 AM', hi: 'सुबह 11 बजे' } as Bi,

  receptionHours: { en: '24x7', hi: '24x7' } as Bi,
  servicesHours: { en: '24x7', hi: '24x7' } as Bi,
  restaurantHours: { en: '10 AM – 10 PM', hi: 'सुबह 10 – रात 10 बजे' } as Bi,

  address: {
    en: '100 Hospitality Boulevard, Metropolis, Metro State, India',
    hi: '100 हॉस्पिटैलिटी बुलेवार्ड, मेट्रोपोलिस, मेट्रो स्टेट, भारत',
  } as Bi,
  landmark: { en: 'Grand Central Plaza', hi: 'ग्रैंड सेंट्रल प्लाजा' } as Bi,

  parking: { en: 'On-site forecourt parking', hi: 'ऑन-साइट पार्किंग' } as Bi,

  emergencyPhone: '+910000000000',

  reviewUrl: '',
}

export const WIFI = {
  WIFI_NAME: 'TapMenu_Guest_WiFi',
  WIFI_PASS: 'Welcome@1234',
}
