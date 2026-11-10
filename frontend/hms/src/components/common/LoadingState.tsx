import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  subtext?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading live data...',
  subtext = 'Synchronizing with hotel PMS core...'
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center min-h-[240px]">
      <Loader2 className="w-8 h-8 text-amber-600 animate-spin mb-3" />
      <h4 className="text-sm font-semibold text-slate-800 tracking-tight">{message}</h4>
      {subtext && <p className="text-xs text-slate-500 mt-1 max-w-sm">{subtext}</p>}
    </div>
  );
};

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
      {icon && <div className="text-slate-400 mb-3">{icon}</div>}
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
