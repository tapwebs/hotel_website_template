import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Shield, 
  Key, 
  Plus, 
  Check, 
  X, 
  Search, 
  Filter, 
  UserCheck, 
  UserX, 
  LogOut, 
  RotateCcw, 
  Eye, 
  Edit3, 
  AlertTriangle, 
  Building2, 
  CheckCircle2, 
  FileText,
  Lock,
  UserPlus
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Role, AccountType, JobRole, StaffMember, StaffAuditLog } from '../../types/auth';
import { useAuthStore } from '../../stores/authStore';
import { staffService } from '../../services/apiServices';
import {
  ACCOUNT_TYPES,
  JOB_ROLES,
  ACCOUNT_TYPE_LABELS,
  JOB_ROLE_LABELS,
  ROLE_DISPLAY_NAMES,
  roleLabel,
  ROLE_DEPARTMENT_MAP,
  ALL_DEPARTMENTS
} from './staff-components/StaffConstants';
import { StaffDirectoryTable } from './staff-components/StaffDirectoryTable';
import { StaffAuditDrawer } from './staff-components/StaffAuditDrawer';

export const StaffPage: React.FC = () => {
  const { session } = useAuthStore();
  const isSuperAdmin = session?.accountType === 'OWNER' || session?.role === 'ROLE_SUPER_ADMIN';
  const isGM = session?.accountType === 'MANAGER' || session?.role === 'ROLE_GENERAL_MANAGER';

  // Navigation Tabs: Only 2 simplified tabs (Directory and Audit)
  const [activeTab, setActiveTab] = useState<'directory' | 'audit'>('directory');

  // Data State
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<StaffAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');

  // Feedback Banner / Toast
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isResetPwdModalOpen, setIsResetPwdModalOpen] = useState<boolean>(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);

  // Target Staff Member for operations
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'ACTIVATE' | 'DEACTIVATE' | 'FORCE_LOGOUT';
    title: string;
    description: string;
    actionText: string;
    isDestructive: boolean;
  } | null>(null);

  // Form State for Add Staff (3-step simplified model)
  const [newStaffForm, setNewStaffForm] = useState<{
    fullName: string;
    email: string;
    phone: string;
    username: string;
    password: string;
    confirmPassword: string;
    accountType: AccountType;
    jobRole: JobRole;
    propertyId: string;
  }>({
    fullName: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    confirmPassword: '',
    accountType: 'STAFF',
    jobRole: 'WAITER',
    propertyId: session?.activePropertyId || ''
  });

  // Form State for Edit Staff
  const [editStaffForm, setEditStaffForm] = useState<{
    fullName: string;
    email: string;
    phone: string;
    accountType: AccountType;
    jobRole: JobRole;
    propertyId: string;
  }>({
    fullName: '',
    email: '',
    phone: '',
    accountType: 'STAFF',
    jobRole: 'WAITER',
    propertyId: ''
  });

  // Password Reset Form State
  const [tempPassword, setTempPassword] = useState<string>('');
  const [confirmTempPassword, setConfirmTempPassword] = useState<string>('');

  // Clear feedback after timeout
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Load Staff Data
  const loadStaff = async () => {
    setIsLoading(true);
    try {
      const data = await staffService.getAll();
      setStaffList(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load staff list.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Load Audit Logs
  const loadAuditHistory = async () => {
    try {
      const logs = await staffService.getAuditHistory(50);
      setAuditLogs(logs);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load audit history.' });
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditHistory();
    }
  }, [activeTab]);

  // Available Account Types:
  // Hotel Owner (SuperAdmin) can create Owner, Manager, or Staff.
  // Managers can ONLY create Staff accounts.
  // Platform Super Admin is NEVER selectable in hotel staff UI.
  const selectableAccountTypes = useMemo(() => {
    if (isSuperAdmin) {
      return ACCOUNT_TYPES;
    }
    return ACCOUNT_TYPES.filter(t => t.id === 'STAFF');
  }, [isSuperAdmin]);

  // Filtered staff list for UI display
  const filteredStaff = useMemo(() => {
    return staffList.filter(s => {
      const matchesSearch = 
        s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.username.toLowerCase().includes(searchQuery.toLowerCase());
      
      const dept = ROLE_DEPARTMENT_MAP[s.role_code] || 'SYSTEM';
      const matchesDept = selectedDeptFilter === 'ALL' || dept === selectedDeptFilter;

      return matchesSearch && matchesDept;
    });
  }, [staffList, searchQuery, selectedDeptFilter]);

  // Authority check for modifying target staff
  const canManageTarget = (target: StaffMember): boolean => {
    if (!session) return false;
    if (isSuperAdmin) return true;
    if (isGM) {
      // GM cannot manage self
      if (target.user_id === session.userId) return false;
      // GM cannot manage Owner or other Managers
      if (
        target.account_type === 'OWNER' || 
        target.account_type === 'MANAGER' ||
        target.role_code === 'ROLE_SUPER_ADMIN' || 
        target.role_code === 'ROLE_GENERAL_MANAGER'
      ) {
        return false;
      }
      return true;
    }
    return false;
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    setNewStaffForm({
      fullName: '',
      email: '',
      phone: '',
      username: '',
      password: '',
      confirmPassword: '',
      accountType: 'STAFF',
      jobRole: 'WAITER',
      propertyId: session?.activePropertyId || ''
    });
    setIsAddModalOpen(true);
  };

  // Submit Add Staff
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newStaffForm.password !== newStaffForm.confirmPassword) {
      setFeedback({ type: 'error', message: 'Passwords do not match.' });
      return;
    }
    if (newStaffForm.password.length < 6) {
      setFeedback({ type: 'error', message: 'Password must be at least 6 characters.' });
      return;
    }

    try {
      await staffService.create({
        full_name: newStaffForm.fullName.trim(),
        email: newStaffForm.email.trim(),
        phone_number: newStaffForm.phone.trim() || undefined,
        username: newStaffForm.username.trim(),
        password: newStaffForm.password,
        account_type: newStaffForm.accountType,
        job_role: newStaffForm.accountType === 'STAFF' ? newStaffForm.jobRole : undefined,
        property_id: newStaffForm.propertyId || undefined
      });

      setFeedback({ type: 'success', message: `Staff account for ${newStaffForm.fullName} created successfully!` });
      setIsAddModalOpen(false);
      loadStaff();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create staff member.' });
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (target: StaffMember) => {
    setSelectedStaff(target);
    const targetAccountType: AccountType = (target.account_type || (
      target.role_code === 'ROLE_SUPER_ADMIN' ? 'OWNER' :
      target.role_code === 'ROLE_GENERAL_MANAGER' ? 'MANAGER' : 'STAFF'
    )) as AccountType;

    const KNOWN: JobRole[] = ['CAPTAIN', 'WAITER', 'KITCHEN_STAFF', 'ACCOUNTANT'];
    const fromRole: JobRole =
      target.role_code === 'ROLE_CAPTAIN' ? 'CAPTAIN' :
      target.role_code === 'ROLE_KITCHEN_STAFF' ? 'KITCHEN_STAFF' :
      target.role_code === 'ROLE_ACCOUNTANT' ? 'ACCOUNTANT' : 'WAITER';
    const targetJobRole: JobRole = KNOWN.includes(target.job_role as JobRole) ? (target.job_role as JobRole) : fromRole;

    setEditStaffForm({
      fullName: target.full_name,
      email: target.email,
      phone: target.phone_number || '',
      accountType: targetAccountType,
      jobRole: targetJobRole,
      propertyId: target.property_id || ''
    });
    setIsEditModalOpen(true);
  };

  // Submit Edit Staff
  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;

    try {
      await staffService.update(selectedStaff.user_id, {
        full_name: editStaffForm.fullName.trim(),
        email: editStaffForm.email.trim(),
        phone_number: editStaffForm.phone.trim() || undefined,
        account_type: editStaffForm.accountType,
        job_role: editStaffForm.accountType === 'STAFF' ? editStaffForm.jobRole : undefined,
        property_id: editStaffForm.propertyId || undefined
      });

      setFeedback({ type: 'success', message: `Staff member ${editStaffForm.fullName} updated successfully!` });
      setIsEditModalOpen(false);
      loadStaff();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update staff member.' });
    }
  };

  // Confirm Status Change (Activate/Deactivate)
  const handleTriggerStatusChange = (target: StaffMember) => {
    setSelectedStaff(target);
    const willBeActive = !target.is_active;
    setConfirmAction({
      type: willBeActive ? 'ACTIVATE' : 'DEACTIVATE',
      title: willBeActive ? 'Activate Staff Account' : 'Deactivate Staff Account',
      description: willBeActive
        ? `Are you sure you want to activate ${target.full_name}'s account? They will be able to log in immediately.`
        : `Are you sure you want to deactivate ${target.full_name}'s account? All existing sessions will be immediately revoked, and they will be blocked from logging in.`,
      actionText: willBeActive ? 'Confirm Activation' : 'Confirm Deactivation',
      isDestructive: !willBeActive
    });
    setIsConfirmModalOpen(true);
  };

  // Confirm Force Logout
  const handleTriggerForceLogout = (target: StaffMember) => {
    setSelectedStaff(target);
    setConfirmAction({
      type: 'FORCE_LOGOUT',
      title: 'Force Logout Staff Member',
      description: `This will increment the security token version for ${target.full_name}, instantly invalidating all active web and mobile JWT sessions.`,
      actionText: 'Revoke All Sessions',
      isDestructive: true
    });
    setIsConfirmModalOpen(true);
  };

  const handleExecuteConfirmAction = async () => {
    if (!selectedStaff || !confirmAction) return;

    try {
      if (confirmAction.type === 'ACTIVATE') {
        await staffService.updateStatus(selectedStaff.user_id, true);
        setFeedback({ type: 'success', message: `Account for ${selectedStaff.full_name} has been activated.` });
      } else if (confirmAction.type === 'DEACTIVATE') {
        await staffService.updateStatus(selectedStaff.user_id, false);
        setFeedback({ type: 'success', message: `Account for ${selectedStaff.full_name} deactivated and sessions revoked.` });
      } else if (confirmAction.type === 'FORCE_LOGOUT') {
        await staffService.forceLogout(selectedStaff.user_id);
        setFeedback({ type: 'success', message: `All active sessions revoked for ${selectedStaff.full_name}.` });
      }
      setIsConfirmModalOpen(false);
      loadStaff();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Operation failed.' });
      setIsConfirmModalOpen(false);
    }
  };

  // Open Password Reset Modal
  const handleOpenResetPwdModal = (target: StaffMember) => {
    setSelectedStaff(target);
    setTempPassword('');
    setConfirmTempPassword('');
    setIsResetPwdModalOpen(true);
  };

  // Submit Password Reset
  const handleExecuteResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    if (tempPassword !== confirmTempPassword) {
      setFeedback({ type: 'error', message: 'Passwords do not match.' });
      return;
    }
    if (tempPassword.length < 6) {
      setFeedback({ type: 'error', message: 'Password must be at least 6 characters.' });
      return;
    }

    try {
      await staffService.resetPassword(selectedStaff.user_id, tempPassword);
      setFeedback({ type: 'success', message: `Password reset successfully for ${selectedStaff.full_name}. Active sessions revoked.` });
      setIsResetPwdModalOpen(false);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to reset password.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div 
          className={`flex items-center justify-between p-4 rounded-xl border text-xs font-medium animate-fadeIn ${
            feedback.type === 'success' 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold font-serif text-slate-900">Staff & Roles</h1>
            <Badge variant="outline" size="sm" className="font-mono text-[11px]">
              {isSuperAdmin ? 'Super Admin (Owner)' : 'Admin (Manager)'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Simplified hotel account administration with role presets, scope protection, and session control.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadStaff}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>

          <Button
            variant="gold"
            size="sm"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" /> Add Staff Member
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('directory')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'directory'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" /> Staff Directory ({staffList.length})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'audit'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" /> Audit History
        </button>
      </div>

      {/* TAB 1: STAFF DIRECTORY */}
      {activeTab === 'directory' && (
        <StaffDirectoryTable
          filteredStaff={filteredStaff}
          isLoading={isLoading}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          selectedDeptFilter={selectedDeptFilter}
          onDeptFilterChange={setSelectedDeptFilter}
          currentUserId={session?.userId}
          canManageTarget={canManageTarget}
          onViewDetails={(staff) => {
            setSelectedStaff(staff);
            setIsDetailModalOpen(true);
          }}
          onEditStaff={handleOpenEditModal}
          onResetPassword={handleOpenResetPwdModal}
          onToggleStatus={handleTriggerStatusChange}
          onForceLogout={handleTriggerForceLogout}
        />
      )}

      {/* TAB 2: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <StaffAuditDrawer
          auditLogs={auditLogs}
          onRefresh={loadAuditHistory}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ADD STAFF MEMBER (SIMPLIFIED 3-STEP MODEL) */}
      {/* ======================================================== */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Staff Member"
        subtitle="Provision an employee account with verified hotel role preset"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateStaff} className="space-y-5 text-xs">
          {/* STEP 1: SELECT ACCOUNT TYPE */}
          <div>
            <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">
              Step 1: Primary Account Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {selectableAccountTypes.map((type) => {
                const isSelected = newStaffForm.accountType === type.id;
                return (
                  <div
                    key={type.id}
                    onClick={() => setNewStaffForm({ ...newStaffForm, accountType: type.id })}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-slate-200 bg-ivory text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs">{type.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <p className={`text-[10px] leading-relaxed line-clamp-2 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                      {type.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 2: SELECT OPERATIONAL JOB ROLE (ONLY FOR STAFF) */}
          {newStaffForm.accountType === 'STAFF' && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block">
                Step 2: Predefined Staff Job Role <span className="text-rose-500">*</span>
              </label>
              <select
                value={newStaffForm.jobRole}
                onChange={(e) => setNewStaffForm({ ...newStaffForm, jobRole: e.target.value as JobRole })}
                className="w-full bg-ivory border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {JOB_ROLES.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.label} — {job.desc}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 italic">
                {JOB_ROLES.find(j => j.id === newStaffForm.jobRole)?.desc}
              </p>
            </div>
          )}

          {/* STEP 3: IDENTITY & PROPERTY SCOPE */}
          <div>
            <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-2">
              Step 3: Identity & Property Assignment
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Full Name"
                required
                value={newStaffForm.fullName}
                onChange={(e) => setNewStaffForm({ ...newStaffForm, fullName: e.target.value })}
                placeholder="e.g. Priya Verma"
              />
              <Input
                label="Staff Email"
                type="email"
                required
                value={newStaffForm.email}
                onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                placeholder="e.g. priya@dreamheavens.com"
              />
              <Input
                label="Phone Number"
                value={newStaffForm.phone}
                onChange={(e) => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                placeholder="+91 98765 00000"
              />
            </div>
          </div>

          {/* Account Credentials */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Username"
              required
              value={newStaffForm.username}
              onChange={(e) => setNewStaffForm({ ...newStaffForm, username: e.target.value })}
              placeholder="priya.verma"
            />
            <Input
              label="Temporary Password"
              type="password"
              required
              value={newStaffForm.password}
              onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
              placeholder="Min 6 characters"
            />
            <Input
              label="Confirm Password"
              type="password"
              required
              value={newStaffForm.confirmPassword}
              onChange={(e) => setNewStaffForm({ ...newStaffForm, confirmPassword: e.target.value })}
              placeholder="Repeat password"
            />
          </div>

          {/* Property Assignment */}
          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
              Assigned Property <span className="text-rose-500">*</span>
            </label>
            <select
              value={newStaffForm.propertyId}
              onChange={(e) => setNewStaffForm({ ...newStaffForm, propertyId: e.target.value })}
              className="w-full bg-ivory border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {session?.availableProperties?.map((p) => (
                <option key={p.propertyId} value={p.propertyId}>{p.propertyName} ({p.city})</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="gold" size="sm" type="submit">
              Provision Staff Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: EDIT STAFF MEMBER */}
      {/* ======================================================== */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Staff Member: ${selectedStaff?.full_name}`}
        subtitle="Modify profile details, account type, and assigned property"
        maxWidth="lg"
      >
        <form onSubmit={handleUpdateStaff} className="space-y-4 text-xs">
          {/* Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Full Name"
              required
              value={editStaffForm.fullName}
              onChange={(e) => setEditStaffForm({ ...editStaffForm, fullName: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              required
              value={editStaffForm.email}
              onChange={(e) => setEditStaffForm({ ...editStaffForm, email: e.target.value })}
            />
            <Input
              label="Phone Number"
              value={editStaffForm.phone}
              onChange={(e) => setEditStaffForm({ ...editStaffForm, phone: e.target.value })}
            />
          </div>

          {/* Account Type & Job Role */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                Account Type
              </label>
              <select
                value={editStaffForm.accountType}
                onChange={(e) => setEditStaffForm({ ...editStaffForm, accountType: e.target.value as AccountType })}
                className="w-full bg-ivory border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {selectableAccountTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            </div>

            {editStaffForm.accountType === 'STAFF' && (
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Job Role Preset
                </label>
                <select
                  value={editStaffForm.jobRole}
                  onChange={(e) => setEditStaffForm({ ...editStaffForm, jobRole: e.target.value as JobRole })}
                  className="w-full bg-ivory border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {JOB_ROLES.map((job) => (
                    <option key={job.id} value={job.id}>{job.label} ({job.desc})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Property */}
          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
              Assigned Property
            </label>
            <select
              value={editStaffForm.propertyId}
              onChange={(e) => setEditStaffForm({ ...editStaffForm, propertyId: e.target.value })}
              className="w-full bg-ivory border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {session?.availableProperties?.map((p) => (
                <option key={p.propertyId} value={p.propertyId}>{p.propertyName} ({p.city})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 3: STAFF DETAIL VIEW */}
      {/* ======================================================== */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Staff Profile & Access Summary"
        maxWidth="md"
      >
        {selectedStaff && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm overflow-hidden shrink-0">
                {selectedStaff.avatar_url ? (
                  <img src={selectedStaff.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  selectedStaff.full_name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedStaff.full_name}</h3>
                <p className="text-xs text-slate-500 font-mono">{selectedStaff.email} • @{selectedStaff.username}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge 
                    variant={selectedStaff.account_type === 'OWNER' || selectedStaff.role_code === 'ROLE_SUPER_ADMIN' ? 'gold' : 'info'} 
                    size="sm" 
                    className="font-mono text-[10px]"
                  >
                    {selectedStaff.account_type ? (ACCOUNT_TYPE_LABELS[selectedStaff.account_type] || selectedStaff.account_type) : roleLabel(selectedStaff.role_code)}
                  </Badge>
                  {selectedStaff.job_role && (
                    <Badge variant="outline" size="sm" className="font-mono text-[10px]">
                      {JOB_ROLE_LABELS[selectedStaff.job_role] || selectedStaff.job_role}
                    </Badge>
                  )}
                  {selectedStaff.is_active ? (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-semibold border border-rose-200">
                      INACTIVE
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Phone Number</span>
                <span className="text-xs font-semibold text-slate-800">{selectedStaff.phone_number || 'Not provided'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Property</span>
                <span className="text-xs font-semibold text-slate-800">{selectedStaff.property_name || selectedStaff.property_id || 'Global'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Created On</span>
                <span className="text-xs font-semibold text-slate-800">
                  {selectedStaff.created_at ? new Date(selectedStaff.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Last Login</span>
                <span className="text-xs font-semibold text-slate-800">
                  {selectedStaff.last_login_at ? new Date(selectedStaff.last_login_at).toLocaleString() : 'Never'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Authoritative Permissions ({selectedStaff.permissions?.length || 0})
              </span>
              <p className="text-[11px] text-slate-500 leading-tight">
                Backend-enforced dynamically based on canonical account type and assigned job preset.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 4: RESET PASSWORD */}
      {/* ======================================================== */}
      <Modal
        isOpen={isResetPwdModalOpen}
        onClose={() => setIsResetPwdModalOpen(false)}
        title={`Reset Password: ${selectedStaff?.full_name}`}
        subtitle="Set a secure temporary password. All active JWT sessions will be invalidated immediately."
        maxWidth="md"
      >
        <form onSubmit={handleExecuteResetPassword} className="space-y-4 text-xs">
          <Input
            label="New Temporary Password"
            type="password"
            required
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            placeholder="Min 6 characters"
          />
          <Input
            label="Confirm New Password"
            type="password"
            required
            value={confirmTempPassword}
            onChange={(e) => setConfirmTempPassword(e.target.value)}
            placeholder="Repeat password"
          />

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-tight">
              Once reset, existing credentials and active sessions for this account will stop working instantly.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsResetPwdModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="gold" size="sm" type="submit">
              Reset Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 5: CONFIRM ACTION (DESTRUCTIVE / STATUS) */}
      {/* ======================================================== */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title={confirmAction?.title || 'Confirm Action'}
        maxWidth="sm"
      >
        {confirmAction && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-600 leading-relaxed">
              {confirmAction.description}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setIsConfirmModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={confirmAction.isDestructive ? 'primary' : 'gold'}
                size="sm"
                onClick={handleExecuteConfirmAction}
                className={confirmAction.isDestructive ? 'bg-rose-600 hover:bg-rose-700 text-white' : ''}
              >
                {confirmAction.actionText}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
