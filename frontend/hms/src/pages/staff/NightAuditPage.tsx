import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Moon, CheckCircle2, Clock, AlertTriangle, Play, FileText, Calendar, ShieldCheck, UserCheck, XCircle } from 'lucide-react';
import { reportService, reservationService } from '../../services/apiServices';
import { usePmsUIStore } from '../../stores/pmsUIStore';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingState } from '../../components/common/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { RefreshCw } from 'lucide-react';
import { UnresolvedArrivalItem, NightAuditRolloverResult } from '../../types/reports';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';

import { useAppDate } from '../../hooks/useAppDate';
import { useSettingsStore } from '../../stores/settingsStore';

export const NightAuditPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { businessDate, calendarDate, isAuditPending } = useAppDate();
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditComplete, setAuditComplete] = useState(false);
  const [auditMessage, setAuditMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<NightAuditRolloverResult | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [noShowModalItem, setNoShowModalItem] = useState<UnresolvedArrivalItem | null>(null);
  const [isDeclaringNoShow, setIsDeclaringNoShow] = useState(false);

  const { data: steps = [], isFetching: isStepsFetching, isLoading: isStepsLoading } = useQuery({
    queryKey: ['nightAuditSteps'],
    queryFn: () => reportService.getNightAuditSteps(),
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true
  });

  const { data: auditStatus, isFetching: isStatusFetching } = useQuery({
    queryKey: ['nightAuditStatus'],
    queryFn: () => reportService.getNightAuditStatus(),
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true
  });

  const { data: history = [] } = useQuery({
    queryKey: ['nightAuditHistory'],
    queryFn: () => reportService.getNightAuditHistory(30),
    staleTime: 1000 * 30,
  });

  const isFetching = isStepsFetching || isStatusFetching;
  const isCompleted = auditStatus?.status === 'COMPLETED' || auditComplete || (steps && steps.length > 0 && steps.every((s) => s.status === 'PASSED'));
  const isBlocked = auditStatus?.status === 'BLOCKED' && !isCompleted;
  const isFailed = auditStatus?.status === 'FAILED' && !isCompleted;
  const canRunAudit = auditStatus ? auditStatus.can_run : !isCompleted && !isBlocked;

  const handleExecuteAudit = async () => {
    setConfirmModalOpen(false);
    setIsAuditing(true);
    setAuditMessage(null);
    try {
      const res = await reportService.executeRollover();
      if (res?.new_business_date) {
        usePmsUIStore.getState().setBusinessDate(res.new_business_date);
        useSettingsStore.getState().setBusinessDate(res.new_business_date);
      }
      setAuditComplete(true);
      setLastResult(res ?? null);
      if (res?.already_completed) {
        setAuditMessage(`Business date ${res.business_date} was already finalized. Active business date remains ${res.new_business_date}.`);
      } else {
        setAuditMessage(res?.message || 'Night audit successfully finalized.');
      }
      await queryClient.invalidateQueries({ queryKey: ['businessDate'] });
      await queryClient.invalidateQueries({ queryKey: ['reservations'] });
      await queryClient.invalidateQueries({ queryKey: ['nightAuditSteps'] });
      await queryClient.invalidateQueries({ queryKey: ['nightAuditStatus'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboardKPIs'] });
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      await queryClient.invalidateQueries({ queryKey: ['nightAuditHistory'] });
      await queryClient.invalidateQueries({ queryKey: ['managerFlashReport'] });
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
    } catch (err: any) {
      console.error('Night audit execution failed:', err);
      setAuditMessage(err?.message || 'Night audit execution failed. Please check unresolved items and retry.');
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-sans font-bold text-slate-900 tracking-tight">
              Night Audit & Day Close Engine
            </h1>
            {isFetching && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full font-medium animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" /> Syncing...
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            System reconciliation, room charge posting, ledger rollover, and business date advancement • Calendar Date: <span className="font-mono font-semibold text-slate-700">{calendarDate}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-lg font-semibold">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>Active Business Date:</span>
            <span className="font-mono">{businessDate}</span>
            {isAuditPending && (
              <span className="ml-1 text-[10px] bg-amber-200/70 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                Rollover Required
              </span>
            )}
            {isCompleted && !isAuditPending && (
              <span className="ml-1 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                Day Closed
              </span>
            )}
          </div>

          <Button
            variant={isCompleted ? 'outline' : isBlocked ? 'outline' : 'gold'}
            size="sm"
            disabled={isAuditing || (!canRunAudit && !isCompleted)}
            onClick={() => {
              if (isCompleted) {
                // Repeat click displays existing completion message without repeating rollover
                handleExecuteAudit();
              } else {
                setConfirmModalOpen(true);
              }
            }}
            className="text-xs"
          >
            {isAuditing ? (
              <>
                <Clock className="w-3.5 h-3.5 mr-1 animate-spin" /> Processing Audit...
              </>
            ) : isCompleted ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Audit Finalized (Active: {businessDate})
              </>
            ) : isBlocked ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" /> Blocked: Resolve Checklist
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 mr-1" /> Run Night Audit Rollover
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Audit Success Banner */}
      {isCompleted && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm">Night Audit Successfully Finalized</h4>
            <p className="mt-1 leading-relaxed">
              • {lastResult
                ? <>{lastResult.room_charges_posted ?? 0} nightly room {(lastResult.room_charges_posted ?? 0) === 1 ? 'charge' : 'charges'} posted (<CurrencyDisplay amountPaise={lastResult.total_charges_minor ?? 0} /> + GST <CurrencyDisplay amountPaise={lastResult.total_tax_minor ?? 0} />). Prepaid stays are not charged twice.</>
                : <>Room rates and GST posted to all eligible in-house stays.</>}<br />
              • Business date successfully advanced to <strong>{businessDate}</strong>.<br />
              • Manager Flash Report generated and archived in database.
              {auditMessage && <><br />• <span className="font-medium text-emerald-800">{auditMessage}</span></>}
            </p>
          </div>
        </div>
      )}

      {/* Audit Blocked Banner */}
      {isBlocked && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm">Night Audit Execution Blocked</h4>
            <p className="mt-1 leading-relaxed">
              The following operational items must be resolved before the business date can be advanced:
            </p>
            <ul className="mt-1.5 list-disc list-inside space-y-0.5 font-medium">
              {auditStatus?.blocking_reasons?.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Audit Failed / Retry Banner */}
      {isFailed && (
        <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm">Previous Audit Attempt Incomplete</h4>
            <p className="mt-1 leading-relaxed">
              An error occurred during previous execution. Safe to retry: already completed steps will not be duplicated.
            </p>
          </div>
        </div>
      )}

      {/* Step by Step Checklist */}
      <div className="bg-ivory rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100">
          Night Audit Verification Pipeline
        </h3>

        {isStepsLoading && (!steps || steps.length === 0) ? (
          <LoadingState message="Loading audit checklist..." />
        ) : (
          <div className="space-y-3">
            {steps?.map((step) => {
              const isPassed = step.status === 'PASSED' || (isCompleted && step.stepNumber <= 6);
              const isFailedStep = step.status === 'FAILED' && !isCompleted;
              const isInProgress = isAuditing && step.stepNumber === 4;

              return (
                <div
                  key={step.id}
                  className="p-4 rounded-xl border border-slate-200 flex items-start justify-between gap-4 bg-slate-50/50"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="mt-0.5 shrink-0">
                      {isPassed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : isFailedStep ? (
                        <AlertTriangle className="w-5 h-5 text-rose-600" />
                      ) : isInProgress ? (
                        <Clock className="w-5 h-5 text-amber-600 animate-spin" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-300 font-mono text-[10px] flex items-center justify-center font-bold text-slate-400">
                          {step.stepNumber}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{step.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{step.description}</p>
                      {step.details && (
                        <p className={`text-[11px] font-mono px-2 py-0.5 rounded mt-1.5 inline-block ${
                          isPassed ? 'text-emerald-800 bg-emerald-50' : isFailedStep ? 'text-rose-800 bg-rose-50' : 'text-slate-600 bg-slate-100'
                        }`}>
                          {step.details}
                        </p>
                      )}

                      {/* Unresolved items details & action routes */}
                      {isFailedStep && step.unresolved_items && step.unresolved_items.length > 0 && (
                        <div className="mt-3 space-y-2 border-t border-slate-200/70 pt-2.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Unresolved Arrivals Requiring Action:
                          </span>
                          {step.unresolved_items.map((item) => (
                            <div
                              key={item.reservation_id}
                              className="p-3 bg-white rounded-lg border border-amber-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-xs text-slate-900">{item.booking_reference}</span>
                                  {item.external_booking_ref && (
                                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                      {item.external_booking_ref}
                                    </span>
                                  )}
                                  <span className="text-xs font-semibold text-slate-700">• {item.guest_name}</span>
                                </div>
                                <p className="text-[11px] text-amber-800 mt-0.5">
                                  {item.total_rooms > 1
                                    ? `${item.checked_in_rooms} of ${item.total_rooms} rooms checked in (${item.pending_rooms} pending check-in or NO-SHOW)`
                                    : 'Pending check-in or NO-SHOW'}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs py-1 px-2.5 h-auto"
                                  onClick={() => navigate(`/app/front-desk?ref=${item.booking_reference}`)}
                                >
                                  Front Desk Check-In
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="text-xs py-1 px-2.5 h-auto"
                                  onClick={() => setNoShowModalItem(item)}
                                >
                                  Declare No-Show
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <Badge variant={isPassed ? 'success' : isFailedStep ? 'destructive' : isInProgress ? 'warning' : 'default'} size="sm">
                    {isPassed ? 'Ready' : isFailedStep ? 'Action Required' : isInProgress ? 'Processing' : 'Pending'}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Audit history */}
      <div className="bg-ivory rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100">Night Audit History</h3>
        {history.length === 0 ? (
          <p className="text-xs text-slate-500">No night audit has been run yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <th className="py-2 pr-3">Business date</th>
                  <th className="py-2 pr-3">Closed by</th>
                  <th className="py-2 pr-3 text-right">Rooms sold</th>
                  <th className="py-2 pr-3 text-right">Occupancy</th>
                  <th className="py-2 pr-3 text-right">Revenue</th>
                  <th className="py-2 pr-3 text-right">Posted</th>
                  <th className="py-2 pr-3 text-right">GST posted</th>
                  <th className="py-2 pr-3">Completed</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {history.map((h) => (
                  <tr key={h.business_date}>
                    <td className="py-2 pr-3 font-bold text-slate-900">{h.business_date}</td>
                    <td className="py-2 pr-3 font-sans text-slate-600">{h.performed_by}</td>
                    <td className="py-2 pr-3 text-right">{h.rooms_sold ?? '-'}</td>
                    <td className="py-2 pr-3 text-right">{h.occupancy_pct != null ? `${h.occupancy_pct}%` : '-'}</td>
                    <td className="py-2 pr-3 text-right">{h.gross_revenue_minor != null ? <CurrencyDisplay amountPaise={h.gross_revenue_minor} /> : '-'}</td>
                    <td className="py-2 pr-3 text-right"><CurrencyDisplay amountPaise={h.total_charges_minor} /></td>
                    <td className="py-2 pr-3 text-right"><CurrencyDisplay amountPaise={h.total_tax_minor} /></td>
                    <td className="py-2 pr-3 font-sans text-slate-600">{h.completed_at ? new Date(h.completed_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : h.status}</td>
                    <td className="py-2 text-right">
                      {h.has_report && (
                        <Button variant="outline" size="sm" className="text-[11px] py-0.5 px-2 h-auto" onClick={() => navigate(`/app/reports?date=${h.business_date}`)}>
                          <FileText className="w-3 h-3 mr-1" /> Report
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <Modal
          isOpen={confirmModalOpen}
          onClose={() => setConfirmModalOpen(false)}
          title="Confirm Night Audit Execution"
          subtitle="Irreversible business date roll-over"
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
              <span className="font-bold block">Warning:</span>
              This operation will close the current business day ({businessDate}), verify POS batches, post statutory room charges to in-house folios, and advance the calendar date.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setConfirmModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="gold" size="sm" onClick={handleExecuteAudit}>
                Proceed with Rollover
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* No-Show Confirmation Modal */}
      {noShowModalItem && (
        <Modal
          isOpen={!!noShowModalItem}
          onClose={() => setNoShowModalItem(null)}
          title="Confirm NO-SHOW Declaration"
          subtitle={`Reservation ${noShowModalItem.booking_reference}`}
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 space-y-1">
              <span className="font-bold block">Guest: {noShowModalItem.guest_name}</span>
              {noShowModalItem.checked_in_rooms > 0 ? (
                <p>
                  This reservation has {noShowModalItem.checked_in_rooms} room(s) checked in and {noShowModalItem.pending_rooms} unassigned room unit(s). Declaring No-Show will release the {noShowModalItem.pending_rooms} pending unit(s) and update the booking to permit Night Audit rollover.
                </p>
              ) : (
                <p>
                  Declaring NO-SHOW will release held inventory and update reservation status to NO_SHOW.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setNoShowModalItem(null)} disabled={isDeclaringNoShow}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={isDeclaringNoShow}
                onClick={async () => {
                  setIsDeclaringNoShow(true);
                  try {
                    await reservationService.markNoShow(noShowModalItem.booking_reference);
                    setNoShowModalItem(null);
                    await queryClient.invalidateQueries({ queryKey: ['nightAuditSteps'] });
                    await queryClient.invalidateQueries({ queryKey: ['nightAuditStatus'] });
                    await queryClient.invalidateQueries({ queryKey: ['reservations'] });
                    await queryClient.invalidateQueries({ queryKey: ['dashboardKPIs'] });
                  } catch (err: any) {
                    alert(`Failed to declare NO-SHOW: ${err.message || 'Unknown error'}`);
                  } finally {
                    setIsDeclaringNoShow(false);
                  }
                }}
              >
                {isDeclaringNoShow ? <><Clock className="w-3.5 h-3.5 mr-1 animate-spin" /> Updating...</> : 'Confirm NO-SHOW'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
