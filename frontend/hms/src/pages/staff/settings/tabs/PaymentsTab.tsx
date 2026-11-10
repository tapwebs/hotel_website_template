import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { paymentService } from '../../../../services/apiServices';
import { useSettingsStore } from '../../../../stores/settingsStore';
import type { RefundPolicyConfig } from '../../../../types/settings';
import {
  Field,
  FieldGrid,
  GoTo,
  NumberInput,
  SelectInput,
  SettingsSection,
  StatusPill,
  Switch,
  ToggleGrid,
  ToggleRow,
  cellInput,
  tableCls,
  tableWrap,
  theadCls,
  useSettingsSection,
} from '../components/ui';

const C = 'payments';

export const PaymentsTab: React.FC = () => {
  // Gateway status comes from the server's real configuration (env vars), not from saved settings,
  // so this card can never claim a gateway is set up when it is not (or the other way round).
  const { data: ps, isError: psError } = useQuery({ queryKey: ['provider-status'], queryFn: paymentService.getProviderStatus, staleTime: 60_000 });
  const [dep, setDep] = useSettingsSection('depositPolicy');
  const [ref, setRef] = useSettingsSection('refundPolicy');
  const methods = useSettingsStore((s) => s.data.paymentMethods);
  const updatePaymentMethod = useSettingsStore((s) => s.updatePaymentMethod);

  return (
    <div className="space-y-6">
      <SettingsSection categoryId={C} id="gateways" title="Payment gateways" description="Read from the server. Keys are set as server environment variables and are never shown in full.">
        {psError ? (
          <p className="text-xs text-muted-foreground">Gateway status needs the Process payments permission.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <GatewayCard
              name="Razorpay (guest QR orders)"
              desc="Cards, UPI and net banking for guests ordering from a table QR. Turn it on or off for guests in Restaurant settings."
              tone={ps?.razorpay?.configured ? 'ok' : ps?.guestOnlinePayment === 'demo' ? 'warn' : 'off'}
              status={ps?.razorpay?.configured ? (ps.razorpay.mode === 'TEST' ? 'Connected (test keys)' : 'Connected') : ps?.guestOnlinePayment === 'demo' ? 'Demo (local only)' : 'Not set up'}
              rows={[
                ['Key ID', ps?.razorpay?.keyIdMasked || '—'],
                ['Webhook', ps?.razorpay?.webhookConfigured ? 'Signed' : 'Not set'],
              ]}
              hint={ps?.razorpay?.configured ? undefined : 'Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET on the API server.'}
            />
            <GatewayCard
              name="Front desk gateway"
              desc="Used for folio payments taken through the payments ledger and for settlement reconciliation."
              tone={ps?.configurationValid ? (ps.isDemo ? 'warn' : 'ok') : 'error'}
              status={ps ? (ps.configurationValid ? (ps.isDemo ? 'Demo' : 'Connected') : 'Error') : '…'}
              rows={[['Provider', ps?.activeProvider || '—']]}
              hint={ps?.configurationError || 'Card-machine and cash payments are recorded on the folio; refunds for them are handed back at the desk.'}
            />
          </div>
        )}
      </SettingsSection>

      <SettingsSection categoryId={C} id="methods" title="Payment methods" description="Ways guests can pay, and where each payment is settled.">
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead className={theadCls}>
              <tr>
                <th scope="col" className="px-3 py-2.5">Method</th>
                <th scope="col" className="px-3 py-2.5">Settles to</th>
                <th scope="col" className="px-3 py-2.5 text-center">Reference no. required</th>
                <th scope="col" className="px-3 py-2.5 text-center">Refunds</th>
                <th scope="col" className="px-3 py-2.5 text-center">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-ink">
              {methods.map((m) => (
                <tr key={m.id} className={m.enabled ? '' : 'bg-slate-50/60 text-muted-foreground'}>
                  <td className="px-3 py-2">
                    <input aria-label="Method name" value={m.displayName} onChange={(e) => updatePaymentMethod(m.id, { displayName: e.target.value })} className={cellInput} />
                    <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">{m.code}</span>
                  </td>
                  <td className="px-3 py-2">
                    <input aria-label={`${m.displayName} settlement account`} value={m.settlementAccount} onChange={(e) => updatePaymentMethod(m.id, { settlementAccount: e.target.value })} className={cellInput} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Switch aria-label={`${m.displayName} reference required`} checked={m.requireReferenceNo} onChange={(v) => updatePaymentMethod(m.id, { requireReferenceNo: v })} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Switch aria-label={`${m.displayName} refunds allowed`} checked={m.allowRefund} onChange={(v) => updatePaymentMethod(m.id, { allowRefund: v })} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Switch aria-label={`${m.displayName} active`} checked={m.enabled} onChange={(v) => updatePaymentMethod(m.id, { enabled: v })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsSection>

      <SettingsSection categoryId={C} id="deposits" title="Advance deposits" description="Payment taken up front to guarantee a booking.">
        <ToggleRow label="Require a deposit for guaranteed bookings" checked={dep.requireDepositForGuaranteedBooking} onChange={(v) => setDep({ requireDepositForGuaranteedBooking: v })}>
          <FieldGrid cols={2}>
            <Field label="Deposit amount" issue="depositPolicy.defaultDepositPercentage" hint="Of the total stay value.">
              {(p) => <NumberInput {...p} min={0} max={100} step={5} unit="%" disabled={!dep.requireDepositForGuaranteedBooking} value={dep.defaultDepositPercentage} onChange={(v) => setDep({ defaultDepositPercentage: v })} />}
            </Field>
          </FieldGrid>
        </ToggleRow>
        <ToggleGrid>
          <ToggleRow label="Front desk can waive or change the deposit" checked={dep.allowManualDepositOverride} onChange={(v) => setDep({ allowManualDepositOverride: v })} />
          <ToggleRow label="Manager approval for deposit changes" disabled={!dep.allowManualDepositOverride} checked={dep.overrideRequiresManagerApproval} onChange={(v) => setDep({ overrideRequiresManagerApproval: v })} />
        </ToggleGrid>
      </SettingsSection>

      <SettingsSection categoryId={C} id="refunds" title="Refunds" description="Who can refund guests, and up to how much.">
        <ToggleRow label="Allow refunds" checked={ref.allowRefunds} onChange={(v) => setRef({ allowRefunds: v })}>
          <FieldGrid cols={2}>
            <Field label="Front desk can refund up to" hint="Larger refunds need approval.">
              {(p) => <NumberInput {...p} min={0} step={500} unit="₹" disabled={!ref.allowRefunds} value={ref.maxFrontDeskRefundINR} onChange={(v) => setRef({ maxFrontDeskRefundINR: v })} />}
            </Field>
            <Field label="Larger refunds approved by">
              {(p) => (
                <SelectInput
                  {...p}
                  disabled={!ref.allowRefunds}
                  value={ref.approvalLevelRequired}
                  onChange={(v) => setRef({ approvalLevelRequired: v as RefundPolicyConfig['approvalLevelRequired'] })}
                  options={[
                    { value: 'STAFF', label: 'Front desk cashier' },
                    { value: 'DUTY_MANAGER', label: 'Duty manager' },
                    { value: 'GENERAL_MANAGER', label: 'General manager' },
                    { value: 'FINANCE_HEAD', label: 'Finance head' },
                  ]}
                />
              )}
            </Field>
          </FieldGrid>
          <div className="mt-3">
            <ToggleRow label="Reason required for every refund" disabled={!ref.allowRefunds} checked={ref.refundReasonMandatory} onChange={(v) => setRef({ refundReasonMandatory: v })} />
          </div>
        </ToggleRow>
        <p className="text-xs text-muted-foreground">
          Turn refund approval on or off in <GoTo tab="security" section="approvals">Manager approvals</GoTo>.
        </p>
      </SettingsSection>
    </div>
  );
};

const GatewayCard: React.FC<{ name: string; desc: string; tone: 'ok' | 'warn' | 'error' | 'off'; status: string; rows: [string, string][]; hint?: string }> = ({ name, desc, tone, status, rows, hint }) => (
  <div className="space-y-3 rounded-lg border border-border bg-cream/40 p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-ink">{name}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <StatusPill tone={tone}>{status}</StatusPill>
    </div>
    <dl className="grid grid-cols-2 gap-2 text-xs">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="truncate font-mono text-ink">{v}</dd>
        </div>
      ))}
    </dl>
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);
