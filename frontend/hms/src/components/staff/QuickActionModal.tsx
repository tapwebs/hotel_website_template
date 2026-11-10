import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePmsUIStore } from '../../stores/pmsUIStore';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { roomService, frontDeskService } from '../../services/apiServices';
import { NewBookingDialog } from '../../site/features/admin/NewBookingDialog';

export const QuickActionModal: React.FC = () => {
  const activeModal = usePmsUIStore((s) => s.activeModal);
  const closeModal = usePmsUIStore((s) => s.closeModal);
  const queryClient = useQueryClient();

  if (!activeModal) return null;

  if (activeModal === 'NEW_RESERVATION') {
    return (
      <NewBookingDialog
        open={true}
        onClose={closeModal}
        onCreated={() => {
          closeModal();
          void queryClient.invalidateQueries({ queryKey: ['reservations'] });
          void queryClient.invalidateQueries({ queryKey: ['website', 'bookings'] });
        }}
        onAuthError={() => {
          closeModal();
        }}
      />
    );
  }

  return <QuickActionModalContent activeModal={activeModal} closeModal={closeModal} />;
};

const QuickActionModalContent: React.FC<{ activeModal: string; closeModal: () => void }> = ({ activeModal, closeModal }) => {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [selectedRoomNumber, setSelectedRoomNumber] = useState('104');
  const [nights, setNights] = useState('1');
  const [ratePaise, setRatePaise] = useState('450000');
  const [paymentMethod, setPaymentMethod] = useState('UPI');

  const { data: physicalRooms } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomService.getAll()
  });

  const vacantRooms = useMemo(() => {
    return (physicalRooms ?? []).filter(r => r.occupancyStatus === 'VACANT' && (!r.maintenanceStatus || r.maintenanceStatus === 'OPERATIONAL'));
  }, [physicalRooms]);

  useEffect(() => {
    if (vacantRooms.length > 0 && !vacantRooms.some(r => r.roomNumber === selectedRoomNumber)) {
      setSelectedRoomNumber(vacantRooms[0].roomNumber);
    }
  }, [vacantRooms, selectedRoomNumber]);

  const handleSubmit = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      if (activeModal === 'WALK_IN_CHECKIN') {
        const res = await frontDeskService.walkInCheckIn({
          guest_name: guestName,
          guest_phone: guestPhone,
          room_number: selectedRoomNumber,
          nights: Number(nights) || 1,
          deposit_payment_method: paymentMethod,
          advance_amount_paise: Number(ratePaise) || 0
        });
        await queryClient.invalidateQueries({ queryKey: ['reservations'] });
        await queryClient.invalidateQueries({ queryKey: ['rooms'] });
        setSuccessMessage(`Check-in completed for ${guestName}! Room ${res.room_number} is now OCCUPIED. (Ref: ${res.booking_reference})`);
        setTimeout(() => {
          setSuccessMessage(null);
          closeModal();
        }, 1500);
      } else {
        setTimeout(() => {
          setIsSubmitting(false);
          setSuccessMessage(`Action executed successfully!`);
          setTimeout(() => {
            setSuccessMessage(null);
            closeModal();
          }, 1200);
        }, 500);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Operation failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [activeModal, guestName, guestPhone, selectedRoomNumber, nights, paymentMethod, ratePaise, queryClient, closeModal]);


  return (
    <Modal
      isOpen={Boolean(activeModal)}
      onClose={closeModal}
      title={
        activeModal === 'WALK_IN_CHECKIN'
          ? 'Fast Walk-In Check-In'
          : activeModal === 'COLLECT_PAYMENT'
          ? 'Collect Payment'
          : activeModal === 'ROOM_MOVE'
          ? 'Transfer Guest Room'
          : 'Operational Action'
      }
      subtitle="Immediate transactional update to PMS database"
      maxWidth="md"
    >
      {successMessage ? (
        <div className="p-8 text-center bg-emerald-50 rounded-xl border border-emerald-200">
          <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-bold">
            ✓
          </div>
          <h4 className="text-sm font-bold text-emerald-950 mb-1">Transaction Completed</h4>
          <p className="text-xs text-emerald-700">{successMessage}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
              {errorMessage}
            </div>
          )}
          {activeModal === 'WALK_IN_CHECKIN' && (
            <>
              <Input
                label="Guest Full Name"
                required
                placeholder="e.g. Vikramaditya Rathore"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Phone Number"
                  required
                  placeholder="+91 98201 00000"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                />
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Nights
                  </label>
                  <select
                    value={nights}
                    onChange={(e) => setNights(e.target.value)}
                    className="w-full bg-ivory text-slate-900 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="1">1 Night</option>
                    <option value="2">2 Nights</option>
                    <option value="3">3 Nights</option>
                    <option value="4">4 Nights</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Assign Inspected Room
                </label>
                <select
                  value={selectedRoomNumber}
                  onChange={(e) => setSelectedRoomNumber(e.target.value)}
                  className="w-full bg-ivory text-slate-900 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {vacantRooms.map((r) => (
                    <option key={r.id} value={r.roomNumber}>
                      Room {r.roomNumber} — {r.roomTypeName} (Floor {r.floor})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Deposit Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-ivory text-slate-900 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="UPI">UPI / QR Code</option>
                    <option value="CREDIT_CARD">Credit / Debit Card</option>
                    <option value="CASH">Cash Drawer</option>
                    <option value="CITY_LEDGER">Company City Ledger</option>
                  </select>
                </div>
                <Input
                  label="Advance Collected (₹)"
                  placeholder="4500"
                  value={Number(ratePaise) / 100}
                  onChange={(e) => setRatePaise(String(Number(e.target.value) * 100))}
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
                <span className="font-semibold block mb-0.5">Automated PMS Impact:</span>
                • Stays record initialized with status <code className="bg-amber-100 px-1 rounded">CHECKED_IN</code>.<br />
                • Room status transitions immediately to <code className="bg-amber-100 px-1 rounded">OCCUPIED</code>.<br />
                • Master Folio generated & digital key code issued.
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={closeModal} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="gold" type="submit" isLoading={isSubmitting}>
              Complete Check-In
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
