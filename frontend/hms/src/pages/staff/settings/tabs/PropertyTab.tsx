import React from 'react';
import { Field, FieldGrid, Note, SelectInput, SettingsSection, TextInput, useSettingsSection } from '../components/ui';

const C = 'property';

const HOTEL_TYPES = [
  { value: 'HERITAGE_LUXURY', label: 'Heritage palace / haveli' },
  { value: 'BOUTIQUE', label: 'Boutique hotel' },
  { value: 'RESORT', label: 'Resort' },
  { value: 'BUSINESS', label: 'Business & conference hotel' },
  { value: 'BED_AND_BREAKFAST', label: 'Bed & breakfast / homestay' },
];
const STARS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}-star` }));
const STATUSES = [
  { value: 'ACTIVE', label: 'Active — open for bookings' },
  { value: 'SEASONAL_PAUSE', label: 'Seasonal pause' },
  { value: 'MAINTENANCE_HOLD', label: 'Maintenance hold' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export const PropertyTab: React.FC = () => {
  const [identity, setIdentity] = useSettingsSection('propertyIdentity');
  const [contact, setContact] = useSettingsSection('contact');
  const [legal, setLegal] = useSettingsSection('legalRegistration');

  return (
    <div className="space-y-6">
      <SettingsSection categoryId={C} id="identity" title="Hotel identity" description="How the hotel is named and classified across the system.">
        <FieldGrid>
          <Field label="Property name" required issue="propertyIdentity.propertyName">
            {(p) => <TextInput {...p} value={identity.propertyName} onChange={(v) => setIdentity({ propertyName: v })} />}
          </Field>
          <Field label="Legal entity name" hint="Printed on tax invoices.">
            {(p) => <TextInput {...p} value={identity.legalEntityName} onChange={(v) => setIdentity({ legalEntityName: v })} />}
          </Field>
          <Field label="Property code" hint="Fixed system ID. Contact support to change it.">
            {(p) => <TextInput {...p} value={identity.propertyCode} mono readOnly />}
          </Field>
          <Field label="Hotel type">
            {(p) => (
              <SelectInput {...p} value={identity.hotelType} options={HOTEL_TYPES} onChange={(v) => setIdentity({ hotelType: v as typeof identity.hotelType })} />
            )}
          </Field>
          <Field label="Star rating">
            {(p) => (
              <SelectInput {...p} value={String(identity.starClassification)} options={STARS} onChange={(v) => setIdentity({ starClassification: Number(v) })} />
            )}
          </Field>
          <Field label="Operating status">
            {(p) => (
              <SelectInput {...p} value={identity.propertyStatus} options={STATUSES} onChange={(v) => setIdentity({ propertyStatus: v as typeof identity.propertyStatus })} />
            )}
          </Field>
        </FieldGrid>
      </SettingsSection>

      <SettingsSection categoryId={C} id="contact" title="Contact details" description="Shown to guests on confirmations, invoices and messages.">
        <FieldGrid cols={2}>
          <Field label="Front desk phone">
            {(p) => <TextInput {...p} type="tel" autoComplete="tel" value={contact.phone} onChange={(v) => setContact({ phone: v })} placeholder="+91 98765 43210" />}
          </Field>
          <Field label="Email" issue="contact.email">
            {(p) => <TextInput {...p} type="email" autoComplete="email" value={contact.email} onChange={(v) => setContact({ email: v.trim() })} placeholder="reservations@hotel.in" />}
          </Field>
          <Field label="WhatsApp number" hint="Country code and number, digits only.">
            {(p) => <TextInput {...p} inputMode="numeric" value={contact.whatsappNumber} onChange={(v) => setContact({ whatsappNumber: v.replace(/\D/g, '') })} mono placeholder="919876543210" />}
          </Field>
          <Field label="Website">
            {(p) => <TextInput {...p} type="url" value={contact.website} onChange={(v) => setContact({ website: v.trim() })} placeholder="https://" />}
          </Field>
        </FieldGrid>
      </SettingsSection>

      <SettingsSection categoryId={C} id="legal" title="Legal & tax registration" description="Statutory numbers printed on invoices and used for GST returns.">
        <FieldGrid>
          <Field label="GSTIN" issue="legalRegistration.gstin" hint="15 characters. The first two digits are your state code.">
            {(p) => <TextInput {...p} value={legal.gstin} onChange={(v) => setLegal({ gstin: v.trim() })} mono uppercase maxLength={15} placeholder="08ABCDE1234F1Z5" />}
          </Field>
          <Field label="PAN" issue="legalRegistration.pan">
            {(p) => <TextInput {...p} value={legal.pan} onChange={(v) => setLegal({ pan: v.trim() })} mono uppercase maxLength={10} placeholder="ABCDE1234F" />}
          </Field>
          <Field label="Sarai Act registration">
            {(p) => <TextInput {...p} value={legal.saraiActRegistration} onChange={(v) => setLegal({ saraiActRegistration: v })} mono />}
          </Field>
          <Field label="FSSAI licence number" hint="Required if you serve food.">
            {(p) => <TextInput {...p} value={legal.fssaiNumber} onChange={(v) => setLegal({ fssaiNumber: v.replace(/\D/g, '') })} mono maxLength={14} />}
          </Field>
          <Field label="Fire safety NOC number">
            {(p) => <TextInput {...p} value={legal.fireSafetyLicenseNo} onChange={(v) => setLegal({ fireSafetyLicenseNo: v })} mono />}
          </Field>
        </FieldGrid>
      </SettingsSection>

      <SettingsSection categoryId={C} id="address" title="Registered address" description="The address on your GST registration. Printed on invoices.">
        <FieldGrid>
          <Field label="Street address" span={3}>
            {(p) => <TextInput {...p} autoComplete="street-address" value={legal.registeredAddress} onChange={(v) => setLegal({ registeredAddress: v })} />}
          </Field>
          <Field label="City">
            {(p) => <TextInput {...p} autoComplete="address-level2" value={legal.city} onChange={(v) => setLegal({ city: v })} />}
          </Field>
          <Field label="State">
            {(p) => <TextInput {...p} autoComplete="address-level1" value={legal.state} onChange={(v) => setLegal({ state: v })} />}
          </Field>
          <Field label="GST state code" hint="Two digits, e.g. 08 for Rajasthan.">
            {(p) => <TextInput {...p} inputMode="numeric" maxLength={2} value={legal.stateCode} onChange={(v) => setLegal({ stateCode: v.replace(/\D/g, '') })} mono />}
          </Field>
          <Field label="PIN code" issue="legalRegistration.pinCode">
            {(p) => <TextInput {...p} inputMode="numeric" autoComplete="postal-code" maxLength={6} value={legal.pinCode} onChange={(v) => setLegal({ pinCode: v.replace(/\D/g, '') })} mono />}
          </Field>
          <Field label="Country">
            {(p) => <TextInput {...p} autoComplete="country-name" value={legal.country} onChange={(v) => setLegal({ country: v })} />}
          </Field>
        </FieldGrid>
        <Note>Name, GSTIN and address are also saved to the property record, so invoices pick up changes straight away.</Note>
      </SettingsSection>
    </div>
  );
};
