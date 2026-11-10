import type React from 'react';
import {
  Building2,
  Globe2,
  Palette,
  Clock,
  CalendarCheck,
  BedDouble,
  Receipt,
  FileText,
  CreditCard,
  Moon,
  Share2,
  MessageSquare,
  Shield,
  Plug,
  Network,
} from 'lucide-react';
import type { HMSSettingsData, SettingsCategoryId } from '../../../types/settings';

export interface SettingsSectionDef {
  id: string;
  title: string;
  /** Field labels and synonyms, used by the settings search. */
  keywords: string;
}

export interface SettingsCategoryDef {
  id: SettingsCategoryId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  /** Settings data keys edited on this page; drives the unsaved-changes marker. */
  dataKeys: (keyof HMSSettingsData)[];
  sections: SettingsSectionDef[];
  restricted?: boolean;
}

export const SETTINGS_CATEGORIES: SettingsCategoryDef[] = [
  {
    id: 'property',
    group: 'Property',
    label: 'Property profile',
    description: 'Hotel name, contact details and legal registration.',
    icon: Building2,
    dataKeys: ['propertyIdentity', 'contact', 'legalRegistration'],
    sections: [
      { id: 'identity', title: 'Hotel identity', keywords: 'property name legal entity code hotel type star rating status' },
      { id: 'contact', title: 'Contact details', keywords: 'phone email whatsapp website' },
      { id: 'legal', title: 'Legal & tax registration', keywords: 'gstin pan sarai act fssai fire safety noc licence' },
      { id: 'address', title: 'Registered address', keywords: 'address city state code pin country' },
    ],
  },
  {
    id: 'localization',
    group: 'Property',
    label: 'Region & language',
    description: 'Currency, time zone, date formats and guest languages.',
    icon: Globe2,
    dataKeys: ['localization'],
    sections: [
      { id: 'region', title: 'Currency & time zone', keywords: 'currency inr timezone time zone' },
      { id: 'formats', title: 'Date & time formats', keywords: 'date format clock 12 24 hour first day of week calendar' },
      { id: 'languages', title: 'Languages', keywords: 'language primary secondary hindi english' },
    ],
  },
  {
    id: 'branding',
    group: 'Property',
    label: 'Branding',
    description: 'Brand colours and logos used on invoices, emails and the booking engine.',
    icon: Palette,
    dataKeys: ['branding'],
    sections: [
      { id: 'colors', title: 'Brand colours', keywords: 'primary secondary colour color theme' },
      { id: 'logos', title: 'Logos', keywords: 'logo invoice email header favicon booking engine' },
    ],
  },
  {
    id: 'stay',
    group: 'Front office',
    label: 'Check-in & stay',
    description: 'Check-in times, early and late fees, guest policies and front desk rules.',
    icon: Clock,
    dataKeys: ['stayTimes', 'guestPolicies', 'stayPolicies'],
    sections: [
      { id: 'times', title: 'Check-in & check-out times', keywords: 'check in check out time early late grace fee' },
      { id: 'guest-policies', title: 'Guest policies', keywords: 'minimum age child free id proof form c foreign national extra bed smoking pets' },
      { id: 'front-desk', title: 'Front desk rules', keywords: 'walk in same day booking cutoff room move' },
    ],
  },
  {
    id: 'reservations',
    group: 'Front office',
    label: 'Reservations',
    description: 'Booking defaults, cancellations, stay limits, overbooking and booking sources.',
    icon: CalendarCheck,
    dataKeys: ['reservationPolicies', 'stayPolicies', 'overbooking', 'inventoryRules', 'bookingSources'],
    sections: [
      { id: 'defaults', title: 'Booking defaults', keywords: 'default status rate plan booking source' },
      { id: 'cancellation', title: 'Cancellation & no-show', keywords: 'cancellation policy no show penalty same day modification cutoff' },
      { id: 'restrictions', title: 'Stay limits & holds', keywords: 'minimum maximum length of stay nights advance booking window hold release' },
      { id: 'overbooking', title: 'Overbooking', keywords: 'overbooking capacity threshold' },
      { id: 'inventory', title: 'Inventory', keywords: 'inventory pool allotment availability formula release rooms left' },
      { id: 'sources', title: 'Booking sources', keywords: 'booking source commission ota walk in corporate' },
    ],
  },
  {
    id: 'housekeeping',
    group: 'Rooms',
    label: 'Rooms & housekeeping',
    description: 'Room status rules, out-of-order handling, cleaning tasks and maintenance.',
    icon: BedDouble,
    dataKeys: ['roomStatusPolicy', 'roomOutage', 'housekeepingAutomation', 'maintenanceAutomation'],
    sections: [
      { id: 'room-status', title: 'Room status & inspection', keywords: 'inspection dirty clean ready assign before inspection supervisor override' },
      { id: 'outage', title: 'Out of service & out of order', keywords: 'oos ooo out of order out of service reason sellable' },
      { id: 'tasks', title: 'Housekeeping tasks', keywords: 'departure stayover inspection task photo linen change' },
      { id: 'maintenance', title: 'Maintenance', keywords: 'maintenance ticket work order resolution photo return room' },
    ],
  },
  {
    id: 'rates-taxes',
    group: 'Finance',
    label: 'Rates & taxes',
    description: 'Pricing rules and GST rates for every service.',
    icon: Receipt,
    dataKeys: ['rateEngine', 'taxRules'],
    sections: [
      { id: 'pricing', title: 'Pricing rules', keywords: 'tax inclusive base rate bar override minimum maximum rate floor ceiling' },
      { id: 'gst', title: 'GST rates', keywords: 'gst cgst sgst igst sac hsn tax rule slab' },
    ],
  },
  {
    id: 'billing',
    group: 'Finance',
    label: 'Folios & invoices',
    description: 'Folio rules, discounts, and invoice numbering and layout.',
    icon: FileText,
    dataKeys: ['folio', 'invoice'],
    sections: [
      { id: 'folio', title: 'Folio rules', keywords: 'folio split discount allowance negative balance checkout' },
      { id: 'numbering', title: 'Invoice numbering', keywords: 'invoice prefix number format sequence credit note receipt' },
      { id: 'layout', title: 'Invoice layout', keywords: 'footer legal text gstin sac breakdown guest address round off' },
    ],
  },
  {
    id: 'payments',
    group: 'Finance',
    label: 'Payments',
    description: 'Payment gateways, accepted payment methods, deposits and refunds.',
    icon: CreditCard,
    dataKeys: ['paymentGateways', 'paymentMethods', 'depositPolicy', 'refundPolicy'],
    sections: [
      { id: 'gateways', title: 'Payment gateways', keywords: 'razorpay pine labs gateway edc card machine test production' },
      { id: 'methods', title: 'Payment methods', keywords: 'cash upi card bank transfer btc settlement account reference refundable' },
      { id: 'deposits', title: 'Advance deposits', keywords: 'deposit advance guarantee percentage waiver' },
      { id: 'refunds', title: 'Refunds', keywords: 'refund limit approval reason' },
    ],
  },
  {
    id: 'night-audit',
    group: 'Finance',
    label: 'Night audit',
    description: 'Business date, audit schedule and the checks that must pass before the day closes.',
    icon: Moon,
    dataKeys: ['nightAudit'],
    sections: [
      { id: 'business-date', title: 'Business date', keywords: 'business date last audit' },
      { id: 'schedule', title: 'Audit schedule', keywords: 'auto start cutoff time advance date post room charges no show' },
      { id: 'safeguards', title: 'Checks before closing the day', keywords: 'cash reconciliation unposted charges settlement batch discrepancy' },
    ],
  },
  {
    id: 'distribution',
    group: 'Guests & sales',
    label: 'Booking engine & OTAs',
    description: 'Direct website bookings and OTA channel connections.',
    icon: Share2,
    dataKeys: ['directBookingEngine', 'channels'],
    sections: [
      { id: 'booking-engine', title: 'Direct booking engine', keywords: 'booking engine website direct guest modification cancellation instant confirmation advance payment cart hold' },
      { id: 'channels', title: 'OTA channels', keywords: 'ota channel manager booking.com makemytrip agoda expedia sync' },
    ],
  },
  {
    id: 'communications',
    group: 'Guests & sales',
    label: 'Guest messaging',
    description: 'Email, SMS and WhatsApp providers, automatic messages and templates.',
    icon: MessageSquare,
    dataKeys: ['communicationProviders', 'eventTriggers', 'messageTemplates'],
    sections: [
      { id: 'providers', title: 'Messaging providers', keywords: 'email smtp sms whatsapp provider quota' },
      { id: 'triggers', title: 'Automatic messages', keywords: 'notification trigger confirmation pre arrival invoice receipt' },
      { id: 'templates', title: 'Message templates', keywords: 'template merge tag wording' },
    ],
  },
  {
    id: 'security',
    group: 'System',
    label: 'Security & approvals',
    description: 'Staff sign-in rules, manager approvals, audit logging and guest data privacy.',
    icon: Shield,
    dataKeys: ['authPolicy', 'approvalPolicies', 'auditLogging', 'dataPrivacy'],
    sections: [
      { id: 'sign-in', title: 'Sign-in & passwords', keywords: 'session timeout mfa two factor password length expiry lockout failed attempts concurrent' },
      { id: 'approvals', title: 'Manager approvals', keywords: 'approval manager pin rate override discount void refund upgrade out of order waiver adjustment permission' },
      { id: 'audit-log', title: 'Audit logging', keywords: 'audit log ip address tracked actions' },
      { id: 'privacy', title: 'Guest data privacy', keywords: 'privacy dpdp retention mask id document marketing consent' },
    ],
  },
  {
    id: 'integrations',
    group: 'System',
    label: 'Integrations',
    description: 'Website API, restaurant POS link and outbound webhooks.',
    icon: Plug,
    dataKeys: ['websiteApi', 'externalFnb', 'webhooks'],
    sections: [
      { id: 'website-api', title: 'Website API', keywords: 'api endpoint rate limit cors origins key' },
      { id: 'fnb', title: 'Restaurant POS', keywords: 'f&b restaurant pos analytics reconciliation' },
      { id: 'webhooks', title: 'Webhooks', keywords: 'webhook endpoint event hmac' },
    ],
  },
  {
    id: 'organization',
    group: 'System',
    label: 'Organization',
    description: 'Properties in your group and the defaults they inherit.',
    icon: Network,
    dataKeys: ['managedProperties', 'organizationDefaults'],
    restricted: true,
    sections: [
      { id: 'properties', title: 'Properties', keywords: 'properties portfolio onboard new property' },
      { id: 'org-defaults', title: 'Group defaults', keywords: 'organization group currency timezone override shared rate plans dashboard' },
    ],
  },
];

/** Organization settings are limited to administrators and general managers. */
export const canManageOrganization = (role?: string) => role === 'ROLE_SUPER_ADMIN' || role === 'ROLE_GENERAL_MANAGER';

export const DEFAULT_CATEGORY: SettingsCategoryId = 'property';

export const findCategory = (id: string | null | undefined) =>
  SETTINGS_CATEGORIES.find((c) => c.id === id);

/** DOM id for a section anchor, shared by the page (scroll target) and the section cards. */
export const sectionAnchor = (categoryId: string, sectionId: string) => `settings-${categoryId}-${sectionId}`;

export interface SettingsSearchHit {
  category: SettingsCategoryDef;
  section: SettingsSectionDef;
}

/**
 * Every query word must start a word in the category label, section title or keywords.
 * Results where the whole query appears as a phrase, or in the section title, rank first.
 */
export function searchSettings(query: string, categories = SETTINGS_CATEGORIES): SettingsSearchHit[] {
  const q = query.toLowerCase().replace(/[^a-z0-9&.]+/g, ' ').trim();
  const words = q.split(' ').filter(Boolean);
  if (!words.length) return [];
  const scored: (SettingsSearchHit & { score: number })[] = [];
  for (const category of categories) {
    for (const section of category.sections) {
      const hay = ` ${category.label} ${section.title} ${section.keywords}`.toLowerCase().replace(/[^a-z0-9&.]+/g, ' ');
      if (!words.every((w) => hay.includes(` ${w}`))) continue;
      const score = (hay.includes(` ${q} `) || hay.endsWith(` ${q}`) ? 2 : 0) + (section.title.toLowerCase().includes(q) ? 1 : 0);
      scored.push({ category, section, score });
    }
  }
  return scored.sort((a, b) => b.score - a.score).map(({ category, section }) => ({ category, section }));
}

/** Categories whose data differs from the last saved copy. */
export function dirtyCategoryIds(data: HMSSettingsData, saved: HMSSettingsData): Set<SettingsCategoryId> {
  const out = new Set<SettingsCategoryId>();
  for (const c of SETTINGS_CATEGORIES) {
    if (c.dataKeys.some((k) => JSON.stringify(data[k]) !== JSON.stringify(saved[k]))) out.add(c.id);
  }
  return out;
}
