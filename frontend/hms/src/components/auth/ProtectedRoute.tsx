import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Role, Permission } from '../../types/auth';
import { ShieldAlert, Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  requiredRole?: Role;
  requiredPermission?: Permission;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredRole,
  requiredPermission
}) => {
  const location = useLocation();
  const {
    isAuthenticated,
    isInitialized,
    isLoading,
    session,
    initializeSession,
    hasPermission
  } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) {
      initializeSession();
    }
  }, [isInitialized, initializeSession]);

  // While checking token with backend /api/v1/auth/session
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-300">Verifying secure staff session...</p>
      </div>
    );
  }

  // Not authenticated: redirect to /login preserving return location
  if (!isAuthenticated || !session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Role validation if required
  if (requiredRole && session.role !== requiredRole && session.role !== 'ROLE_SUPER_ADMIN' && session.role !== 'ROLE_GENERAL_MANAGER') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div role="alert" className="max-w-md space-y-3 rounded-xl border border-border bg-ivory p-6 text-center text-ink shadow-sm">
          <ShieldAlert className="mx-auto size-12 text-burgundy" aria-hidden="true" />
          <h2 className="text-lg font-bold">Access restricted</h2>
          <p className="text-sm text-walnut">
            Your role (<span className="font-mono">{session.role}</span>) cannot open this page. Ask an administrator if you need access.
          </p>
          <a href="/app" className="inline-block text-sm font-semibold text-burgundy underline">Back to home</a>
        </div>
      </div>
    );
  }

  // Permission validation if required
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div role="alert" className="max-w-md space-y-3 rounded-xl border border-border bg-ivory p-6 text-center text-ink shadow-sm">
          <ShieldAlert className="mx-auto size-12 text-burgundy" aria-hidden="true" />
          <h2 className="text-lg font-bold">Permission denied</h2>
          <p className="text-sm text-walnut">
            You do not have access to this page. An administrator can grant the <span className="font-mono">{requiredPermission}</span> permission.
          </p>
          <a href="/app" className="inline-block text-sm font-semibold text-burgundy underline">Back to home</a>
        </div>
      </div>
    );
  }

  return <Outlet />;
};
