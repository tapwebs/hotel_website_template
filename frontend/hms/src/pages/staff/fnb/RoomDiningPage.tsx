import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { BedDouble, Copy, Download, ExternalLink, Printer, QrCode, RefreshCw, Search, User } from 'lucide-react';
import { fnbService } from '../../../services/fnbService';
import { useAuthStore } from '../../../stores/authStore';
import type { RoomQrCode } from '../../../types/fnb';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/common/EmptyState';
import { LoadingState } from '../../../components/common/LoadingState';
import { ErrorNote, MenuAction, MoreMenu } from './fnbUi';

import { buildRoomDiningQrUrl } from '../../../site/features/qrhub/lib/qrUrl';

const linkFor = (token: string) => buildRoomDiningQrUrl(token);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const qrFor = (token: string, width = 720) => QRCode.toDataURL(linkFor(token), { width, margin: 2, errorCorrectionLevel: 'M' });

/** One sticker per page: print a single room, or every room on the floor in one go. */
async function printStickers(rooms: RoomQrCode[], propertyName: string) {
  const w = window.open('', '_blank', 'width=480,height=700');
  if (!w) return;
  const pages = await Promise.all(rooms.map(async (r) => `<section><h1>${esc(propertyName)}</h1><p class="room">Room ${esc(r.roomNumber)}</p>
<img alt="QR code to order food to Room ${esc(r.roomNumber)}" src="${await qrFor(r.token)}"><p><b>Scan to see the menu and order</b></p><p class="small">Your order is added to your room bill</p></section>`));
  w.document.write(`<!doctype html><title>Room QR stickers</title><style>
@page{margin:12mm}body{font-family:Georgia,serif;text-align:center;margin:0;color:#2b1a14}
section{padding:28px 16px;break-after:page}section:last-child{break-after:auto}
h1{font-size:26px;margin:0 0 4px}p{margin:6px 0;font-family:system-ui,sans-serif;font-size:15px}.room{font-size:22px;font-weight:700}
.small{font-size:12px;color:#6b5a50}img{width:260px;height:260px;margin:14px 0}</style>${pages.join('')}`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

const RoomQrModal: React.FC<{ room: RoomQrCode | null; propertyName: string; onClose: () => void }> = ({ room, propertyName, onClose }) => {
  const [qr, setQr] = useState('');
  useEffect(() => { setQr(''); if (room) qrFor(room.token).then(setQr).catch(() => setQr('')); }, [room?.token]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!room) return null;
  return (
    <Modal isOpen onClose={onClose} title={`QR code · Room ${room.roomNumber}`} maxWidth="md">
      <div className="grid justify-items-center gap-4">
        {qr ? <img src={qr} alt={`QR code for room ${room.roomNumber}`} className="size-64 rounded-lg border border-border" /> : <div className="size-64 rounded-lg bg-gold-soft/30" />}
        <p className="break-all text-center font-mono text-xs text-muted-foreground">{linkFor(room.token)}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <a href={qr} download={`room-${room.roomNumber}-qr.png`} className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-ivory px-4 text-sm font-medium text-walnut"><Download className="size-4" /> Download PNG</a>
          <Button disabled={!qr} onClick={() => void printStickers([room], propertyName)}><Printer className="size-4" /> Print sticker</Button>
        </div>
      </div>
    </Modal>
  );
};

/** Room QR codes: one permanent code per room, placed in the room. Scanning it orders to whoever is staying there. */
export const RoomDiningPage: React.FC = () => {
  const qc = useQueryClient();
  const propertyName = useAuthStore((s) => s.session?.activePropertyName) ?? 'TapMenu';
  const canReset = useAuthStore((s) => s.hasPermission('MANAGE_SETTINGS'));
  const rooms = useQuery({ queryKey: ['fnb', 'roomsQr'], queryFn: fnbService.roomsQr, refetchInterval: 60_000 });
  const [search, setSearch] = useState('');
  const [floor, setFloor] = useState<number | 'ALL'>('ALL');
  const [open, setOpen] = useState<RoomQrCode | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const reset = useMutation({ mutationFn: (id: string) => fnbService.resetRoomQr(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['fnb', 'roomsQr'] }) });

  const all = rooms.data ?? [];
  const floors = useMemo(() => [...new Set(all.map((r) => r.floor))].sort((a, b) => a - b), [all]);
  const shown = useMemo(() => all.filter((r) =>
    (floor === 'ALL' || r.floor === floor) && (!search.trim() || `${r.roomNumber} ${r.roomTypeName} ${r.guestName ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))), [all, floor, search]);
  const copy = async (r: RoomQrCode) => { await navigator.clipboard?.writeText(linkFor(r.token)); setCopied(r.id); setTimeout(() => setCopied(null), 1500); };

  if (rooms.isLoading) return <LoadingState message="Loading rooms…" subtext="" />;
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Every room has its own QR code. Print it once and place it in the room: guests scan it to order, and the order is added to the bill of whoever is staying there.
        Orders wait for a captain or waiter to accept them. If nobody is checked in, the code shows a polite “not available”.
      </p>
      <ErrorNote error={rooms.error ?? reset.error} />
      {!all.length ? (
        <EmptyState icon={<BedDouble className="size-6" />} title="No rooms yet" description="Add rooms from Rooms & rates → Add rooms. Each one gets its QR code automatically." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-48 flex-1">
              <span className="sr-only">Search rooms</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search room, type or guest" className="min-h-10 w-full rounded-full border border-input bg-card pr-3 pl-9 text-sm" />
            </label>
            <div className="no-scrollbar flex max-w-full gap-1.5 overflow-x-auto" role="group" aria-label="Floor">
              {(['ALL', ...floors] as (number | 'ALL')[]).map((f) => (
                <button key={f} type="button" aria-pressed={floor === f} onClick={() => setFloor(f)}
                  className={`min-h-10 rounded-full border px-3 text-sm font-semibold whitespace-nowrap ${floor === f ? 'border-burgundy bg-burgundy text-ivory' : 'border-border bg-ivory text-walnut hover:bg-gold-soft/40'}`}>
                  {f === 'ALL' ? 'All floors' : f === 0 ? 'Ground' : `Floor ${f}`}
                </button>
              ))}
            </div>
            <Button variant="outline" isLoading={printing} disabled={!shown.length}
              onClick={async () => { setPrinting(true); try { await printStickers(shown, propertyName); } finally { setPrinting(false); } }}>
              <Printer className="size-4" /> Print {shown.length === all.length ? 'all' : shown.length} sticker{shown.length === 1 ? '' : 's'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{shown.length} of {all.length} rooms · {all.filter((r) => r.occupied).length} with a guest</p>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((r) => (
              <li key={r.id} className={`grid gap-3 rounded-xl border p-4 ${r.occupied ? 'border-amber-300 bg-amber-50/50' : 'border-border bg-ivory'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-ink">Room {r.roomNumber}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.roomTypeName} · {r.floor === 0 ? 'Ground floor' : `Floor ${r.floor}`}</p>
                  </div>
                  <MoreMenu label={`More for room ${r.roomNumber}`}>
                    <MenuAction href={linkFor(r.token)} icon={<ExternalLink className="size-4" />}>Preview guest menu</MenuAction>
                    {canReset && (
                      <MenuAction disabled={reset.isPending} icon={<RefreshCw className="size-4" />}
                        onClick={() => window.confirm(`Reset the QR for room ${r.roomNumber}? The printed sticker stops working and you will need to print a new one.`) && reset.mutate(r.id)}>Reset QR</MenuAction>
                    )}
                  </MoreMenu>
                </div>
                <p className={`flex items-center gap-1.5 text-sm ${r.occupied ? 'font-medium text-amber-900' : 'text-muted-foreground'}`}>
                  <User className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{r.occupied ? r.guestName : 'Vacant · ordering unavailable'}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setOpen(r)}><QrCode className="size-3.5" /> QR</Button>
                  <Button size="sm" variant="outline" onClick={() => void printStickers([r], propertyName)}><Printer className="size-3.5" /> Print</Button>
                  <Button size="sm" variant="ghost" onClick={() => void copy(r)}><Copy className="size-3.5" /> {copied === r.id ? 'Copied' : 'Copy link'}</Button>
                </div>
              </li>
            ))}
            {!shown.length && <li className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No rooms match.</li>}
          </ul>
        </>
      )}
      <RoomQrModal room={open} propertyName={propertyName} onClose={() => setOpen(null)} />
    </div>
  );
};
