import React from 'react';
import { useSettingsStore } from '../../../../stores/settingsStore';
import type { InventoryRulesConfig, OverbookingPolicyConfig, ReservationPoliciesConfig } from '../../../../types/settings';
import {
  Field,
  FieldGrid,
  NumberInput,
  SelectInput,
  SettingsSection,
  SubHeading,
  Switch,
  ToggleGrid,
  ToggleRow,
  cellInput,
  tableCls,
  tableWrap,
  theadCls,
  useSettingsSection,
} from '../components/ui';

const C = 'reservations';

const RATE_PLANS = [
  { value: 'BAR-FLEX-BF', label: 'BAR flexible with breakfast' },
  { value: 'BAR-ROOM-ONLY', label: 'BAR room only' },
  { value: 'BAR-RACK', label: 'Rack rate' },
  { value: 'OTA-STANDARD', label: 'OTA standard' },
  { value: 'CORP-PREMIER', label: 'Corporate negotiated' },
  { value: 'NON-REF-SAVE15', label: 'Non-refundable (15% off)' },
];
const CANCELLATION_POLICIES = [
  { value: 'FREE_48H', label: 'Free cancellation up to 48 h before arrival' },
  { value: 'FREE_24H', label: 'Free cancellation up to 24 h before arrival' },
  { value: 'MODERATE', label: 'Moderate — 1 night charged within 72 h' },
  { value: 'NON_REFUNDABLE', label: 'Non-refundable' },
];
const SHORT_CANCEL = [
  { value: 'FREE_48H', label: 'Free 48 h' },
  { value: 'FREE_24H', label: 'Free 24 h' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'NON_REFUNDABLE', label: 'Non-refundable' },
];

export const ReservationsTab: React.FC = () => {
  const [res, setRes] = useSettingsSection('reservationPolicies');
  const [stay, setStay] = useSettingsSection('stayPolicies');
  const [ob, setOb] = useSettingsSection('overbooking');
  const [inv, setInv] = useSettingsSection('inventoryRules');
  const bookingSources = useSettingsStore((s) => s.data.bookingSources);
  const updateBookingSource = useSettingsStore((s) => s.updateBookingSource);
  const sourceOptions = bookingSources.map((s) => ({ value: s.code, label: s.displayName }));

  return (
    <div className="space-y-6">
      <SettingsSection categoryId={C} id="defaults" title="Booking defaults" description="Pre-filled on every new reservation. Staff can change them per booking.">
        <FieldGrid>
          <Field label="Default status">
            {(p) => (
              <SelectInput
                {...p}
                value={res.defaultReservationStatus}
                onChange={(v) => setRes({ defaultReservationStatus: v as ReservationPoliciesConfig['defaultReservationStatus'] })}
                options={[
                  { value: 'CONFIRMED', label: 'Confirmed (guaranteed)' },
                  { value: 'HOLD', label: 'On hold (temporary)' },
                  { value: 'PROVISIONAL', label: 'Provisional (unpaid enquiry)' },
                ]}
              />
            )}
          </Field>
          <Field label="Default rate plan">
            {(p) => <SelectInput {...p} value={res.defaultRatePlan} options={RATE_PLANS} onChange={(v) => setRes({ defaultRatePlan: v })} />}
          </Field>
          <Field label="Default booking source">
            {(p) => <SelectInput {...p} value={res.defaultBookingSource} options={sourceOptions} onChange={(v) => setRes({ defaultBookingSource: v })} />}
          </Field>
        </FieldGrid>
      </SettingsSection>

      <SettingsSection categoryId={C} id="cancellation" title="Cancellation & no-show" description="Default terms. Booking sources below can override the cancellation policy.">
        <FieldGrid>
          <Field label="Cancellation policy">
            {(p) => (
              <SelectInput
                {...p}
                value={res.cancellationPolicyDefault}
                options={CANCELLATION_POLICIES}
                onChange={(v) => setRes({ cancellationPolicyDefault: v as ReservationPoliciesConfig['cancellationPolicyDefault'] })}
              />
            )}
          </Field>
          <Field label="No-show charge">
            {(p) => (
              <SelectInput
                {...p}
                value={res.noShowPolicyDefault}
                onChange={(v) => setRes({ noShowPolicyDefault: v as ReservationPoliciesConfig['noShowPolicyDefault'] })}
                options={[
                  { value: 'CHARGE_FIRST_NIGHT', label: 'First night plus taxes' },
                  { value: 'CHARGE_FULL_STAY', label: 'Full stay' },
                  { value: 'NO_CHARGE', label: 'No charge' },
                ]}
              />
            )}
          </Field>
          <Field label="Changes allowed until" hint="Before arrival. Later changes need the front desk.">
            {(p) => <NumberInput {...p} min={0} step={1} unit="hours" value={res.modificationCutoffHours} onChange={(v) => setRes({ modificationCutoffHours: v })} />}
          </Field>
        </FieldGrid>
        <ToggleRow label="Allow cancellation on the arrival day" checked={stay.sameDayCancellationAllowed} onChange={(v) => setStay({ sameDayCancellationAllowed: v })} />
      </SettingsSection>

      <SettingsSection categoryId={C} id="restrictions" title="Stay limits & holds">
        <FieldGrid>
          <Field label="Minimum stay" issue="reservationPolicies.minLengthOfStayNights">
            {(p) => <NumberInput {...p} min={1} unit="nights" value={res.minLengthOfStayNights} onChange={(v) => setRes({ minLengthOfStayNights: v })} />}
          </Field>
          <Field label="Maximum stay" issue="reservationPolicies.maxLengthOfStayNights">
            {(p) => <NumberInput {...p} min={1} unit="nights" value={res.maxLengthOfStayNights} onChange={(v) => setRes({ maxLengthOfStayNights: v })} />}
          </Field>
          <Field label="Book up to" hint="How far ahead guests can book.">
            {(p) => <NumberInput {...p} min={1} max={730} unit="days ahead" value={res.maxAdvanceBookingDays} onChange={(v) => setRes({ maxAdvanceBookingDays: v })} />}
          </Field>
        </FieldGrid>
        <ToggleRow
          label="Release expired holds automatically"
          description="When a hold runs out, the room goes back on sale."
          checked={res.autoReleaseExpiredHolds}
          onChange={(v) => setRes({ autoReleaseExpiredHolds: v })}
        >
          <Field label="Hold rooms for">
            {(p) => <NumberInput {...p} min={5} step={5} unit="minutes" value={res.reservationHoldDurationMinutes} onChange={(v) => setRes({ reservationHoldDurationMinutes: v })} />}
          </Field>
        </ToggleRow>
      </SettingsSection>

      <SettingsSection categoryId={C} id="overbooking" title="Overbooking" description="Sell more rooms than you have on high-demand dates.">
        <ToggleRow label="Allow overbooking" checked={ob.allowOverbooking} onChange={(v) => setOb({ allowOverbooking: v })}>
          <FieldGrid cols={2}>
            <Field label="Up to">
              {(p) => <NumberInput {...p} min={0} max={25} unit="% of rooms" disabled={!ob.allowOverbooking} value={ob.maxOverbookingPercentage} onChange={(v) => setOb({ maxOverbookingPercentage: v })} />}
            </Field>
            <Field label="Applies to">
              {(p) => (
                <SelectInput
                  {...p}
                  disabled={!ob.allowOverbooking}
                  value={ob.scope}
                  onChange={(v) => setOb({ scope: v as OverbookingPolicyConfig['scope'] })}
                  options={[
                    { value: 'PER_ROOM_TYPE', label: 'Each room type' },
                    { value: 'PROPERTY_WIDE', label: 'Whole property' },
                  ]}
                />
              )}
            </Field>
          </FieldGrid>
          <div className="mt-3">
            <ToggleRow
              label="Manager approval for overbooked reservations"
              disabled={!ob.allowOverbooking}
              checked={ob.managerApprovalRequired}
              onChange={(v) => setOb({ managerApprovalRequired: v })}
            />
          </div>
        </ToggleRow>
      </SettingsSection>

      <SettingsSection categoryId={C} id="inventory" title="Inventory" description="How available rooms are counted and shared between channels.">
        <FieldGrid cols={2}>
          <Field label="Inventory mode">
            {(p) => (
              <SelectInput
                {...p}
                value={inv.inventoryMode}
                onChange={(v) => setInv({ inventoryMode: v as InventoryRulesConfig['inventoryMode'] })}
                options={[
                  { value: 'SHARED_POOL', label: 'Shared pool — all channels sell the same rooms' },
                  { value: 'CHANNEL_ALLOCATED', label: 'Fixed allotment per channel' },
                  { value: 'HYBRID', label: 'Allotment plus shared overflow' },
                ]}
              />
            )}
          </Field>
          <Field label="Available rooms =">
            {(p) => (
              <SelectInput
                {...p}
                value={inv.availabilityCalculation}
                onChange={(v) => setInv({ availabilityCalculation: v as InventoryRulesConfig['availabilityCalculation'] })}
                options={[
                  { value: 'PHYSICAL_MINUS_OCCUPIED_AND_OOO', label: 'Rooms − occupied − confirmed − out of order' },
                  { value: 'INCLUDE_PROVISIONAL', label: 'Also subtract provisional bookings' },
                ]}
              />
            )}
          </Field>
        </FieldGrid>
        <SubHeading>Put rooms back on sale when</SubHeading>
        <ToggleGrid>
          <ToggleRow label="A booking is cancelled" checked={inv.releaseInventoryOnCancellation} onChange={(v) => setInv({ releaseInventoryOnCancellation: v })} />
          <ToggleRow label="A guest is marked no-show" checked={inv.releaseInventoryOnNoShow} onChange={(v) => setInv({ releaseInventoryOnNoShow: v })} />
        </ToggleGrid>
        <ToggleRow
          label='Show "Only X rooms left"'
          description="Displayed on the booking engine when availability is low."
          checked={inv.allowPartialAvailabilityDisplay}
          onChange={(v) => setInv({ allowPartialAvailabilityDisplay: v })}
        />
      </SettingsSection>

      <SettingsSection categoryId={C} id="sources" title="Booking sources" description="Where reservations come from, with commission and default terms for each.">
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead className={theadCls}>
              <tr>
                <th scope="col" className="px-3 py-2.5">Source</th>
                <th scope="col" className="px-3 py-2.5">Commission</th>
                <th scope="col" className="px-3 py-2.5">Rate plan</th>
                <th scope="col" className="px-3 py-2.5">Cancellation</th>
                <th scope="col" className="px-3 py-2.5 text-center">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-ink">
              {bookingSources.map((s) => (
                <tr key={s.id} className={s.enabled ? '' : 'bg-slate-50/60 text-muted-foreground'}>
                  <td className="px-3 py-2">
                    <input aria-label="Source name" value={s.displayName} onChange={(e) => updateBookingSource(s.id, { displayName: e.target.value })} className={cellInput} />
                    <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">{s.code}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        aria-label={`${s.displayName} commission`}
                        min={0}
                        max={50}
                        step={0.5}
                        value={s.commissionPercentage}
                        onChange={(e) => updateBookingSource(s.id, { commissionPercentage: Number(e.target.value) || 0 })}
                        className={`${cellInput} w-20 font-mono`}
                      />
                      <span className="text-muted-foreground">%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <select aria-label={`${s.displayName} rate plan`} value={s.defaultRatePlan} onChange={(e) => updateBookingSource(s.id, { defaultRatePlan: e.target.value })} className={cellInput}>
                      {RATE_PLANS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select aria-label={`${s.displayName} cancellation`} value={s.cancellationPolicy} onChange={(e) => updateBookingSource(s.id, { cancellationPolicy: e.target.value })} className={cellInput}>
                      {SHORT_CANCEL.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Switch aria-label={`${s.displayName} active`} checked={s.enabled} onChange={(v) => updateBookingSource(s.id, { enabled: v })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsSection>
    </div>
  );
};
