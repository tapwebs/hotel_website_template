import React, { useState } from 'react';
import {
  ConciergeBell,
  DoorOpen,
  Clock,
  Users,
  CheckCircle2,
  ArrowRightLeft,
  Key,
  AlertCircle,
  Plus,
  LogOut
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { reservationService, roomService, frontDeskService } from '../../services/apiServices';
import { Reservation } from '../../types/pms';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/common/StatusBadge';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { usePmsUIStore } from '../../stores/pmsUIStore';
import { useAppDate } from '../../hooks/useAppDate';
import { Modal } from '../../components/ui/Modal';

export const FrontDeskPage: React.FC = () => {
  const queryClient = useQueryClient();
  const openModal = usePmsUIStore((state) => state.openModal);
  const { businessDate, calendarDate } = useAppDate();
  const [sp] = useSearchParams();
  const incomingRef = sp.get('ref') ?? null;
  const [activeTab, setActiveTab] = useState<'ARRIVALS' | 'DEPARTURES' | 'IN_HOUSE'>('ARRIVALS');
  const [checkInModalReservation, setCheckInModalReservation] = useState<Reservation | null>(null);
  const [assignedRoom, setAssignedRoom] = useState('104');
  const [checkoutModalReservation, setCheckoutModalReservation] = useState<Reservation | null>(null);
  const [isEarlyCheckout, setIsEarlyCheckout] = useState(false);
  const [settlementMethod, setSettlementMethod] = useState<'CASH' | 'UPI' | 'CREDIT_CARD'>('UPI');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const { data: reservations } = useQuery({
    queryKey: ['reservations'],
    queryFn: () => reservationService.getAll()
  });

  const { data: rooms } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomService.getAll()
  });

  const vacantRooms = React.useMemo(() => {
    return rooms?.filter(r => r.occupancyStatus === 'VACANT') || [];
  }, [rooms]);

  // Today's normal arrivals — checkIn equals businessDate, or calendarDate if night audit rollover is pending.
  const arrivals = React.useMemo(() => {
    return reservations?.filter(r =>
      r.status === 'CONFIRMED' &&
      (r.checkIn === businessDate || (calendarDate && r.checkIn === calendarDate)) &&
      (!r.rooms.length || r.rooms.some(rm => !rm.stayStatus || (rm.stayStatus !== 'CHECKED_IN' && rm.stayStatus !== 'CHECKED_OUT')))
    ) || [];
  }, [reservations, businessDate, calendarDate]);

  const departures = React.useMemo(() => {
    return reservations?.filter(r =>
      r.status === 'CONFIRMED' &&
      (r.checkOut === businessDate || (calendarDate && r.checkOut === calendarDate)) &&
      r.rooms.some(rm => rm.stayStatus === 'CHECKED_IN')
    ) || [];
  }, [reservations, businessDate, calendarDate]);

  const inHouse = React.useMemo(() => {
    return reservations?.filter(r =>
      r.status === 'CONFIRMED' &&
      r.rooms.some(rm => rm.stayStatus === 'CHECKED_IN')
    ) || [];
  }, [reservations]);

  // Reservation navigated in from Bookings via ?ref=.
  // Searched across ALL reservations — not filtered by today's checkIn —
  // so rescheduled / late-arriving guests are always found.
  const selectedReservation = React.useMemo<Reservation | null>(() => {
    if (!incomingRef || !reservations) return null;
    return reservations.find(r => r.bookingReference === incomingRef || r.externalBookingRef === incomingRef) ?? null;
  }, [incomingRef, reservations]);

  // True when the selected reservation also appears in today's arrivals list.
  // Used to suppress a duplicate row in the table below the panel.
  const selectedIsInTodayArrivals = selectedReservation
    ? arrivals.some(r => r.id === selectedReservation.id)
    : false;

  // Eligibility gate — never lets the UI silently bypass cancelled/completed/already-in states.
  const selectedEligibility = React.useMemo<'eligible' | 'already_checked_in' | 'ineligible' | null>(() => {
    if (!selectedReservation) return null;
    if (selectedReservation.status === 'CANCELLED' || selectedReservation.status === 'COMPLETED' || selectedReservation.status === 'NO_SHOW') return 'ineligible';
    const hasPendingRooms = !selectedReservation.rooms.length || selectedReservation.rooms.some(rm => !rm.stayStatus || (rm.stayStatus !== 'CHECKED_IN' && rm.stayStatus !== 'CHECKED_OUT'));
    if (!hasPendingRooms) return 'already_checked_in';
    if (selectedReservation.status === 'CONFIRMED') return 'eligible';
    return 'ineligible'; // PENDING — must be confirmed before check-in
  }, [selectedReservation]);

  const handlePerformCheckIn = (res: Reservation) => {
    setCheckInModalReservation(res);
    if (vacantRooms.length > 0) {
      setAssignedRoom(vacantRooms[0].roomNumber);
    }
  };

  const handleConfirmCheckIn = async () => {
    if (!checkInModalReservation) return;
    setIsProcessing(true);
    try {
      const targetRoom = rooms?.find(r => r.roomNumber === assignedRoom || r.id === assignedRoom);
      const roomId = targetRoom?.id || assignedRoom;
      const pendingRoom = checkInModalReservation.rooms.find(rm => !rm.stayStatus || (rm.stayStatus !== 'CHECKED_IN' && rm.stayStatus !== 'CHECKED_OUT')) || checkInModalReservation.rooms[0];
      await frontDeskService.checkIn({
        reservation_id: checkInModalReservation.id,
        room_id: roomId,
        reservation_room_id: pendingRoom?.id
      });
      await queryClient.invalidateQueries({ queryKey: ['reservations'] });
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setActionNotice(`Check-in completed for ${checkInModalReservation.guestName}! Room ${targetRoom?.roomNumber || assignedRoom} is now OCCUPIED.`);
      setCheckInModalReservation(null);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionNotice(`Check-in failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInitiateCheckout = (res: Reservation, isEarly: boolean = false) => {
    setCheckoutModalReservation(res);
    setIsEarlyCheckout(isEarly || res.checkOut > businessDate);
    setSettlementMethod('UPI');
    setCheckoutError(null);
  };

  const handleConfirmCheckOut = async () => {
    if (!checkoutModalReservation) return;
    setIsProcessing(true);
    setCheckoutError(null);
    try {
      const roomItem = checkoutModalReservation.rooms[0];
      const payload: {
        stay_id?: string;
        reservation_id?: string;
        room_id?: string;
        settle_remaining_with_method?: string;
      } = {
        reservation_id: checkoutModalReservation.id,
        settle_remaining_with_method: checkoutModalReservation.balanceAmountPaise > 0 ? settlementMethod : (settlementMethod || 'UPI')
      };
      if (roomItem?.stayId) {
        payload.stay_id = roomItem.stayId;
      }
      if (roomItem?.assignedRoomId) {
        payload.room_id = roomItem.assignedRoomId;
      }

      const res = await frontDeskService.checkOut(payload);

      await queryClient.invalidateQueries({ queryKey: ['reservations'] });
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
      await queryClient.invalidateQueries({ queryKey: ['folios'] });

      const roomNum = roomItem?.assignedRoomNumber ? `Room ${roomItem.assignedRoomNumber}` : 'Room';
      const invoiceMsg = res?.invoice_number ? ` (Invoice: ${res.invoice_number})` : '';
      setActionNotice(
        `${isEarlyCheckout ? 'Early check-out' : 'Check-out'} completed for ${checkoutModalReservation.guestName}! ${roomNum} is now VACANT (DIRTY).${invoiceMsg}`
      );
      setCheckoutModalReservation(null);
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err: any) {
      setCheckoutError(err.message || 'Check-out failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Banner */}
      {actionNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-emerald-700 font-bold">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 tracking-tight">
            Front Desk Operations
          </h1>
          <p className="text-xs text-slate-500">
            Real-time check-in, key card issuance, departure settlement, and room assignments • Business Date:{' '}
            <span className="font-mono font-semibold text-slate-700">{businessDate}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="gold" size="sm" onClick={() => openModal('WALK_IN_CHECKIN')} className="text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> Fast Walk-In Check-In
          </Button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('ARRIVALS')}
          className={`pb-3 pointer-coarse:pt-2 flex items-center gap-2 transition-colors cursor-pointer border-b-2 ${
            activeTab === 'ARRIVALS'
              ? 'border-amber-600 text-amber-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <DoorOpen className="w-4 h-4" />
          <span>Expected Arrivals Today</span>
          <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-full">{arrivals.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('DEPARTURES')}
          className={`pb-3 pointer-coarse:pt-2 flex items-center gap-2 transition-colors cursor-pointer border-b-2 ${
            activeTab === 'DEPARTURES'
              ? 'border-amber-600 text-amber-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Departures &amp; Settlements</span>
          <span className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded-full">{departures.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('IN_HOUSE')}
          className={`pb-3 pointer-coarse:pt-2 flex items-center gap-2 transition-colors cursor-pointer border-b-2 ${
            activeTab === 'IN_HOUSE'
              ? 'border-amber-600 text-amber-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Active In-House Stays</span>
          <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded-full">{inHouse.length}</span>
        </button>
      </div>

      {/* ── Selected Reservation Panel ───────────────────────────────────────
          Shown on the ARRIVALS tab when ?ref= is present.
          Searches the FULL reservations list so rescheduled / late-arriving
          guests are found even when their original checkIn date has passed. */}
      {activeTab === 'ARRIVALS' && selectedReservation && (
        <div
          className={`rounded-xl border-2 p-4 text-xs space-y-3 ${
            selectedEligibility === 'eligible'
              ? 'border-amber-400 bg-amber-50'
              : selectedEligibility === 'already_checked_in'
              ? 'border-emerald-400 bg-emerald-50'
              : 'border-red-300 bg-red-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <ConciergeBell className="w-4 h-4 text-amber-600" />
              <span>Selected Reservation from Bookings</span>
              <span className="font-mono text-amber-700">{selectedReservation.bookingReference}</span>
            </div>
            <StatusBadge type="reservation" value={selectedReservation.status} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-slate-400 block uppercase tracking-wider text-[10px]">Guest</span>
              <span className="font-semibold text-slate-900 block">{selectedReservation.guestName}</span>
              <span className="text-slate-500">{selectedReservation.guestPhone}</span>
            </div>
            <div>
              <span className="text-slate-400 block uppercase tracking-wider text-[10px]">Stay Dates</span>
              <span className="font-medium text-slate-800 block">
                {selectedReservation.checkIn} → {selectedReservation.checkOut}
              </span>
              <span className="text-slate-500">{selectedReservation.nights} Nights</span>
            </div>
            <div>
              <span className="text-slate-400 block uppercase tracking-wider text-[10px]">Room</span>
              {selectedReservation.rooms[0]?.assignedRoomNumber ? (
                <span className="font-mono font-bold text-emerald-700 block">
                  Room {selectedReservation.rooms[0].assignedRoomNumber}
                </span>
              ) : (
                <span className="text-amber-600 italic block">Select at Check-in</span>
              )}
              <span className="text-slate-500">{selectedReservation.rooms[0]?.roomTypeName}</span>
            </div>
            <div>
              <span className="text-slate-400 block uppercase tracking-wider text-[10px]">Balance Due</span>
              <span className="font-mono font-bold text-slate-900 block">
                <CurrencyDisplay amountPaise={selectedReservation.balanceAmountPaise} />
              </span>
              <StatusBadge type="stay" value={selectedReservation.rooms[0]?.stayStatus || 'SCHEDULED'} />
            </div>
          </div>

          {/* Date-mismatch advisory — shown only for eligible rescheduled arrivals */}
          {selectedEligibility === 'eligible' && selectedReservation.checkIn !== businessDate && (
            <div className="flex items-start gap-2 p-2.5 bg-amber-100 border border-amber-300 rounded-lg text-amber-900">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Original check-in date <strong>{selectedReservation.checkIn}</strong> differs from the current
                business date <strong>{businessDate}</strong>. If the guest's stay dates must change, amend
                the reservation before proceeding. Clicking Check-In will use the original dates on record.
              </span>
            </div>
          )}

          <div className="pt-1">
            {selectedEligibility === 'eligible' && (
              <Button
                variant="gold"
                size="sm"
                onClick={() => handlePerformCheckIn(selectedReservation)}
                className="h-8 text-xs font-semibold"
              >
                <Key className="w-3.5 h-3.5 mr-1.5" /> Check-In Guest
              </Button>
            )}
            {selectedEligibility === 'already_checked_in' && (
              <span className="inline-flex items-center gap-1.5 text-emerald-800 font-semibold bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5" /> Guest is already checked in
              </span>
            )}
            {selectedEligibility === 'ineligible' && (
              <span className="inline-flex items-center gap-1.5 text-red-800 font-semibold bg-red-100 border border-red-300 px-3 py-1.5 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5" />
                Cannot check in — reservation is {selectedReservation.status.toLowerCase()}. No action permitted.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Not-found message when ?ref= supplied but reservation doesn't exist */}
      {activeTab === 'ARRIVALS' && incomingRef && !selectedReservation && reservations && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-red-300 bg-red-50 text-red-800 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Reservation <span className="font-mono mx-1">{incomingRef}</span> was not found. It may have been deleted or the reference is invalid.
        </div>
      )}

      {/* Arrivals Table */}
      {activeTab === 'ARRIVALS' && (
        <div className="bg-ivory rounded-xl border border-slate-200/90 shadow-2xs overflow-x-auto">
          <table className="w-full min-w-[720px] text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Ref Code</th>
                <th className="py-3 px-4">Guest Name</th>
                <th className="py-3 px-4">VIP Tier</th>
                <th className="py-3 px-4">Room Category</th>
                <th className="py-3 px-4">Assigned Room</th>
                <th className="py-3 px-4">Balance Due</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {arrivals
                .filter(res => !(selectedIsInTodayArrivals && res.id === selectedReservation?.id))
                .map((res) => (
                  <tr key={res.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-bold text-amber-700">{res.bookingReference}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{res.guestName}</td>
                    <td className="py-3 px-4">
                      <Badge variant={res.guestVipStatus === 'PLATINUM' ? 'gold' : 'info'} size="sm">
                        {res.guestVipStatus || 'REGULAR'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">{res.rooms[0]?.roomTypeName}</td>
                    <td className="py-3 px-4">
                      {res.rooms[0]?.assignedRoomNumber ? (
                        <span className="font-mono font-bold text-emerald-700">Room {res.rooms[0].assignedRoomNumber}</span>
                      ) : (
                        <span className="text-amber-600 italic">Select at Check-in</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <CurrencyDisplay amountPaise={res.balanceAmountPaise} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        variant="gold"
                        size="sm"
                        onClick={() => handlePerformCheckIn(res)}
                        className="h-7 text-xs px-3"
                      >
                        <Key className="w-3 h-3 mr-1" /> Check-In Guest
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Departures Table */}
      {activeTab === 'DEPARTURES' && (
        <div className="bg-ivory rounded-xl border border-slate-200/90 shadow-2xs overflow-x-auto">
          <table className="w-full min-w-[720px] text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Room #</th>
                <th className="py-3 px-4">Guest Name</th>
                <th className="py-3 px-4">Folio Status</th>
                <th className="py-3 px-4">Outstanding Balance</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departures.map((res) => (
                <tr key={res.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">Room {res.rooms[0]?.assignedRoomNumber}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900">{res.guestName}</td>
                  <td className="py-3 px-4">
                    <Badge variant={res.balanceAmountPaise === 0 ? 'success' : 'destructive'} size="sm">
                      {res.balanceAmountPaise === 0 ? 'Zero Balance' : 'Balance Pending'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    <CurrencyDisplay amountPaise={res.balanceAmountPaise} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleInitiateCheckout(res, false)}
                      className="h-7 text-xs px-3"
                    >
                      Review &amp; Settle Check-Out →
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* In-House Table */}
      {activeTab === 'IN_HOUSE' && (
        <div className="bg-ivory rounded-xl border border-slate-200/90 shadow-2xs overflow-x-auto">
          <table className="w-full min-w-[720px] text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Room #</th>
                <th className="py-3 px-4">In-House Guest</th>
                <th className="py-3 px-4">Stay Range</th>
                <th className="py-3 px-4">In-Room Dining QR Token</th>
                <th className="py-3 px-4 text-center">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inHouse.map((res) => (
                <tr key={res.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-4 font-mono font-bold text-emerald-800 bg-emerald-50/60">
                    Room {res.rooms[0]?.assignedRoomNumber}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900">{res.guestName}</td>
                  <td className="py-3 px-4 text-slate-600">
                    {res.checkIn} to {res.checkOut} ({res.nights} Nights)
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="success" size="sm" className="font-mono text-[10px]">
                      ACTIVE (HMAC Signed)
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-center flex items-center justify-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleInitiateCheckout(res, true)}
                      className="h-7 text-[11px] px-2.5 text-amber-900 border-amber-300 bg-amber-50/70 hover:bg-amber-100 font-medium"
                      title="Initiate Early Check-Out"
                    >
                      <LogOut className="w-3 h-3 mr-1 text-amber-700" /> Early Check-Out
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openModal('ROOM_MOVE', { roomId: res.rooms[0]?.assignedRoomNumber })}
                      className="h-7 text-[11px] px-2"
                    >
                      <ArrowRightLeft className="w-3 h-3 mr-1" /> Room Move
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openModal('ADD_FOLIO_CHARGE', { guestName: res.guestName })}
                      className="h-7 text-[11px] px-2"
                    >
                      + Charge
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Check-In Modal — shared by both the panel button and the arrivals table */}
      {checkInModalReservation && (
        <Modal
          isOpen={Boolean(checkInModalReservation)}
          onClose={() => setCheckInModalReservation(null)}
          title={`Check-In: ${checkInModalReservation.guestName}`}
          subtitle={`Booking Reference: ${checkInModalReservation.bookingReference}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Accommodation</span>
              <span className="font-bold text-slate-900 text-sm block">
                {checkInModalReservation.rooms[0]?.roomTypeName}
              </span>
              <span className="text-slate-500">
                {checkInModalReservation.checkIn} → {checkInModalReservation.checkOut} ({checkInModalReservation.nights} Nights)
              </span>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                Assign Inspected Physical Room
              </label>
              <select
                value={assignedRoom}
                onChange={(e) => setAssignedRoom(e.target.value)}
                className="w-full bg-ivory text-slate-900 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {vacantRooms.length > 0 ? (
                  vacantRooms.map((rm) => (
                    <option key={rm.id} value={rm.roomNumber}>
                      Room {rm.roomNumber} — {rm.roomTypeName} ({rm.housekeepingStatus})
                    </option>
                  ))
                ) : (
                  <option value="" disabled>No vacant rooms available</option>
                )}
              </select>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 space-y-1">
              <span className="font-semibold block">Post-Check-In Automated Trigger:</span>
              • Stay state becomes <code className="bg-emerald-100 px-1 rounded">CHECKED_IN</code>.<br />
              • Physical Room state becomes <code className="bg-emerald-100 px-1 rounded">OCCUPIED</code>.<br />
              • Issues RFID key card &amp; in-room QR dining token.
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setCheckInModalReservation(null)}>
                Cancel
              </Button>
              <Button variant="gold" size="sm" isLoading={isProcessing} onClick={handleConfirmCheckIn}>
                Complete Check-In &amp; Issue Key
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Check-Out / Settlement Modal — shared by normal departure and early check-out */}
      {checkoutModalReservation && (
        <Modal
          isOpen={Boolean(checkoutModalReservation)}
          onClose={() => {
            if (!isProcessing) {
              setCheckoutModalReservation(null);
              setCheckoutError(null);
            }
          }}
          title={
            isEarlyCheckout
              ? `Early Check-Out: ${checkoutModalReservation.guestName}`
              : `Check-Out & Settlement: ${checkoutModalReservation.guestName}`
          }
          subtitle={`Booking Reference: ${checkoutModalReservation.bookingReference} • Room ${checkoutModalReservation.rooms[0]?.assignedRoomNumber || 'N/A'}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            {checkoutError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{checkoutError}</span>
              </div>
            )}

            {isEarlyCheckout && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-700" />
                  <span>Early Departure Confirmation</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Scheduled check-out is <strong>{checkoutModalReservation.checkOut}</strong>.
                  Guest is departing early on current business date <strong>{businessDate}</strong>.
                  Confirming will conclude the stay today, vacate Room {checkoutModalReservation.rooms[0]?.assignedRoomNumber},
                  dispatch housekeeping turnover, and finalize the folio invoice.
                </p>
              </div>
            )}

            {/* Stay & Guest Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block uppercase tracking-wider text-[10px]">Guest</span>
                <span className="font-semibold text-slate-900 block">{checkoutModalReservation.guestName}</span>
                <span className="text-slate-500">{checkoutModalReservation.guestPhone || 'No phone'}</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase tracking-wider text-[10px]">Room Assigned</span>
                <span className="font-mono font-bold text-slate-900 block">
                  Room {checkoutModalReservation.rooms[0]?.assignedRoomNumber}
                </span>
                <span className="text-slate-500">{checkoutModalReservation.rooms[0]?.roomTypeName}</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase tracking-wider text-[10px]">Stay Window</span>
                <span className="font-medium text-slate-800 block">
                  {checkoutModalReservation.checkIn} → {isEarlyCheckout ? `${businessDate} (Early)` : checkoutModalReservation.checkOut}
                </span>
                <span className="text-slate-500">
                  {checkoutModalReservation.nights} Nights scheduled
                </span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase tracking-wider text-[10px]">Folio Status</span>
                <span className="font-semibold block">
                  {checkoutModalReservation.balanceAmountPaise === 0 ? (
                    <span className="text-emerald-700">Zero Balance</span>
                  ) : (
                    <span className="text-amber-700">Settlement Due</span>
                  )}
                </span>
                <span className="text-slate-500">{checkoutModalReservation.paymentStatus}</span>
              </div>
            </div>

            {/* Folio Financial Breakdown */}
            <div className="p-3.5 bg-ivory rounded-xl border border-slate-200 space-y-2">
              <span className="text-slate-500 uppercase tracking-wider text-[10px] font-bold block">
                Folio Settlement Review
              </span>
              <div className="flex justify-between items-center text-slate-600">
                <span>Total Folio Charges:</span>
                <span className="font-mono font-semibold text-slate-800">
                  <CurrencyDisplay amountPaise={checkoutModalReservation.totalAmountPaise} />
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Payments Received:</span>
                <span className="font-mono text-emerald-700 font-semibold">
                  -<CurrencyDisplay amountPaise={checkoutModalReservation.paidAmountPaise} />
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                <span>Outstanding Balance:</span>
                <span className="font-mono">
                  <CurrencyDisplay amountPaise={checkoutModalReservation.balanceAmountPaise} />
                </span>
              </div>
            </div>

            {/* Payment Method Selector if balance > 0 */}
            {checkoutModalReservation.balanceAmountPaise > 0 ? (
              <div className="space-y-2 p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                <label className="text-xs font-semibold text-slate-800 block">
                  Select Settlement Tender for Remaining Balance:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['UPI', 'CREDIT_CARD', 'CASH'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setSettlementMethod(method)}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        settlementMethod === method
                          ? 'border-amber-600 bg-amber-100 text-amber-900 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {method === 'CREDIT_CARD' ? 'Card / EDC' : method}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Settlement of <CurrencyDisplay amountPaise={checkoutModalReservation.balanceAmountPaise} /> will be recorded via {settlementMethod} before release.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium text-[11px]">
                  Folio has zero outstanding balance. All charges are settled.
                </span>
              </div>
            )}

            {/* Automated Actions Notice */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 space-y-1 text-[11px]">
              <span className="font-semibold block text-slate-800">Automated Post-Check-Out Triggers:</span>
              • Stay state finalized as <code className="bg-slate-200 px-1 rounded text-slate-800">CHECKED_OUT</code>.<br />
              • Room {checkoutModalReservation.rooms[0]?.assignedRoomNumber} vacated (<code className="bg-slate-200 px-1 rounded text-slate-800">VACANT DIRTY</code>) and housekeeping turnover dispatched.<br />
              • GST Tax Invoice generated and folio closed.
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                disabled={isProcessing}
                onClick={() => {
                  setCheckoutModalReservation(null);
                  setCheckoutError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant={isEarlyCheckout ? "gold" : "primary"}
                size="sm"
                isLoading={isProcessing}
                onClick={handleConfirmCheckOut}
              >
                {isEarlyCheckout ? 'Confirm Early Check-Out' : 'Confirm Check-Out & Settle'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
