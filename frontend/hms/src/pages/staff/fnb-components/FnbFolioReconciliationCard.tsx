import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { CurrencyDisplay } from '../../../components/common/CurrencyDisplay';
import { FnbAnalyticsData } from '../../../types/fnbAnalytics';

interface FnbFolioReconciliationCardProps {
  folioReconciliation: FnbAnalyticsData['folioReconciliation'];
}

export const FnbFolioReconciliationCard: React.FC<FnbFolioReconciliationCardProps> = ({
  folioReconciliation,
}) => {
  return (
    <div className="bg-ivory rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            F&B → Hotel Folio Financial Reconciliation
          </h3>
          <p className="text-[11px] text-slate-400">
            Cross-system audit matching external restaurant billing with HMS Master Folios
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="warning" size="md" className="font-semibold text-xs">
            {folioReconciliation.reconciliationStatus}
          </Badge>
          <Link to="/app/folio">
            <Button variant="outline" size="sm" className="text-xs bg-ivory text-slate-700">
              Go to Master Folios →
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-mono">
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <span className="font-sans text-slate-400 block text-[10px] uppercase font-semibold">Total F&B Revenue</span>
          <span className="text-lg font-bold text-slate-900 block mt-1">
            <CurrencyDisplay amountPaise={folioReconciliation.fnbGrossRevenueMinor} showDecimals={false} />
          </span>
          <span className="font-sans text-[10px] text-slate-400">From external POS batches</span>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <span className="font-sans text-slate-400 block text-[10px] uppercase font-semibold">Posted to HMS Folio</span>
          <span className="text-lg font-bold text-emerald-700 block mt-1">
            <CurrencyDisplay amountPaise={folioReconciliation.postedToFolioMinor} showDecimals={false} />
          </span>
          <span className="font-sans text-[10px] text-emerald-600">Successfully debited to guest rooms</span>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <span className="font-sans text-slate-400 block text-[10px] uppercase font-semibold">Pending Reconciliation</span>
          <span className="text-lg font-bold text-amber-700 block mt-1">
            <CurrencyDisplay amountPaise={folioReconciliation.pendingReconciliationMinor} showDecimals={false} />
          </span>
          <span className="font-sans text-[10px] text-amber-600">Unposted / cashier discrepancy</span>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <span className="font-sans text-slate-400 block text-[10px] uppercase font-semibold">Audit Status</span>
          <span className="text-sm font-bold text-slate-900 block mt-1">
            Audit Pending
          </span>
          <span className="font-sans text-[10px] text-slate-400">
            Resolved in Night Audit batch
          </span>
        </div>
      </div>

      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-[11px] leading-relaxed">
          <strong>Integration Invariant:</strong> The external F&B system is the operational source of truth for restaurant and kitchen activity. TapMenu HMS consumes dining transactions solely for guest room folio posting and hotel-wide accounting reconciliation during Night Audit.
        </div>
      </div>
    </div>
  );
};
