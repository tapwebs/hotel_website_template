import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, Plus, Eye, Globe, Check, RefreshCw, X, ConciergeBell } from 'lucide-react';
import { reservationService } from '../../services/apiServices';
import { Reservation } from '../../types/pms';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/common/StatusBadge';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { LoadingState } from '../../components/common/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { usePmsUIStore } from '../../stores/pmsUIStore';
import { useAuthStore } from '../../stores/authStore';
import { listAdminBookings, updateAdminBooking } from '../../site/features/admin/bookingsApi';
import { BookingDetailDialog } from '../../site/features/admin/BookingDetailDialog';
import type { AdminBooking } from '../../site/features/admin/adminTypes';

import { formatKolkataDate } from '../../utils/dateUtils';

type Status = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
/** One row of the combined list: a hotel reservation, or a website booking that is not in the HMS yet. */
type Row =
  | { key: string; kind: 'hotel'; res: Reservation; web?: AdminBooking; status: Status }
  | { key: string; kind: 'web'; web: AdminBooking; status: Status };

const short = (ymd: string) => formatKolkataDate(ymd, { day: 'numeric', month: 'short' });

const SOURCES = [
  { id: 'ALL', label: 'All sources' },
  { id: 'HOTEL', label: 'Hotel' },
  { id: 'WEBSITE', label: 'Website' },
] as const;

/** Hotel reservations and website bookings in one list (the website's bookings that already synced into the HMS appear once). */
export const ReservationsPage: React.FC = () => {
  const openModal = usePmsUIStore((state) => state.openModal);
  const canWeb = useAuthStore((s) => s.hasPermission('VIEW_RESERVATIONS'));
  const qc = useQueryClient();
  const [sp] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(sp.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState<string>((sp.get('status') ?? 'ALL').toUpperCase());
  const [sourceFilter, setSourceFilter] = useState<(typeof SOURCES)[number]['id']>(sp.get('source') === 'website' ? 'WEBSITE' : 'ALL');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [selectedWeb, setSelectedWeb] = useState<AdminBooking | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [note, setNote] = useState<string>('');
  const [isActionProcessing, setIsActionProcessing] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const { data: reservations = [], isFetching, isLoading } = useQuery({
    queryKey: ['reservations'],
    queryFn: () => reservationService.getAll(),
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 5
  });
  // Website bookings come from the website backend; if it is down the hotel list still works.
  const web = useQuery({
    queryKey: ['website', 'bookings'],
    enabled: canWeb,
    queryFn: async () => {
      const r = await listAdminBookings({ page: 1, q: '', status: '', paymentStatus: '', range: { from: '2000-01-01', to: '2100-01-01' } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.items;
    },
    staleTime: 20_000,
    refetchInterval: 45_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  const rows = React.useMemo<Row[]>(() => {
    const hotelIds = new Set(reservations.map((r) => r.id));
    const hotelRefMap = new Map(
      reservations.filter((r) => r.externalBookingRef).map((r) => [r.externalBookingRef!, r.id])
    );
    const linked = new Map<string, AdminBooking>();
    for (const b of web.data ?? []) {
      if (b.externalHmsBookingId && hotelIds.has(b.externalHmsBookingId)) {
        linked.set(b.externalHmsBookingId, b);
      } else if (hotelRefMap.has(b.reference)) {
        linked.set(hotelRefMap.get(b.reference)!, b);
      }
    }
    const out: Row[] = reservations.map((res) => ({ key: `h:${res.id}`, kind: 'hotel', res, web: linked.get(res.id), status: res.status as Status }));
    for (const b of web.data ?? []) {
      if (b.externalHmsBookingId && hotelIds.has(b.externalHmsBookingId)) continue;
      if (hotelRefMap.has(b.reference)) continue;
      out.push({ key: `w:${b.id}`, kind: 'web', web: b, status: b.status.toUpperCase() as Status });
    }
    return out.sort((a, b) => (a.kind === 'hotel' ? a.res.checkIn : a.web.checkIn).localeCompare(b.kind === 'hotel' ? b.res.checkIn : b.web.checkIn)).reverse();
  }, [reservations, web.data]);

  const filtered = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return rows.filter((row) => {
      const ref = row.kind === 'hotel' ? row.res.bookingReference : row.web.reference;
      const name = row.kind === 'hotel' ? row.res.guestName : row.web.guest?.name ?? '';
      const phone = row.kind === 'hotel' ? row.res.guestPhone : row.web.guest?.phone ?? '';
      const mail = row.kind === 'hotel' ? row.res.guestEmail ?? '' : row.web.guest?.email ?? '';
      const matchesSearch = !q || [ref, name, phone, mail].some((f) => f.toLowerCase().includes(q)) || (row.kind === 'hotel' && row.web?.reference.toLowerCase().includes(q));
      const isWeb = row.kind === 'web' || Boolean(row.web) || (row.kind === 'hotel' && (row.res.source === 'DIRECT_WEB' || row.res.source === 'WEBSITE'));
      const matchesSource = sourceFilter === 'ALL' || (sourceFilter === 'WEBSITE' ? isWeb : !isWeb);
      const matchesStatus = statusFilter === 'ALL' || row.status === statusFilter;
      return matchesSearch && matchesSource && matchesStatus;
    });
  }, [rows, searchQuery, statusFilter, sourceFilter]);

  const confirmNow = async (b: AdminBooking) => {
    setConfirming(b.id);
    setNote('');
    const r = await updateAdminBooking(b.id, { status: 'confirmed' });
    setConfirming(null);
    if (r.ok) {
      setNote(`${b.reference} confirmed.`);
      void qc.invalidateQueries({ queryKey: ['website'] });
      void qc.invalidateQueries({ queryKey: ['reservations'] });
    } else setNote(r.error.message);
  };

  const confirmHotelNow = async (res: Reservation) => {
    setConfirming(res.id);
    setNote('');
    try {
      const matchingWeb = (web.data ?? []).find(
        (b) => (b.externalHmsBookingId && b.externalHmsBookingId === res.id) || (res.externalBookingRef && b.reference === res.externalBookingRef)
      );
      if (matchingWeb && matchingWeb.status === 'pending') {
        await updateAdminBooking(matchingWeb.id, { status: 'confirmed' });
      }
      await reservationService.confirmReservation(res.id);
      setNote(`${res.bookingReference} confirmed.`);
      void qc.invalidateQueries({ queryKey: ['reservations'] });
      void qc.invalidateQueries({ queryKey: ['website'] });
    } catch (err: any) {
      setNote(err.message || 'Failed to confirm reservation.');
    } finally {
      setConfirming(null);
    }
  };

  const handleConfirmReservation = async (res: Reservation) => {
    setIsActionProcessing(true);
    setModalFeedback(null);
    try {
      const matchingWeb = (web.data ?? []).find(
        (b) => (b.externalHmsBookingId && b.externalHmsBookingId === res.id) || (res.externalBookingRef && b.reference === res.externalBookingRef)
      );
      if (matchingWeb && matchingWeb.status === 'pending') {
        await updateAdminBooking(matchingWeb.id, { status: 'confirmed' });
      }
      const updated = await reservationService.confirmReservation(res.id);
      setSelectedReservation(updated);
      setModalFeedback({ kind: 'ok', text: `Booking ${res.bookingReference} confirmed successfully.` });
      void qc.invalidateQueries({ queryKey: ['reservations'] });
      void qc.invalidateQueries({ queryKey: ['website'] });
    } catch (err: any) {
      setModalFeedback({ kind: 'error', text: err.message || 'Failed to confirm booking.' });
    } finally {
      setIsActionProcessing(false);
    }
  };

  const handleRejectReservation = async (res: Reservation) => {
    setIsActionProcessing(true);
    setModalFeedback(null);
    try {
      const matchingWeb = (web.data ?? []).find(
        (b) => (b.externalHmsBookingId && b.externalHmsBookingId === res.id) || (res.externalBookingRef && b.reference === res.externalBookingRef)
      );
      if (matchingWeb && matchingWeb.status === 'pending') {
        await updateAdminBooking(matchingWeb.id, { status: 'cancelled' });
      }
      const updated = await reservationService.rejectReservation(res.id);
      setSelectedReservation(updated);
      setModalFeedback({ kind: 'ok', text: `Booking request ${res.bookingReference} rejected.` });
      void qc.invalidateQueries({ queryKey: ['reservations'] });
      void qc.invalidateQueries({ queryKey: ['website'] });
    } catch (err: any) {
      setModalFeedback({ kind: 'error', text: err.message || 'Failed to reject booking request.' });
    } finally {
      setIsActionProcessing(false);
    }
  };

  const handleCancelReservation = async (res: Reservation) => {
    if (!window.confirm(`Are you sure you want to cancel booking ${res.bookingReference}?`)) {
      return;
    }
    setIsActionProcessing(true);
    setModalFeedback(null);
    try {
      const matchingWeb = (web.data ?? []).find(
        (b) => (b.externalHmsBookingId && b.externalHmsBookingId === res.id) || (res.externalBookingRef && b.reference === res.externalBookingRef)
      );
      if (matchingWeb && matchingWeb.status !== 'cancelled') {
        await updateAdminBooking(matchingWeb.id, { status: 'cancelled' });
      }
      const updated = await reservationService.cancelBooking(res.id);
      if (updated) {
        setSelectedReservation(updated);
      }
      setModalFeedback({ kind: 'ok', text: `Booking ${res.bookingReference} has been cancelled.` });
      void qc.invalidateQueries({ queryKey: ['reservations'] });
      void qc.invalidateQueries({ queryKey: ['website'] });
    } catch (err: any) {
      setModalFeedback({ kind: 'error', text: err.message || 'Failed to cancel booking.' });
    } finally {
      setIsActionProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1>Bookings</h1>
            {(isFetching || web.isFetching) && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full font-medium animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" /> Syncing...
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Hotel reservations and website booking requests in one list</p>
        </div>
        <Button variant="gold" size="sm" onClick={() => openModal('NEW_RESERVATION')} className="text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" /> New Booking
        </Button>
      </div>
      {web.isError && canWeb && (
        <p role="status" className="rounded-xl border border-gold/60 bg-gold-soft/30 px-3 py-2 text-xs text-walnut">
          Website bookings are unavailable right now, so only hotel reservations are shown.
        </p>
      )}
      {note && <p role="status" className="rounded-xl border border-gold bg-gold-soft/40 px-3 py-2 text-xs font-semibold text-walnut">{note}</p>}
      {/* Filter and Search Bar */}
      <div className="bg-ivory p-4 rounded-2xl border border-border shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="w-full lg:w-80">
          <Input placeholder="Search reference, guest, phone, email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} icon={<Search className="w-4 h-4" />} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 w-full lg:w-auto text-xs">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Source">
            <span className="text-slate-400 mr-1 flex items-center gap-1"><Globe className="w-3 h-3" /> Source:</span>
            {SOURCES.filter((o) => canWeb || o.id !== 'WEBSITE').map((o) => (
              <button key={o.id} onClick={() => setSourceFilter(o.id)} aria-pressed={sourceFilter === o.id}
                className={`px-2.5 py-1 pointer-coarse:py-2.5 rounded-full font-medium transition-colors cursor-pointer ${sourceFilter === o.id ? 'bg-burgundy text-ivory' : 'bg-cream text-walnut hover:bg-gold-soft/40'}`}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Status">
            <span className="text-slate-400 mr-1 flex items-center gap-1"><Filter className="w-3 h-3" /> Status:</span>
            {(['ALL', 'CONFIRMED', 'PENDING', 'CANCELLED'] as const).map((st) => (
              <button key={st} onClick={() => setStatusFilter(st)} aria-pressed={statusFilter === st}
                className={`px-2.5 py-1 pointer-coarse:py-2.5 rounded-full font-medium transition-colors cursor-pointer ${statusFilter === st ? 'bg-burgundy text-ivory' : 'bg-cream text-walnut hover:bg-gold-soft/40'}`}>
                {st === 'ALL' ? 'All' : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Combined table */}
      <div className="bg-ivory rounded-2xl border border-border shadow-xs overflow-hidden">
        {isLoading && filtered.length === 0 ? (
          <LoadingState message="Fetching reservations ledger..." />
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No bookings match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-cream/60 border-b border-border text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-3 whitespace-nowrap">Reference</th>
                  <th className="py-3 px-3 min-w-44">Guest</th>
                  <th className="py-3 px-3">Source</th>
                  <th className="py-3 px-3">Stay</th>
                  <th className="py-3 px-3">Room</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Total</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((row) => {
                  if (row.kind === 'web') {
                    const b = row.web;
                    return (
                      <tr key={row.key} className="hover:bg-gold-soft/20 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-burgundy whitespace-nowrap">{b.reference}</td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-walnut block">{b.guest?.name ?? 'Deleted account'}</span>
                          <span className="text-[11px] text-slate-400 break-all">{b.guest?.phone ?? b.guest?.email}</span>
                        </td>
                        <td className="py-3 px-3"><Badge variant="gold" size="sm" className="text-[10px]"><Globe className="w-3 h-3" /> Website</Badge></td>
                        <td className="py-3 px-3">
                          <span className="font-medium text-slate-800 block whitespace-nowrap">{short(b.checkIn)} → {short(b.checkOut)}</span>
                          <span className="text-[11px] text-slate-400">{b.nights} Nights</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-slate-800 font-medium block whitespace-nowrap">{b.room.name} × {b.roomCount}</span>
                          <span className="text-[11px] text-amber-600 italic">Not in HMS yet</span>
                        </td>
                        <td className="py-3 px-3"><StatusBadge type="reservation" value={row.status} /></td>
                        <td className="py-3 px-3 text-right font-mono">
                          <span className="font-bold text-slate-900 block"><CurrencyDisplay amountPaise={b.totalAmount * 100} /></span>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">{b.paymentStatus === "pay_at_hotel" ? "Pay at hotel" : b.paymentStatus}</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {b.status === 'pending' && (
                              <Button size="sm" onClick={() => void confirmNow(b)} disabled={confirming === b.id} className="h-7 text-xs px-2">
                                <Check className="w-3.5 h-3.5 mr-1" /> {confirming === b.id ? '…' : 'Confirm'}
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setSelectedWeb(b)} className="h-7 text-xs px-2 text-slate-600 hover:text-slate-900">
                              <Eye className="w-3.5 h-3.5 mr-1" /> View
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  const res = row.res;
                  const roomItem = res.rooms[0];
                  return (
                    <tr key={row.key} className="hover:bg-gold-soft/20 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-burgundy whitespace-nowrap">
                        {res.bookingReference}
                        {row.web && <span className="block text-[10px] font-normal text-slate-400">Web {row.web.reference}</span>}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-walnut block">{res.guestName}</span>
                        <span className="text-[11px] text-slate-400">{res.guestPhone}</span>
                      </td>
                      <td className="py-3 px-3">
                        {row.web || res.source === 'DIRECT_WEB' || res.source === 'WEBSITE' ? (
                          <Badge variant="gold" size="sm" className="text-[10px]"><Globe className="w-3 h-3" /> Website</Badge>
                        ) : (
                          <Badge variant="outline" size="sm" className="text-[10px]">{res.source.replace('_', ' ')}</Badge>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-medium text-slate-800 block whitespace-nowrap">{short(res.checkIn)} → {short(res.checkOut)}</span>
                        <span className="text-[11px] text-slate-400">{res.nights} Nights</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-slate-800 font-medium block whitespace-nowrap">{roomItem?.roomTypeName || 'Deluxe Room'}</span>
                        {roomItem?.assignedRoomNumber ? (
                          <span className="text-[11px] font-mono text-emerald-700 font-bold">Room {roomItem.assignedRoomNumber}</span>
                        ) : (
                          <span className="text-[11px] text-amber-600 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge type="reservation" value={res.status} />
                          <StatusBadge type="stay" value={roomItem?.stayStatus || 'SCHEDULED'} />
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        <span className="font-bold text-slate-900 block"><CurrencyDisplay amountPaise={res.totalAmountPaise} /></span>
                        <span className="text-[10px] text-slate-400">{res.balanceAmountPaise === 0 ? 'Settled' : `Bal: ₹${res.balanceAmountPaise / 100}`}</span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {res.status === 'PENDING' && (
                            <Button
                              size="sm"
                              onClick={() => void confirmHotelNow(res)}
                              disabled={confirming === res.id}
                              className="h-7 text-xs px-2"
                            >
                              <Check className="w-3.5 h-3.5 mr-1" /> {confirming === res.id ? '…' : 'Confirm'}
                            </Button>
                          )}
                          {res.status === 'CONFIRMED' && res.rooms[0]?.stayStatus !== 'CHECKED_IN' && (
                            <Link to={`/app/front-desk?ref=${encodeURIComponent(res.bookingReference)}`}>
                              <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-amber-700 hover:text-amber-900 hover:bg-amber-50">
                                <ConciergeBell className="w-3.5 h-3.5 mr-1" /> Front Desk
                              </Button>
                            </Link>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setSelectedReservation(res)} className="h-7 text-xs px-2 text-slate-600 hover:text-slate-900">
                            <Eye className="w-3.5 h-3.5 mr-1" /> View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <BookingDetailDialog
        booking={selectedWeb}
        onClose={() => setSelectedWeb(null)}
        onAuthError={() => undefined}
        onUpdated={(b) => {
          setSelectedWeb(b);
          void qc.invalidateQueries({ queryKey: ['website'] });
        }}
      />
      {/* Reservation Details Drawer / Modal */}
      {selectedReservation && (
        <Modal
          isOpen={Boolean(selectedReservation)}
          onClose={() => setSelectedReservation(null)}
          title={`Booking ${selectedReservation.bookingReference}`}
          subtitle={`Channel: ${selectedReservation.source} • Created: ${selectedReservation.createdAt}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block">Primary Guest</span>
                <span className="font-bold text-slate-900 text-sm block">{selectedReservation.guestName}</span>
                <span className="text-slate-500">{selectedReservation.guestEmail}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block">Total Gross Folio</span>
                <span className="font-mono font-bold text-slate-900 text-sm block">
                  <CurrencyDisplay amountPaise={selectedReservation.totalAmountPaise} />
                </span>
                <StatusBadge type="payment" value={selectedReservation.paymentStatus} />
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                Assigned Room Item ({selectedReservation.rooms.length})
              </span>
              {selectedReservation.rooms.map((rm) => (
                <div key={rm.id} className="flex justify-between items-center py-1">
                  <div>
                    <span className="font-medium text-slate-900">{rm.roomTypeName}</span>
                    <span className="text-slate-500 block text-[11px]">{rm.ratePlanName}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      {rm.assignedRoomNumber ? `Room ${rm.assignedRoomNumber}` : 'Assign at Desk'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-amber-50 rounded-lg text-amber-900 border border-amber-200">
              <span className="font-semibold block mb-0.5">Special Requests:</span>
              {selectedReservation.specialRequests || 'No special requests noted.'}
            </div>

            {modalFeedback && (
              <div
                className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
                  modalFeedback.kind === 'ok'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                    : 'bg-red-50 text-red-900 border border-red-200'
                }`}
              >
                <span>{modalFeedback.text}</span>
                <button
                  type="button"
                  onClick={() => setModalFeedback(null)}
                  className="font-bold opacity-70 hover:opacity-100 ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                {selectedReservation.status === 'PENDING' && (
                  <>
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={() => void handleConfirmReservation(selectedReservation)}
                      disabled={isActionProcessing}
                      className="h-8 text-xs font-semibold"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      {isActionProcessing ? 'Processing…' : 'Confirm'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleRejectReservation(selectedReservation)}
                      disabled={isActionProcessing}
                      className="h-8 text-xs text-rose-700 border-rose-300 hover:bg-rose-50"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Reject Request
                    </Button>
                  </>
                )}

                {selectedReservation.status === 'CONFIRMED' && (
                  selectedReservation.rooms[0]?.stayStatus === 'CHECKED_IN' ? (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
                      Guest In-House (Checked In)
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleCancelReservation(selectedReservation)}
                      disabled={isActionProcessing}
                      className="h-8 text-xs text-rose-700 border-rose-300 hover:bg-rose-50"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Cancel Booking
                    </Button>
                  )
                )}

                {selectedReservation.status === 'CANCELLED' && (
                  <span className="text-[11px] text-slate-500 italic">
                    Booking cancelled · No actions available
                  </span>
                )}
                {selectedReservation.status === 'COMPLETED' && (
                  <span className="text-[11px] text-slate-500 italic">
                    Stay completed · Archived
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedReservation(null);
                    setModalFeedback(null);
                  }}
                >
                  Close
                </Button>
                <Link to="/app/folio">
                  <Button variant="gold" size="sm">
                    View Master Folio →
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
