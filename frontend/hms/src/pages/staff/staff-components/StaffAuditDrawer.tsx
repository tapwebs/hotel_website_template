import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { StaffAuditLog } from '../../../types/auth';

interface StaffAuditDrawerProps {
  auditLogs: StaffAuditLog[];
  onRefresh: () => void;
}

export const StaffAuditDrawer: React.FC<StaffAuditDrawerProps> = ({
  auditLogs,
  onRefresh,
}) => {
  return (
    <div className="bg-ivory rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Security Audit Trail</h3>
          <p className="text-[11px] text-slate-400">Cryptographically immutable staff administration actions</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh} className="h-7 text-xs">
          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Actor</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Target Entity ID</th>
              <th className="py-3 px-4">Audit Payload / Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {auditLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  No staff administrative audit records recorded.
                </td>
              </tr>
            ) : (
              auditLogs.map((log) => (
                <tr key={log.audit_id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                    {log.recorded_at ? new Date(log.recorded_at).toLocaleString() : 'N/A'}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {log.actor_username}
                  </td>
                  <td className="py-3 px-4">
                    <Badge 
                      variant={
                        log.action.includes('DEACTIVATE') || log.action.includes('LOGOUT') 
                          ? 'destructive' 
                          : log.action.includes('CREATED') || log.action.includes('ACTIVATE')
                          ? 'gold'
                          : 'outline'
                      } 
                      size="sm"
                      className="font-mono text-[10px]"
                    >
                      {log.action}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                    {log.entity_id}
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-mono text-[10px] max-w-md truncate">
                    {log.new_values ? JSON.stringify(log.new_values) : (log.justification_reason || '—')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
