import React, { useState } from 'react';
import { Shield, Check, X } from 'lucide-react';
import { Role } from '../../../types/auth';
import { ROLE_DISPLAY_NAMES, PERMISSIONS_CATALOG, ROLE_PERMISSIONS } from './StaffConstants';

interface RolePermissionsMatrixProps {
  initialRole?: Role;
}

export const RolePermissionsMatrix: React.FC<RolePermissionsMatrixProps> = ({
  initialRole = 'ROLE_CAPTAIN'
}) => {
  const [matrixRole, setMatrixRole] = useState<Role>(initialRole);

  return (
    <div className="bg-ivory rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-600" /> Granular Permission Matrix by Role
          </h3>
          <p className="text-xs text-slate-500">Every operational action is cryptographically verified against backend RBAC tokens</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Inspect Role:</span>
          <select
            value={matrixRole}
            onChange={(e) => setMatrixRole(e.target.value as Role)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none"
          >
            {(Object.keys(ROLE_DISPLAY_NAMES) as Role[]).map((r) => (
              <option key={r} value={r}>{ROLE_DISPLAY_NAMES[r]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {PERMISSIONS_CATALOG.map((perm) => {
          const hasIt = ROLE_PERMISSIONS[matrixRole]().includes(perm.key);
          return (
            <div
              key={perm.key}
              className={`p-3 rounded-xl border flex items-start gap-3 transition-colors ${
                hasIt ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50/50 border-slate-200 opacity-60'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {hasIt ? (
                  <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                ) : (
                  <X className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <div>
                <span className={`text-xs font-bold block ${hasIt ? 'text-slate-900' : 'text-slate-500'}`}>
                  {perm.label}
                </span>
                <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                  {perm.desc}
                </span>
                <span className="text-[9px] font-mono text-slate-400 block mt-1">
                  {perm.key}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
