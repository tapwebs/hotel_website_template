import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, BellRing, Bluetooth, BookOpen, CheckCircle, ChefHat, CreditCard, Gift, Loader2, Pencil, Percent, Plus, Printer, RotateCcw,
  Save, Search, Smartphone, Trash2, Users,
} from 'lucide-react';
import { fnbService } from '../../../services/fnbService';
import { useAuthStore } from '../../../stores/authStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import type { Coupon, CouponInput, FnbConfig, FnbConfigUpdate } from '../../../types/fnb';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { LoadingState } from '../../../components/common/LoadingState';
import {
  EmptyNote, Field, FieldGrid, IssuesContext, Note, NumberInput, SelectInput, SettingsSection, StatusPill, SubHeading, Switch, TextInput,
  ToggleGrid, ToggleRow, buttonPrimary, buttonSecondary, useIssue,
} from '../settings/components/ui';
import type { SettingsIssue } from '../settings/validation';
import { ErrorNote, rupees } from './fnbUi';
import { playTone } from './printing';
import { textMatch } from './search';
import { ReceiptSettings } from './ReceiptSettingsCard';
import { bluetoothSupported, forgetPrinter, pairPrinter, printTestPage, printerName } from './btPrinter';
import { setKotDevice, useKotDevice } from './kotDevice';

// ── navigation ──────────────────────────────────────────────────────────────
type TabId = 'tax' | 'payments' | 'kitchen' | 'guest' | 'receipts' | 'staff' | 'rewards' | 'menu';
const TABS: { id: TabId; label: string; description: string; icon: typeof Percent; keywords: string }[] = [
  { id: 'tax', label: 'Tax & discounts', description: 'Restaurant GST, bill round-off, discount limits and the manager PIN.', icon: Percent, keywords: 'gst tax round off discount manager pin limit' },
  { id: 'payments', label: 'Payments', description: 'Online payment for table orders and the UPI QR on the customer screen.', icon: CreditCard, keywords: 'online payment razorpay upi id payee customer display' },
  { id: 'kitchen', label: 'Kitchen & KOT', description: 'Order alert sound, automatic KOT printing and the Bluetooth kitchen printer.', icon: ChefHat, keywords: 'kitchen sound tone volume kot print bluetooth printer copies auto print' },
  { id: 'guest', label: 'Guest ordering', description: 'Phone ordering from table and room QR codes, and who must accept those orders.', icon: Smartphone, keywords: 'guest qr room table ordering accept acceptance ring alert captain waiter escalation minutes' },
  { id: 'receipts', label: 'Receipts & printing', description: 'What prints on the bill, with a live preview.', icon: Printer, keywords: 'receipt bill header footer gstin fssai qr paper width font copies print' },
  { id: 'staff', label: 'Staff & stations', description: 'Who does what in the restaurant, and the kitchen station.', icon: Users, keywords: 'staff role captain waiter kitchen station permission' },
  { id: 'rewards', label: 'Rewards & coupons', description: 'Ratings, the reward wheel, games and coupons.', icon: Gift, keywords: 'reward wheel spin prize coupon review rating game' },
  { id: 'menu', label: 'Menu', description: 'Dishes, categories, tables and QR codes.', icon: BookOpen, keywords: 'menu dishes category sold out tables qr' },
];

// ── validation ─────────────────────────────────────────────────────────────
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const UPI_RE = /^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9.-]{1,40}$/;
function validate(d: FnbConfig, pin: string): (SettingsIssue & { tab: TabId })[] {
  const out: (SettingsIssue & { tab: TabId })[] = [];
  const add = (field: string, tab: TabId, message: string) => out.push({ field, tab, category: 'property', message });
  if (pin && (pin.length < 4 || pin.length > 12)) add('managerPin', 'tax', 'The PIN must be 4 to 12 digits.');
  if (d.gstin && !GSTIN_RE.test(d.gstin)) add('gstin', 'receipts', 'GSTIN must be 15 characters, e.g. 08ABCDE1234F1Z5.');
  if (d.upiId && !UPI_RE.test(d.upiId)) add('upiId', 'payments', 'Enter a UPI ID like name@bank.');
  if (d.reviewUrl && !/^https?:\/\/\S+$/.test(d.reviewUrl)) add('reviewUrl', 'receipts', 'The link must start with https://');
  const chance = d.rewards.reduce((n, r) => n + (Number(r.probability) || 0), 0);
  if (d.spinWheelEnabled && d.rewards.length && chance !== 100) add('rewards', 'rewards', `Prize chances must add up to 100 (now ${chance}).`);
  return out;
}

/** Restaurant & kitchen settings. Saved data lives in property settings ("fnb"); coupons save on their own. */
export const FnbSettingsPage: React.FC = () => {
  const qc = useQueryClient();
  const isSuper = useAuthStore((s) => s.session?.role) === 'ROLE_SUPER_ADMIN';
  const propertyName = useAuthStore((s) => s.session?.activePropertyName) ?? 'TapMenu';
  const cfg = useQuery({ queryKey: ['fnb', 'config'], queryFn: fnbService.config });
  const [draft, setDraft] = useState<FnbConfig | null>(null);
  const [pin, setPin] = useState('');
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const tab = (TABS.find((t) => t.id === params.get('tab')) ?? TABS[0]).id;
  const go = (id: TabId) => { setParams({ tab: id }); setQuery(''); };

  // Hotel details, for "Copy from Hotel settings" on the receipt.
  const hotelData = useSettingsStore((s) => s.data);
  useEffect(() => { void useSettingsStore.getState().loadFromApi(); }, []);
  const hotel = {
    address: [hotelData.legalRegistration.registeredAddress, hotelData.legalRegistration.city, hotelData.legalRegistration.pinCode].filter(Boolean).join(', '),
    phone: hotelData.contact?.phone ?? '', gstin: hotelData.legalRegistration.gstin, fssai: hotelData.legalRegistration.fssaiNumber,
  };

  useEffect(() => { if (cfg.data && !draft) setDraft(cfg.data); }, [cfg.data, draft]);
  const dirty = !!draft && !!cfg.data && (JSON.stringify(draft) !== JSON.stringify(cfg.data) || !!pin);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = useMutation({
    mutationFn: () => {
      const { hasManagerPin: _h, ...rest } = draft!;
      return fnbService.saveConfig({ ...rest, ...(pin ? { managerPin: pin } : {}) } as FnbConfigUpdate);
    },
    onSuccess: (saved) => { setPin(''); setDraft(saved); qc.setQueryData(['fnb', 'config'], saved); void qc.invalidateQueries({ queryKey: ['fnb'] }); },
  });

  const issues = useMemo(() => (draft ? validate(draft, pin) : []), [draft, pin]);
  const hits = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return words.length ? TABS.filter((t) => words.every((w) => `${t.label} ${t.keywords}`.toLowerCase().includes(w))) : [];
  }, [query]);

  if (cfg.isLoading || !draft) return <LoadingState message="Loading settings…" subtext="" />;
  const set = <K extends keyof FnbConfig>(k: K, v: FnbConfig[K]) => { save.reset(); setDraft((d) => (d ? { ...d, [k]: v } : d)); };
  const active = TABS.find((t) => t.id === tab)!;
  const issueTabs = new Set(issues.map((i) => i.tab));
  const Icon = active.icon;

  return (
    <IssuesContext.Provider value={issues}>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Settings for the restaurant, kitchen and guest ordering at {propertyName}.</p>
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) go(hits[0].id); }}
              placeholder="Search settings" aria-label="Search restaurant settings"
              className="min-h-10 w-full rounded-lg border border-input bg-ivory pl-9 pr-3 text-sm outline-none focus-visible:border-burgundy focus-visible:ring-2 focus-visible:ring-burgundy/25" />
            {query && (
              <ul className="absolute right-0 left-0 z-30 mt-1 overflow-hidden rounded-lg border border-border bg-ivory shadow-lg">
                {hits.length ? hits.map((t) => (
                  <li key={t.id}><button type="button" onClick={() => go(t.id)} className="w-full px-3 py-2 text-left text-sm hover:bg-gold-soft/30">{t.label}</button></li>
                )) : <li className="p-3 text-sm text-muted-foreground">No settings match “{query}”.</li>}
              </ul>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-6">
          <div className="lg:hidden">
            <label htmlFor="fnb-settings-tab" className="sr-only">Settings category</label>
            <select id="fnb-settings-tab" value={tab} onChange={(e) => go(e.target.value as TabId)}
              className="min-h-11 w-full rounded-lg border border-input bg-ivory px-3 text-sm font-medium outline-none focus-visible:border-burgundy focus-visible:ring-2 focus-visible:ring-burgundy/25">
              {TABS.map((t) => <option key={t.id} value={t.id}>{t.label}{issueTabs.has(t.id) ? ' • needs attention' : ''}</option>)}
            </select>
          </div>
          <nav aria-label="Restaurant settings categories" className="hidden lg:block">
            <ul className="sticky top-24 space-y-0.5">
              {TABS.map((t) => {
                const I = t.icon;
                const on = t.id === tab;
                return (
                  <li key={t.id}>
                    <button type="button" onClick={() => go(t.id)} aria-current={on ? 'page' : undefined}
                      className={`flex min-h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy/40 ${on ? 'bg-burgundy font-semibold text-white' : 'text-walnut hover:bg-gold-soft/40'}`}>
                      <I className={`size-4 shrink-0 ${on ? 'text-white' : 'text-muted-foreground'}`} />
                      <span className="flex-1 truncate">{t.label}</span>
                      {issueTabs.has(t.id) && <span className="size-2 rounded-full bg-rose-500" aria-label="needs attention" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="min-w-0 space-y-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold-soft/50 text-burgundy"><Icon className="size-5" /></span>
              <div><h2 className="text-lg font-semibold text-ink">{active.label}</h2><p className="text-sm text-muted-foreground">{active.description}</p></div>
            </div>
            {tab === 'tax' && <TaxTab draft={draft} set={set} pin={pin} setPin={setPin} />}
            {tab === 'payments' && <PaymentsTab draft={draft} set={set} />}
            {tab === 'kitchen' && <KitchenTab draft={draft} set={set} propertyName={propertyName} />}
            {tab === 'guest' && <GuestTab draft={draft} set={set} />}
            {tab === 'receipts' && <ReceiptSettings draft={draft} set={set} propertyName={propertyName} hotel={hotel} />}
            {tab === 'staff' && <StaffTab />}
            {tab === 'rewards' && <RewardsTab draft={draft} set={set} isSuper={isSuper} />}
            {tab === 'menu' && <MenuTab />}
          </div>
        </div>

        {(dirty || save.isSuccess || save.isError) && (
          <aside aria-label="Save restaurant settings" className="sticky bottom-20 z-30 md:bottom-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-ink p-3 text-white shadow-2xl sm:p-4">
              <p role="status" aria-live="polite" className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                {save.isPending ? <><Loader2 className="size-4 animate-spin" /> Saving…</>
                  : save.isError ? <><AlertCircle className="size-4 text-rose-400" /> {(save.error as Error).message}</>
                  : issues.length ? <><AlertCircle className="size-4 text-amber-300" /> Fix {issues.length === 1 ? '1 issue' : `${issues.length} issues`} to save. <button type="button" onClick={() => go(issues[0].tab)} className="font-semibold underline">Show</button></>
                  : dirty ? <><span className="size-2 rounded-full bg-amber-400" /> Unsaved changes</>
                  : <><CheckCircle className="size-4 text-emerald-400" /> Settings saved.</>}
              </p>
              {dirty && (
                <div className="ml-auto flex gap-2">
                  <button type="button" onClick={() => { setDraft(cfg.data!); setPin(''); save.reset(); }} disabled={save.isPending}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-slate-800 px-3 text-sm text-slate-200 hover:bg-slate-700"><RotateCcw className="size-4" /> Discard</button>
                  <button type="button" onClick={() => save.mutate()} disabled={save.isPending || issues.length > 0}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-burgundy px-4 text-sm font-semibold text-white hover:bg-burgundy-deep disabled:cursor-not-allowed disabled:opacity-50"><Save className="size-4" /> Save changes</button>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </IssuesContext.Provider>
  );
};

type TabProps = { draft: FnbConfig; set: <K extends keyof FnbConfig>(k: K, v: FnbConfig[K]) => void };

// ── Tax & discounts ─────────────────────────────────────────────────────────
const TaxTab: React.FC<TabProps & { pin: string; setPin: (v: string) => void }> = ({ draft, set, pin, setPin }) => (
  <div className="space-y-6">
    <SettingsSection categoryId="tax" id="gst" title="GST" description="Applies to new restaurant orders. Dishes can carry their own rate in the menu.">
      <FieldGrid cols={2}>
        <Field label="Default restaurant GST" hint="Restaurant food is usually 5% (SAC 996331). Check with your accountant.">
          {(p) => <NumberInput {...p} min={0} max={28} unit="%" value={draft.gstPercent} onChange={(v) => set('gstPercent', Math.round(v))} />}
        </Field>
      </FieldGrid>
      <ToggleRow label="Round bills to the nearest rupee" description="Adds a “Round off” line to the bill. Charge-to-room and room-service orders are rounded on the room invoice instead."
        checked={draft.roundOffTotal} onChange={(v) => set('roundOffTotal', v)} />
      <Note>Restaurant bills use the rate here. The GST table in Hotel settings → Rates & taxes covers room invoices.</Note>
    </SettingsSection>
    <SettingsSection categoryId="tax" id="discounts" title="Discounts & manager PIN" description="Captains and admins give discounts. Waiters need the manager PIN for any discount.">
      <FieldGrid cols={2}>
        <Field label="Largest discount without the PIN" hint="Captains above this need the PIN. Admins never do.">
          {(p) => <NumberInput {...p} min={0} max={100} unit="%" value={draft.maxDiscountPercentWithoutPin} onChange={(v) => set('maxDiscountPercentWithoutPin', Math.round(v))} />}
        </Field>
        <Field label={draft.hasManagerPin ? 'Change manager PIN' : 'Set manager PIN'} issue="managerPin" hint={draft.hasManagerPin ? 'A PIN is set. Leave empty to keep it.' : 'No PIN yet. 4 to 12 digits.'}>
          {(p) => <TextInput {...p} type="password" inputMode="numeric" autoComplete="new-password" maxLength={12} value={pin} onChange={(v) => setPin(v.replace(/\D/g, ''))} />}
        </Field>
      </FieldGrid>
    </SettingsSection>
  </div>
);

// ── Payments ────────────────────────────────────────────────────────────────
const PaymentsTab: React.FC<TabProps> = ({ draft, set }) => (
  <div className="space-y-6">
    <SettingsSection categoryId="payments" id="online" title="Online payment">
      <ToggleRow label="Guests can pay online from a table QR" description="Razorpay. A paid order still waits for a captain to accept it before the kitchen sees it."
        checked={draft.onlinePayment} onChange={(v) => set('onlinePayment', v)} />
      <Note>Razorpay keys are set on the server. See Hotel settings → Payments for the gateway status.</Note>
    </SettingsSection>
    <SettingsSection categoryId="payments" id="upi" title="UPI QR on the customer screen" description="Shown on /customer-display when the cashier picks UPI.">
      <FieldGrid cols={2}>
        <Field label="UPI ID" issue="upiId">{(p) => <TextInput {...p} maxLength={80} placeholder="name@bank" value={draft.upiId ?? ''} onChange={(v) => set('upiId', v.trim())} />}</Field>
        <Field label="Payee name">{(p) => <TextInput {...p} maxLength={60} value={draft.upiPayeeName ?? ''} onChange={(v) => set('upiPayeeName', v)} />}</Field>
      </FieldGrid>
    </SettingsSection>
  </div>
);

// ── Kitchen & KOT ───────────────────────────────────────────────────────────
const KitchenTab: React.FC<TabProps & { propertyName: string }> = ({ draft, set, propertyName }) => {
  const device = useKotDevice();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (f: () => Promise<unknown>, ok: string) => f().then(() => setMsg({ ok: true, text: ok }), (e) => setMsg({ ok: false, text: (e as Error).message }));
  return (
    <div className="space-y-6">
      <SettingsSection categoryId="kitchen" id="kot" title="KOT printing" description="Each order prints one KOT. Dishes added later print as an “Additional KOT” with only the new dishes, and cancelled dishes print a cancellation slip.">
        <ToggleRow label="Print KOTs automatically" description="The kitchen printer device prints each KOT once, as soon as the order reaches the kitchen. Two kitchen screens never print the same KOT twice."
          checked={draft.autoPrintKot} onChange={(v) => set('autoPrintKot', v)} />
        <FieldGrid cols={2}>
          <Field label="KOT copies">{(p) => <NumberInput {...p} min={1} max={3} value={draft.kotCopies} onChange={(v) => set('kotCopies', Math.min(3, Math.max(1, Math.round(v) || 1)))} />}</Field>
        </FieldGrid>
        <ToggleRow label="Show prices on the KOT" checked={draft.kotShowPrices} onChange={(v) => set('kotShowPrices', v)} />
        <p className="text-xs text-muted-foreground">Bills are printed by hand at reception (see Receipts & printing). Reprint a KOT from its ticket on the kitchen screen.</p>
      </SettingsSection>

      <SettingsSection categoryId="kitchen" id="device" title="This device"
        description="Saved on this device only. Turn it on for the kitchen tablet that has the printer."
        actions={device.isKitchenPrinter ? <StatusPill tone={device.method === 'browser' || device.connected ? 'ok' : 'error'}>{device.method === 'browser' ? 'Browser printing' : device.connected ? 'Printer connected' : 'Printer not connected'}</StatusPill> : null}>
        <ToggleRow label="This device is the kitchen printer" description="It prints KOTs while the Kitchen screen is open." checked={device.isKitchenPrinter} onChange={(v) => setKotDevice({ isKitchenPrinter: v })}>
          <FieldGrid cols={2}>
            <Field label="Printer type">
              {(p) => <SelectInput {...p} value={device.method} onChange={(v) => setKotDevice({ method: v as 'bluetooth' | 'browser' })}
                options={[{ value: 'bluetooth', label: 'Bluetooth thermal printer' }, { value: 'browser', label: 'USB / network printer (browser print)' }]} />}
            </Field>
          </FieldGrid>
          {device.method === 'bluetooth' && (
            <div className="mt-3 space-y-3">
              {!bluetoothSupported() ? (
                <Note tone="warning">This browser cannot use Bluetooth. On the Android tablet, open the HMS in Chrome.</Note>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className={buttonPrimary} onClick={() => run(pairPrinter, 'Printer connected.')}>
                    <Bluetooth className="size-4" /> {printerName() ? 'Reconnect printer' : 'Pair printer'}
                  </button>
                  <button type="button" className={buttonSecondary} disabled={!device.connected} onClick={() => run(() => printTestPage(propertyName, draft.paperWidth), 'Test page sent.')}>
                    <Printer className="size-4" /> Print test page
                  </button>
                  {printerName() && <button type="button" className={buttonSecondary} onClick={() => { forgetPrinter(); setMsg(null); }}>Forget {printerName()}</button>}
                </div>
              )}
              <Note>Works with Bluetooth Low Energy (BLE) thermal printers in Chrome on Android. Turn the printer on and keep it near the tablet. If pairing does not find it, the printer may be Bluetooth Classic only, which browsers cannot reach.</Note>
            </div>
          )}
          {device.method === 'browser' && (
            <Note>To print without the print dialog, start Chrome on this device with <span className="font-mono">--kiosk-printing</span> and set the KOT printer as the default.</Note>
          )}
          {msg && <p role="status" className={`mt-2 text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>}
        </ToggleRow>
      </SettingsSection>

      <SettingsSection categoryId="kitchen" id="sound" title="Kitchen alert sound & sound effects" description="Default tone and sound cues for KDS, POS, printing, and ordering.">
        <FieldGrid cols={2}>
          <Field label="Tone">
            {(p) => <SelectInput {...p} value={draft.soundTone} onChange={(v) => set('soundTone', v as FnbConfig['soundTone'])}
              options={(['phone', 'bell', 'chime', 'siren', 'buzzer', 'synth'] as const).map((t) => ({ value: t, label: t === 'phone' ? 'Phone ring (Loud)' : t[0].toUpperCase() + t.slice(1) }))} />}
          </Field>
          <Field label={`Volume ${draft.soundVolume}%`}>
            {(p) => <input id={p.id} type="range" min={0} max={100} value={draft.soundVolume} onChange={(e) => set('soundVolume', Number(e.target.value))} className="mt-3 w-full accent-burgundy" />}
          </Field>
        </FieldGrid>
        <div className="mt-3 space-y-2">
          <ToggleRow label="Enable sound effects" description="Plays audio feedback on receipt/KOT print, order complete, and order accept." checked={draft.soundEffectsEnabled ?? true} onChange={(v) => set('soundEffectsEnabled', v)} />
        </div>
        <button type="button" className={buttonSecondary} onClick={() => playTone(draft.soundTone, draft.soundVolume)}><BellRing className="size-4" /> Test sound</button>
      </SettingsSection>
    </div>
  );
};

// ── Guest ordering ──────────────────────────────────────────────────────────
const GuestTab: React.FC<TabProps> = ({ draft, set }) => (
  <div className="space-y-6">
    <SettingsSection categoryId="guest" id="ordering" title="Phone ordering">
      <ToggleGrid>
        <ToggleRow label="Guests can order from table QR codes" checked={draft.tableOrdering} onChange={(v) => set('tableOrdering', v)} />
        <ToggleRow label="Guests can order from the QR in their room" description="Charged to the room bill. Print the stickers from Room dining."
          checked={draft.roomOrdering} onChange={(v) => set('roomOrdering', v)} />
        <ToggleRow label="Allow room QR orders when nobody is checked in" description="Every scan can order, even in a vacant room. These orders are not charged to a room bill; guests pay at the counter."
          checked={draft.roomOrderingVacant} onChange={(v) => set('roomOrderingVacant', v)} />
      </ToggleGrid>
    </SettingsSection>
    <SettingsSection categoryId="guest" id="accept" title="Accepting guest orders" description="Orders placed from /menu wait here before the kitchen sees them.">
      <ToggleRow label="Staff must accept guest orders" description="Off: guest orders go straight to the kitchen." checked={draft.guestOrderAcceptance} onChange={(v) => set('guestOrderAcceptance', v)}>
        <SubHeading>Who rings</SubHeading>
        <ol className="mt-2 grid gap-2 text-sm text-ink">
          <li className="flex gap-2"><StatusPill tone="warn">At once</StatusPill> Captains{draft.ringWaitersForGuestOrders ? ' and waiters' : ''} (loud order ring). Any of them can accept.</li>
          <li className="flex gap-2"><StatusPill tone="error">After {draft.acceptanceEscalationMinutes} min</StatusPill> Escalates to Admins and Super Admins too, if waiters/captains do not respond.</li>
        </ol>
        <div className="mt-3 space-y-3">
          <ToggleRow label="Keep ringing continuously until accepted" description="When active, rings repeatedly in short bursts so incoming orders cannot be missed." disabled={!draft.guestOrderAcceptance}
            checked={draft.keepRinging ?? true} onChange={(v) => set('keepRinging', v)} />
          <ToggleRow label="Waiters' devices ring too" description="Off: waiters still see and can accept guest orders, but only captains' devices ring." disabled={!draft.guestOrderAcceptance}
            checked={draft.ringWaitersForGuestOrders} onChange={(v) => set('ringWaitersForGuestOrders', v)} />
          <FieldGrid cols={2}>
            <Field label="Ring admins after">
              {(p) => <NumberInput {...p} min={1} max={30} unit="minutes" disabled={!draft.guestOrderAcceptance} value={draft.acceptanceEscalationMinutes} onChange={(v) => set('acceptanceEscalationMinutes', Math.min(30, Math.max(1, Math.round(v) || 1)))} />}
            </Field>
            <Field label="Repeat the alert every" hint="Until someone accepts.">
              {(p) => <NumberInput {...p} min={1} max={60} unit="seconds" disabled={!draft.guestOrderAcceptance} value={draft.alertRepeatSeconds} onChange={(v) => set('alertRepeatSeconds', Math.min(60, Math.max(1, Math.round(v) || 3)))} />}
            </Field>
          </FieldGrid>
        </div>
      </ToggleRow>
      <Note>Alerts ring on devices that have the HMS open. Staff can also allow pop-up alerts for when the tab is in the background.</Note>
    </SettingsSection>
  </div>
);

// ── Staff & stations ────────────────────────────────────────────────────────
const ROLES: { role: string; does: string }[] = [
  { role: 'Captain', does: 'Takes and accepts orders, adds dishes, cancels dishes or whole orders, moves tables, gives discounts up to the no-PIN limit, sees the kitchen screen. Rings first for guest orders.' },
  { role: 'Waiter', does: 'Takes orders, adds dishes to running orders and accepts guest orders. Discounts need a captain or the manager PIN. Cannot cancel dishes or move tables.' },
  { role: 'Kitchen staff', does: 'Kitchen screen only: start, ready and served.' },
  { role: 'Admin / Super admin', does: 'Everything, including these settings. Rings when a guest order waits too long.' },
];
const StaffTab: React.FC = () => (
  <div className="space-y-6">
    <SettingsSection categoryId="staff" id="roles" title="Restaurant roles" actions={<Link to="/app/staff" className={buttonSecondary}>Manage staff</Link>}>
      <dl className="divide-y divide-border rounded-lg border border-border">
        {ROLES.map((r) => (
          <div key={r.role} className="grid gap-1 p-3 sm:grid-cols-[10rem_1fr]">
            <dt className="text-sm font-semibold text-ink">{r.role}</dt><dd className="text-sm text-muted-foreground">{r.does}</dd>
          </div>
        ))}
      </dl>
    </SettingsSection>
    <SettingsSection categoryId="staff" id="stations" title="Kitchen station">
      <p className="text-sm text-ink">The restaurant has one station: <strong>Kitchen</strong>. Every dish goes to it and every cook sees every ticket.</p>
    </SettingsSection>
  </div>
);

const IssueText: React.FC<{ field: string }> = ({ field: f }) => {
  const msg = useIssue(f);
  return msg ? <p role="alert" className="text-xs font-medium text-rose-600">{msg}</p> : null;
};

// ── Rewards & coupons ───────────────────────────────────────────────────────
const RewardsTab: React.FC<TabProps & { isSuper: boolean }> = ({ draft, set, isSuper }) => {
  const chance = draft.rewards.reduce((n, r) => n + (Number(r.probability) || 0), 0);
  const upd = (n: number, patch: Partial<FnbConfig['rewards'][number]>) => set('rewards', draft.rewards.map((x, i) => (i === n ? { ...x, ...patch } : x)));
  const cell = 'min-h-10 w-full rounded-lg border border-input bg-ivory px-2 text-sm outline-none focus-visible:border-burgundy focus-visible:ring-2 focus-visible:ring-burgundy/25';
  return (
    <div className="space-y-6">
      <SettingsSection categoryId="rewards" id="engagement" title="After the meal">
        <ToggleGrid>
          <ToggleRow label="Ask guests for a rating" checked={draft.reviewsEnabled} onChange={(v) => set('reviewsEnabled', v)} />
          <ToggleRow label="Reward wheel after a rating" description="A win creates a single-use coupon for the next visit." checked={draft.spinWheelEnabled} onChange={(v) => set('spinWheelEnabled', v)} />
        </ToggleGrid>
      </SettingsSection>

      <SettingsSection categoryId="rewards" id="prizes" title="Reward wheel prizes" description={`Chances must add up to 100. Now: ${chance}.`}
        actions={<button type="button" className={buttonSecondary} onClick={() => set('rewards', [...draft.rewards, { id: crypto.randomUUID().slice(0, 8), label: 'New prize', type: 'percent', value: 5, probability: 0, emoji: '🎁' }])}><Plus className="size-4" /> Add prize</button>}>
        {!draft.rewards.length ? <EmptyNote title="No prizes" /> : (
          <ul className="grid gap-3">
            {draft.rewards.map((r, n) => (
              <li key={r.id} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] gap-2 rounded-lg border border-border bg-cream/40 p-2 sm:grid-cols-[3rem_minmax(0,1fr)_9rem_6rem_6rem_auto] sm:items-center">
                <input aria-label="Emoji" value={r.emoji ?? ''} onChange={(e) => upd(n, { emoji: e.target.value })} className={`${cell} text-center`} />
                <input aria-label="Prize label" value={r.label} onChange={(e) => upd(n, { label: e.target.value })} className={cell} />
                <button type="button" aria-label={`Remove ${r.label}`} onClick={() => set('rewards', draft.rewards.filter((_, i) => i !== n))}
                  className="grid size-10 place-items-center rounded-lg text-rose-700 hover:bg-rose-50 sm:order-last"><Trash2 className="size-4" /></button>
                <select aria-label="Prize type" value={r.type} onChange={(e) => upd(n, { type: e.target.value })} className={`${cell} col-span-3 sm:col-span-1`}>
                  <option value="percent">% off</option><option value="flat">₹ off</option><option value="free_item">Free item</option><option value="free_drink">Free drink</option><option value="bogo">Buy one get one</option><option value="none">No prize</option>
                </select>
                <label className="col-span-3 flex items-center gap-1 text-xs text-muted-foreground sm:col-span-1">Value
                  <input aria-label="Value" type="number" min={0} value={r.value} onChange={(e) => upd(n, { value: Number(e.target.value) })} className={cell} /></label>
                <label className="col-span-3 flex items-center gap-1 text-xs text-muted-foreground sm:col-span-1">Chance %
                  <input aria-label="Chance %" type="number" min={0} max={100} value={r.probability} onChange={(e) => upd(n, { probability: Number(e.target.value) })} className={cell} /></label>
              </li>
            ))}
          </ul>
        )}
        <IssueText field="rewards" />
      </SettingsSection>

      {isSuper ? <Coupons /> : (
        <SettingsSection categoryId="rewards" id="coupons" title="Coupons"><p className="text-sm text-muted-foreground">Coupons are managed by super admins.</p></SettingsSection>
      )}
    </div>
  );
};

const blankCoupon: CouponInput = { code: '', kind: 'PERCENT', value: 10, minOrderPaise: 0, maxDiscountPaise: null, description: '', categories: [], singleUse: false, expiresAt: null, isActive: true };
const field = 'min-h-10 w-full rounded-lg border border-input bg-ivory px-3 text-sm text-ink outline-none focus-visible:border-burgundy focus-visible:ring-2 focus-visible:ring-burgundy/25';

/** Coupons save immediately (not with the page's save bar). */
const Coupons: React.FC = () => {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['fnb', 'coupons'], queryFn: fnbService.coupons });
  const cats = useQuery({ queryKey: ['fnb', 'categories'], queryFn: fnbService.categories });
  const [editing, setEditing] = useState<{ id?: string; c: CouponInput } | null>(null);
  const [search, setSearch] = useState('');
  const done = () => qc.invalidateQueries({ queryKey: ['fnb', 'coupons'] });
  const save = useMutation({ mutationFn: (e: NonNullable<typeof editing>) => fnbService.saveCoupon(e.c, e.id), onSuccess: () => { setEditing(null); done(); } });
  const del = useMutation({ mutationFn: (id: string) => fnbService.deleteCoupon(id), onSuccess: done });
  const rows = (list.data ?? []).filter((c) => !search || textMatch([c.code, c.description, c.source], search));
  const value = (c: Coupon) => (c.kind === 'PERCENT' ? `${c.value}%` : rupees(c.value));
  const e = editing?.c;
  const setC = (patch: Partial<CouponInput>) => setEditing((x) => (x ? { ...x, c: { ...x.c, ...patch } } : x));

  return (
    <SettingsSection categoryId="rewards" id="coupons" title="Coupons" description="Guests enter these at checkout; cashiers at settlement. Reward-wheel coupons appear here too. Changes save straight away."
      actions={<button type="button" className={buttonPrimary} onClick={() => { save.reset(); setEditing({ c: blankCoupon }); }}><Plus className="size-4" /> New coupon</button>}>
      <label className="relative block">
        <span className="sr-only">Search coupons</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(ev) => setSearch(ev.target.value)} placeholder="Search coupons" className={`${field} pl-9`} />
      </label>
      <ErrorNote error={list.error ?? del.error} />
      <ul className="divide-y divide-border">
        {rows.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <span className="font-mono font-semibold text-ink">{c.code}</span>
            <Badge size="sm" variant="gold">{value(c)} off</Badge>
            {c.source !== 'ADMIN' && <Badge size="sm" variant="outline">{c.source.toLowerCase()}</Badge>}
            {!c.isActive && <Badge size="sm" variant="destructive">Off</Badge>}
            {c.usedAt && <Badge size="sm">Used</Badge>}
            <span className="min-w-40 flex-1 truncate text-muted-foreground">{c.description}{c.minOrderPaise ? ` · min ${rupees(c.minOrderPaise)}` : ''}{c.expiresAt ? ` · until ${new Date(c.expiresAt).toLocaleDateString('en-IN')}` : ''}</span>
            <Button size="icon" variant="ghost" aria-label={`Edit ${c.code}`} onClick={() => { save.reset(); setEditing({ id: c.id, c: { ...c } }); }}><Pencil className="size-4" /></Button>
            <Button size="icon" variant="ghost" aria-label={`Delete ${c.code}`} onClick={() => window.confirm(`Delete ${c.code}?`) && del.mutate(c.id)}><Trash2 className="size-4" /></Button>
          </li>
        ))}
        {!rows.length && <li className="py-4 text-center text-sm text-muted-foreground">No coupons yet.</li>}
      </ul>
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit coupon' : 'New coupon'} maxWidth="md">
        {e && (
          <form className="grid gap-3" onSubmit={(ev) => { ev.preventDefault(); save.mutate(editing!); }}>
            <label className="grid gap-1 text-sm font-semibold text-walnut">Code<input required minLength={3} maxLength={50} pattern="[A-Za-z0-9_-]+" value={e.code} onChange={(ev) => setC({ code: ev.target.value.toUpperCase() })} className={`${field} font-mono`} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm font-semibold text-walnut">Type
                <select value={e.kind} onChange={(ev) => setC({ kind: ev.target.value as Coupon['kind'] })} className={field}><option value="PERCENT">% off</option><option value="FLAT">₹ off</option></select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-walnut">{e.kind === 'PERCENT' ? 'Percent' : 'Amount (₹)'}
                <input type="number" min={1} value={e.kind === 'FLAT' ? e.value / 100 : e.value} onChange={(ev) => setC({ value: e.kind === 'FLAT' ? Math.round(Number(ev.target.value) * 100) : Number(ev.target.value) })} className={field} />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-walnut">Minimum bill (₹)<input type="number" min={0} value={e.minOrderPaise / 100} onChange={(ev) => setC({ minOrderPaise: Math.round(Number(ev.target.value) * 100) })} className={field} /></label>
              <label className="grid gap-1 text-sm font-semibold text-walnut">Cap (₹, optional)<input type="number" min={0} value={e.maxDiscountPaise ? e.maxDiscountPaise / 100 : ''} onChange={(ev) => setC({ maxDiscountPaise: ev.target.value ? Math.round(Number(ev.target.value) * 100) : null })} className={field} /></label>
            </div>
            <label className="grid gap-1 text-sm font-semibold text-walnut">Description<input maxLength={200} value={e.description} onChange={(ev) => setC({ description: ev.target.value })} className={field} /></label>
            <label className="grid gap-1 text-sm font-semibold text-walnut">Only for categories (none = whole bill)
              <select multiple value={e.categories} onChange={(ev) => setC({ categories: Array.from(ev.target.selectedOptions).map((o) => o.value) })} className={`${field} min-h-24`}>
                {(cats.data ?? []).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-walnut">Expires (optional)<input type="date" value={e.expiresAt ? e.expiresAt.slice(0, 10) : ''} onChange={(ev) => setC({ expiresAt: ev.target.value ? `${ev.target.value}T23:59:59+05:30` : null })} className={field} /></label>
            <label className="flex items-center justify-between gap-3 text-sm text-walnut">Single use <Switch aria-label="Single use" checked={e.singleUse} onChange={(v) => setC({ singleUse: v })} /></label>
            <label className="flex items-center justify-between gap-3 text-sm text-walnut">Active <Switch aria-label="Active" checked={e.isActive} onChange={(v) => setC({ isActive: v })} /></label>
            <ErrorNote error={save.error} />
            <Button type="submit" isLoading={save.isPending}>Save coupon</Button>
          </form>
        )}
      </Modal>
    </SettingsSection>
  );
};

// ── Menu ────────────────────────────────────────────────────────────────────
const MenuTab: React.FC = () => {
  const menu = useQuery({ queryKey: ['fnb', 'menu'], queryFn: fnbService.menu });
  const cats = useQuery({ queryKey: ['fnb', 'categories'], queryFn: fnbService.categories });
  const items = menu.data ?? [];
  const stats = [
    { label: 'Dishes', value: items.length },
    { label: 'Categories', value: cats.data?.length ?? 0 },
    { label: 'Sold out now', value: items.filter((i) => !i.isAvailable).length },
    { label: 'With their own GST rate', value: items.filter((i) => i.taxPercent != null).length },
  ];
  return (
    <div className="space-y-6">
      <SettingsSection categoryId="menu" id="summary" title="Menu" description="Dishes, prices, sizes, add-ons, categories and sold-out status are edited on the Menu page."
        actions={<Link to="/app/fnb/menu" className={buttonPrimary}><BookOpen className="size-4" /> Open menu</Link>}>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-cream/40 p-3">
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="text-xl font-semibold text-ink">{menu.isLoading ? '…' : s.value}</dd>
            </div>
          ))}
        </dl>
      </SettingsSection>
      <SettingsSection categoryId="menu" id="tables" title="Tables & QR codes" actions={<Link to="/app/fnb/tables" className={buttonSecondary}>Open tables</Link>}>
        <p className="text-sm text-muted-foreground">Add tables, group them into sections and reset a table's QR code on the Tables page.</p>
      </SettingsSection>
    </div>
  );
};
