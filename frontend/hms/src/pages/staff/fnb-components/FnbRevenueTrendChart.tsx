import React, { useState, useMemo } from 'react';
import { CurrencyDisplay } from '../../../components/common/CurrencyDisplay';
import { FnbAnalyticsData } from '../../../types/fnbAnalytics';

interface FnbRevenueTrendChartProps {
  trends: FnbAnalyticsData['trends'];
}

export const FnbRevenueTrendChart: React.FC<FnbRevenueTrendChartProps> = ({ trends }) => {
  const [trendPeriod, setTrendPeriod] = useState<'today' | 'sevenDays' | 'thirtyDays'>('sevenDays');

  const currentTrendPoints = useMemo(() => {
    return trends[trendPeriod] || [];
  }, [trends, trendPeriod]);

  const maxTrendValue = useMemo(() => {
    const maxVal = Math.max(...currentTrendPoints.map(p => p.revenueMinor), 0);
    return maxVal === 0 ? 1 : maxVal;
  }, [currentTrendPoints]);

  return (
    <div className="lg:col-span-8 bg-ivory rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            F&B Revenue Trend Over Time
          </h3>
          <p className="text-[11px] text-slate-400">
            Received from external F&B POS synchronization
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
          <button
            onClick={() => setTrendPeriod('today')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              trendPeriod === 'today' ? 'bg-ivory text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Today (Hourly)
          </button>
          <button
            onClick={() => setTrendPeriod('sevenDays')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              trendPeriod === 'sevenDays' ? 'bg-ivory text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTrendPeriod('thirtyDays')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              trendPeriod === 'thirtyDays' ? 'bg-ivory text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* Clean Analytics Bar Chart */}
      <div className="pt-2">
        <div className="h-56 flex items-end gap-2 sm:gap-4 px-2">
          {currentTrendPoints.map((point, idx) => {
            const heightPct = Math.round((point.revenueMinor / maxTrendValue) * 100);
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono font-semibold bg-slate-900 text-white px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap pointer-events-none">
                  <CurrencyDisplay amountPaise={point.revenueMinor} showDecimals={false} />
                </div>

                <div className="w-full bg-slate-100 rounded-t-lg overflow-hidden flex flex-col justify-end h-40">
                  <div
                    className="w-full bg-gradient-to-t from-amber-600 to-amber-500 group-hover:from-amber-700 group-hover:to-amber-600 transition-all rounded-t-lg"
                    style={{ height: `${heightPct}%` }}
                  />
                </div>

                <span className="text-[10px] text-slate-500 font-mono block text-center truncate w-full">
                  {point.periodLabel}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between items-center text-[10px] text-slate-400 pt-3 border-t border-slate-100 mt-2">
          <span>Low: ₹0</span>
          <span>Peak Turnover: <CurrencyDisplay amountPaise={maxTrendValue} showDecimals={false} /></span>
        </div>
      </div>
    </div>
  );
};
