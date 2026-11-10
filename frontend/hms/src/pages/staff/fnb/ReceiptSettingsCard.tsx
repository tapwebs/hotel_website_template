import React, { useEffect, useMemo, useState } from 'react';
import type { FnbConfig } from '../../../types/fnb';
import type { POSOrder } from '../../../types/pms';
import { Field, FieldGrid, NumberInput, SelectInput, SettingsSection, SubHeading, TextInput, ToggleGrid, ToggleRow, buttonSecondary } from '../settings/components/ui';
import { receiptHtml, receiptQrDataUrl } from './printing';

type Flag = { [K in keyof FnbConfig]: FnbConfig[K] extends boolean ? K : never }[keyof FnbConfig];

const SAMPLE: POSOrder = {
  id: 'sample', orderNumber: '#101', orderType: 'DINE_IN', tableNumber: 'T4', guestName: 'Sample Customer', status: 'BILLED',
  items: [
    { menuItemId: 'a', name: 'Classic Salted Twister', quantity: 2, pricePaise: 8945, station: 'MAIN_KITCHEN', variantName: 'Regular', taxPercent: 5 },
    { menuItemId: 'b', name: 'Complimentary Water', quantity: 1, pricePaise: 0, station: 'MAIN_KITCHEN', addOns: ['Chilled'], taxPercent: 5 },
  ],
  subtotalPaise: 17890, taxPaise: 894, totalPaise: 18784, taxPercent: 5, discountPaise: 0, paymentMethod: 'CASH', tenderedPaise: 20000,
  createdAt: new Date().toISOString(), paidAt: new Date().toISOString(), elapsedMinutes: 0,
} as POSOrder;

export interface HotelDefaults { address: string; phone: string; gstin: string; fssai: string }

/** Receipt settings with a live preview that updates as you type (before saving). */
export const ReceiptSettings: React.FC<{
  draft: FnbConfig;
  set: <K extends keyof FnbConfig>(k: K, v: FnbConfig[K]) => void;
  propertyName: string;
  hotel?: HotelDefaults;
}> = ({ draft, set, propertyName, hotel }) => {
  const C = 'receipts';
  const [qr, setQr] = useState<string | undefined>();
  useEffect(() => {
    let live = true;
    void receiptQrDataUrl({ showQr: draft.showQr, reviewUrl: draft.reviewUrl }).then((u) => live && setQr(u));
    return () => { live = false; };
  }, [draft.showQr, draft.reviewUrl]);
  // The sample bill follows the round-off setting so the preview matches real bills.
  const sample = useMemo(() => {
    const raw = SAMPLE.subtotalPaise + SAMPLE.taxPaise;
    const r = draft.roundOffTotal ? Math.floor((raw + 50) / 100) * 100 - raw : 0;
    return { ...SAMPLE, roundOffPaise: r, totalPaise: raw + r };
  }, [draft.roundOffTotal]);
  const html = useMemo(() => receiptHtml(sample, { ...draft, copies: 1 }, propertyName, qr), [sample, draft, propertyName, qr]);
  const sw = (k: Flag, label: string, description?: string) => (
    <ToggleRow key={k} label={label} description={description} checked={draft[k]} onChange={(v) => set(k, v as FnbConfig[Flag])} />
  );
  const fillFromHotel = () => {
    if (!hotel) return;
    set('receiptAddress', hotel.address);
    set('receiptPhone', hotel.phone);
    set('gstin', hotel.gstin);
    set('fssai', hotel.fssai);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <SettingsSection
          categoryId={C}
          id="header"
          title="Bill header"
          description="Who the bill is from. Usually the same as Hotel settings."
          actions={hotel && <button type="button" onClick={fillFromHotel} className={buttonSecondary}>Copy from Hotel settings</button>}
        >
          <FieldGrid cols={2}>
            <Field label="Header line" span={2}>
              {(p) => <TextInput {...p} maxLength={200} value={draft.receiptHeader} onChange={(v) => set('receiptHeader', v)} placeholder="e.g. Pure veg · Family restaurant" />}
            </Field>
            <Field label="Address" span={2}>
              {(p) => <TextInput {...p} maxLength={200} value={draft.receiptAddress} onChange={(v) => set('receiptAddress', v)} />}
            </Field>
            <Field label="Phone">{(p) => <TextInput {...p} maxLength={30} inputMode="tel" value={draft.receiptPhone} onChange={(v) => set('receiptPhone', v)} />}</Field>
            <Field label="GSTIN" issue="gstin">{(p) => <TextInput {...p} maxLength={15} mono uppercase value={draft.gstin} onChange={(v) => set('gstin', v.trim())} />}</Field>
            <Field label="FSSAI licence number">{(p) => <TextInput {...p} maxLength={20} mono value={draft.fssai} onChange={(v) => set('fssai', v.trim())} />}</Field>
          </FieldGrid>
          <ToggleGrid>
            {sw('showAddress', 'Show address')}{sw('showPhone', 'Show phone')}{sw('showGstin', 'Show GSTIN')}{sw('showFssai', 'Show FSSAI number')}
          </ToggleGrid>
        </SettingsSection>

        <SettingsSection categoryId={C} id="body" title="Bill details">
          <SubHeading>Order</SubHeading>
          <ToggleGrid>
            {sw('showOrderTime', 'Date and time')}{sw('showPaymentMethod', 'Payment method')}{sw('showCustomerName', 'Customer name')}
          </ToggleGrid>
          <SubHeading>Items and tax</SubHeading>
          <ToggleGrid>
            {sw('showUnitPrice', 'Price per unit (@ ₹ each)')}{sw('showTaxBreakup', 'CGST / SGST split')}
          </ToggleGrid>
        </SettingsSection>

        <SettingsSection categoryId={C} id="footer" title="Footer & QR code">
          <FieldGrid cols={2}>
            <Field label="Footer line">{(p) => <TextInput {...p} maxLength={200} value={draft.receiptFooter} onChange={(v) => set('receiptFooter', v)} />}</Field>
            <Field label="Extra line" hint="UPI ID, an offer or the Wi-Fi password.">{(p) => <TextInput {...p} maxLength={200} value={draft.extraFooter} onChange={(v) => set('extraFooter', v)} />}</Field>
          </FieldGrid>
          <ToggleRow label="Print a QR code" checked={draft.showQr} onChange={(v) => set('showQr', v)}>
            <FieldGrid cols={2}>
              <Field label="QR opens" issue="reviewUrl" hint="Leave empty to use your store link.">
                {(p) => <TextInput {...p} type="url" maxLength={300} placeholder="https://g.page/r/..." value={draft.reviewUrl} onChange={(v) => set('reviewUrl', v.trim())} />}
              </Field>
              <Field label="QR caption">{(p) => <TextInput {...p} maxLength={80} value={draft.qrCaption} onChange={(v) => set('qrCaption', v)} />}</Field>
            </FieldGrid>
          </ToggleRow>
        </SettingsSection>

        <SettingsSection categoryId={C} id="printer" title="Bill printing" description="Bills print at reception through the browser's printer.">
          <FieldGrid>
            <Field label="Paper width">
              {(p) => <SelectInput {...p} value={draft.paperWidth} onChange={(v) => set('paperWidth', v as FnbConfig['paperWidth'])} options={[{ value: '58mm', label: '58 mm' }, { value: '80mm', label: '80 mm' }]} />}
            </Field>
            <Field label="Text size">
              {(p) => <SelectInput {...p} value={draft.fontSize} onChange={(v) => set('fontSize', v as FnbConfig['fontSize'])} options={[{ value: 'small', label: 'Small' }, { value: 'normal', label: 'Normal' }, { value: 'large', label: 'Large' }]} />}
            </Field>
            <Field label="Copies">{(p) => <NumberInput {...p} min={1} max={5} value={draft.copies} onChange={(v) => set('copies', Math.min(5, Math.max(1, Math.round(v) || 1)))} />}</Field>
          </FieldGrid>
          {sw('autoPrint', 'Print the bill automatically after payment', 'Off: the cashier is asked, and can print from the order at any time.')}
        </SettingsSection>
      </div>
      <div className="xl:sticky xl:top-24 xl:self-start">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live preview</p>
        <iframe title="Receipt preview" srcDoc={html} sandbox="" className="h-[560px] w-full rounded-lg border border-border bg-white" />
        <p className="mt-1 text-xs text-muted-foreground">Sample bill. Changes show here before you save.</p>
      </div>
    </div>
  );
};
