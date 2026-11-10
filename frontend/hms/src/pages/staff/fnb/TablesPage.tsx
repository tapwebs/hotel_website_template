import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { Ban, CalendarClock, Copy, Download, ExternalLink, Pencil, Plus, Printer, QrCode, RefreshCw, Search, Trash2, Users } from 'lucide-react';
import { fnbService } from '../../../services/fnbService';
import { useAuthStore } from '../../../stores/authStore';
import type { Section, TableReservation } from '../../../types/fnb';
import type { POSTable } from '../../../types/pms';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { LoadingState } from '../../../components/common/LoadingState';
import { ErrorNote, MenuAction, MoreMenu, Segmented, rupees, titleCase } from './fnbUi';
import { textMatch } from './search';

const field = 'min-h-10 rounded-lg border border-input bg-card px-3 text-sm font-normal text-ink';
import { buildTableDiningQrUrl } from '../../../site/features/qrhub/lib/qrUrl';

const linkFor = (token: string) => buildTableDiningQrUrl(token);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const TONE: Record<POSTable['status'], string> = {
  AVAILABLE: 'border-emerald-200 bg-emerald-50 text-emerald-900', SEATED: 'border-amber-300 bg-amber-50 text-amber-900',
  ORDERED: 'border-burgundy/40 bg-burgundy/10 text-burgundy', BILLED: 'border-sky-300 bg-sky-50 text-sky-900',
  CLEANING: 'border-violet-300 bg-violet-50 text-violet-900', MAINTENANCE: 'border-slate-300 bg-slate-100 text-slate-600',
};

function printSticker(t: POSTable, qr: string, propertyName: string) {
  const w = window.open('', '_blank', 'width=420,height=620');
  if (!w) return;
  w.document.write(`<!doctype html><title>Table ${esc(t.tableNumber)}</title>
<style>body{font-family:Georgia,serif;text-align:center;margin:0;padding:32px;color:#2b1a14}h1{font-size:26px;margin:0 0 4px}p{margin:6px 0;font-family:system-ui,sans-serif;font-size:14px}img{width:260px;height:260px;margin:18px 0}</style>
<h1>${esc(propertyName)}</h1><p>Table ${esc(t.tableNumber)}</p><img alt="QR code to order at this table" src="${qr}"><p><b>Scan to see the menu and order</b></p><p>Pay at the counter with your order code</p>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

/** Tables & QR (from TapMenu) plus floor status and table reservations. */
export const TablesPage: React.FC = () => {
  const [tab, setTab] = useState<'floor' | 'reservations'>('floor');
  return (
    <div className="grid gap-4">
      <Segmented label="Tables view" className="justify-self-start" value={tab} onChange={setTab}
        options={[{ id: 'floor', label: 'Floor & QR' }, { id: 'reservations', label: 'Reservations' }]} />
      {tab === 'floor' ? <Floor /> : <Reservations />}
    </div>
  );
};

const Floor: React.FC = () => {
  const qc = useQueryClient();
  const canEdit = useAuthStore((s) => s.hasPermission)('MANAGE_SETTINGS');
  const propertyName = useAuthStore((s) => s.session?.activePropertyName) ?? 'TapMenu';
  const tables = useQuery({ queryKey: ['fnb', 'tables'], queryFn: fnbService.tables, refetchInterval: () => (document.hidden ? 45_000 : 10_000) });
  const sections = useQuery({ queryKey: ['fnb', 'sections'], queryFn: fnbService.sections });
  const [sectionFilter, setSectionFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ id?: string; tableNumber: string; capacity: string; sectionId: string } | null>(null);
  const [qrFor, setQrFor] = useState<POSTable | null>(null);
  const done = () => qc.invalidateQueries({ queryKey: ['fnb'] });

  const save = useMutation({
    mutationFn: (e: NonNullable<typeof editing>) => {
      const body = { tableNumber: e.tableNumber.trim(), capacity: Number(e.capacity) || 4, sectionId: e.sectionId || null };
      return e.id ? fnbService.editTable(e.id, body) : fnbService.addTable(body);
    },
    onSuccess: () => { setEditing(null); done(); },
  });
  const del = useMutation({ mutationFn: (id: string) => fnbService.deleteTable(id), onSuccess: done });
  const reset = useMutation({ mutationFn: (id: string) => fnbService.resetTableQr(id), onSuccess: done });
  const status = useMutation({ mutationFn: (v: { id: string; s: 'AVAILABLE' | 'SEATED' | 'CLEANING' | 'MAINTENANCE' }) => fnbService.setTableStatus(v.id, v.s), onSuccess: done });
  const addSection = useMutation({ mutationFn: (n: string) => fnbService.addSection(n), onSuccess: done });
  const renameSection = useMutation({ mutationFn: (v: { id: string; n: string }) => fnbService.renameSection(v.id, v.n), onSuccess: done });
  const delSection = useMutation({ mutationFn: (id: string) => fnbService.deleteSection(id), onSuccess: done });

  const secName = (t: POSTable) => sections.data?.find((s) => s.id === t.sectionId)?.name ?? titleCase(t.section);
  const shown = (tables.data ?? []).filter((t) => (sectionFilter === 'all' || t.sectionId === sectionFilter) && (!search || textMatch([t.tableNumber, secName(t), t.status], search)));
  const seats = (tables.data ?? []).reduce((n, t) => n + t.capacity, 0);

  if (tables.isLoading) return <LoadingState message="Loading tables…" subtext="" />;
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        <b className="text-ink">{(tables.data ?? []).filter((t) => ['SEATED', 'ORDERED', 'BILLED'].includes(t.status)).length}</b> of {tables.data?.length ?? 0} tables occupied · {seats} seats · {sections.data?.length ?? 0} sections
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 flex-wrap gap-2" role="group" aria-label="Sections">
          <button aria-pressed={sectionFilter === 'all'} onClick={() => setSectionFilter('all')} className={`min-h-9 rounded-full border px-3 text-sm font-semibold ${sectionFilter === 'all' ? 'border-burgundy bg-burgundy text-ivory' : 'border-border bg-ivory text-walnut'}`}>All</button>
          {(sections.data ?? []).map((s: Section) => (
            <span key={s.id} className="inline-flex items-center">
              <button aria-pressed={sectionFilter === s.id} onClick={() => setSectionFilter(s.id)} className={`min-h-9 rounded-full border px-3 text-sm font-semibold ${sectionFilter === s.id ? 'border-burgundy bg-burgundy text-ivory' : 'border-border bg-ivory text-walnut'}`}>{s.name}</button>
              {canEdit && sectionFilter === s.id && (
                <>
                  <Button size="icon" variant="ghost" aria-label={`Rename ${s.name}`} onClick={() => { const n = window.prompt('Section name', s.name); if (n?.trim()) renameSection.mutate({ id: s.id, n }); }}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={`Delete ${s.name}`} onClick={() => window.confirm(`Delete section ${s.name}? Its tables move to no section.`) && delSection.mutate(s.id)}><Trash2 className="size-4" /></Button>
                </>
              )}
            </span>
          ))}
          {canEdit && <Button size="sm" variant="outline" onClick={() => { const n = window.prompt('New section, e.g. Rooftop'); if (n?.trim()) addSection.mutate(n); }}><Plus className="size-3.5" /> Section</Button>}
        </div>
        <label className="relative">
          <span className="sr-only">Search tables</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tables" className="min-h-10 w-48 rounded-full border border-input bg-card pr-3 pl-9 text-sm" />
        </label>
        {canEdit && <Button onClick={() => { save.reset(); setEditing({ tableNumber: '', capacity: '4', sectionId: sectionFilter !== 'all' ? sectionFilter : '' }); }}><Plus className="size-4" /> Add table</Button>}
      </div>
      <ErrorNote error={del.error ?? reset.error ?? status.error ?? addSection.error ?? renameSection.error ?? delSection.error} />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((t) => (
          <li key={t.id} className={`grid gap-3 rounded-xl border p-4 ${TONE[t.status]}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-bold">Table {t.tableNumber}</p>
                <p className="flex items-center gap-1 text-xs opacity-80"><Users className="size-3.5" /> {t.capacity} seats · {secName(t)}</p>
              </div>
              <span className="grid justify-items-end gap-1">
                <Badge size="sm" variant="outline">{titleCase(t.status)}</Badge>
                {!!t.activeOrderTotalPaise && <span className="text-xs font-semibold">{rupees(t.activeOrderTotalPaise)} open</span>}
                {!!t.seatedMinutes && <span className="text-xs">{t.seatedMinutes < 90 ? `${t.seatedMinutes} min` : `${Math.floor(t.seatedMinutes / 60)} h ${t.seatedMinutes % 60} min`} seated</span>}
              </span>
            </div>
            {/* One main action for the table's current state; the rest live under "More" */}
            <div className="flex items-center gap-1.5">
              {t.status === 'AVAILABLE' && <Button size="sm" variant="outline" onClick={() => status.mutate({ id: t.id, s: 'SEATED' })}>Seat guests</Button>}
              {['BILLED', 'SEATED', 'CLEANING'].includes(t.status) && !t.activeOrderId && <Button size="sm" variant="outline" onClick={() => status.mutate({ id: t.id, s: t.status === 'BILLED' ? 'CLEANING' : 'AVAILABLE' })}>{t.status === 'BILLED' ? 'Guests left · clean' : 'Mark available'}</Button>}
              {t.status === 'MAINTENANCE' && <Button size="sm" variant="outline" onClick={() => status.mutate({ id: t.id, s: 'AVAILABLE' })}>Unblock</Button>}
              <Button size="sm" variant="ghost" disabled={!t.qrToken} onClick={() => setQrFor(t)}><QrCode className="size-3.5" /> QR</Button>
              <span className="flex-1" />
              <MoreMenu label={`More for table ${t.tableNumber}`}>
                {t.qrToken && <MenuAction href={linkFor(t.qrToken)} icon={<ExternalLink className="size-4" />}>Preview guest menu</MenuAction>}
                {t.status !== 'MAINTENANCE' && !t.activeOrderId && <MenuAction icon={<Ban className="size-4" />} onClick={() => status.mutate({ id: t.id, s: 'MAINTENANCE' })}>Block table</MenuAction>}
                {canEdit && <MenuAction icon={<Pencil className="size-4" />} onClick={() => { save.reset(); setEditing({ id: t.id, tableNumber: t.tableNumber, capacity: String(t.capacity), sectionId: t.sectionId ?? '' }); }}>Edit table</MenuAction>}
                {canEdit && <MenuAction icon={<RefreshCw className="size-4" />} onClick={() => window.confirm(`Reset the QR for table ${t.tableNumber}? Printed stickers will stop working.`) && reset.mutate(t.id)}>Reset QR</MenuAction>}
                {canEdit && <MenuAction danger icon={<Trash2 className="size-4" />} onClick={() => window.confirm(`Delete table ${t.tableNumber}?`) && del.mutate(t.id)}>Delete table</MenuAction>}
              </MoreMenu>
            </div>
          </li>
        ))}
      </ul>
      {!shown.length && <p className="py-10 text-center text-sm text-muted-foreground">No tables found.</p>}

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit table' : 'Add table'} maxWidth="md">
        {editing && (
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (editing.tableNumber.trim()) save.mutate(editing); }}>
            <label className="grid gap-1 text-sm font-semibold text-walnut">Table number<input required maxLength={20} value={editing.tableNumber} onChange={(e) => setEditing({ ...editing, tableNumber: e.target.value })} className={field} /></label>
            <label className="grid gap-1 text-sm font-semibold text-walnut">Seats<input type="number" min={1} max={40} value={editing.capacity} onChange={(e) => setEditing({ ...editing, capacity: e.target.value })} className={field} /></label>
            <label className="grid gap-1 text-sm font-semibold text-walnut">Section
              <select value={editing.sectionId} onChange={(e) => setEditing({ ...editing, sectionId: e.target.value })} className={field}>
                <option value="">No section</option>
                {(sections.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <ErrorNote error={save.error} />
            <Button type="submit" isLoading={save.isPending}>{editing.id ? 'Save' : 'Add table'}</Button>
          </form>
        )}
      </Modal>
      <QrModal table={qrFor} propertyName={propertyName} onClose={() => setQrFor(null)} />
    </div>
  );
};

const QrModal: React.FC<{ table: POSTable | null; propertyName: string; onClose: () => void }> = ({ table, propertyName, onClose }) => {
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setQr('');
    if (table?.qrToken) QRCode.toDataURL(linkFor(table.qrToken), { width: 720, margin: 2, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr(''));
  }, [table?.qrToken]);
  if (!table?.qrToken) return null;
  const url = linkFor(table.qrToken);
  return (
    <Modal isOpen={!!table} onClose={onClose} title={`QR code · Table ${table.tableNumber}`} maxWidth="md">
      <div className="grid justify-items-center gap-3">
        {qr ? <img src={qr} alt={`QR code for table ${table.tableNumber}`} className="size-64 rounded-lg border border-border" /> : <div className="size-64 rounded-lg bg-gold-soft/30" />}
        <code className="max-w-full truncate text-xs text-muted-foreground">{url}</code>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={async () => { await navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}><Copy className="size-4" /> {copied ? 'Copied' : 'Copy link'}</Button>
          <a href={qr} download={`table-${table.tableNumber}-qr.png`} className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-ivory px-4 text-sm font-medium text-walnut"><Download className="size-4" /> Download PNG</a>
          <Button disabled={!qr} onClick={() => printSticker(table, qr, propertyName)}><Printer className="size-4" /> Print sticker</Button>
        </div>
      </div>
    </Modal>
  );
};

const STATUS_TONE: Record<TableReservation['status'], 'info' | 'success' | 'destructive' | 'warning' | 'default'> = {
  BOOKED: 'info', SEATED: 'success', CANCELLED: 'destructive', NO_SHOW: 'warning', COMPLETED: 'default',
};
const today = () => new Date().toLocaleDateString('en-CA');

const Reservations: React.FC = () => {
  const qc = useQueryClient();
  const [day, setDay] = useState(today());
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<{ guestName: string; phone: string; partySize: string; time: string; durationMinutes: string; tableId: string; roomNumber: string; notes: string } | null>(null);
  const list = useQuery({ queryKey: ['fnb', 'reservations', day], queryFn: () => fnbService.reservations(day) });
  const tables = useQuery({ queryKey: ['fnb', 'tables'], queryFn: fnbService.tables });
  const done = () => qc.invalidateQueries({ queryKey: ['fnb'] });
  const add = useMutation({
    mutationFn: (f: NonNullable<typeof form>) => fnbService.addReservation({
      guestName: f.guestName.trim(), phone: f.phone || undefined, partySize: Number(f.partySize) || 2,
      reservedFor: new Date(`${day}T${f.time}`).toISOString(), durationMinutes: Number(f.durationMinutes) || 90,
      tableId: f.tableId || undefined, roomNumber: f.roomNumber || undefined, notes: f.notes || undefined,
    }),
    onSuccess: () => { setForm(null); done(); },
  });
  const update = useMutation({ mutationFn: (v: { id: string; patch: Partial<TableReservation> }) => fnbService.updateReservation(v.id, v.patch), onSuccess: done });
  const rows = useMemo(() => (list.data ?? [])
    .filter((r) => new Date(r.reservedFor).toLocaleDateString('en-CA') === day)
    .filter((r) => !search || textMatch([r.guestName, r.phone, r.tableNumber, r.roomNumber, r.notes], search)), [list.data, day, search]);
  const bigEnough = (form ? (tables.data ?? []).filter((t) => t.capacity >= (Number(form.partySize) || 1)) : []);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-walnut"><CalendarClock className="size-4" />
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={field} />
        </label>
        <label className="relative flex-1">
          <span className="sr-only">Search reservations</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guest, phone, table" className="min-h-10 w-full rounded-full border border-input bg-card pr-3 pl-9 text-sm" />
        </label>
        <Button onClick={() => { add.reset(); setForm({ guestName: '', phone: '', partySize: '2', time: '19:30', durationMinutes: '90', tableId: '', roomNumber: '', notes: '' }); }}><Plus className="size-4" /> New reservation</Button>
      </div>
      <ErrorNote error={list.error ?? update.error} />
      {list.isLoading ? <LoadingState message="Loading reservations…" subtext="" /> : !rows.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No reservations for this day.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-ivory">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="w-16 font-mono text-lg font-semibold text-ink">{new Date(r.reservedFor).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{r.guestName} <span className="font-normal text-muted-foreground">· {r.partySize} guests{r.roomNumber ? ` · Room ${r.roomNumber}` : ''}</span></p>
                <p className="text-xs text-muted-foreground">{r.tableNumber ? `Table ${r.tableNumber}` : 'No table yet'} · {r.durationMinutes} min{r.phone ? ` · ${r.phone}` : ''}{r.notes ? ` · ${r.notes}` : ''}</p>
              </div>
              <Badge size="sm" variant={STATUS_TONE[r.status]}>{titleCase(r.status)}</Badge>
              {r.status === 'BOOKED' && (
                <span className="flex flex-wrap gap-1.5">
                  <select aria-label="Assign table" value={r.tableId ?? ''} onChange={(e) => update.mutate({ id: r.id, patch: { tableId: e.target.value || null } })} className={`${field} min-h-8 text-xs`}>
                    <option value="">Table…</option>
                    {(tables.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.tableNumber} ({t.capacity})</option>)}
                  </select>
                  <Button size="sm" disabled={!r.tableId} onClick={() => update.mutate({ id: r.id, patch: { status: 'SEATED' } })}>Seat</Button>
                  <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: r.id, patch: { status: 'NO_SHOW' } })}>No-show</Button>
                  <Button size="sm" variant="ghost" onClick={() => window.confirm('Cancel this reservation?') && update.mutate({ id: r.id, patch: { status: 'CANCELLED' } })}>Cancel</Button>
                </span>
              )}
              {r.status === 'SEATED' && <Button size="sm" variant="outline" onClick={() => update.mutate({ id: r.id, patch: { status: 'COMPLETED' } })}>Done</Button>}
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={!!form} onClose={() => setForm(null)} title="New table reservation" maxWidth="md">
        {form && (
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (form.guestName.trim()) add.mutate(form); }}>
            <label className="grid gap-1 text-sm font-semibold text-walnut">Guest name<input required maxLength={100} value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} className={field} /></label>
            <div className="grid grid-cols-3 gap-3">
              <label className="grid gap-1 text-sm font-semibold text-walnut">Party<input type="number" min={1} max={40} value={form.partySize} onChange={(e) => setForm({ ...form, partySize: e.target.value })} className={field} /></label>
              <label className="grid gap-1 text-sm font-semibold text-walnut">Time<input type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className={field} /></label>
              <label className="grid gap-1 text-sm font-semibold text-walnut">Minutes<input type="number" min={15} max={480} step={15} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} className={field} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm font-semibold text-walnut">Phone<input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} /></label>
              <label className="grid gap-1 text-sm font-semibold text-walnut">Room (in-house)<input value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} className={field} /></label>
            </div>
            <label className="grid gap-1 text-sm font-semibold text-walnut">Table (seats {form.partySize}+)
              <select value={form.tableId} onChange={(e) => setForm({ ...form, tableId: e.target.value })} className={field}>
                <option value="">Assign later</option>
                {bigEnough.map((t) => <option key={t.id} value={t.id}>Table {t.tableNumber} · {t.capacity} seats</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-walnut">Notes<input maxLength={300} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Birthday, high chair, window seat…" className={field} /></label>
            <ErrorNote error={add.error} />
            <Button type="submit" isLoading={add.isPending}>Book table</Button>
          </form>
        )}
      </Modal>
    </div>
  );
};
