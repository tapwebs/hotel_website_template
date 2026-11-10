import type { HMSSettingsData, SettingsCategoryId } from '../../../types/settings';

export interface SettingsIssue {
  /** Dotted path of the field, e.g. "legalRegistration.gstin". Fields look themselves up by this key. */
  field: string;
  category: SettingsCategoryId;
  message: string;
}

// Same pattern the backend enforces in settings_service.py.
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
const PIN_RE = /^\d{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Blocking problems in the settings. Optional fields are only checked when filled in. */
export function validateSettings(d: HMSSettingsData): SettingsIssue[] {
  const issues: SettingsIssue[] = [];
  const add = (field: string, category: SettingsCategoryId, message: string) => issues.push({ field, category, message });

  if (!d.propertyIdentity.propertyName.trim()) add('propertyIdentity.propertyName', 'property', 'Property name is required.');
  const gstin = d.legalRegistration.gstin.trim().toUpperCase();
  if (gstin && !GSTIN_RE.test(gstin)) add('legalRegistration.gstin', 'property', 'GSTIN must be 15 characters, e.g. 08ABCDE1234F1Z5.');
  if (gstin && d.legalRegistration.stateCode && gstin.slice(0, 2) !== d.legalRegistration.stateCode.padStart(2, '0'))
    add('legalRegistration.gstin', 'property', `GSTIN starts with ${gstin.slice(0, 2)} but the state code is ${d.legalRegistration.stateCode}.`);
  const pan = d.legalRegistration.pan.trim().toUpperCase();
  if (pan && !PAN_RE.test(pan)) add('legalRegistration.pan', 'property', 'PAN must be 10 characters, e.g. ABCDE1234F.');
  if (d.legalRegistration.pinCode && !PIN_RE.test(d.legalRegistration.pinCode.trim())) add('legalRegistration.pinCode', 'property', 'PIN code must be 6 digits.');
  if (d.contact.email && !EMAIL_RE.test(d.contact.email.trim())) add('contact.email', 'property', 'Enter a valid email address.');

  for (const [key, label] of [['primaryBrandColor', 'Primary colour'], ['secondaryBrandColor', 'Secondary colour']] as const)
    if (!HEX_RE.test(d.branding[key])) add(`branding.${key}`, 'branding', `${label} must be a hex colour like #7A1F2B.`);

  if (d.rateEngine.minAllowedRateINR > d.rateEngine.maxAllowedRateINR)
    add('rateEngine.maxAllowedRateINR', 'rates-taxes', 'Maximum rate must be at least the minimum rate.');

  if (d.folio.discountRequiresApprovalAbovePercent > d.folio.maxFrontDeskDiscountPercent)
    add('folio.discountRequiresApprovalAbovePercent', 'billing', 'Approval threshold cannot exceed the maximum front desk discount.');
  if (!d.invoice.invoicePrefix.trim()) add('invoice.invoicePrefix', 'billing', 'Invoice prefix is required.');

  const r = d.reservationPolicies;
  if (r.minLengthOfStayNights < 1) add('reservationPolicies.minLengthOfStayNights', 'reservations', 'Minimum stay must be at least 1 night.');
  if (r.maxLengthOfStayNights < r.minLengthOfStayNights)
    add('reservationPolicies.maxLengthOfStayNights', 'reservations', 'Maximum stay must be at least the minimum stay.');

  if (d.depositPolicy.defaultDepositPercentage < 0 || d.depositPolicy.defaultDepositPercentage > 100)
    add('depositPolicy.defaultDepositPercentage', 'payments', 'Deposit must be between 0 and 100%.');

  if (d.authPolicy.passwordMinLength < 8) add('authPolicy.passwordMinLength', 'security', 'Passwords must be at least 8 characters.');
  if (d.authPolicy.sessionTimeoutMinutes < 5) add('authPolicy.sessionTimeoutMinutes', 'security', 'Session timeout must be at least 5 minutes.');

  return issues;
}
