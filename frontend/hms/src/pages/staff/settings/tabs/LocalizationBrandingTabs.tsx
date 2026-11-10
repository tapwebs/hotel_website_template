import React from 'react';
import { ColorInput, Field, FieldGrid, Note, SelectInput, SettingsSection, TextInput, useSettingsSection } from '../components/ui';
import type { LocalizationConfig } from '../../../../types/settings';

const CURRENCIES: { value: LocalizationConfig['currency']; label: string; symbol: string }[] = [
  { value: 'INR', label: 'Indian rupee (₹)', symbol: '₹' },
  { value: 'USD', label: 'US dollar ($)', symbol: '$' },
  { value: 'EUR', label: 'Euro (€)', symbol: '€' },
  { value: 'GBP', label: 'British pound (£)', symbol: '£' },
  { value: 'AED', label: 'UAE dirham (AED)', symbol: 'AED' },
];

// Native IANA list; older stored values like "Asia/Kolkata (IST +5:30)" stay visible via SelectInput's fallback.
const TIMEZONES = (() => {
  try {
    return Intl.supportedValuesOf('timeZone').map((z) => ({ value: z, label: z.replace(/_/g, ' ') }));
  } catch {
    return [{ value: 'Asia/Kolkata', label: 'Asia/Kolkata' }];
  }
})();

const LANGUAGES = ['English (India)', 'Hindi', 'English (UK)', 'English (US)', 'Bengali', 'Gujarati', 'Kannada', 'Malayalam', 'Marathi', 'Punjabi', 'Tamil', 'Telugu', 'Urdu', 'French', 'German', 'Spanish', 'Arabic'].map((l) => ({
  value: l,
  label: l,
}));

export const LocalizationTab: React.FC = () => {
  const [loc, set] = useSettingsSection('localization');
  const C = 'localization';
  return (
    <div className="space-y-6">
      <SettingsSection categoryId={C} id="region" title="Currency & time zone" description="Used for prices, folios and every date the system shows.">
        <FieldGrid cols={2}>
          <Field label="Currency">
            {(p) => (
              <SelectInput
                {...p}
                value={loc.currency}
                options={CURRENCIES}
                onChange={(v) => {
                  const c = CURRENCIES.find((x) => x.value === v)!;
                  set({ currency: c.value, currencySymbol: c.symbol });
                }}
              />
            )}
          </Field>
          <Field label="Time zone" hint="Check-in times and the night audit cutoff follow this zone.">
            {(p) => <SelectInput {...p} value={loc.timezone} options={TIMEZONES} onChange={(v) => set({ timezone: v })} />}
          </Field>
        </FieldGrid>
      </SettingsSection>

      <SettingsSection categoryId={C} id="formats" title="Date & time formats">
        <FieldGrid>
          <Field label="Date format">
            {(p) => (
              <SelectInput
                {...p}
                value={loc.dateFormat}
                onChange={(v) => set({ dateFormat: v as LocalizationConfig['dateFormat'] })}
                options={[
                  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (29/10/2026)' },
                  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-10-29)' },
                  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (10/29/2026)' },
                ]}
              />
            )}
          </Field>
          <Field label="Clock">
            {(p) => (
              <SelectInput
                {...p}
                value={loc.timeFormat}
                onChange={(v) => set({ timeFormat: v as LocalizationConfig['timeFormat'] })}
                options={[
                  { value: '12_HOUR', label: '12-hour (2:30 PM)' },
                  { value: '24_HOUR', label: '24-hour (14:30)' },
                ]}
              />
            )}
          </Field>
          <Field label="Week starts on">
            {(p) => (
              <SelectInput
                {...p}
                value={loc.firstDayOfWeek}
                onChange={(v) => set({ firstDayOfWeek: v as LocalizationConfig['firstDayOfWeek'] })}
                options={[
                  { value: 'MONDAY', label: 'Monday' },
                  { value: 'SUNDAY', label: 'Sunday' },
                ]}
              />
            )}
          </Field>
        </FieldGrid>
      </SettingsSection>

      <SettingsSection categoryId={C} id="languages" title="Languages" description="Languages used for guest messages and printed documents.">
        <FieldGrid cols={2}>
          <Field label="Primary language">
            {(p) => <SelectInput {...p} value={loc.defaultLanguage} options={LANGUAGES} onChange={(v) => set({ defaultLanguage: v })} />}
          </Field>
          <Field label="Second language" hint="Optional.">
            {(p) => (
              <SelectInput {...p} value={loc.secondaryLanguage} options={[{ value: '', label: 'None' }, ...LANGUAGES]} onChange={(v) => set({ secondaryLanguage: v })} />
            )}
          </Field>
        </FieldGrid>
      </SettingsSection>
    </div>
  );
};

export const BrandingTab: React.FC = () => {
  const [b, set] = useSettingsSection('branding');
  const C = 'branding';
  const logo = (label: string, key: 'hotelLogoUrl' | 'invoiceLogoUrl' | 'emailHeaderLogoUrl' | 'bookingEngineLogoUrl' | 'faviconUrl', hint?: string) => (
    <Field label={label} hint={hint}>
      {(p) => (
        <div className="flex items-center gap-2">
          <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-white">
            {b[key] ? <img key={b[key]} src={b[key]} alt="" className="max-h-full max-w-full object-contain" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} /> : null}
          </span>
          <TextInput {...p} type="url" value={b[key]} onChange={(v) => set({ [key]: v.trim() } as Partial<typeof b>)} placeholder="https:// or /path.png" />
        </div>
      )}
    </Field>
  );
  return (
    <div className="space-y-6">
      <SettingsSection categoryId={C} id="colors" title="Brand colours" description="Applied to invoices, emails and the direct booking engine.">
        <FieldGrid cols={2}>
          <Field label="Primary colour" issue="branding.primaryBrandColor" hint="Buttons and headings.">
            {(p) => <ColorInput {...p} value={b.primaryBrandColor} onChange={(v) => set({ primaryBrandColor: v })} />}
          </Field>
          <Field label="Secondary colour" issue="branding.secondaryBrandColor" hint="Backgrounds and accents.">
            {(p) => <ColorInput {...p} value={b.secondaryBrandColor} onChange={(v) => set({ secondaryBrandColor: v })} />}
          </Field>
        </FieldGrid>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3" aria-label="Colour preview">
          <span className="rounded-lg px-4 py-2 text-xs font-semibold text-white" style={{ background: b.primaryBrandColor }}>
            Book now
          </span>
          <span className="rounded-lg px-4 py-2 text-xs font-semibold text-white" style={{ background: b.secondaryBrandColor }}>
            Secondary
          </span>
          <span className="text-xs text-muted-foreground">Preview</span>
        </div>
      </SettingsSection>

      <SettingsSection categoryId={C} id="logos" title="Logos" description="Paste an image link. Use a transparent PNG or SVG for best results.">
        <FieldGrid cols={2}>
          {logo('Main logo', 'hotelLogoUrl')}
          {logo('Invoice logo', 'invoiceLogoUrl', 'Printed at the top of tax invoices.')}
          {logo('Email header logo', 'emailHeaderLogoUrl')}
          {logo('Booking engine logo', 'bookingEngineLogoUrl')}
          {logo('Browser icon (favicon)', 'faviconUrl')}
        </FieldGrid>
        <Note>Image upload is not available yet; host the file and paste its link here.</Note>
      </SettingsSection>
    </div>
  );
};
