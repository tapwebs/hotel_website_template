// Self-check for settings navigation, search and validation.
// Run: npx tsx src/pages/staff/settings/settings.check.ts
import assert from 'node:assert/strict';
import { INITIAL_SETTINGS_DATA } from '../../../stores/settings/initialSettingsData';
import type { HMSSettingsData } from '../../../types/settings';
import { SETTINGS_CATEGORIES, dirtyCategoryIds, searchSettings } from './settingsNav';
import { validateSettings } from './validation';

const clone = (): HMSSettingsData => structuredClone(INITIAL_SETTINGS_DATA);

// Every data key is owned by at least one category, so no setting is unreachable.
const owned = new Set(SETTINGS_CATEGORIES.flatMap((c) => c.dataKeys));
const unowned = Object.keys(INITIAL_SETTINGS_DATA).filter((k) => k !== 'businessDate' && !owned.has(k as keyof HMSSettingsData));
assert.deepEqual(unowned, [], `settings with no page: ${unowned.join(', ')}`);

// Section ids are unique within a category (they are scroll anchors).
for (const c of SETTINGS_CATEGORIES) assert.equal(new Set(c.sections.map((s) => s.id)).size, c.sections.length, c.id);

// Search finds settings by field words, not only by section title.
assert.equal(searchSettings('gstin')[0]?.section.id, 'legal');
assert.equal(searchSettings('form c')[0]?.section.id, 'guest-policies'); // phrase beats "formats … clock"
assert.equal(searchSettings('check-out')[0]?.section.id, 'times');
assert.ok(searchSettings('razorpay').some((h) => h.category.id === 'payments'));
assert.equal(searchSettings('   ').length, 0);

// Defaults are valid; bad values are reported against the right field.
assert.deepEqual(validateSettings(clone()), []);
const bad = clone();
bad.legalRegistration.gstin = '27ABCDE1234F1Z5'; // valid shape, wrong state (08)
bad.rateEngine.minAllowedRateINR = 9000;
bad.rateEngine.maxAllowedRateINR = 5000;
const fields = validateSettings(bad).map((i) => i.field);
assert.ok(fields.includes('legalRegistration.gstin'));
assert.ok(fields.includes('rateEngine.maxAllowedRateINR'));

// Dirty tracking marks only the categories that own the changed data.
const edited = clone();
edited.invoice.invoicePrefix = 'TAX/';
assert.deepEqual([...dirtyCategoryIds(edited, clone())], ['billing']);

console.log('settings checks passed');
