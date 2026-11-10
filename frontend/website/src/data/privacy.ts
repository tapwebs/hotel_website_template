// Privacy policy copy. Contact details come from hotel.ts only. Update `privacyUpdated` with every change.
import { hotel } from './hotel'
export const privacyUpdated = { iso: '2026-10-15', label: 'October 15, 2026' }
export const googlePrivacyUrl = 'https://policies.google.com/privacy'
const brand = 'TapMenu Grand Resort & Spa'
export interface PrivacySection {
  id: string
  title: string
  paragraphs: string[]
}
export const privacySections: PrivacySection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    paragraphs: [
      `${brand} is a hotel at ${hotel.address.street}, ${hotel.address.city}, ${hotel.address.region}, ${hotel.address.country}. For the personal data described in this policy, we are the “Data Fiduciary” under India’s Digital Personal Data Protection Act, 2023 (DPDP Act). This policy covers this website, ${hotel.domain}, and the enquiries you send through it.`,
    ],
  },
  {
    id: 'what-we-collect',
    title: 'What we collect and why',
    paragraphs: [
      'On this website: this website has no database or server of its own that stores what you type. The booking, event and contact forms ask for details such as your name, mobile number, stay or event dates, room or venue choice, and any message you add. We use them only to build a WhatsApp message or an email that you then choose to send to us.',
      'Nothing is sent to us until you press send in WhatsApp or your email app. If you do not send it, we never receive it.',
      'When you message or call us: we receive what you send, such as your name, phone number or WhatsApp number, email address and the contents of your message. We use it to check availability, quote a price, reply to you and manage your booking.',
      'Log in and sign up pages: these pages are visible but online accounts are not active. Today they send nothing anywhere. When accounts launch, the name, email, mobile number and password you enter will go to our own booking system, and we will update this policy before launch.',
      'Server logs: our web host may automatically record technical data such as your IP address, browser type and the pages requested, to keep the site running and secure.',
    ],
  },
  {
    id: 'check-in-records',
    title: 'Guest records at check-in',
    paragraphs: [
      'When you stay with us, we collect identity and registration details at the property, at check-in, on paper or in our own records. These can include your name, address, nationality, a photo identity document, purpose of visit and, for foreign guests, passport and visa details.',
      'We do not collect identity documents through this website. Indian law requires hotels to keep guest registration records (for example the Form C record for foreign guests), and we may have to share them with authorities when the law requires. We keep them for the period the law requires.',
    ],
  },
  {
    id: 'consent-and-rights',
    title: 'Your consent and legal basis',
    paragraphs: [
      'We process your details based on your consent, which you give by choosing to send us a message, call us, or tick a consent box, and for legitimate uses the DPDP Act allows, such as handling a request you made, meeting legal duties, and the records every hotel must keep.',
      'We ask only for what we need for the purpose you gave it for, and we do not use it for anything unrelated. You can withdraw your consent at any time by emailing us. Withdrawing does not undo what we did before, and we may still have to keep some records the law requires.',
    ],
  },
  {
    id: 'how-we-use',
    title: 'How we use your details',
    paragraphs: [
      'We use your details to answer enquiries, confirm bookings, run your stay and meet legal duties. We do not sell your details. We do not use them for advertising.',
    ],
  },
  {
    id: 'third-parties',
    title: 'Third parties',
    paragraphs: [
      'WhatsApp (Meta): the booking and enquiry forms open WhatsApp with your message ready. Once you send it, WhatsApp and Meta handle it under their own terms and privacy policy. Email and phone calls go through your own email provider and phone network in the same way.',
      'Google Maps: the Contact page can show a Google map. It stays off until you press “Load map”. Only then does your browser contact Google, which may set cookies and collect data such as your IP address under its own policy. The “Open in Google Maps” link also takes you to a Google page.',
      'Hostinger: our website is hosted with Hostinger, which may keep server logs such as IP address and browser details.',
      'The site footer links to the website’s developer and our Instagram page. These are ordinary links. Nothing is shared with them unless you click, and then their own policies apply.',
      'Google’s own privacy policy explains what it collects and why.',
    ],
  },
  {
    id: 'cookies-fonts',
    title: 'Cookies, fonts and analytics',
    paragraphs: [
      'We do not set any cookies and we do not store anything about you in your browser (no local storage or session storage). Our fonts are hosted on this website, so no font provider receives your visit.',
      'We do not use analytics or advertising trackers, and there are no tracking pixels on this site. If that ever changes, we will update this page first. The only cookies you may meet are those Google may set if you choose to load the map.',
    ],
  },
  {
    id: 'international-transfers',
    title: 'Transfers outside India',
    paragraphs: [
      'WhatsApp, Google and our hosting provider run services around the world, so data you share through them may be processed outside India. We do not choose to send your details abroad ourselves.',
    ],
  },
  {
    id: 'security',
    title: 'How we protect it',
    paragraphs: [
      'This website is served over HTTPS. We keep guest records at the property and limit access to staff who need them. No system is completely secure, and we cannot guarantee that messages sent through WhatsApp, email or the internet will never be intercepted. We do not currently hold any online guest database.',
    ],
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    paragraphs: [
      'This website does not store your form entries. For enquiries and booking messages we hold, we keep them as long as needed to reply and run your stay, and for any longer period the law requires, such as guest registration records. After that we delete them or remove what identifies you.',
    ],
  },
  {
    id: 'children',
    title: 'Children',
    paragraphs: [
      'This website is meant for adults who book stays and events. We do not knowingly collect details from children through it. A child’s details at check-in are given by their parent or guardian as part of the family’s registration. If a child has sent us details online, email us and we will delete them.',
    ],
  },
  {
    id: 'your-rights',
    title: 'Your rights and grievances',
    paragraphs: [
      `Under the DPDP Act you can ask for a summary of the details we hold about you, ask us to correct or complete them, ask us to erase them (unless the law requires us to keep them), withdraw consent, and name someone to act for you if you cannot. Email ${hotel.email} from the address or number you used, and we will reply to confirm what we did.`,
      'If you have a complaint about how we handled your data, write to our grievance contact at the same address. We will acknowledge and respond as quickly as we can. If you are not satisfied, you may complain to the Data Protection Board of India once it is in operation.',
    ],
  },
  {
    id: 'future-accounts',
    title: 'Accounts and online booking',
    paragraphs: [
      'We plan to add online accounts and a booking system. They are not live, and this policy does not describe their data handling yet. We will update this policy, and ask for consent where needed, before they launch.',
    ],
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    paragraphs: [
      'When we change this policy, we post the new version on this page and update the “Last updated” date. If a change affects how we use your details in a significant way, we will tell you before it applies.',
    ],
  },
  {
    id: 'contact',
    title: 'Contact us',
    paragraphs: [
      `${brand}, ${hotel.address.street}, ${hotel.address.landmark.toLowerCase()}, ${hotel.address.city}, ${hotel.address.region}, ${hotel.address.country}.`,
    ],
  },
]
