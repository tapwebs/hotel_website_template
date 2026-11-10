import React from 'react';
import { Search, Filter, Building2, Eye, Edit3, Key, UserX, UserCheck, LogOut } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { StaffMember, Role } from '../../../types/auth';
import { ALL_DEPARTMENTS, ROLE_DISPLAY_NAMES, ROLE_DEPARTMENT_MAP, ACCOUNT_TYPE_LABELS, JOB_ROLE_LABELS } from './StaffConstants';

interface StaffDirectoryTableProps {
  filteredStaff: StaffMember[];
  isLoading: boolean;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  selectedDeptFilter: string;
  onDeptFilterChange: (dept: string) => void;
  currentUserId?: string;
  canManageTarget: (staff: StaffMember) => boolean;
  onViewDetails: (staff: StaffMember) => void;
  onEditStaff: (staff: StaffMember) => void;
  onResetPassword: (staff: StaffMember) => void;
  onToggleStatus: (staff: StaffMember) => void;
  onForceLogout: (staff: StaffMember) => void;
}

export const StaffDirectoryTable: React.FC<StaffDirectoryTableProps> = ({
  filteredStaff,
  isLoading,
  searchQuery,
  onSearchQueryChange,
  selectedDeptFilter,
  onDeptFilterChange,
  currentUserId,
  canManageTarget,
  onViewDetails,
  onEditStaff,
  onResetPassword,
  onToggleStatus,
  onForceLogout,
}) => {
  return (
    <div className="space-y-4">
      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-ivory p-4 rounded-xl border border-slate-200">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search staff by name, email, or username..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500">Department:</span>
          <select
            value={selectedDeptFilter}
            onChange={(e) => onDeptFilterChange(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none"
          >
            <option value="ALL">All Departments</option>
            {ALL_DEPARTMENTS.map(d => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-ivory rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">Full Name</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Assigned Property</th>
                <th className="py-3.5 px-4">Account Status</th>
                <th className="py-3.5 px-4">Last Login</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading staff directory...
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No staff members found matching query.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staff) => {
                  const isSelf = currentUserId === staff.user_id;
                  const hasAuthority = canManageTarget(staff);
                  const dept = ROLE_DEPARTMENT_MAP[staff.role_code as Role] || 'SYSTEM';

                  return (
                    <tr key={staff.user_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 shrink-0 overflow-hidden">
                            {staff.avatar_url ? (
                              <img src={staff.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              staff.full_name.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                              {staff.full_name}
                              {isSelf && (
                                <span className="text-[10px] font-normal text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                  You
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-slate-400 block">{staff.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <Badge 
                            variant={
                              staff.account_type === 'OWNER' || staff.role_code === 'ROLE_SUPER_ADMIN' 
                                ? 'gold' 
                                : staff.account_type === 'MANAGER' || staff.role_code === 'ROLE_GENERAL_MANAGER' 
                                  ? 'info' 
                                  : 'outline'
                            }
                            size="sm"
                            className="text-[10px] font-semibold"
                          >
                            {staff.account_type ? (ACCOUNT_TYPE_LABELS[staff.account_type] || staff.account_type) : (ROLE_DISPLAY_NAMES[staff.role_code as Role] || staff.role_code)}
                          </Badge>
                          {staff.job_role && (
                            <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              Role: {JOB_ROLE_LABELS[staff.job_role] || staff.job_role}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {staff.job_role ? (JOB_ROLE_LABELS[staff.job_role] || staff.job_role) : dept.replace('_', ' ')}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px]" title={staff.property_name || staff.property_id || 'System-Wide'}>
                            {staff.property_name || staff.property_id || 'All Properties'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {staff.is_active ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 font-semibold text-[11px] bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            INACTIVE
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {staff.last_login_at ? (
                          <span title={new Date(staff.last_login_at).toLocaleString()}>
                            {new Date(staff.last_login_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-300">Never</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewDetails(staff)}
                            title="View Details"
                            className="h-7 px-2 text-slate-600 hover:text-slate-900"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>

                          {hasAuthority && !isSelf && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEditStaff(staff)}
                                title="Edit Staff"
                                className="h-7 px-2 text-slate-600 hover:text-slate-900"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onResetPassword(staff)}
                                title="Reset Password"
                                className="h-7 px-2 text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onToggleStatus(staff)}
                                title={staff.is_active ? "Deactivate Account" : "Activate Account"}
                                className={`h-7 px-2 ${
                                  staff.is_active 
                                    ? 'text-rose-600 hover:text-rose-800 hover:bg-rose-50' 
                                    : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                                }`}
                              >
                                {staff.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onForceLogout(staff)}
                                title="Force Logout / Revoke Sessions"
                                className="h-7 px-2 text-slate-400 hover:text-rose-700 hover:bg-rose-50"
                              >
                                <LogOut className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}

                          {isSelf && (
                            <span className="text-[10px] text-slate-400 italic px-2">Protected</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
