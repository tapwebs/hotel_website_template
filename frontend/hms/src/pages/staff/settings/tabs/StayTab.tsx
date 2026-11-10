import React from 'react';
import { Field, FieldGrid, GoTo, NumberInput, SelectInput, SettingsSection, SubHeading, TimeInput, ToggleGrid, ToggleRow, useSettingsSection } from '../components/ui';
import type { GuestPoliciesConfig } from '../../../../types/settings';

const C = 'stay';

export const StayTab: React.FC = () => {
  const [times, setTimes] = useSettingsSection('stayTimes');
  const [guest, setGuest] = useSettingsSection('guestPolicies');
  const [stay, setStay] = useSettingsSection('stayPolicies');

  return (
    <div className="space-y-6">
      <SettingsSection categoryId={C} id="times" title="Check-in & check-out times" description="Standard times, free grace periods, and what to charge beyond them.">
        <FieldGrid cols={2}>
          <Field label="Check-in from" required>
            {(p) => <TimeInput {...p} value={times.standardCheckIn} onChange={(v) => setTimes({ standardCheckIn: v })} />}
          </Field>
          <Field label="Check-out by" required>
            {(p) => <TimeInput {...p} value={times.standardCheckOut} onChange={(v) => setTimes({ standardCheckOut: v })} />}
          </Field>
        </FieldGrid>
        <ToggleGrid>
          <ToggleRow label="Allow early check-in" description="Subject to room availability." checked={times.earlyCheckInAllowed} onChange={(v) => setTimes({ earlyCheckInAllowed: v })}>
            <FieldGrid cols={2}>
              <Field label="Free grace period">
                {(p) => <NumberInput {...p} min={0} step={15} unit="min" disabled={!times.earlyCheckInAllowed} value={times.earlyCheckInGraceMinutes} onChange={(v) => setTimes({ earlyCheckInGraceMinutes: v })} />}
              </Field>
              <Field label="Fee beyond grace" hint="% of one night's rate.">
                {(p) => <NumberInput {...p} min={0} max={100} step={5} unit="%" disabled={!times.earlyCheckInAllowed} value={times.earlyCheckInFeePercent} onChange={(v) => setTimes({ earlyCheckInFeePercent: v })} />}
              </Field>
            </FieldGrid>
          </ToggleRow>
          <ToggleRow label="Allow late check-out" description="Subject to the next arrival." checked={times.lateCheckOutAllowed} onChange={(v) => setTimes({ lateCheckOutAllowed: v })}>
            <FieldGrid cols={2}>
              <Field label="Free grace period">
                {(p) => <NumberInput {...p} min={0} step={15} unit="min" disabled={!times.lateCheckOutAllowed} value={times.lateCheckOutGraceMinutes} onChange={(v) => setTimes({ lateCheckOutGraceMinutes: v })} />}
              </Field>
              <Field label="Fee beyond grace" hint="% of one night's rate.">
                {(p) => <NumberInput {...p} min={0} max={100} step={5} unit="%" disabled={!times.lateCheckOutAllowed} value={times.lateCheckOutFeePercent} onChange={(v) => setTimes({ lateCheckOutFeePercent: v })} />}
              </Field>
            </FieldGrid>
          </ToggleRow>
        </ToggleGrid>
      </SettingsSection>

      <SettingsSection categoryId={C} id="guest-policies" title="Guest policies" description="House rules checked at the front desk and shown on the booking engine.">
        <FieldGrid>
          <Field label="Minimum age to check in">
            {(p) => <NumberInput {...p} min={0} max={25} unit="years" value={guest.minCheckInAge} onChange={(v) => setGuest({ minCheckInAge: v })} />}
          </Field>
          <Field label="Children stay free up to" hint="Without an extra bed.">
            {(p) => <NumberInput {...p} min={0} max={17} unit="years" value={guest.childFreeStayAgeLimit} onChange={(v) => setGuest({ childFreeStayAgeLimit: v })} />}
          </Field>
          <Field label="Smoking">
            {(p) => (
              <SelectInput
                {...p}
                value={guest.smokingPolicy}
                onChange={(v) => setGuest({ smokingPolicy: v as GuestPoliciesConfig['smokingPolicy'] })}
                options={[
                  { value: 'NON_SMOKING', label: 'Non-smoking property' },
                  { value: 'DESIGNATED_ROOMS', label: 'Designated smoking rooms only' },
                  { value: 'ALLOWED', label: 'Allowed' },
                ]}
              />
            )}
          </Field>
        </FieldGrid>
        <SubHeading>Identity checks</SubHeading>
        <ToggleGrid>
          <ToggleRow label="ID proof required at check-in" description="Aadhaar, passport, driving licence or voter ID for every adult." checked={guest.idProofRequiredAtCheckIn} onChange={(v) => setGuest({ idProofRequiredAtCheckIn: v })} />
          <ToggleRow label="Form C for foreign nationals" description="Prompt for passport and visa details to report to FRRO within 24 hours." checked={guest.formCForForeignNationals} onChange={(v) => setGuest({ formCForForeignNationals: v })} />
        </ToggleGrid>
        <SubHeading>Extras</SubHeading>
        <ToggleGrid>
          <ToggleRow label="Extra beds available" checked={guest.extraBedAllowed} onChange={(v) => setGuest({ extraBedAllowed: v })}>
            <Field label="Extra bed charge per night">
              {(p) => <NumberInput {...p} min={0} step={100} unit="₹" disabled={!guest.extraBedAllowed} value={guest.extraBedChargeINR} onChange={(v) => setGuest({ extraBedChargeINR: v })} />}
            </Field>
          </ToggleRow>
          <ToggleRow label="Pets allowed" checked={guest.petsAllowed} onChange={(v) => setGuest({ petsAllowed: v })} />
        </ToggleGrid>
      </SettingsSection>

      <SettingsSection categoryId={C} id="front-desk" title="Front desk rules">
        <ToggleGrid>
          <ToggleRow label="Walk-in bookings" description="Front desk can create a booking and check in on the spot." checked={stay.walkInBookingAllowed} onChange={(v) => setStay({ walkInBookingAllowed: v })} />
          <ToggleRow label="Room moves after check-in" description="Move an in-house guest and their folio to another room." checked={stay.roomMoveAfterCheckInAllowed} onChange={(v) => setStay({ roomMoveAfterCheckInAllowed: v })} />
          <ToggleRow label="Same-day bookings" description="Accept bookings for arrival today." checked={stay.sameDayBookingAllowed} onChange={(v) => setStay({ sameDayBookingAllowed: v })}>
            <Field label="Last booking time for today">
              {(p) => <TimeInput {...p} disabled={!stay.sameDayBookingAllowed} value={stay.sameDayCutoffTime} onChange={(v) => setStay({ sameDayCutoffTime: v })} />}
            </Field>
          </ToggleRow>
        </ToggleGrid>
        <p className="text-xs text-muted-foreground">
          Manager approval for upgrades and rate overrides is set in <GoTo tab="security" section="approvals">Manager approvals</GoTo>.
        </p>
      </SettingsSection>
    </div>
  );
};
