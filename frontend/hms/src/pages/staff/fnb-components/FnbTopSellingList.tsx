import React from 'react';
import { CurrencyDisplay } from '../../../components/common/CurrencyDisplay';
import { FnbAnalyticsData } from '../../../types/fnbAnalytics';

interface FnbTopSellingListProps {
  topSellingItems: FnbAnalyticsData['topSellingItems'];
  operationalMetrics: FnbAnalyticsData['operationalMetrics'];
}

export const FnbTopSellingList: React.FC<FnbTopSellingListProps> = ({
  topSellingItems,
  operationalMetrics,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Top Selling Items (7 cols) */}
      <div className="lg:col-span-7 bg-ivory rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
        <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Top Selling Menu Items
            </h3>
            <p className="text-[11px] text-slate-400">
              Analytical ranking received from external dining orders
            </p>
          </div>
          <span className="text-[10px] text-slate-400 italic">Read-Only Ranking</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Item Name</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Orders</th>
                <th className="py-2.5 px-3 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {topSellingItems.map((item) => (
                <tr key={item.rank} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-bold text-amber-700">#{item.rank}</td>
                  <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">{item.itemName}</td>
                  <td className="py-2.5 px-3 font-sans text-slate-500 text-[11px]">{item.category}</td>
                  <td className="py-2.5 px-3 text-right text-slate-700 font-bold">{item.ordersCount}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                    <CurrencyDisplay amountPaise={item.revenueMinor} showDecimals={false} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Operational Performance Statistics (5 cols) */}
      <div className="lg:col-span-5 bg-ivory rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Kitchen & Operational Metrics
          </h3>
          <p className="text-[11px] text-slate-400">
            Aggregated preparation statistics from connected KDS
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-sans text-slate-400 block text-[10px] uppercase font-semibold">Total KOTs</span>
            <span className="text-lg font-bold text-slate-900">{operationalMetrics.totalKots}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-sans text-slate-400 block text-[10px] uppercase font-semibold">Avg Prep Time</span>
            <span className="text-lg font-bold text-slate-900">{operationalMetrics.averagePreparationTimeMinutes} min</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-sans text-slate-400 block text-[10px] uppercase font-semibold">Completed Orders</span>
            <span className="text-lg font-bold text-emerald-700">{operationalMetrics.completedOrders}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-sans text-slate-400 block text-[10px] uppercase font-semibold">Pending In Kitchen</span>
            <span className="text-lg font-bold text-amber-700">{operationalMetrics.pendingOrders}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-sans text-slate-400 block text-[10px] uppercase font-semibold">Cancelled Orders</span>
            <span className="text-lg font-bold text-slate-600">{operationalMetrics.cancelledOrders}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-sans text-slate-400 block text-[10px] uppercase font-semibold">Void Tickets</span>
            <span className="text-lg font-bold text-rose-700">{operationalMetrics.voidOrders}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
