import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BedDouble, Filter, AlertTriangle, ShieldCheck, Sparkles, User, Wrench, Lock, Plus, RefreshCw } from 'lucide-react';
import { availabilityService, roomService } from '../../services/apiServices';
import { PhysicalRoom, RoomOperationalStatus, RoomHousekeepingStatus } from '../../types/pms';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/common/LoadingState';
import { useAuthStore } from '../../stores/authStore';
import { AddRoomsModal } from './rooms/AddRoomsModal';

/** One row per room type. Super admins can change the nightly rate; it applies to the HMS and the website. */
const RoomTypeRateCell: React.FC<{ typeId: string; ratePaise: number }> = ({ typeId, ratePaise }) => {
  const isSuperAdmin = useAuthStore((st) => st.session?.role === 'ROLE_SUPER_ADMIN');
  const queryClient = useQueryClient();
  const current = Math.round(ratePaise / 100);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(current));
  const n = Number(value);
  const valid = Number.isInteger(n) && n >= 100 && n <= 1_000_000;
  const save = useMutation({
    mutationFn: () => roomService.setTypeRate(typeId, n),
    onSuccess: () => { setEditing(false); queryClient.invalidateQueries({ queryKey: ['roomTypes'] }); queryClient.invalidateQueries({ queryKey: ['rooms'] }); },
  });
  if (!editing) {
    return (
      <span className="inline-flex items-center justify-end gap-2">
        <span className="tabular-nums">₹{current.toLocaleString('en-IN')}</span>
        {isSuperAdmin && <Button size="sm" variant="outline" onClick={() => { setValue(String(current)); setEditing(true); }}>Change</Button>}
      </span>
    );
  }
  return (
    <form className="inline-flex flex-wrap items-center justify-end gap-2" onSubmit={(e) => { e.preventDefault(); if (valid && n !== current) save.mutate(); }}>
      <input aria-label="Rate per night in rupees" inputMode="numeric" autoFocus value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
        className="min-h-9 w-24 rounded-lg border border-input bg-card px-2 text-right text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-burgundy/25" />
      <Button size="sm" type="submit" disabled={!valid || n === current} isLoading={save.isPending}>Save</Button>
      <Button size="sm" type="button" variant="outline" onClick={() => setEditing(false)} disabled={save.isPending}>Cancel</Button>
      {!valid && <span className="w-full text-right text-xs text-rose-700">Enter a whole number from 100 to 1,000,000.</span>}
      {save.error && <span role="alert" className="w-full text-right text-xs text-rose-700">{(save.error as Error).message}</span>}
    </form>
  );
};

/** Room types from the HMS (even before any room exists), with live counts. */
const RoomTypesAndRates: React.FC<{ rooms: PhysicalRoom[] }> = ({ rooms }) => {
  const cats = useQuery({ queryKey: ['roomTypes'], queryFn: () => availabilityService.searchCategories(), staleTime: 30_000 });
  const types = React.useMemo(() => (cats.data ?? []).map((c) => {
    const mine = rooms.filter((r) => r.roomTypeId === c.id);
    return {
      id: c.id, name: c.name, ratePaise: c.startingPricePerNightPaise, total: mine.length,
      occupied: mine.filter((r) => r.occupancyStatus === 'OCCUPIED').length,
      blocked: mine.filter((r) => r.occupancyStatus !== 'OCCUPIED' && (r.occupancyStatus === 'OUT_OF_ORDER' || r.occupancyStatus === 'OUT_OF_SERVICE' || r.maintenanceStatus === 'OUT_OF_ORDER')).length,
    };
  }), [cats.data, rooms]);
  return (
    <section aria-labelledby="types-rates" className="rounded-2xl border border-border bg-ivory p-5 shadow-xs">
      <h2 id="types-rates" className="font-display text-h3 text-walnut">Room types &amp; rates</h2>
      <p className="mb-3 text-xs text-muted-foreground">Nightly rate before tax. Used for front-desk bookings and the website. Only the super admin can change it.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground uppercase">
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3 text-right">Rate / night</th>
              <th className="py-2 pr-3 text-right">Rooms</th>
              <th className="py-2 pr-3 text-right">Occupied</th>
              <th className="py-2 text-right">Blocked</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0">
                <td className="py-2 pr-3 font-medium text-walnut">{t.name}</td>
                <td className="py-2 pr-3 text-right"><RoomTypeRateCell typeId={t.id} ratePaise={t.ratePaise} /></td>
                <td className="py-2 pr-3 text-right tabular-nums">{t.total}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{t.occupied}</td>
                <td className="py-2 text-right tabular-nums">{t.blocked}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {cats.isSuccess && !types.length && <p className="py-3 text-sm text-muted-foreground">No room types yet. Use Add rooms to create the standard ones.</p>}
      </div>
    </section>
  );
};

export const RoomsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedFloor, setSelectedFloor] = useState<number | 'ALL'>('ALL');
  const [selectedRoom, setSelectedRoom] = useState<PhysicalRoom | null>(null);
  const canAddRooms = useAuthStore((st) => st.hasPermission('MANAGE_SETTINGS'));
  const [addingRooms, setAddingRooms] = useState(false);
  const [overrideModalRoom, setOverrideModalRoom] = useState<PhysicalRoom | null>(null);
  const [newHkStatus, setNewHkStatus] = useState<RoomHousekeepingStatus>('CLEAN');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const { data: rooms = [], isFetching, isLoading } = useQuery<PhysicalRoom[]>({
    queryKey: ['rooms'],
    queryFn: () => roomService.getAll(),
    placeholderData: (prev) => prev,
    staleTime: 1000 * 10,
    refetchOnMount: true
  });

  const floors = React.useMemo(() => [...new Set((rooms || []).map((r) => r.floor))].sort((a, b) => a - b), [rooms]);
  const filteredRooms = React.useMemo(() => {
    if (selectedFloor === 'ALL') return rooms || [];
    return rooms?.filter((r) => r.floor === selectedFloor) || [];
  }, [rooms, selectedFloor]);

  const handleSaveStatusOverride = React.useCallback(async () => {
    if (!overrideModalRoom) return;
    setIsUpdatingStatus(true);
    setUpdateError(null);
    try {
      const res = await roomService.updateStatus(overrideModalRoom.id, { clean_status: newHkStatus });
      if (!res) {
        throw new Error('Failed to update room housekeeping status.');
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rooms'] }),
        queryClient.invalidateQueries({ queryKey: ['housekeepingTasks'] }),
      ]);
      setOverrideModalRoom(null);
    } catch (err: any) {
      setUpdateError(err?.message || 'Failed to update room housekeeping status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  }, [overrideModalRoom, newHkStatus, queryClient]);

  return (
    <div className="space-y-6">
      <RoomTypesAndRates rooms={rooms || []} />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-sans font-bold text-slate-900 tracking-tight">
              Physical Rooms Matrix
            </h1>
            {isFetching && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full font-medium animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" /> Syncing...
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time physical room inventory, floor-plan statuses, and housekeeping readiness
          </p>
        </div>

        {canAddRooms && (
          <Button size="sm" onClick={() => setAddingRooms(true)}><Plus className="size-4" /> Add rooms</Button>
        )}
        {/* Floor Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs bg-ivory p-1 rounded-xl border border-slate-200">
          <span className="text-slate-400 px-2 font-medium">Floor:</span>
          {(['ALL', ...floors] as (number | 'ALL')[]).map((fl) => (
            <button
              key={fl}
              onClick={() => setSelectedFloor(fl)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                selectedFloor === fl
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {fl === 'ALL' ? 'All Floors' : `Floor ${fl}`}
            </button>
          ))}
        </div>
      </div>

      {/* Room Grid by Floors */}
      {isLoading && (!filteredRooms || filteredRooms.length === 0) ? (
        <LoadingState message="Querying physical room ledger..." />
      ) : rooms.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 p-6 bg-ivory border border-slate-200 rounded-2xl text-sm text-slate-600">
          <span>No rooms have been added to this property yet.{canAddRooms ? '' : ' Ask an admin to add them.'}</span>
          {canAddRooms && <Button size="sm" onClick={() => setAddingRooms(true)}><Plus className="size-4" /> Add rooms</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {filteredRooms?.map((room) => {
            const isOccupied = room.occupancyStatus === 'OCCUPIED';
            const isMaintBlocked = room.maintenanceStatus === 'OUT_OF_ORDER';
            const isOOO = room.occupancyStatus === 'OUT_OF_ORDER' || (!isOccupied && isMaintBlocked);
            const isOOS = room.occupancyStatus === 'OUT_OF_SERVICE';
            const isBlocked = isOOO || isOOS;
            const displayOccupancyStatus: RoomOperationalStatus = isOccupied
              ? 'OCCUPIED'
              : (isOOO ? 'OUT_OF_ORDER' : (isOOS ? 'OUT_OF_SERVICE' : 'VACANT'));

            return (
              <div
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between min-h-[130px] hover:shadow-md ${
                  isBlocked
                    ? 'bg-slate-100 border-slate-300'
                    : isOccupied
                    ? 'bg-amber-50/40 border-amber-200 hover:border-amber-400'
                    : 'bg-ivory border-slate-200 hover:border-emerald-400'
                }`}
              >
                {/* Room Number & Floor */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-base font-bold text-slate-900 block">
                      {room.roomNumber}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Floor {room.floor}
                    </span>
                  </div>

                  <StatusBadge type="room_occupancy" value={displayOccupancyStatus} size="sm" />
                </div>

                {/* Guest or Status Info */}
                <div className="my-2">
                  {room.currentGuestName ? (
                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-800 truncate">
                      <User className="w-3 h-3 text-amber-600 shrink-0" />
                      <span className="truncate">{room.currentGuestName}</span>
                    </div>
                  ) : room.activeMaintenanceTicketId ? (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-rose-700">
                      <Wrench className="w-3 h-3 shrink-0" />
                      <span>{room.activeMaintenanceTicketId}</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Unoccupied</span>
                  )}
                </div>

                {/* Housekeeping Badge Footer */}
                <div className="flex items-center justify-between border-t border-slate-100/80 pt-2 mt-auto">
                  <StatusBadge type="room_housekeeping" value={room.housekeepingStatus} size="sm" />
                  {room.lockStatus === 'DND' && (
                    <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1 py-0.5 rounded">
                      DND
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {addingRooms && (
        <AddRoomsModal
          onClose={() => setAddingRooms(false)}
          onAdded={() => {
            void queryClient.invalidateQueries({ queryKey: ['rooms'] });
            void queryClient.invalidateQueries({ queryKey: ['fnb', 'roomsQr'] });
          }}
        />
      )}
      {/* Room Details Modal */}
      {selectedRoom && (
        <Modal
          isOpen={Boolean(selectedRoom)}
          onClose={() => setSelectedRoom(null)}
          title={`Room ${selectedRoom.roomNumber} Overview`}
          subtitle={`${selectedRoom.roomTypeName} • Floor ${selectedRoom.floor}`}
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 block mb-1">Occupancy</span>
                <StatusBadge
                  type="room_occupancy"
                  value={
                    selectedRoom.occupancyStatus === 'OCCUPIED'
                      ? 'OCCUPIED'
                      : (selectedRoom.occupancyStatus === 'OUT_OF_ORDER' || selectedRoom.maintenanceStatus === 'OUT_OF_ORDER'
                          ? 'OUT_OF_ORDER'
                          : (selectedRoom.occupancyStatus === 'OUT_OF_SERVICE' ? 'OUT_OF_SERVICE' : 'VACANT'))
                  }
                  size="md"
                />
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 block mb-1">Housekeeping</span>
                <StatusBadge type="room_housekeeping" value={selectedRoom.housekeepingStatus} size="md" />
              </div>
            </div>

            {selectedRoom.currentGuestName && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-amber-800 text-[11px] font-semibold block uppercase">Current Occupant</span>
                <span className="font-bold text-amber-950 text-sm">{selectedRoom.currentGuestName}</span>
                <span className="text-amber-700 block text-[11px] mt-0.5">Stay ID: {selectedRoom.currentStayId}</span>
              </div>
            )}

            {selectedRoom.notes && (
              <p className="text-slate-600 bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                <strong>Notes:</strong> {selectedRoom.notes}
              </p>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewHkStatus(selectedRoom.housekeepingStatus);
                  setUpdateError(null);
                  setOverrideModalRoom(selectedRoom);
                  setSelectedRoom(null);
                }}
              >
                Change Cleaning State
              </Button>
              <Button variant="primary" size="sm" onClick={() => setSelectedRoom(null)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Housekeeping Override Modal */}
      {overrideModalRoom && (
        <Modal
          isOpen={Boolean(overrideModalRoom)}
          onClose={() => !isUpdatingStatus && setOverrideModalRoom(null)}
          title={`Override Status: Room ${overrideModalRoom.roomNumber}`}
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            {updateError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">
                {updateError}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                New Housekeeping State
              </label>
              <select
                value={newHkStatus}
                onChange={(e) => setNewHkStatus(e.target.value as any)}
                disabled={isUpdatingStatus}
                className="w-full bg-ivory text-slate-900 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
              >
                <option value="INSPECTED">INSPECTED (Ready for Check-In)</option>
                <option value="CLEAN">CLEAN (Cleaned, Awaiting Inspection)</option>
                <option value="CLEANING">CLEANING (Housekeeper in Room)</option>
                <option value="DIRTY">DIRTY (Needs Turnover)</option>
                <option value="TOUCH_UP">TOUCH_UP (Light Refresh)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setOverrideModalRoom(null)} disabled={isUpdatingStatus}>
                Cancel
              </Button>
              <Button variant="gold" size="sm" onClick={handleSaveStatusOverride} disabled={isUpdatingStatus}>
                {isUpdatingStatus ? 'Saving...' : 'Save State'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
