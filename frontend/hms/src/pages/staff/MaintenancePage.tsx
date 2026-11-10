import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Wrench,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Filter,
  User,
  ShieldAlert,
  Check,
  PauseCircle,
  Play,
  XCircle,
  FileText
} from 'lucide-react';
import { maintenanceService, roomService } from '../../services/apiServices';
import { MaintenanceTicket, PhysicalRoom } from '../../types/pms';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingState } from '../../components/common/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';

export const MaintenancePage: React.FC = () => {
  const queryClient = useQueryClient();

  // Modals & Selection
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<MaintenanceTicket | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'BLOCKED' | 'RESOLVED'>('ALL');

  // Form state for New Work Order
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [category, setCategory] = useState<string>('HVAC');
  const [priority, setPriority] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [technician, setTechnician] = useState('');
  const [blocksRoom, setBlocksRoom] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Details Modal edit states
  const [detailsTechnician, setDetailsTechnician] = useState('');
  const [detailsResolutionNotes, setDetailsResolutionNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsSuccess, setDetailsSuccess] = useState<string | null>(null);

  // Queries
  const {
    data: tickets = [],
    isLoading: isTicketsLoading,
    isFetching: isTicketsFetching,
    error: ticketsError,
    refetch: refetchTickets
  } = useQuery<MaintenanceTicket[]>({
    queryKey: ['maintenanceTickets'],
    queryFn: () => maintenanceService.getTickets(),
    staleTime: 1000 * 30
  });

  const { data: rooms = [] } = useQuery<PhysicalRoom[]>({
    queryKey: ['rooms'],
    queryFn: () => roomService.getAll(),
    staleTime: 1000 * 60
  });

  // Selected room for new ticket modal
  const selectedRoom = useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId);
  }, [rooms, selectedRoomId]);

  // Set default room selection when rooms load
  React.useEffect(() => {
    if (rooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [rooms, selectedRoomId]);

  // Synchronize details modal state when selectedTicket changes
  React.useEffect(() => {
    if (selectedTicket) {
      setDetailsTechnician(selectedTicket.assignedTechnician || '');
      setDetailsResolutionNotes(selectedTicket.resolutionNotes || '');
      setDetailsError(null);
      setDetailsSuccess(null);
    }
  }, [selectedTicket]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Search
      const matchesSearch =
        searchTerm === '' ||
        t.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.roomNumber && t.roomNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.locationArea && t.locationArea.toLowerCase().includes(searchTerm.toLowerCase())) ||
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.assignedTechnician && t.assignedTechnician.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      // Status Filter
      if (statusFilter === 'ACTIVE') {
        return ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'WAITING_PARTS'].includes(t.status);
      }
      if (statusFilter === 'BLOCKED') {
        return t.blocksRoomFromSale;
      }
      if (statusFilter === 'RESOLVED') {
        return ['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status);
      }

      return true;
    });
  }, [tickets, searchTerm, statusFilter]);

  // Create Ticket Handler
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setCreateError('Issue summary is required.');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      await maintenanceService.createTicket({
        room_id: selectedRoom?.id,
        room_number: selectedRoom?.roomNumber,
        category,
        priority,
        title: title.trim(),
        description: description.trim(),
        assigned_technician: technician.trim() || undefined,
        blocks_room_from_sale: blocksRoom
      });

      // Invalidate queries to refresh lists and room statuses
      await queryClient.invalidateQueries({ queryKey: ['maintenanceTickets'] });
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });

      // Reset and close
      setTitle('');
      setDescription('');
      setTechnician('');
      setBlocksRoom(true);
      setNewTicketModalOpen(false);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create work order.');
    } finally {
      setIsCreating(false);
    }
  };

  // Update Ticket Status or Details
  const handleUpdateTicket = async (updatePayload: {
    status?: MaintenanceTicket['status'];
    assigned_technician?: string;
    resolution_notes?: string;
    priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    blocks_room_from_sale?: boolean;
  }) => {
    if (!selectedTicket) return;

    setIsUpdating(true);
    setDetailsError(null);
    setDetailsSuccess(null);

    try {
      const updated = await maintenanceService.updateTicketStatus(selectedTicket.id, updatePayload);
      if (updated) {
        setSelectedTicket(updated);
        setDetailsSuccess('Ticket successfully updated.');
      }

      await queryClient.invalidateQueries({ queryKey: ['maintenanceTickets'] });
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
    } catch (err: any) {
      setDetailsError(err.message || 'Failed to update maintenance ticket.');
    } finally {
      setIsUpdating(false);
    }
  };

  const getPriorityBadgeVariant = (pri: string) => {
    switch (pri) {
      case 'CRITICAL':
        return 'destructive';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'gold';
      default:
        return 'default';
    }
  };

  const getStatusBadgeVariant = (st: string) => {
    switch (st) {
      case 'RESOLVED':
        return 'success';
      case 'CLOSED':
        return 'default';
      case 'IN_PROGRESS':
        return 'info';
      case 'ASSIGNED':
        return 'purple';
      case 'ON_HOLD':
      case 'WAITING_PARTS':
        return 'warning';
      case 'CANCELLED':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-sans font-bold text-slate-900 tracking-tight">
              Maintenance & Engineering
            </h1>
            {isTicketsFetching && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full font-medium animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" /> Syncing...
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Defect reporting, room outage isolation (OOO), technician dispatch, and SLA resolution tracking
          </p>
        </div>

        <Button
          variant="gold"
          size="sm"
          onClick={() => {
            setCreateError(null);
            setNewTicketModalOpen(true);
          }}
          className="text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> New Work Order
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-ivory p-3 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search ticket #, room, defect, staff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white text-slate-900 border border-slate-200 rounded-md pl-9 pr-3 py-1.5 pointer-coarse:py-2.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-burgundy"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Tickets ({tickets.length})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              statusFilter === 'ACTIVE'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Active / Open
          </button>
          <button
            onClick={() => setStatusFilter('BLOCKED')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              statusFilter === 'BLOCKED'
                ? 'bg-rose-700 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            Blocked (OOO)
          </button>
          <button
            onClick={() => setStatusFilter('RESOLVED')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              statusFilter === 'RESOLVED'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Resolved / Closed
          </button>
        </div>
      </div>

      {/* Tickets List */}
      <div className="bg-ivory rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {isTicketsLoading ? (
          <LoadingState message="Fetching engineering tickets..." />
        ) : ticketsError ? (
          <div className="p-8 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-xs text-rose-600 font-semibold">
              Failed to load maintenance tickets: {(ticketsError as any)?.message || 'Server error'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetchTickets()}>
              Retry
            </Button>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Wrench className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-medium text-slate-500">
              {searchTerm || statusFilter !== 'ALL'
                ? 'No maintenance tickets match the selected filters.'
                : 'No maintenance tickets logged. Click "New Work Order" to create one.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Ticket #</th>
                  <th className="py-3 px-4">Location / Room</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Issue Summary</th>
                  <th className="py-3 px-4">Technician</th>
                  <th className="py-3 px-4">Blocks Sale (OOO)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{t.ticketNumber}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {t.roomNumber ? `Room ${t.roomNumber}` : t.locationArea || 'General Area'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" size="sm">
                        {t.category}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={getPriorityBadgeVariant(t.priority)} size="sm">
                        {t.priority}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-700" title={t.title}>
                      {t.title}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {t.assignedTechnician ? (
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          {t.assignedTechnician}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {t.blocksRoomFromSale ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          <ShieldAlert className="w-3 h-3 text-rose-600" />
                          YES (OOO)
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">No</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={getStatusBadgeVariant(t.status)} size="sm">
                        {t.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTicket(t)}
                        className="h-7 text-xs px-2.5"
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <Modal
          isOpen={Boolean(selectedTicket)}
          onClose={() => {
            setSelectedTicket(null);
            setDetailsError(null);
            setDetailsSuccess(null);
          }}
          title={`Ticket ${selectedTicket.ticketNumber}`}
          subtitle={`Reported: ${new Date(selectedTicket.reportedAt).toLocaleString()} by ${selectedTicket.reportedBy}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            {/* Status alerts */}
            {detailsError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{detailsError}</span>
              </div>
            )}
            {detailsSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{detailsSuccess}</span>
              </div>
            )}

            {/* Quick Overview Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Location / Room</span>
                <span className="font-bold text-slate-800 text-xs">
                  {selectedTicket.roomNumber ? `Room ${selectedTicket.roomNumber}` : selectedTicket.locationArea || 'General'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Category</span>
                <Badge variant="outline" size="sm">
                  {selectedTicket.category}
                </Badge>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Priority</span>
                <Badge variant={getPriorityBadgeVariant(selectedTicket.priority)} size="sm">
                  {selectedTicket.priority}
                </Badge>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Current Status</span>
                <Badge variant={getStatusBadgeVariant(selectedTicket.status)} size="sm">
                  {selectedTicket.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>

            {/* Room Block Warning / Status */}
            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                selectedTicket.blocksRoomFromSale
                  ? ['CLOSED', 'CANCELLED'].includes(selectedTicket.status)
                    ? 'bg-slate-50 border-slate-200 text-slate-700'
                    : 'bg-amber-50/80 border-amber-200 text-amber-800'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <ShieldAlert
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  selectedTicket.blocksRoomFromSale && !['CLOSED', 'CANCELLED'].includes(selectedTicket.status)
                    ? 'text-amber-600'
                    : 'text-slate-400'
                }`}
              />
              <div className="text-[11px] leading-relaxed">
                <span className="font-bold block">Room Outage / Sale Isolation:</span>
                {selectedTicket.blocksRoomFromSale ? (
                  ['CLOSED', 'CANCELLED'].includes(selectedTicket.status) ? (
                    'This ticket was configured to block the room, but the ticket is closed/cancelled. The maintenance restriction has been released for this ticket (room is operational unless another active ticket blocks it).'
                  ) : selectedTicket.status === 'RESOLVED' ? (
                    'Repair is marked resolved, awaiting final verification and closure. The room remains blocked until ticket closure.'
                  ) : (
                    'This ticket blocks the room from new sales and check-ins (OUT OF ORDER). Physical occupancy and housekeeping states remain preserved.'
                  )
                ) : (
                  'This ticket does not block room inventory. The room remains available for sale and check-in.'
                )}
              </div>
            </div>

            {/* Issue Summary & Description */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Defect Description</span>
              <h4 className="font-bold text-slate-900 text-sm">{selectedTicket.title}</h4>
              {selectedTicket.description ? (
                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedTicket.description}</p>
              ) : (
                <p className="text-slate-400 italic">No additional description provided.</p>
              )}
            </div>

            {/* Technician Assignment */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2 shadow-2xs">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Technician Assignment</span>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Technician name..."
                  value={detailsTechnician}
                  disabled={isUpdating || ['CLOSED', 'CANCELLED'].includes(selectedTicket.status)}
                  onChange={(e) => setDetailsTechnician(e.target.value)}
                  className="w-full bg-ivory text-slate-900 border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-burgundy disabled:bg-slate-100"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    isUpdating ||
                    ['CLOSED', 'CANCELLED'].includes(selectedTicket.status) ||
                    detailsTechnician.trim() === (selectedTicket.assignedTechnician || '')
                  }
                  onClick={() => handleUpdateTicket({ assigned_technician: detailsTechnician.trim() })}
                  className="shrink-0 text-xs h-8"
                >
                  Save Tech
                </Button>
              </div>
            </div>

            {/* Status Workflow Action Buttons */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2 shadow-2xs">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Workflow Actions</span>
              <div className="flex flex-wrap gap-2">
                {/* OPEN / ASSIGNED -> IN_PROGRESS */}
                {['OPEN', 'ASSIGNED'].includes(selectedTicket.status) && (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isUpdating}
                    onClick={() => handleUpdateTicket({ status: 'IN_PROGRESS' })}
                    className="text-xs"
                  >
                    <Play className="w-3.5 h-3.5 mr-1" /> Start Repair (In Progress)
                  </Button>
                )}

                {/* IN_PROGRESS -> ON_HOLD or RESOLVED */}
                {selectedTicket.status === 'IN_PROGRESS' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isUpdating}
                      onClick={() => handleUpdateTicket({ status: 'ON_HOLD' })}
                      className="text-xs"
                    >
                      <PauseCircle className="w-3.5 h-3.5 mr-1 text-amber-600" /> Put On Hold
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isUpdating}
                      onClick={() =>
                        handleUpdateTicket({
                          status: 'RESOLVED',
                          resolution_notes: detailsResolutionNotes.trim() || undefined
                        })
                      }
                      className="text-xs bg-emerald-700 hover:bg-emerald-800"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Resolved
                    </Button>
                  </>
                )}

                {/* ON_HOLD -> Resume or RESOLVED */}
                {selectedTicket.status === 'ON_HOLD' && (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isUpdating}
                      onClick={() => handleUpdateTicket({ status: 'IN_PROGRESS' })}
                      className="text-xs"
                    >
                      <Play className="w-3.5 h-3.5 mr-1" /> Resume Repair
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isUpdating}
                      onClick={() =>
                        handleUpdateTicket({
                          status: 'RESOLVED',
                          resolution_notes: detailsResolutionNotes.trim() || undefined
                        })
                      }
                      className="text-xs bg-emerald-700 hover:bg-emerald-800"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Resolved
                    </Button>
                  </>
                )}

                {/* RESOLVED -> Close or Reopen */}
                {selectedTicket.status === 'RESOLVED' && (
                  <>
                    <Button
                      variant="gold"
                      size="sm"
                      disabled={isUpdating}
                      onClick={() =>
                        handleUpdateTicket({
                          status: 'CLOSED',
                          resolution_notes: detailsResolutionNotes.trim() || undefined
                        })
                      }
                      className="text-xs font-semibold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Verify & Close Ticket
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isUpdating}
                      onClick={() => handleUpdateTicket({ status: 'IN_PROGRESS' })}
                      className="text-xs text-slate-700"
                    >
                      Reopen Repair
                    </Button>
                  </>
                )}

                {/* Cancel option for non-completed tickets */}
                {!['CLOSED', 'CANCELLED'].includes(selectedTicket.status) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isUpdating}
                    onClick={() => {
                      if (window.confirm('Are you sure you want to cancel this maintenance work order?')) {
                        handleUpdateTicket({ status: 'CANCELLED' });
                      }
                    }}
                    className="text-xs text-rose-600 hover:bg-rose-50 ml-auto"
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel Ticket
                  </Button>
                )}
              </div>
            </div>

            {/* Resolution Notes */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2 shadow-2xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Resolution Notes</span>
                {selectedTicket.resolvedAt && (
                  <span className="text-[10px] text-slate-400">
                    Resolved at: {new Date(selectedTicket.resolvedAt).toLocaleString()}
                  </span>
                )}
              </div>
              <textarea
                rows={2}
                placeholder="Enter work performed, parts replaced, or supervisor sign-off notes..."
                value={detailsResolutionNotes}
                disabled={isUpdating || ['CLOSED', 'CANCELLED'].includes(selectedTicket.status)}
                onChange={(e) => setDetailsResolutionNotes(e.target.value)}
                className="w-full bg-ivory text-slate-900 border border-slate-300 rounded-md p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-burgundy disabled:bg-slate-100"
              />
              {!['CLOSED', 'CANCELLED'].includes(selectedTicket.status) && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      isUpdating ||
                      detailsResolutionNotes.trim() === (selectedTicket.resolutionNotes || '')
                    }
                    onClick={() => handleUpdateTicket({ resolution_notes: detailsResolutionNotes.trim() })}
                    className="text-xs h-7"
                  >
                    Save Notes
                  </Button>
                </div>
              )}
            </div>

            {/* Close footer */}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedTicket(null);
                  setDetailsError(null);
                  setDetailsSuccess(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Ticket Modal */}
      {newTicketModalOpen && (
        <Modal
          isOpen={newTicketModalOpen}
          onClose={() => {
            setNewTicketModalOpen(false);
            setCreateError(null);
          }}
          title="Create Engineering Work Order"
          subtitle="Direct synchronization with physical room inventory status"
          maxWidth="md"
        >
          <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
            {createError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{createError}</span>
              </div>
            )}

            {/* Room selection & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Physical Room <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="w-full bg-ivory text-slate-900 border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-burgundy"
                >
                  {rooms.map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      Room {rm.roomNumber} (Floor {rm.floor} - {rm.occupancyStatus})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-ivory text-slate-900 border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-burgundy"
                >
                  <option value="HVAC">HVAC / Air Conditioning</option>
                  <option value="PLUMBING">Plumbing & Water</option>
                  <option value="ELECTRICAL">Electrical & Lighting</option>
                  <option value="CARPENTRY">Furniture & Carpentry</option>
                  <option value="APPLIANCE">Appliance / TV / Minibar</option>
                  <option value="STRUCTURAL">Structural & Civil</option>
                  <option value="OTHER">Other Defect</option>
                </select>
              </div>
            </div>

            {/* Occupied Warning Banner if room is OCCUPIED */}
            {selectedRoom && selectedRoom.occupancyStatus === 'OCCUPIED' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Room {selectedRoom.roomNumber} is currently OCCUPIED</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Blocking this room from sale will prevent new reservations and check-ins, but will{' '}
                  <strong>NOT</strong> displace or check out the current in-house guest.
                </p>
              </div>
            )}

            {/* Priority & Technician */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Priority <span className="text-rose-500">*</span>
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full bg-ivory text-slate-900 border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-burgundy"
                >
                  <option value="LOW">LOW — Minor cosmetic</option>
                  <option value="MEDIUM">MEDIUM — Standard maintenance</option>
                  <option value="HIGH">HIGH — High priority repair</option>
                  <option value="CRITICAL">CRITICAL — Emergency outage</option>
                </select>
              </div>

              <div>
                <Input
                  label="Assign Technician (Optional)"
                  placeholder="e.g. Ramesh Kumar"
                  value={technician}
                  onChange={(e) => setTechnician(e.target.value)}
                />
              </div>
            </div>

            {/* Issue Summary */}
            <div>
              <Input
                label="Issue Summary"
                required
                placeholder="e.g. Low water pressure in shower head"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Detailed Description */}
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                Detailed Description (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Provide details about the fault, location, or guest observations..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-ivory text-slate-900 border border-slate-300 rounded-md p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-burgundy"
              />
            </div>

            {/* Block Room Checkbox */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={blocksRoom}
                  onChange={(e) => setBlocksRoom(e.target.checked)}
                  className="rounded text-burgundy accent-burgundy mt-0.5"
                />
                <div>
                  <span className="font-semibold text-slate-900 block text-xs">
                    Block Room from Sale (Set Room OUT OF ORDER)
                  </span>
                  <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                    Locks room out of availability and prevents front desk check-in without altering current
                    occupancy or housekeeping status.
                  </span>
                </div>
              </label>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={isCreating}
                onClick={() => setNewTicketModalOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="gold" size="sm" type="submit" isLoading={isCreating}>
                Log Ticket & Dispatch
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
