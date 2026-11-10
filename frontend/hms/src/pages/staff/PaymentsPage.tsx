import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  CreditCard, 
  RotateCcw, 
  ShieldCheck, 
  Download, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  FileSpreadsheet, 
  Check, 
  X,
  SlidersHorizontal,
  Layers
} from 'lucide-react';
import { paymentService } from '../../services/apiServices';
import { PaymentTransaction, ReconciliationReport } from '../../types/pms';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/common/StatusBadge';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { LoadingState } from '../../components/common/LoadingState';
import { PermissionGate } from '../../components/common/PermissionGate';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';

export const PaymentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'TRANSACTIONS' | 'RECONCILIATION'>('TRANSACTIONS');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProvider, setFilterProvider] = useState<string>('ALL');
  const [filterMethod, setFilterMethod] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Refund Modal State
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<PaymentTransaction | null>(null);
  const [refundAmountPaise, setRefundAmountPaise] = useState('');
  const [refundReason, setRefundReason] = useState('Guest requested refund');
  const [refundSimulation, setRefundSimulation] = useState<'SUCCESS' | 'FAILED'>('SUCCESS');
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  // CSV Import Modal State
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [csvImportError, setCsvImportError] = useState<string | null>(null);

  // Queries
  const { data: payments = [], isFetching: isFetchingPayments, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['payments'],
    queryFn: () => paymentService.getAll(),
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 2
  });

  const { data: providerStatus } = useQuery({
    queryKey: ['provider-status'],
    queryFn: () => paymentService.getProviderStatus(),
    staleTime: 1000 * 60 * 10
  });

  const { 
    data: reconciliationData, 
    isLoading: isLoadingRecon, 
    isFetching: isFetchingRecon, 
    refetch: refetchRecon 
  } = useQuery({
    queryKey: ['reconciliation'],
    queryFn: () => paymentService.getReconciliation(),
    enabled: activeTab === 'RECONCILIATION'
  });

  // Filtered Payments
  const filteredPayments = React.useMemo(() => {
    return (payments || []).filter((tx) => {
      const matchSearch =
        !searchQuery ||
        tx.transactionRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.folioId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.roomNumber && tx.roomNumber.includes(searchQuery));

      const matchProvider = filterProvider === 'ALL' || tx.provider === filterProvider;
      const matchMethod = filterMethod === 'ALL' || tx.paymentMethod === filterMethod;
      const matchStatus = filterStatus === 'ALL' || tx.status === filterStatus;

      return matchSearch && matchProvider && matchMethod && matchStatus;
    });
  }, [payments, searchQuery, filterProvider, filterMethod, filterStatus]);

  const handleOpenRefundModal = (tx: PaymentTransaction) => {
    setSelectedTx(tx);
    setRefundAmountPaise(String(tx.amountPaise));
    setRefundReason('Guest requested early departure refund');
    setRefundSimulation('SUCCESS');
    setRefundError(null);
    setRefundModalOpen(true);
  };

  const handleConfirmRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTx) return;

    setIsRefunding(true);
    setRefundError(null);

    try {
      const amount = Number(refundAmountPaise);
      const res = await paymentService.processRefund(
        selectedTx.id,
        amount,
        refundReason,
        refundSimulation
      );

      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      await queryClient.invalidateQueries({ queryKey: ['folios'] });
      setRefundModalOpen(false);

      setActionSuccessNotice(
        `Refund of ₹${(amount / 100).toFixed(2)} processed successfully for ${selectedTx.transactionRef}. ${res.isDemo ? '(DEMO SIMULATION)' : ''}`
      );
      setTimeout(() => setActionSuccessNotice(null), 6000);
    } catch (err: any) {
      setRefundError(err.message || 'Refund failed. Please check permissions or amount.');
    } finally {
      setIsRefunding(false);
    }
  };

  const handleRunDemoReconciliation = async () => {
    try {
      await paymentService.reconcileDemo();
      await refetchRecon();
      setActionSuccessNotice('Reconciliation feed updated with latest provider settlement records.');
      setTimeout(() => setActionSuccessNotice(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Reconciliation failed');
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvContent.trim()) return;

    setIsImportingCsv(true);
    setCsvImportError(null);
    try {
      await paymentService.importSettlementCsv(csvContent);
      await refetchRecon();
      setCsvModalOpen(false);
      setCsvContent('');
      setActionSuccessNotice('Settlement CSV successfully parsed and reconciled with HMS payments.');
      setTimeout(() => setActionSuccessNotice(null), 5000);
    } catch (err: any) {
      setCsvImportError(err.message || 'Failed to import and parse settlement CSV.');
    } finally {
      setIsImportingCsv(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      await paymentService.exportCsv();
    } catch (err: any) {
      alert(err.message || 'Failed to export CSV');
    }
  };

  return (
    <div className="space-y-6">
      {/* Provider Status Banner */}
      <div className={`p-4 rounded-xl border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
        providerStatus?.isDemo
          ? 'bg-amber-50/70 border-amber-200/80 text-amber-900'
          : 'bg-emerald-50 border-emerald-200 text-emerald-900'
      }`}>
        <div className="flex items-center gap-3">
          <span className="p-2 bg-white rounded-lg border border-amber-300 shadow-2xs">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">
                Unified Payment Gateway: {providerStatus?.activeProvider || 'DEMO'}
              </span>
              <Badge variant={providerStatus?.isDemo ? 'gold' : 'success'} size="sm">
                {providerStatus?.isDemo ? 'DEMO MODE' : 'LIVE'}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {providerStatus?.isDemo
                ? 'Deterministic local simulation active. Transactions, refunds, and settlement feeds run locally without requiring external bank/gateway API keys.'
                : 'Production gateway provider active with verified API credentials.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <Badge variant="outline" size="sm" className="font-mono text-[10px]">
            Supported: Demo, Razorpay, Bank
          </Badge>
        </div>
      </div>

      {/* Action Notice Banner */}
      {actionSuccessNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessNotice}</span>
          </div>
          <button onClick={() => setActionSuccessNotice(null)} className="text-emerald-700 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-sans font-bold text-slate-900 tracking-tight">
              Payments &amp; Gateway Reconciliation
            </h1>
            {(isFetchingPayments || isFetchingRecon) && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full font-medium animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" /> Syncing...
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Provider-independent transactions ledger, simulated/live settlement feeds, and audit trail reconciliation
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'RECONCILIATION' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunDemoReconciliation}
                className="text-xs bg-ivory"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Re-run Reconciliation
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCsvModalOpen(true)}
                className="text-xs bg-ivory"
              >
                <Upload className="w-3.5 h-3.5 mr-1" /> Import Settlement CSV
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="text-xs bg-ivory"
          >
            <Download className="w-3.5 h-3.5 mr-1" /> Export Bank CSV
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('TRANSACTIONS')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'TRANSACTIONS'
              ? 'border-amber-600 text-amber-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Transactions &amp; Payments Ledger</span>
          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px]">
            {payments?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('RECONCILIATION')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'RECONCILIATION'
              ? 'border-amber-600 text-amber-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Gateway &amp; Bank Reconciliation</span>
          {reconciliationData && reconciliationData.discrepancyCount > 0 ? (
            <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
              {reconciliationData.discrepancyCount} Discrepancies
            </span>
          ) : (
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px]">
              Balanced
            </span>
          )}
        </button>
      </div>

      {/* ──────────────── TAB 1: TRANSACTIONS LEDGER ──────────────── */}
      {activeTab === 'TRANSACTIONS' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-3 bg-ivory rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transaction ref, folio, guest..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px] font-semibold">Channel:</span>
              <select
                value={filterMethod}
                onChange={(e) => setFilterMethod(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700"
              >
                <option value="ALL">All Methods</option>
                <option value="UPI">UPI</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px] font-semibold">Provider:</span>
              <select
                value={filterProvider}
                onChange={(e) => setFilterProvider(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700"
              >
                <option value="ALL">All Providers</option>
                <option value="DEMO">DEMO</option>
                <option value="RAZORPAY">Razorpay</option>
                <option value="STRIPE">Stripe</option>
                <option value="PINE_LABS_POS">Pine Labs POS</option>
                <option value="CASH_REGISTER">Cash Register</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px] font-semibold">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="PENDING">PENDING</option>
                <option value="FAILED">FAILED</option>
                <option value="REFUNDED">REFUNDED</option>
              </select>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-ivory rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            {isLoadingPayments && (!payments || payments.length === 0) ? (
              <LoadingState message="Loading payment transaction records..." />
            ) : filteredPayments.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No transactions found matching the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
                      <th className="py-3 px-4">Transaction Ref</th>
                      <th className="py-3 px-4">Folio #</th>
                      <th className="py-3 px-4">Guest Name</th>
                      <th className="py-3 px-4">Method &amp; Channel</th>
                      <th className="py-3 px-4">Gateway Provider</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {filteredPayments.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {tx.transactionRef}
                          {tx.provider === 'DEMO' && (
                            <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-sans">
                              DEMO
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-amber-700 font-bold">{tx.folioId}</td>
                        <td className="py-3 px-4 font-sans font-semibold text-slate-800">
                          {tx.guestName}
                          {tx.roomNumber && <span className="text-[11px] text-slate-400 block font-normal">Room {tx.roomNumber}</span>}
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <span className="font-medium text-slate-900 block">{tx.paymentMethod}</span>
                          <span className="text-[11px] text-slate-400">{tx.upiId || `Card •••• ${tx.cardLast4 || '0000'}`}</span>
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <Badge variant={tx.provider === 'DEMO' ? 'gold' : 'outline'} size="sm" className="text-[10px]">
                            {tx.provider}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <CurrencyDisplay amountPaise={tx.amountPaise} />
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <StatusBadge type="payment" value={tx.status} />
                        </td>
                        <td className="py-3 px-4 text-center font-sans">
                          {tx.status === 'SUCCESS' ? (
                            <PermissionGate
                              permission="AUTHORIZE_REFUND"
                              fallback={<span className="text-slate-400 text-[10px]">No Refund Right</span>}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenRefundModal(tx)}
                                className="h-7 text-xs px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3 mr-1" /> Refund
                              </Button>
                            </PermissionGate>
                          ) : (
                            <span className="text-slate-400 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────── TAB 2: GATEWAY & BANK RECONCILIATION ──────────────── */}
      {activeTab === 'RECONCILIATION' && (
        <div className="space-y-6">
          {/* Reconciliation KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-4 bg-ivory rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-slate-400 uppercase font-bold text-[10px] block">HMS Processed Payments</span>
              <span className="font-mono text-base font-bold text-slate-900 block">
                <CurrencyDisplay amountPaise={reconciliationData?.totalHmsPaymentsPaise || 0} />
              </span>
              <span className="text-[11px] text-slate-500">Internal ledger total</span>
            </div>

            <div className="p-4 bg-ivory rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-slate-400 uppercase font-bold text-[10px] block">Gateway Settled Volume</span>
              <span className="font-mono text-base font-bold text-emerald-700 block">
                <CurrencyDisplay amountPaise={reconciliationData?.totalSettledPaise || 0} />
              </span>
              <span className="text-[11px] text-slate-500">Gross provider settlement</span>
            </div>

            <div className="p-4 bg-ivory rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-slate-400 uppercase font-bold text-[10px] block">Gateway Fees Deducted</span>
              <span className="font-mono text-base font-bold text-amber-700 block">
                <CurrencyDisplay amountPaise={reconciliationData?.totalFeesPaise || 0} />
              </span>
              <span className="text-[11px] text-slate-500">MDR &amp; gateway charges</span>
            </div>

            <div className="p-4 bg-ivory rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-slate-400 uppercase font-bold text-[10px] block">Net Bank Payout</span>
              <span className="font-mono text-base font-bold text-slate-900 block">
                <CurrencyDisplay amountPaise={reconciliationData?.totalPayoutPaise || 0} />
              </span>
              <span className="text-[11px] text-emerald-600 font-semibold">Credited to bank account</span>
            </div>
          </div>

          {/* Reconciliation Audit Trail Table */}
          <div className="bg-ivory rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden space-y-3 p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Settlement Records vs HMS Payments Comparison
                </h3>
                <p className="text-[11px] text-slate-500">
                  Batch: <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">{reconciliationData?.batchId || 'Awaiting Batch'}</code> • Provider: {reconciliationData?.provider || 'DEMO'}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold text-[11px]">
                  <Check className="w-3 h-3" /> {reconciliationData?.matchedCount || 0} Matched
                </span>
                {(reconciliationData?.discrepancyCount || 0) > 0 && (
                  <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-semibold text-[11px]">
                    <AlertCircle className="w-3 h-3" /> {reconciliationData?.discrepancyCount} Discrepancies
                  </span>
                )}
              </div>
            </div>

            {isLoadingRecon ? (
              <LoadingState message="Reconciling transactions against provider settlement records..." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Transaction Ref</th>
                      <th className="py-2.5 px-3">Folio #</th>
                      <th className="py-2.5 px-3">HMS Amount</th>
                      <th className="py-2.5 px-3">Settlement Amount</th>
                      <th className="py-2.5 px-3">Gateway Fee</th>
                      <th className="py-2.5 px-3">Net Payout</th>
                      <th className="py-2.5 px-3">Audit Discrepancy Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {reconciliationData?.items?.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-sans font-semibold">
                          {item.matchStatus === 'MATCHED' && (
                            <Badge variant="success" size="sm" className="text-[10px]">MATCHED</Badge>
                          )}
                          {item.matchStatus === 'AMOUNT_MISMATCH' && (
                            <Badge variant="destructive" size="sm" className="text-[10px]">MISMATCH</Badge>
                          )}
                          {item.matchStatus === 'MISSING_IN_HMS' && (
                            <Badge variant="gold" size="sm" className="text-[10px]">NOT IN HMS</Badge>
                          )}
                          {item.matchStatus === 'PENDING' && (
                            <Badge variant="outline" size="sm" className="text-[10px]">PENDING</Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">{item.transactionRef}</td>
                        <td className="py-2.5 px-3 text-slate-600">{item.folioId || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-900">
                          {item.hmsAmountPaise !== null && item.hmsAmountPaise !== undefined ? (
                            <CurrencyDisplay amountPaise={item.hmsAmountPaise} />
                          ) : (
                            <span className="text-slate-400 font-sans italic">None</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-emerald-700 font-semibold">
                          <CurrencyDisplay amountPaise={item.settlementAmountPaise} />
                        </td>
                        <td className="py-2.5 px-3 text-amber-700">
                          <CurrencyDisplay amountPaise={item.feePaise + item.taxPaise} />
                        </td>
                        <td className="py-2.5 px-3 text-slate-900 font-semibold">
                          <CurrencyDisplay amountPaise={item.netPayoutPaise} />
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-600 text-[11px]">
                          {item.discrepancyNote || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────── MODAL: PROCESS AUTHORIZED REFUND ──────────────── */}
      {refundModalOpen && selectedTx && (
        <Modal
          isOpen={refundModalOpen}
          onClose={() => setRefundModalOpen(false)}
          title="Authorize & Process Payment Refund"
          subtitle={`Transaction ${selectedTx.transactionRef} • Folio ${selectedTx.folioId}`}
          maxWidth="md"
        >
          <form onSubmit={handleConfirmRefund} className="space-y-4 text-xs font-sans">
            {refundError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                {refundError}
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Original Guest:</span>
                <span className="font-semibold text-slate-900">{selectedTx.guestName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Original Payment Amount:</span>
                <span className="font-mono font-bold text-slate-900">
                  <CurrencyDisplay amountPaise={selectedTx.amountPaise} />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Channel &amp; Provider:</span>
                <span className="font-semibold text-slate-800">{selectedTx.paymentMethod} ({selectedTx.provider})</span>
              </div>
            </div>

            <div>
              <Input
                label="Refund Amount (₹)"
                required
                type="number"
                value={Number(refundAmountPaise) / 100}
                onChange={(e) => setRefundAmountPaise(String(Number(e.target.value) * 100))}
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Maximum refundable: ₹{(selectedTx.amountPaise / 100).toFixed(2)}
              </span>
            </div>

            <div>
              <Input
                label="Reason for Refund (Audit Trail)"
                required
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>

            {/* Provider simulation outcome selector if demo */}
            {selectedTx.provider === 'DEMO' && (
              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-xs">
                  Demo Outcome Simulator
                </label>
                <select
                  value={refundSimulation}
                  onChange={(e) => setRefundSimulation(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white text-slate-800"
                >
                  <option value="SUCCESS">Simulate Successful Refund</option>
                  <option value="FAILED">Simulate Provider Error / Declined Refund</option>
                </select>
                <span className="text-[10px] text-amber-700 block mt-0.5">
                  Demo provider deterministic test switch (local only).
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={isRefunding}
                onClick={() => setRefundModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                type="submit"
                isLoading={isRefunding}
              >
                Authorize &amp; Issue Refund
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ──────────────── MODAL: IMPORT SETTLEMENT CSV ──────────────── */}
      {csvModalOpen && (
        <Modal
          isOpen={csvModalOpen}
          onClose={() => setCsvModalOpen(false)}
          title="Import Bank / Gateway Settlement CSV"
          subtitle="Paste or upload daily bank settlement MIS records for audit reconciliation"
          maxWidth="lg"
        >
          <form onSubmit={handleImportCsv} className="space-y-4 text-xs font-sans">
            {csvImportError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                {csvImportError}
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-slate-700 font-semibold">
                Settlement CSV Content (Columns: transaction_ref, amount, fee, date)
              </label>
              <textarea
                rows={7}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder={`transaction_ref,amount,fee,date\nTXN-2026-9041,18480.00,369.60,2026-10-15\nTXN-2026-9042,10000.00,200.00,2026-10-15`}
                className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-xs bg-slate-50 text-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  setCsvContent(
                    `transaction_ref,amount,fee,date\nTXN-2026-9041,18480.00,369.60,2026-10-15\nTXN-2026-9043,9500.00,190.00,2026-10-15\nTXN-EXTRA-8888,2500.00,50.00,2026-10-15`
                  );
                }}
              >
                Load Sample Settlement Data
              </Button>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setCsvModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="gold" size="sm" type="submit" isLoading={isImportingCsv}>
                  Reconcile Batch
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
