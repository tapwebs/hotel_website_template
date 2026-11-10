import React, { useCallback, useState } from 'react';
import { useSettingsStore } from '../../../../stores/settingsStore';
import { useAppDate } from '../../../../hooks/useAppDate';
import type { FolioConfig, InvoiceConfig, RateEngineConfig, TaxRuleItem } from '../../../../types/settings';
import { GstSlabTable } from '../components/GstSlabTable';
import { TaxRuleModal } from '../components/TaxRuleModal';
import {
  Field,
  FieldGrid,
  GoTo,
  Note,
  NumberInput,
  SelectInput,
  SettingsSection,
  SubHeading,
  TextInput,
  TimeInput,
  ToggleGrid,
  ToggleRow,
  useSettingsSection,
} from '../components/ui';

// ---------------------------------------------------------------------------
// Rates & taxes
// ---------------------------------------------------------------------------

export const RatesTaxesTab: React.FC = () => {
  const C = 'rates-taxes';
  const [rate, setRate] = useSettingsSection('rateEngine');
  const taxRules = useSettingsStore((s) => s.data.taxRules);
  const { addTaxRule, updateTaxRule, deleteTaxRule, toggleTaxRule } = useSettingsStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TaxRuleItem | null>(null);

  const openAdd = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);
  const openEdit = useCallback((r: TaxRuleItem) => {
    setEditing(r);
    setModalOpen(true);
  }, []);
  const remove = useCallback(
    (id: string) => {
      const rule = taxRules.find((r) => r.id === id);
      if (window.confirm(`Delete the tax rule "${rule?.taxName ?? id}"? You can still discard this before saving.`)) deleteTaxRule(id);
    },
    [taxRules, deleteTaxRule]
  );

  return (
    <div className="space-y-6">
      <SettingsSection categoryId={C} id="pricing" title="Pricing rules" description="How room prices are shown and how far staff can change them.">
        <FieldGrid>
          <Field label="Base rate">
            {(p) => (
              <SelectInput
                {...p}
                value={rate.baseRateSource}
                onChange={(v) => setRate({ baseRateSource: v as RateEngineConfig['baseRateSource'] })}
                options={[
                  { value: 'BAR_STANDARD', label: 'Best available rate (BAR)' },
                  { value: 'DYNAMIC_TIER', label: 'Occupancy-based tiers' },
                  { value: 'CORPORATE_LINKED', label: 'Linked to corporate contract' },
                ]}
              />
            )}
          </Field>
          <Field label="Lowest rate allowed" hint="Per room per night.">
            {(p) => <NumberInput {...p} min={0} step={500} unit="₹" value={rate.minAllowedRateINR} onChange={(v) => setRate({ minAllowedRateINR: v })} />}
          </Field>
          <Field label="Highest rate allowed" issue="rateEngine.maxAllowedRateINR" hint="Per room per night.">
            {(p) => <NumberInput {...p} min={0} step={500} unit="₹" value={rate.maxAllowedRateINR} onChange={(v) => setRate({ maxAllowedRateINR: v })} />}
          </Field>
        </FieldGrid>
        <ToggleGrid>
          <ToggleRow label="Prices include tax" description="Rates shown to guests already include GST." checked={rate.taxInclusivePricing} onChange={(v) => setRate({ taxInclusivePricing: v })} />
          <ToggleRow
            label="Front desk can override rates"
            description={<>Within the limits above. Approval is set in <GoTo tab="security" section="approvals">Manager approvals</GoTo>.</>}
            checked={rate.allowManualRateOverride}
            onChange={(v) => setRate({ allowManualRateOverride: v })}
          />
        </ToggleGrid>
      </SettingsSection>

      <div id="settings-rates-taxes-gst" className="scroll-mt-24">
        <GstSlabTable taxRules={taxRules} onAdd={openAdd} onEdit={openEdit} onDelete={remove} onToggle={toggleTaxRule} />
      </div>

      {/* Keyed mount: the modal copies the rule into local state once, so each open needs a fresh instance. */}
      {modalOpen && (
        <TaxRuleModal
          key={editing?.id ?? 'new'}
          isOpen
          initialRule={editing}
          onClose={() => setModalOpen(false)}
          onSave={(saved) => ('id' in saved ? updateTaxRule(saved.id, saved) : addTaxRule(saved))}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Folios & invoices
// ---------------------------------------------------------------------------

export const BillingTab: React.FC = () => {
  const C = 'billing';
  const [folio, setFolio] = useSettingsSection('folio');
  const [inv, setInv] = useSettingsSection('invoice');

  return (
    <div className="space-y-6">
      <SettingsSection categoryId={C} id="folio" title="Folio rules" description="How guest bills are opened, split and settled.">
        <FieldGrid cols={2}>
          <Field label="Default folio type">
            {(p) => (
              <SelectInput
                {...p}
                value={folio.defaultFolioType}
                onChange={(v) => setFolio({ defaultFolioType: v as FolioConfig['defaultFolioType'] })}
                options={[
                  { value: 'INDIVIDUAL', label: 'Individual guest' },
                  { value: 'MASTER_COMPANY', label: 'Company master (bill to company)' },
                  { value: 'GROUP', label: 'Group' },
                ]}
              />
            )}
          </Field>
          <Field label="Check-out with an unpaid balance">
            {(p) => (
              <SelectInput
                {...p}
                value={folio.negativeBalancePolicy}
                onChange={(v) => setFolio({ negativeBalancePolicy: v as FolioConfig['negativeBalancePolicy'] })}
                options={[
                  { value: 'RESTRICT_CHECKOUT', label: 'Not allowed — balance must be zero' },
                  { value: 'ALLOW_WITH_SUPERVISOR_SIGN_OFF', label: 'Allowed with supervisor sign-off' },
                ]}
              />
            )}
          </Field>
        </FieldGrid>
        <ToggleGrid>
          <ToggleRow label="Split folios" description="Separate room charges from extras, or bill parts to a company." checked={folio.allowSplitFolio} onChange={(v) => setFolio({ allowSplitFolio: v })} />
          <ToggleRow label="Allowances" description="Post corrections and goodwill credits to a folio." checked={folio.allowAllowancePosting} onChange={(v) => setFolio({ allowAllowancePosting: v })} />
        </ToggleGrid>
        <SubHeading>Discounts</SubHeading>
        <ToggleRow label="Front desk can give discounts" checked={folio.allowFrontDeskDiscount} onChange={(v) => setFolio({ allowFrontDeskDiscount: v })}>
          <FieldGrid cols={2}>
            <Field label="Maximum discount">
              {(p) => <NumberInput {...p} min={0} max={100} unit="%" disabled={!folio.allowFrontDeskDiscount} value={folio.maxFrontDeskDiscountPercent} onChange={(v) => setFolio({ maxFrontDeskDiscountPercent: v })} />}
            </Field>
            <Field label="Manager approval above" issue="folio.discountRequiresApprovalAbovePercent">
              {(p) => <NumberInput {...p} min={0} max={100} unit="%" disabled={!folio.allowFrontDeskDiscount} value={folio.discountRequiresApprovalAbovePercent} onChange={(v) => setFolio({ discountRequiresApprovalAbovePercent: v })} />}
            </Field>
          </FieldGrid>
        </ToggleRow>
      </SettingsSection>

      <SettingsSection categoryId={C} id="numbering" title="Invoice numbering" description="GST rules require one continuous series per financial year.">
        <FieldGrid>
          <Field label="Invoice prefix" required issue="invoice.invoicePrefix">
            {(p) => <TextInput {...p} value={inv.invoicePrefix} onChange={(v) => setInv({ invoicePrefix: v })} mono maxLength={8} />}
          </Field>
          <Field label="Numbering">
            {(p) => (
              <SelectInput
                {...p}
                value={inv.numberFormat}
                onChange={(v) => setInv({ numberFormat: v as InvoiceConfig['numberFormat'] })}
                options={[
                  { value: 'YEAR_SEQUENTIAL', label: 'Restart every financial year' },
                  { value: 'MONTH_SEQUENTIAL', label: 'Restart every month' },
                  { value: 'GLOBAL_INCREMENT', label: 'Never restart' },
                ]}
              />
            )}
          </Field>
          <Field label="Start at number">
            {(p) => <NumberInput {...p} min={1} value={inv.startingSequenceNumber} onChange={(v) => setInv({ startingSequenceNumber: Math.max(1, Math.round(v)) })} />}
          </Field>
          <Field label="Credit note prefix">
            {(p) => <TextInput {...p} value={inv.creditNotePrefix} onChange={(v) => setInv({ creditNotePrefix: v })} mono maxLength={8} />}
          </Field>
          <Field label="Payment receipt prefix">
            {(p) => <TextInput {...p} value={inv.receiptPrefix} onChange={(v) => setInv({ receiptPrefix: v })} mono maxLength={8} />}
          </Field>
        </FieldGrid>
        <Note>
          Tax invoices are currently numbered <span className="font-mono">INV/&lt;financial year&gt;/00001</span>, one continuous series per financial year. The
          choices above are saved and will apply once custom invoice series are switched on.
        </Note>
      </SettingsSection>

      <SettingsSection categoryId={C} id="layout" title="Invoice layout" description="What is printed on tax invoices.">
        <Field label="Footer text" span="full">
          {(p) => <TextInput {...p} value={inv.footerLegalText} onChange={(v) => setInv({ footerLegalText: v })} />}
        </Field>
        <ToggleGrid>
          <ToggleRow label="Show hotel GSTIN" checked={inv.showGSTIN} onChange={(v) => setInv({ showGSTIN: v })} />
          <ToggleRow label="Show SAC / HSN codes" checked={inv.showSacHsnBreakdown} onChange={(v) => setInv({ showSacHsnBreakdown: v })} />
          <ToggleRow label="Show CGST / SGST split" checked={inv.showDetailedTaxBreakdown} onChange={(v) => setInv({ showDetailedTaxBreakdown: v })} />
          <ToggleRow label="Print guest address" checked={inv.showGuestAddress} onChange={(v) => setInv({ showGuestAddress: v })} />
          <ToggleRow label="Round off totals" description="Round the grand total to the nearest rupee and show the round-off line." checked={inv.roundOffTotals} onChange={(v) => setInv({ roundOffTotals: v })} />
        </ToggleGrid>
        <p className="text-xs text-muted-foreground">
          The invoice logo is set in <GoTo tab="branding" section="logos">Branding</GoTo>.
        </p>
      </SettingsSection>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Night audit
// ---------------------------------------------------------------------------

export const NightAuditTab: React.FC = () => {
  const C = 'night-audit';
  const [na, setNa] = useSettingsSection('nightAudit');
  const businessDate = useSettingsStore((s) => s.data.businessDate);
  const { businessDate: appDate } = useAppDate();
  const current = businessDate?.currentBusinessDate || appDate;

  return (
    <div className="space-y-6">
      <SettingsSection categoryId={C} id="business-date" title="Business date" description="The date all charges post to. Only a completed night audit moves it forward.">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-cream/40 p-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Current business date</dt>
            <dd className="mt-1 font-mono text-xl font-bold text-ink">{current || '—'}</dd>
          </div>
          <div className="rounded-lg border border-border bg-cream/40 p-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Last night audit</dt>
            <dd className="mt-1 font-mono text-sm font-semibold text-ink">{businessDate?.lastNightAuditTimestamp || 'See Night audit page'}</dd>
          </div>
        </dl>
        <Note>To protect the ledger, the business date cannot be edited by hand. Run the audit from the Night audit page.</Note>
      </SettingsSection>

      <SettingsSection categoryId={C} id="schedule" title="Audit schedule">
        <ToggleGrid>
          <ToggleRow label="Start the audit automatically" description="Runs unattended at the cutoff time if all checks pass." checked={na.autoStartAudit} onChange={(v) => setNa({ autoStartAudit: v })}>
            <Field label="Cutoff time" hint="Usually between midnight and 4 AM.">
              {(p) => <TimeInput {...p} value={na.auditCutoffTime} onChange={(v) => setNa({ auditCutoffTime: v })} />}
            </Field>
          </ToggleRow>
          <ToggleRow label="Move to the next business date when the audit succeeds" checked={na.autoAdvanceBusinessDateUponSuccess} onChange={(v) => setNa({ autoAdvanceBusinessDateUponSuccess: v })} />
          <ToggleRow label="Post room and tax charges" description="Adds tonight's room rent to every in-house folio." checked={na.autoPostRoomCharges} onChange={(v) => setNa({ autoPostRoomCharges: v })} />
          <ToggleRow label="Mark no-shows" description="Arrivals not checked in by the audit are marked no-show and the no-show charge applies." checked={na.autoMarkNoShows} onChange={(v) => setNa({ autoMarkNoShows: v })} />
        </ToggleGrid>
      </SettingsSection>

      <SettingsSection categoryId={C} id="safeguards" title="Checks before closing the day" description="The audit stops until each enabled check passes.">
        <ToggleGrid>
          <ToggleRow label="Cash drawer balanced" description="Counted cash must match what the system expects." checked={na.mandatoryCashReconciliation} onChange={(v) => setNa({ mandatoryCashReconciliation: v })} />
          <ToggleRow label="Card machine batch settled" description="The day's card and UPI settlement must be closed." checked={na.mandatoryPaymentReconciliation} onChange={(v) => setNa({ mandatoryPaymentReconciliation: v })} />
          <ToggleRow label="No unposted charges" description="Room or restaurant charges waiting to be posted block the audit." checked={na.blockAuditOnUnpostedCharges} onChange={(v) => setNa({ blockAuditOnUnpostedCharges: v })} />
          <ToggleRow label="Folios balance exactly" description="Debits and credits must match to the paisa." checked={na.blockAuditOnOpenFolioDiscrepancies} onChange={(v) => setNa({ blockAuditOnOpenFolioDiscrepancies: v })} />
        </ToggleGrid>
      </SettingsSection>
    </div>
  );
};
