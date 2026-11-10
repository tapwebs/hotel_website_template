import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Download, Printer, ShieldCheck, RefreshCw } from 'lucide-react';
import { reportService, reservationService } from '../../services/apiServices';
import { Reservation } from '../../types/pms';
import { ManagerFlashReport } from '../../types/reports';
import { Button } from '../../components/ui/Button';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { LoadingState } from '../../components/common/LoadingState';
import { useAppDate } from '../../hooks/useAppDate';

type Tab = 'FLASH_REPORT' | 'GST_TAX' | 'CHANNEL_MIX';

const SOURCE_LABELS: Record<string, string> = {
  DIRECT_WEB: 'Website',
  WEBSITE: 'Website',
  WALK_IN: 'Walk-in',
  PHONE: 'Phone',
  BOOKING_COM: 'Booking.com',
  AGODA: 'Agoda',
  MAKEMYTRIP: 'MakeMyTrip',
  AIRBNB: 'Airbnb',
  CORPORATE: 'Corporate',
};

const rupees = (paise: number) => (paise / 100).toFixed(2);
const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

/** Flash report as a flat CSV (one section per block) that opens cleanly in Excel. */
function flashReportCsv(r: ManagerFlashReport): string {
  const rows: (string | number)[][] = [
    ['Property', r.propertyName],
    ['Business date', r.businessDate],
    ['Generated at', r.generatedAt],
    [],
    ['ROOMS'],
    ['Total rooms', r.roomStats.totalRooms],
    ['Out of order', r.roomStats.oooRooms],
    ['Sellable rooms', r.roomStats.sellableRooms],
    ['Rooms sold', r.roomStats.roomsSold],
    ['Occupancy %', r.roomStats.occupancyPct],
    [],
    ['REVENUE (INR, before GST)'],
    ['Room', rupees(r.revenueSummary.roomRevenuePaise)],
    ['Food & beverage', rupees(r.revenueSummary.fnbRevenuePaise)],
    ['Laundry', rupees(r.revenueSummary.laundryRevenuePaise)],
    ['Spa & wellness', rupees(r.revenueSummary.spaRevenuePaise)],
    ['Other', rupees(r.revenueSummary.otherRevenuePaise)],
    ['Total revenue', rupees(r.revenueSummary.grossRevenuePaise)],
    ['GST', rupees(r.revenueSummary.taxesCollectedPaise)],
    ['ADR', rupees(r.financialMetrics.adrPaise)],
    ['RevPAR', rupees(r.financialMetrics.revParPaise)],
    ['Average restaurant bill', rupees(r.financialMetrics.averageCheckPaise)],
    [],
    ['COLLECTIONS (INR)'],
    ['Cash', rupees(r.settlements.cashPaise)],
    ['UPI / digital', rupees(r.settlements.upiPaise)],
    ['Card', rupees(r.settlements.cardPaise)],
    ['Bank transfer', rupees(r.settlements.bankTransferPaise ?? 0)],
    ['City ledger', rupees(r.settlements.cityLedgerPaise)],
    ['Total collected', rupees(r.settlements.totalCollectedPaise)],
    [],
    ['GST BY SAC', 'Description', 'Taxable', 'CGST', 'SGST', 'Total tax', 'Effective %'],
    ...r.taxLiabilityBreakdown.map((t) => [
      t.sacCode, t.description, rupees(t.taxablePaise), rupees(t.cgstPaise), rupees(t.sgstPaise), rupees(t.totalTaxPaise), t.ratePercent ?? 0,
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface ChannelRow { source: string; bookings: number; roomNights: number; valuePaise: number }

function channelMix(reservations: Reservation[]): ChannelRow[] {
  const map = new Map<string, ChannelRow>();
  for (const r of reservations) {
    if (r.status === 'CANCELLED' || r.status === 'NO_SHOW') continue;
    const label = SOURCE_LABELS[r.source] ?? r.source;
    const row = map.get(label) ?? { source: label, bookings: 0, roomNights: 0, valuePaise: 0 };
    row.bookings += 1;
    row.roomNights += Math.max(1, r.nights) * Math.max(1, r.roomsCount);
    row.valuePaise += r.totalAmountPaise;
    map.set(label, row);
  }
  return [...map.values()].sort((a, b) => b.roomNights - a.roomNights);
}

export const ReportsPage: React.FC = () => {
  const [activeReportTab, setActiveReportTab] = useState<Tab>('FLASH_REPORT');
  const [params] = useSearchParams();
  const [reportDate, setReportDate] = useState(params.get('date') ?? '');
  const { businessDate, calendarDate } = useAppDate();

  const { data: flashReport, isFetching, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['managerFlashReport', reportDate || 'active'],
    queryFn: () => reportService.getFlashReport(reportDate || undefined),
    placeholderData: (prev) => prev,
    staleTime: 1000 * 20,
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations'],
    queryFn: () => reservationService.getAll(),
    enabled: activeReportTab === 'CHANNEL_MIX',
    staleTime: 1000 * 30,
  });
  const channels = useMemo(() => channelMix(reservations), [reservations]);
  const totalNights = channels.reduce((n, c) => n + c.roomNights, 0);

  const tabClass = (t: Tab) =>
    `pb-3 transition-colors cursor-pointer border-b-2 ${
      activeReportTab === t ? 'border-amber-600 text-amber-900 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-sans font-bold text-slate-900 tracking-tight">Financial &amp; Operational Reports</h1>
            {isFetching && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full font-medium animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" /> Syncing...
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Manager flash report, GST liability by SAC, collections and booking channels. Figures come from the live ledger.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-600 flex items-center gap-1.5">
            Business date
            <input
              type="date"
              value={reportDate || businessDate || ''}
              max={calendarDate}
              onChange={(e) => setReportDate(e.target.value === businessDate ? '' : e.target.value)}
              className="border border-slate-300 rounded-md px-2 py-1 text-xs bg-ivory"
            />
          </label>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="text-xs bg-ivory">
            <Printer className="w-3.5 h-3.5 mr-1" /> Print Report
          </Button>
          <Button
            variant="gold"
            size="sm"
            disabled={!flashReport}
            onClick={() => flashReport && downloadText(`flash-report-${flashReport.businessDate}.csv`, flashReportCsv(flashReport))}
            className="text-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1" /> Export CSV / Excel
          </Button>
        </div>
      </div>

      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold no-print">
        <button onClick={() => setActiveReportTab('FLASH_REPORT')} className={tabClass('FLASH_REPORT')}>Daily Manager Flash Report</button>
        <button onClick={() => setActiveReportTab('GST_TAX')} className={tabClass('GST_TAX')}>GST Tax Liability</button>
        <button onClick={() => setActiveReportTab('CHANNEL_MIX')} className={tabClass('CHANNEL_MIX')}>Booking Channels</button>
      </div>

      {isError && !flashReport && activeReportTab !== 'CHANNEL_MIX' ? (
        <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 flex items-center justify-between gap-3">
          <span>Could not load the report: {(error as Error)?.message || 'unknown error'}.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">Retry</Button>
        </div>
      ) : isLoading && !flashReport && activeReportTab !== 'CHANNEL_MIX' ? (
        <LoadingState message="Generating financial report snapshot..." />
      ) : (
        <div className="space-y-6">
          {activeReportTab === 'FLASH_REPORT' && flashReport && (
            <div className="bg-ivory rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="font-serif font-bold text-xl text-slate-900">Daily Manager Flash Report</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Property: {flashReport.propertyName} • Business Date: <strong>{flashReport.businessDate}</strong>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-mono block">GENERATED AT</span>
                  <span className="font-mono text-xs text-slate-700">{new Date(flashReport.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">1. Room Inventory &amp; Sold Statistics</h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <Stat label="Total Physical" value={`${flashReport.roomStats.totalRooms} ${flashReport.roomStats.totalRooms === 1 ? 'Room' : 'Rooms'}`} />
                  <Stat label="Sellable Rooms" value={`${flashReport.roomStats.sellableRooms} ${flashReport.roomStats.sellableRooms === 1 ? 'Room' : 'Rooms'}`} />
                  <Stat label="Rooms Sold" value={`${flashReport.roomStats.roomsSold} ${flashReport.roomStats.roomsSold === 1 ? 'Room' : 'Rooms'}`} tone="text-emerald-800" />
                  <Stat label="Occupancy" value={`${flashReport.roomStats.occupancyPct}%`} />
                  <Stat label="Out of Order" value={`${flashReport.roomStats.oooRooms} ${flashReport.roomStats.oooRooms === 1 ? 'Room' : 'Rooms'}`} />
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">2. Departmental Revenue (before GST)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                  <Money label="Room Accommodation" paise={flashReport.revenueSummary.roomRevenuePaise} />
                  <Money label="Food & Beverage" paise={flashReport.revenueSummary.fnbRevenuePaise} />
                  <Money label="Laundry" paise={flashReport.revenueSummary.laundryRevenuePaise} />
                  <Money label="Spa & Wellness" paise={flashReport.revenueSummary.spaRevenuePaise} />
                  <Money label="Other Services" paise={flashReport.revenueSummary.otherRevenuePaise} />
                  <Money label="Total Revenue" paise={flashReport.revenueSummary.grossRevenuePaise} strong />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mt-3">
                  <Stat label="GST Collected" value={<CurrencyDisplay amountPaise={flashReport.revenueSummary.taxesCollectedPaise} />} />
                  <Stat label="ADR" value={<CurrencyDisplay amountPaise={flashReport.financialMetrics.adrPaise} />} />
                  <Stat label="RevPAR" value={<CurrencyDisplay amountPaise={flashReport.financialMetrics.revParPaise} />} />
                  <Stat label="Avg Restaurant Bill" value={<CurrencyDisplay amountPaise={flashReport.financialMetrics.averageCheckPaise} />} />
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">3. Collections &amp; Settlements</h4>
                <div className="border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs font-mono">
                  <Collect label="Cash" paise={flashReport.settlements.cashPaise} />
                  <Collect label="UPI / Digital" paise={flashReport.settlements.upiPaise} />
                  <Collect label="Card" paise={flashReport.settlements.cardPaise} />
                  <Collect label="Bank Transfer" paise={flashReport.settlements.bankTransferPaise ?? 0} />
                  <Collect label="City Ledger" paise={flashReport.settlements.cityLedgerPaise} />
                  <Collect label="Total Collected" paise={flashReport.settlements.totalCollectedPaise} strong />
                </div>
              </div>
            </div>
          )}

          {activeReportTab === 'GST_TAX' && flashReport && (
            <div className="bg-ivory rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="font-serif font-bold text-xl text-slate-900">GST Liability by SAC • {flashReport.businessDate}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Rooms: 5% up to ₹7,500 per night, 18% above. Restaurant: 5%. Other services: 18%. Output tax split equally into CGST and SGST.
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">SAC Code</th>
                      <th className="py-3 px-4">Service Category</th>
                      <th className="py-3 px-4 text-right">Taxable Value</th>
                      <th className="py-3 px-4 text-right">CGST</th>
                      <th className="py-3 px-4 text-right">SGST</th>
                      <th className="py-3 px-4 text-right">Total Tax</th>
                      <th className="py-3 px-4 text-right">Effective Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {flashReport.taxLiabilityBreakdown.length === 0 && (
                      <tr><td colSpan={7} className="py-6 px-4 text-center font-sans text-slate-500">No taxable sales on this business date.</td></tr>
                    )}
                    {flashReport.taxLiabilityBreakdown.map((row) => (
                      <tr key={row.sacCode} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-bold text-amber-700">{row.sacCode}</td>
                        <td className="py-3 px-4 font-sans text-slate-800 font-medium">{row.description}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900"><CurrencyDisplay amountPaise={row.taxablePaise} /></td>
                        <td className="py-3 px-4 text-right text-slate-600"><CurrencyDisplay amountPaise={row.cgstPaise} /></td>
                        <td className="py-3 px-4 text-right text-slate-600"><CurrencyDisplay amountPaise={row.sgstPaise} /></td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900"><CurrencyDisplay amountPaise={row.totalTaxPaise} /></td>
                        <td className="py-3 px-4 text-right text-slate-600">{row.ratePercent ?? 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">For filing:</span>
                  Confirm the property GSTIN under Settings before issuing tax invoices. Room tax is accrued per night in house.
                </div>
              </div>
            </div>
          )}

          {activeReportTab === 'CHANNEL_MIX' && (
            <div className="bg-ivory rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
              <h2 className="font-serif font-bold text-xl text-slate-900">Booking Channels</h2>
              {channels.length === 0 ? (
                <p className="text-xs text-slate-500">No active bookings yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {channels.map((c) => (
                    <div key={c.source} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">{c.source}</span>
                      <span className="font-mono font-display text-3xl leading-none font-semibold lining-nums tabular-nums text-burgundy-deep block">
                        {totalNights ? Math.round((c.roomNights / totalNights) * 100) : 0}%
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {c.bookings} {c.bookings === 1 ? 'booking' : 'bookings'} • {c.roomNights} room-nights • avg <CurrencyDisplay amountPaise={Math.round(c.valuePaise / Math.max(1, c.roomNights))} showDecimals={false} /> / night incl. GST
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: React.ReactNode; tone?: string }> = ({ label, value, tone = 'text-slate-900' }) => (
  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
    <span className="text-slate-400 block text-[10px] uppercase">{label}</span>
    <span className={`font-bold text-sm font-mono ${tone}`}>{value}</span>
  </div>
);

const Money: React.FC<{ label: string; paise: number; strong?: boolean }> = ({ label, paise, strong }) => (
  <div className={`p-4 rounded-xl border flex justify-between items-center ${strong ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
    <span className="font-sans text-slate-700">{label}</span>
    <span className="font-bold text-slate-900"><CurrencyDisplay amountPaise={paise} /></span>
  </div>
);

const Collect: React.FC<{ label: string; paise: number; strong?: boolean }> = ({ label, paise, strong }) => (
  <div>
    <span className="font-sans text-slate-400 block text-[11px]">{label}</span>
    <span className={`font-bold ${strong ? 'text-amber-800' : 'text-slate-900'}`}><CurrencyDisplay amountPaise={paise} /></span>
  </div>
);
