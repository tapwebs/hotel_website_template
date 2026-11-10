import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  UtensilsCrossed, 
  Receipt, 
  ShoppingBag, 
  TrendingUp, 
  BedDouble, 
  PieChart, 
  Clock, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  Flame, 
  Layers,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { fnbAnalyticsService } from '../../services/fnbAnalyticsService';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { LoadingState } from '../../components/common/LoadingState';
import { FnbRevenueTrendChart } from './fnb-components/FnbRevenueTrendChart';
import { FnbTopSellingList } from './fnb-components/FnbTopSellingList';
import { FnbFolioReconciliationCard } from './fnb-components/FnbFolioReconciliationCard';

export const FnbAnalyticsPage: React.FC = () => {
  const { data: analytics, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['fnbAnalytics'],
    queryFn: () => fnbAnalyticsService.getFnbAnalytics(),
    placeholderData: (prev) => prev,
    staleTime: 1000 * 30,
    retry: 1,
  });

  if (isError && !analytics) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4 text-slate-500">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="font-semibold text-slate-700 text-base">Unable to load F&B Analytics</p>
        <p className="text-xs text-slate-500 max-w-xs text-center">
          {error instanceof Error ? error.message : 'The analytics API returned an error.'}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
        </Button>
      </div>
    );
  }

  if (!analytics) return <LoadingState message="Loading F&B analytics..." />;

  const { integration, summary, outlets, trends, breakdown, topSellingItems, operationalMetrics, folioReconciliation } = analytics;

  return (
    <div className="space-y-6">
      {/* Dream Heavens: one compact toolbar instead of a second page title plus a status bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Badge variant="success" size="sm" className="text-[11px] font-semibold">● {integration.dataStatus}</Badge>
        <span>Last sync <span className="font-mono text-slate-700">{integration.lastSyncFormatted}</span></span>
        <span className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="text-xs bg-ivory text-slate-700 hover:text-slate-900">
          <RefreshCw className={`w-3.5 h-3.5 mr-1 text-slate-500 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </Button>
        <Link to="/app/settings" className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 font-medium text-walnut hover:bg-gold-soft/40">
          <ExternalLink className="w-3.5 h-3.5 text-amber-600" /> Integration
        </Link>
      </div>

      {/* B. TOP KPI CARDS (5 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: F&B Revenue Today */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">F&B Revenue Today</span>
              <span className="p-1 rounded-md bg-amber-50 text-amber-600">
                <Receipt className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-bold font-mono text-slate-900">
                <CurrencyDisplay amountPaise={summary.revenueTodayMinor} showDecimals={false} />
              </span>
              <span className="text-xs text-emerald-600 font-semibold flex items-center">
                <ArrowUpRight className="w-3 h-3" /> +{summary.revenueChangePct}%
              </span>
            </div>
            <div className="mt-1 text-[10px] text-slate-400">
              vs. <CurrencyDisplay amountPaise={summary.revenueYesterdayMinor} showDecimals={false} /> yesterday
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Orders Today */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Orders Today</span>
              <span className="p-1 rounded-md bg-blue-50 text-blue-600">
                <ShoppingBag className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-bold font-mono text-slate-900">
                {summary.ordersToday}
              </span>
              <span className="text-xs text-emerald-600 font-semibold flex items-center">
                <ArrowUpRight className="w-3 h-3" /> +{summary.ordersChangePct}%
              </span>
            </div>
            <div className="mt-1 text-[10px] text-slate-400">
              Closed across 4 outlets
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Average Order Value (AOV) */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Average Order Value</span>
              <span className="p-1 rounded-md bg-purple-50 text-purple-600">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2">
              <span className="text-xl font-bold font-mono text-slate-900">
                <CurrencyDisplay amountPaise={summary.averageOrderValueMinor} showDecimals={false} />
              </span>
            </div>
            <div className="mt-1 text-[10px] text-slate-400">
              Revenue per dining cover/ticket
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Room Service Revenue */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Room Service Revenue</span>
              <span className="p-1 rounded-md bg-emerald-50 text-emerald-600">
                <BedDouble className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2">
              <span className="text-xl font-bold font-mono text-slate-900">
                <CurrencyDisplay amountPaise={summary.roomServiceRevenueMinor} showDecimals={false} />
              </span>
            </div>
            <div className="mt-1 text-[10px] text-slate-400">
              Charged to in-house guest rooms
            </div>
          </CardContent>
        </Card>

        {/* Card 5: F&B Contribution to Hotel Revenue */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Hotel Revenue Share</span>
              <span className="p-1 rounded-md bg-rose-50 text-rose-600">
                <PieChart className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2">
              <span className="text-xl font-bold font-mono text-slate-900">
                {summary.fnbContributionToHotelRevenuePct}%
              </span>
            </div>
            <div className="mt-1 text-[10px] text-slate-400">
              Of gross property turnover today
            </div>
          </CardContent>
        </Card>
      </div>

      {/* D. REVENUE TREND CHART & E. REVENUE BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Revenue Trend (8 cols) */}
        <FnbRevenueTrendChart trends={trends} />

        {/* Revenue Breakdown (4 cols) */}
        <div className="lg:col-span-4 bg-ivory rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Dining Channel Breakdown
            </h3>
            <p className="text-[11px] text-slate-400">
              Turnover share across dining formats
            </p>
          </div>

          <div className="space-y-3.5">
            {breakdown.map((item, idx) => (
              <div key={idx} className="space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-800">{item.channel}</span>
                  <span className="font-mono font-bold text-slate-900">
                    <CurrencyDisplay amountPaise={item.revenueMinor} showDecimals={false} />
                  </span>
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>{item.orderCount} orders</span>
                  <span className="font-semibold text-amber-700">{item.percentageContribution}%</span>
                </div>

                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      idx === 0 ? 'bg-amber-600' : idx === 1 ? 'bg-emerald-600' : idx === 2 ? 'bg-blue-600' : 'bg-purple-600'
                    }`}
                    style={{ width: `${item.percentageContribution}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* C. OUTLET PERFORMANCE SECTION */}
      <div className="bg-ivory rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Connected Outlet Performance
            </h3>
            <p className="text-[11px] text-slate-400">
              Read-only operational performance aggregated from external restaurant POS
            </p>
          </div>
          <Badge variant="outline" size="sm" className="font-mono text-[10px]">
            {outlets.length} Active Outlets
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {outlets.map((outlet) => (
            <div
              key={outlet.id}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-1">
                  <h4 className="font-bold text-xs text-slate-900 leading-tight">{outlet.name}</h4>
                  <Badge variant="outline" size="sm" className="text-[9px] shrink-0 font-mono">
                    {outlet.type}
                  </Badge>
                </div>
                <span className="text-[11px] text-slate-400 block">{outlet.topCategory}</span>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-200/60 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Revenue:</span>
                  <span className="font-mono font-bold text-slate-900">
                    <CurrencyDisplay amountPaise={outlet.revenueMinor} showDecimals={false} />
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Orders:</span>
                  <span className="font-mono font-semibold text-slate-800">{outlet.ordersCount}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>AOV:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    <CurrencyDisplay amountPaise={outlet.averageOrderValueMinor} showDecimals={false} />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* F. TOP SELLING ITEMS & G. OPERATIONAL PERFORMANCE STATISTICS */}
      <FnbTopSellingList
        topSellingItems={topSellingItems}
        operationalMetrics={operationalMetrics}
      />

      {/* H. F&B → HOTEL FINANCIAL CONNECTION (RECONCILIATION) */}
      <FnbFolioReconciliationCard
        folioReconciliation={folioReconciliation}
      />
    </div>
  );
};
