import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, BedDouble, Calendar, User, ArrowRight, X } from 'lucide-react';
import { usePmsUIStore } from '../../stores/pmsUIStore';
import { useQuery } from '@tanstack/react-query';
import { roomService, reservationService, guestService } from '../../services/apiServices';

export const CommandPaletteModal: React.FC = () => {
  const commandPaletteOpen = usePmsUIStore((s) => s.commandPaletteOpen);
  const setCommandPaletteOpen = usePmsUIStore((s) => s.setCommandPaletteOpen);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  // Real data only; fetched while the palette is open
  const enabled = commandPaletteOpen;
  const { data: rooms = [] } = useQuery({ queryKey: ['rooms'], queryFn: () => roomService.getAll(), enabled, staleTime: 15_000 });
  const { data: reservations = [] } = useQuery({ queryKey: ['reservations'], queryFn: () => reservationService.getAll(), enabled, staleTime: 15_000 });
  const { data: guests = [] } = useQuery({ queryKey: ['guests'], queryFn: () => guestService.getAll(), enabled, staleTime: 15_000 });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);


  const filteredRooms = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return rooms.slice(0, 3);
    return rooms.filter(r => 
      r.roomNumber.includes(q) || (r.currentGuestName && r.currentGuestName.toLowerCase().includes(q))
    ).slice(0, 3);
  }, [query]);

  const filteredReservations = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return reservations.slice(0, 3);
    return reservations.filter(res => 
      res.bookingReference.toLowerCase().includes(q) || res.guestName.toLowerCase().includes(q)
    ).slice(0, 3);
  }, [query]);

  const filteredGuests = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return guests.slice(0, 3);
    return guests.filter(g => 
      (g.fullName || '').toLowerCase().includes(q) || (g.email || '').toLowerCase().includes(q)
    ).slice(0, 3);
  }, [query]);

  const handleSelect = React.useCallback((path: string) => {
    navigate(path);
    setCommandPaletteOpen(false);
    setQuery('');
  }, [navigate, setCommandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity" 
        onClick={() => setCommandPaletteOpen(false)} 
      />

      <div className="relative bg-ivory w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in fade-in zoom-in-95">
        {/* Search Input */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type room number, guest name, or booking ref..."
            className="w-full text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {/* Quick Navigations */}
          <div>
            <h6 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-1.5">
              Quick Navigations
            </h6>
            <div className="grid grid-cols-2 gap-1">
              {[
                { label: 'Front Desk Arrivals', path: '/app/front-desk' },
                { label: 'Housekeeping Board', path: '/app/housekeeping' },
                { label: 'Master Folios', path: '/app/folio' },
                { label: 'Night Audit Checklist', path: '/app/night-audit' }
              ].map((nav, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(nav.path)}
                  className="text-left px-3 py-2 rounded-lg text-xs text-slate-700 hover:bg-slate-100 flex items-center justify-between group cursor-pointer"
                >
                  <span>{nav.label}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>

          {/* Rooms */}
          {filteredRooms.length > 0 && (
            <div>
              <h6 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-1.5 flex items-center gap-1.5">
                <BedDouble className="w-3 h-3" /> Rooms
              </h6>
              {filteredRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleSelect('/app/rooms')}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-100 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                      Room {room.roomNumber}
                    </span>
                    <span className="text-slate-600">{room.roomTypeName}</span>
                  </div>
                  <span className="text-slate-500 text-[11px]">
                    {room.currentGuestName || room.occupancyStatus}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Reservations */}
          {filteredReservations.length > 0 && (
            <div>
              <h6 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3 h-3" /> Reservations
              </h6>
              {filteredReservations.map((res) => (
                <button
                  key={res.id}
                  onClick={() => handleSelect('/app/reservations')}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-100 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-700">{res.bookingReference}</span>
                    <span className="text-slate-800 font-medium">{res.guestName}</span>
                  </div>
                  <span className="text-slate-500 text-[11px]">{res.status}</span>
                </button>
              ))}
            </div>
          )}

          {/* Guests */}
          {filteredGuests.length > 0 && (
            <div>
              <h6 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-1.5 flex items-center gap-1.5">
                <User className="w-3 h-3" /> Guests
              </h6>
              {filteredGuests.map((gst) => (
                <button
                  key={gst.id}
                  onClick={() => handleSelect('/app/guests')}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-100 flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <span className="font-medium text-slate-900 block">{gst.fullName}</span>
                    <span className="text-[11px] text-slate-400">{gst.email}</span>
                  </div>
                  <span className="text-amber-600 font-semibold text-[10px]">{gst.vipTier} VIP</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer Shortcut Helper */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 px-4">
          <span>Navigate with mouse or arrow keys</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  );
};
