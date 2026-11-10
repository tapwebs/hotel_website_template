import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { availabilityService, roomService } from '../../../services/apiServices';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { MAX_ROOMS_AT_ONCE, parseRoomNumbers, previewNumbers } from './roomNumbers';

const field = 'min-h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-ink outline-none focus-visible:border-burgundy focus-visible:ring-2 focus-visible:ring-burgundy/25';

/** Add one or many rooms (admins). Each new room is vacant, bookable at once and gets its own ordering QR. */
export const AddRoomsModal: React.FC<{ onClose: () => void; onAdded: () => void }> = ({ onClose, onAdded }) => {
  const qc = useQueryClient();
  const types = useQuery({ queryKey: ['roomTypes'], queryFn: () => availabilityService.searchCategories(), staleTime: 60_000 });
  const [typeId, setTypeId] = useState('');
  const [text, setText] = useState('');
  const [floor, setFloor] = useState('');
  const [wing, setWing] = useState('');
  useEffect(() => { if (!typeId && types.data?.length) setTypeId(types.data[0].id); }, [types.data, typeId]);

  const setup = useMutation({
    mutationFn: () => roomService.setupTypes(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roomTypes'] }),
  });

  const parsed = parseRoomNumbers(text);
  const add = useMutation({
    mutationFn: () => roomService.create({
      room_type_id: typeId, room_numbers: parsed.numbers,
      floor_number: floor.trim() === '' ? undefined : Number(floor), wing: wing.trim() || undefined,
    }),
    onSuccess: onAdded,
  });
  const done = add.data;
  const ready = !!typeId && parsed.numbers.length > 0 && !parsed.error && (floor === '' || (Number.isInteger(Number(floor)) && Number(floor) >= 0));

  if (done) {
    return (
      <Modal isOpen onClose={onClose} title="Rooms added" maxWidth="md">
        <div className="grid gap-4">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Added <b>{done.created.length}</b> room{done.created.length === 1 ? '' : 's'}: {previewNumbers(done.created.map((r) => r.roomNumber)) || 'none'}.
            They are vacant and ready to book. Print their QR codes from Restaurant &amp; kitchen → Room dining.
          </p>
          {done.skipped.length > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Already existed, so not changed: {done.skipped.join(', ')}.
            </p>
          )}
          <div className="flex justify-end"><Button onClick={onClose}>Done</Button></div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen onClose={() => !add.isPending && onClose()} title="Add rooms" subtitle="Add one room or a whole floor at once" maxWidth="md">
      <form className="grid grid-cols-[minmax(0,1fr)] gap-4" onSubmit={(e) => { e.preventDefault(); if (ready) add.mutate(); }}>
        <label className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 text-sm font-semibold text-walnut">Room type
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={field} disabled={types.isLoading}>
            {(types.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {types.isSuccess && !types.data.length && (
            <span className="grid min-w-0 gap-2 text-xs font-normal text-rose-700">
              No room types exist yet.
              <Button type="button" variant="outline" className="h-auto min-h-10 w-full whitespace-normal py-2 text-center" onClick={() => setup.mutate()} isLoading={setup.isPending}>
                Create standard room types (Deluxe, Super Deluxe)
              </Button>
              {setup.error && <span role="alert">{(setup.error as Error).message}</span>}
            </span>
          )}
        </label>
        <label className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 text-sm font-semibold text-walnut">Room numbers
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="101-110, 201, 205" autoFocus
            aria-invalid={!!parsed.error} className={`${field} py-2 font-mono`} />
          <span className={`text-xs font-normal ${parsed.error ? 'text-rose-700' : 'text-muted-foreground'}`} role={parsed.error ? 'alert' : undefined}>
            {parsed.error ?? (parsed.numbers.length ? `Will add ${parsed.numbers.length} room${parsed.numbers.length === 1 ? '' : 's'}: ${previewNumbers(parsed.numbers)}` : `Separate with commas or spaces. Ranges like 101-110 are fine (up to ${MAX_ROOMS_AT_ONCE}).`)}
          </span>
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 text-sm font-semibold text-walnut">Floor <span className="text-xs font-normal text-muted-foreground">optional</span>
            <input inputMode="numeric" value={floor} onChange={(e) => setFloor(e.target.value.replace(/\D/g, ''))} placeholder="From the number" className={field} />
          </label>
          <label className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 text-sm font-semibold text-walnut">Wing <span className="text-xs font-normal text-muted-foreground">optional</span>
            <input maxLength={50} value={wing} onChange={(e) => setWing(e.target.value)} placeholder="e.g. North" className={field} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">Numbers that already exist are skipped, never changed. 101 goes on floor 1, 1203 on floor 12.</p>
        {add.error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{(add.error as Error).message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={add.isPending}>Cancel</Button>
          <Button type="submit" disabled={!ready} isLoading={add.isPending}>Add {parsed.numbers.length > 1 ? `${parsed.numbers.length} rooms` : 'room'}</Button>
        </div>
      </form>
    </Modal>
  );
};
