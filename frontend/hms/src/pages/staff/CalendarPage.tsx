import React, { useState, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Calendar as CalendarIcon, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { LoadingState } from '../../components/common/LoadingState';
import { reservationService } from '../../services/apiServices';
import type { Reservation } from '../../types/pms';

/** Map reservation status to a calendar event colour. */
function statusColor(status: string): { bg: string; border: string } {
  switch (status) {
    case 'CHECKED_IN':
      return { bg: '#059669', border: '#047857' };
    case 'CONFIRMED':
      return { bg: '#d97706', border: '#b45309' };
    case 'PENDING':
      return { bg: '#2563eb', border: '#1d4ed8' };
    case 'NO_SHOW':
      return { bg: '#dc2626', border: '#b91c1c' };
    case 'COMPLETED':
      return { bg: '#64748b', border: '#475569' };
    case 'CANCELLED':
      return { bg: '#94a3b8', border: '#64748b' };
    default:
      return { bg: '#2563eb', border: '#1d4ed8' };
  }
}

/** Convert an API Reservation into one or more FullCalendar EventInput objects (one per room). */
function reservationToEvents(res: Reservation) {
  return (res.rooms || []).map((room) => {
    const color = statusColor(room.stayStatus || res.status);
    const roomLabel = room.assignedRoomNumber ? `Rm ${room.assignedRoomNumber}` : room.roomTypeName;
    return {
      id: `${res.id}-${room.id}`,
      title: `${roomLabel} • ${res.guestName}`,
      start: room.checkIn || res.checkIn,
      end: room.checkOut || res.checkOut,
      backgroundColor: color.bg,
      borderColor: color.border,
      extendedProps: {
        reservationId: res.id,
        room: room.assignedRoomNumber || '—',
        roomType: room.roomTypeName,
        guest: res.guestName,
        status: room.stayStatus || res.status,
        ref: res.bookingReference,
        source: res.source,
        paymentStatus: res.paymentStatus,
        specialRequests: res.specialRequests,
      },
    };
  });
}


export const CalendarPage: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const {
    data: reservations = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<Reservation[]>({
    queryKey: ['reservations'],
    queryFn: () => reservationService.getAll(),
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const events = useMemo(() => {
    if (!reservations) return [];
    return reservations.flatMap(reservationToEvents);
  }, [reservations]);

  const handleEventClick = React.useCallback((info: any) => {
    setSelectedEvent(info.event);
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/app/reservations" className="text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Table
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-sans font-bold text-slate-900 tracking-tight">
            Room-Stay Calendar Matrix
          </h1>
          <p className="text-xs text-slate-500">
            Interactive room occupation timeline — data sourced live from PostgreSQL reservations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs bg-ivory text-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 text-slate-500 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-2 text-xs bg-ivory p-2.5 rounded-xl border border-slate-200">
            <span className="flex items-center gap-1 text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> In-House
            </span>
            <span className="flex items-center gap-1 text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600" /> Confirmed
            </span>
            <span className="flex items-center gap-1 text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Pending/Scheduled
            </span>
            <span className="flex items-center gap-1 text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Completed/Other
            </span>
          </div>
        </div>
      </div>

      {/* Calendar Card Container */}
      <div className="bg-ivory rounded-2xl border border-slate-200/90 shadow-sm p-5 overflow-hidden">
        {isLoading && (!reservations || reservations.length === 0) ? (
          <LoadingState message="Loading reservations from database..." />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3 text-slate-500">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="font-semibold text-slate-700">Failed to load reservations</p>
            <p className="text-xs text-center max-w-xs">
              {error instanceof Error ? error.message : 'API error. Please try again.'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
            </Button>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3 text-slate-400">
            <CalendarIcon className="w-8 h-8" />
            <p className="font-semibold text-slate-600">No reservations found</p>
            <p className="text-xs">Create a reservation to see it appear on the calendar.</p>
          </div>
        ) : (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            timeZone="Asia/Kolkata"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek',
            }}
            editable={false}
            selectable={false}
            events={events}
            eventClick={handleEventClick}
            height="auto"
            dayMaxEvents={3}
          />
        )}
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <Modal
          isOpen={Boolean(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          title={`Booking ${selectedEvent.extendedProps?.ref || selectedEvent.id}`}
          subtitle="Stay Details & Room Allocation"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-slate-400 block uppercase font-semibold text-[10px]">Guest & Room</span>
              <h4 className="font-bold text-slate-900 text-sm">{selectedEvent.extendedProps?.guest}</h4>
              <p className="text-slate-600">
                Room <strong>{selectedEvent.extendedProps?.room}</strong> ({selectedEvent.extendedProps?.roomType})
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Arrival</span>
                <span className="font-bold text-slate-900">{selectedEvent.startStr}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Departure</span>
                <span className="font-bold text-slate-900">{selectedEvent.endStr || selectedEvent.startStr}</span>
              </div>
            </div>

            {selectedEvent.extendedProps?.source && (
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Source</span>
                <span className="font-medium text-slate-900">{selectedEvent.extendedProps.source}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <Badge variant="gold" size="md">
                {selectedEvent.extendedProps?.status}
              </Badge>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedEvent(null)}>
                  Close
                </Button>
                <Link to="/app/front-desk">
                  <Button variant="gold" size="sm">
                    Open Front Desk →
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
