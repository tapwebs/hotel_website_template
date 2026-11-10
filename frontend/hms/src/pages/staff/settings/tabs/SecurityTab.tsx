import React from 'react';
import { useSettingsStore } from '../../../../stores/settingsStore';
import type { AuditLoggingConfig, AuthenticationPolicyConfig, ManagerApprovalPoliciesConfig } from '../../../../types/settings';
import { Field, FieldGrid, Note, NumberInput, SelectInput, SettingsSection, SubHeading, ToggleGrid, ToggleRow, useSettingsSection } from '../components/ui';

const C = 'security';

const TRACKED: { key: keyof AuditLoggingConfig['sensitiveActionsTracked']; label: string }[] = [
  { key: 'discounts', label: 'Discounts' },
  { key: 'refunds', label: 'Refunds' },
  { key: 'rateChanges', label: 'Rate changes' },
  { key: 'reservationCancellations', label: 'Cancellations' },
  { key: 'folioVoids', label: 'Voided charges' },
  { key: 'cashDrawerOpenings', label: 'Cash drawer openings' },
  { key: 'permissionModifications', label: 'Staff permission changes' },
  { key: 'settingsChanges', label: 'Settings changes' },
];

export const SecurityTab: React.FC = () => {
  const [auth, setAuth] = useSettingsSection('authPolicy');
  const [ap, setAp] = useSettingsSection('approvalPolicies');
  const [log, setLog] = useSettingsSection('auditLogging');
  const [priv, setPriv] = useSettingsSection('dataPrivacy');
  const folio = useSettingsStore((s) => s.data.folio);
  const refund = useSettingsStore((s) => s.data.refundPolicy);
  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const APPROVALS: { key: keyof ManagerApprovalPoliciesConfig; label: string; description: string; group: string }[] = [
    { group: 'Rates & billing', key: 'rateOverrideApproval', label: 'Manual rate override', description: 'Changing a room rate away from the rate plan.' },
    { group: 'Rates & billing', key: 'discountAboveLimitApproval', label: 'Large discounts', description: `Discounts above ${folio.discountRequiresApprovalAbovePercent}% (set in Folios & invoices).` },
    { group: 'Rates & billing', key: 'folioVoidApproval', label: 'Voiding a posted charge', description: 'Removing a charge already on a folio.' },
    { group: 'Rates & billing', key: 'cancellationPenaltyWaiverApproval', label: 'Waiving a cancellation charge', description: 'Refunding or dropping a penalty the policy would apply.' },
    { group: 'Payments', key: 'refundApproval', label: 'Large refunds', description: `Refunds above ${inr(refund.maxFrontDeskRefundINR)} (set in Payments).` },
    { group: 'Payments', key: 'paymentAdjustmentApproval', label: 'Payment corrections', description: 'Changing the method or amount of a recorded payment.' },
    { group: 'Rooms', key: 'roomUpgradeApproval', label: 'Free upgrades', description: 'Moving a guest to a better room type at no charge.' },
    { group: 'Rooms', key: 'roomOooApproval', label: 'Marking a room out of order', description: 'Takes the room off sale.' },
    { group: 'Staff', key: 'permissionChangesApproval', label: 'Staff role and permission changes', description: 'Giving or removing access.' },
  ];
  const groups = [...new Set(APPROVALS.map((a) => a.group))];

  return (
    <div className="space-y-6">
      <SettingsSection categoryId={C} id="sign-in" title="Sign-in & passwords" description="Rules for every staff account.">
        <FieldGrid>
          <Field label="Sign out after inactivity" issue="authPolicy.sessionTimeoutMinutes">
            {(p) => <NumberInput {...p} min={5} step={5} unit="minutes" value={auth.sessionTimeoutMinutes} onChange={(v) => setAuth({ sessionTimeoutMinutes: v })} />}
          </Field>
          <Field label="Two-step verification">
            {(p) => (
              <SelectInput
                {...p}
                value={auth.mfaEnforcement}
                onChange={(v) => setAuth({ mfaEnforcement: v as AuthenticationPolicyConfig['mfaEnforcement'] })}
                options={[
                  { value: 'ALL_STAFF', label: 'Required for all staff' },
                  { value: 'MANAGERS_AND_ADMINS', label: 'Required for managers and admins' },
                  { value: 'OPTIONAL', label: 'Optional' },
                ]}
              />
            )}
          </Field>
          <Field label="Lock account after" hint="Failed sign-in attempts in a row.">
            {(p) => <NumberInput {...p} min={3} max={10} unit="attempts" value={auth.loginMaxFailedAttempts} onChange={(v) => setAuth({ loginMaxFailedAttempts: v })} />}
          </Field>
          <Field label="Lock for">
            {(p) => <NumberInput {...p} min={5} step={5} unit="minutes" value={auth.lockoutDurationMinutes} onChange={(v) => setAuth({ lockoutDurationMinutes: v })} />}
          </Field>
          <Field label="Minimum password length" issue="authPolicy.passwordMinLength">
            {(p) => <NumberInput {...p} min={8} max={32} unit="characters" value={auth.passwordMinLength} onChange={(v) => setAuth({ passwordMinLength: v })} />}
          </Field>
          <Field label="Password expires after" hint="0 means passwords never expire.">
            {(p) => <NumberInput {...p} min={0} max={365} step={30} unit="days" value={auth.passwordExpiryDays} onChange={(v) => setAuth({ passwordExpiryDays: v })} />}
          </Field>
        </FieldGrid>
        <ToggleGrid cols={3}>
          <ToggleRow label="Password needs a number" checked={auth.passwordRequireNumber} onChange={(v) => setAuth({ passwordRequireNumber: v })} />
          <ToggleRow label="Password needs a symbol" checked={auth.passwordRequireSpecialChar} onChange={(v) => setAuth({ passwordRequireSpecialChar: v })} />
          <ToggleRow label="Same login on several devices" checked={auth.allowConcurrentSessions} onChange={(v) => setAuth({ allowConcurrentSessions: v })} />
        </ToggleGrid>
      </SettingsSection>

      <SettingsSection categoryId={C} id="approvals" title="Manager approvals" description="Actions that need a duty manager or GM to approve with their PIN. This is the one place these approvals are set.">
        {groups.map((g) => (
          <div key={g} className="space-y-3">
            <SubHeading>{g}</SubHeading>
            <ToggleGrid>
              {APPROVALS.filter((a) => a.group === g).map((a) => (
                <ToggleRow key={a.key} label={a.label} description={a.description} checked={ap[a.key]} onChange={(v) => setAp({ [a.key]: v })} />
              ))}
            </ToggleGrid>
          </div>
        ))}
        <Note>Approvals tied to one feature stay with that feature: overbooking (Reservations), deposit changes (Payments), check-out with a balance (Folios) and returning a repaired room (Rooms & housekeeping).</Note>
      </SettingsSection>

      <SettingsSection categoryId={C} id="audit-log" title="Audit logging" description="What the system records for each sensitive action.">
        <ToggleGrid cols={3}>
          <ToggleRow label="Record staff member" checked={log.recordUserId} onChange={(v) => setLog({ recordUserId: v })} />
          <ToggleRow label="Record IP address" checked={log.recordIpAddress} onChange={(v) => setLog({ recordIpAddress: v })} />
          <ToggleRow label="Record exact time" checked={log.recordTimestamp} onChange={(v) => setLog({ recordTimestamp: v })} />
        </ToggleGrid>
        <SubHeading>Actions to log</SubHeading>
        <ToggleGrid cols={3}>
          {TRACKED.map((t) => (
            <ToggleRow
              key={t.key}
              label={t.label}
              checked={log.sensitiveActionsTracked[t.key]}
              onChange={(v) => setLog({ sensitiveActionsTracked: { ...log.sensitiveActionsTracked, [t.key]: v } })}
            />
          ))}
        </ToggleGrid>
      </SettingsSection>

      <SettingsSection categoryId={C} id="privacy" title="Guest data privacy" description="Handling of guest personal data under the Digital Personal Data Protection Act, 2023.">
        <FieldGrid>
          <Field label="Keep guest records for" hint="After the last stay. Tax records are kept as the law requires.">
            {(p) => <NumberInput {...p} min={6} max={120} step={6} unit="months" value={priv.guestDataRetentionMonths} onChange={(v) => setPriv({ guestDataRetentionMonths: v })} />}
          </Field>
        </FieldGrid>
        <ToggleGrid>
          <ToggleRow label="Mask ID numbers" description="Show only the last 4 digits of Aadhaar and passport numbers to staff." checked={priv.maskIdDocumentNumbers} onChange={(v) => setPriv({ maskIdDocumentNumbers: v })} />
          <ToggleRow label="Ask before sending offers" description="Guests must opt in to marketing messages." checked={priv.requireMarketingConsent} onChange={(v) => setPriv({ requireMarketingConsent: v })} />
        </ToggleGrid>
      </SettingsSection>
    </div>
  );
};
