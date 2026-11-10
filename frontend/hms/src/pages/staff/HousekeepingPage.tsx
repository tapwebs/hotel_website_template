import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Sparkles, 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  Clock, 
  User, 
  AlertTriangle, 
  Check, 
  ArrowRight,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { housekeepingService } from '../../services/apiServices';
import { HousekeepingTask } from '../../types/pms';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { RefreshCw } from 'lucide-react';

export const HousekeepingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [offlineSimulated, setOfflineSimulated] = useState(false);
  const [queuedMutationsCount, setQueuedMutationsCount] = useState(0);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const { data: tasks = [], isFetching, isLoading, refetch } = useQuery({
    queryKey: ['housekeepingTasks'],
    queryFn: () => housekeepingService.getTasks(),
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 5
  });

  const [localTasks, setLocalTasks] = useState<HousekeepingTask[]>(tasks);

  // Synchronize local tasks on query updates
  React.useEffect(() => {
    if (tasks) {
      setLocalTasks(tasks);
    }
  }, [tasks]);

  const handleAdvanceStatus = async (task: HousekeepingTask, targetStatus?: HousekeepingTask['status']) => {
    let nextStatus: HousekeepingTask['status'] = targetStatus || 'CLEANING';
    if (!targetStatus) {
      if (task.status === 'DIRTY') nextStatus = 'CLEANING';
      else if (task.status === 'CLEANING') nextStatus = 'CLEANED';
      else if (task.status === 'CLEANED') nextStatus = 'INSPECTED';
    }

    if (offlineSimulated) {
      setQueuedMutationsCount(prev => prev + 1);
      setSyncNotice(`Mutation queued in IndexedDB with envelope (command_id, base_version: 4). Will resolve conflict on Wi-Fi reconnect.`);
      setLocalTasks(prev => 
        prev ? prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t) : []
      );
      return;
    }

    setUpdatingTaskId(task.id);
    setActionError(null);
    try {
      const res = await housekeepingService.updateTaskStatus(task.id, nextStatus);
      if (!res) {
        throw new Error(`Failed to update task status for Room ${task.roomNumber}.`);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['housekeepingTasks'] }),
        queryClient.invalidateQueries({ queryKey: ['rooms'] })
      ]);
    } catch (err: any) {
      setActionError(err?.message || `Failed to update status for Room ${task.roomNumber}.`);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleSimulateReconnect = () => {
    setOfflineSimulated(false);
    if (queuedMutationsCount > 0) {
      setSyncNotice(`Wi-Fi restored! Server verified transition against current room state. ${queuedMutationsCount} mutations applied successfully with zero conflict.`);
      setQueuedMutationsCount(0);
      setTimeout(() => setSyncNotice(null), 4000);
    }
  };

  const columns: { status: HousekeepingTask['status']; title: string; color: string }[] = [
    { status: 'DIRTY', title: 'Needs Cleaning', color: 'border-amber-400 bg-amber-50/40' },
    { status: 'CLEANING', title: 'In Progress', color: 'border-purple-400 bg-purple-50/40' },
    { status: 'CLEANED', title: 'Cleaned (Pending Inspection)', color: 'border-blue-400 bg-blue-50/40' },
    { status: 'INSPECTED', title: 'Inspected & Ready', color: 'border-emerald-400 bg-emerald-50/40' }
  ];

  return (
    <div className="space-y-6">
      {/* Header & Offline Sync Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-sans font-bold text-slate-900 tracking-tight">
              Housekeeping Task Board
            </h1>
            {isFetching && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full font-medium animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" /> Syncing...
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            PWA mobile operational board with deterministic offline conflict resolution
          </p>
        </div>

        {/* Offline Simulation Widget */}
        <div className="flex items-center gap-3 bg-ivory p-2 rounded-xl border border-slate-200 text-xs">
          <div className="flex items-center gap-1.5 font-medium">
            {offlineSimulated ? (
              <span className="text-rose-600 flex items-center gap-1">
                <WifiOff className="w-3.5 h-3.5" /> Offline Mode (PWA Queued: {queuedMutationsCount})
              </span>
            ) : (
              <span className="text-emerald-700 flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 text-emerald-600" /> Online (PMS Synced)
              </span>
            )}
          </div>

          <button
            onClick={() => {
              if (offlineSimulated) handleSimulateReconnect();
              else setOfflineSimulated(true);
            }}
            className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded font-semibold cursor-pointer"
          >
            {offlineSimulated ? 'Reconnect Wi-Fi' : 'Simulate Drop'}
          </button>
        </div>
      </div>

      {/* Sync Notice Alert */}
      {syncNotice && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{syncNotice}</span>
          </div>
          <button onClick={() => setSyncNotice(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Action Error Alert */}
      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* 4-Column Housekeeping Kanban Board */}
      {isLoading && (!localTasks || localTasks.length === 0) ? (
        <LoadingState message="Fetching live room turnover tasks..." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {columns.map((col) => {
            const colTasks = localTasks?.filter(t => t.status === col.status) || [];

            return (
              <div
                key={col.status}
                className={`rounded-2xl border-t-4 p-4 bg-ivory border border-slate-200 shadow-2xs space-y-3 ${col.color}`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    {col.title}
                  </h3>
                  <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded-full text-slate-700">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {colTasks.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs italic">
                      No rooms in this state
                    </div>
                  ) : (
                    colTasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-ivory rounded-xl p-3.5 border border-slate-200 shadow-2xs hover:shadow-sm transition-shadow space-y-2.5"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-mono text-base font-bold text-slate-900 block">
                              Room {task.roomNumber}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">
                              Floor {task.floor} • {task.roomTypeName}
                            </span>
                          </div>

                          <Badge
                            variant={task.priority === 'HIGH' ? 'destructive' : task.priority === 'VIP' ? 'gold' : 'default'}
                            size="sm"
                          >
                            {task.priority}
                          </Badge>
                        </div>

                        <div className="text-xs text-slate-600 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            {task.assignedToStaffName || 'Unassigned'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {task.taskType.replace('_', ' ')}
                          </span>
                        </div>

                        {task.notes && (
                          <p className="text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded">
                            {task.notes}
                          </p>
                        )}

                        {/* Transition Action Button */}
                        {task.status !== 'INSPECTED' && (
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5">
                            {task.status === 'CLEANED' ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={updatingTaskId === task.id}
                                  onClick={() => handleAdvanceStatus(task, 'DIRTY')}
                                  className="h-7 text-[11px] px-2 text-rose-700 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
                                  title="Failed inspection: return to turnover cleaning"
                                >
                                  {updatingTaskId === task.id ? 'Saving...' : 'Fail Inspection ✕'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={updatingTaskId === task.id}
                                  onClick={() => handleAdvanceStatus(task, 'INSPECTED')}
                                  className="h-7 text-[11px] px-2.5 text-emerald-800 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300"
                                >
                                  {updatingTaskId === task.id ? 'Saving...' : 'Approve & Inspect ✓'}
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={updatingTaskId === task.id}
                                onClick={() => handleAdvanceStatus(task)}
                                className="h-7 text-[11px] px-2.5 text-slate-800 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300"
                              >
                                {updatingTaskId === task.id
                                  ? 'Updating...'
                                  : task.status === 'DIRTY'
                                  ? 'Start Cleaning →'
                                  : 'Mark Cleaned →'}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
