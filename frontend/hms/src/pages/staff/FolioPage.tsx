import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Receipt, Printer, Plus, CreditCard, ShieldCheck, ArrowRightLeft, FileSpreadsheet, RefreshCw, X, CheckCircle2 } from 'lucide-react';
import { folioService } from '../../services/apiServices';
import { MasterFolio, FolioItem, TaxInvoice } from '../../types/pms';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { LoadingState } from '../../components/common/LoadingState';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAppDate } from '../../hooks/useAppDate';

export const FolioPage: React.FC = () => {
  const propertyName = useAuthStore((st) => st.session?.activePropertyName) ?? '';
  const legal = useSettingsStore((st) => st.data.legalRegistration);
  const { businessDate } = useAppDate();
  const hotelAddress = [legal?.registeredAddress, legal?.city, legal?.pinCode].filter(Boolean).join(', ');

  const queryClient = useQueryClient();
  const [selectedFolioId, setSelectedFolioId] = useState<string>('fol-5501');
  const [addChargeModalOpen, setAddChargeModalOpen] = useState(false);
  const [chargeDescription, setChargeDescription] = useState('Late Checkout Surcharge');
  const [chargeAmountPaise, setChargeAmountPaise] = useState('150000');
  const [chargeType, setChargeType] = useState<string>('ROOM_CHARGE');
  const [isPostingCharge, setIsPostingCharge] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // Official Tax Invoice Modal state
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState<TaxInvoice | null>(null);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);

  // Payment Recording Modal state
  const [recordPaymentModalOpen, setRecordPaymentModalOpen] = useState(false);
  const [paymentAmountPaise, setPaymentAmountPaise] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER'>('CASH');
  const [paymentRef, setPaymentRef] = useState('');
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccessNotice, setPaymentSuccessNotice] = useState<string | null>(null);

  const { data: folios = [], isFetching, isLoading } = useQuery({
    queryKey: ['folios'],
    queryFn: () => folioService.getAll(),
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 5
  });

  const activeFolio = folios?.find(f => f.id === selectedFolioId || f.folioNumber === selectedFolioId) || folios?.[0];

  // GST rate based on service category
  const getGstRateAndSac = (type: string) => {
    switch (type) {
      case 'FNB_CHARGE':
        return { rate: 0.05, label: '5% GST (Restaurant & F&B)', sac: '996331' };
      case 'SPA':
        return { rate: 0.18, label: '18% GST (Spa & Wellness)', sac: '999711' };
      case 'LAUNDRY':
        return { rate: 0.12, label: '12% GST (Laundry)', sac: '996311' };
      case 'MINIBAR':
        return { rate: 0.12, label: '12% GST (Minibar)', sac: '996331' };
      case 'ROOM_CHARGE':
      default:
        return { rate: 0.12, label: '12% GST (Accommodation)', sac: '996311' };
    }
  };

  const currentGst = getGstRateAndSac(chargeType);
  const calculatedTaxPaise = Math.round(Number(chargeAmountPaise || 0) * currentGst.rate);

  const handleFetchAndPrintInvoice = async () => {
    if (!activeFolio) return;
    setIsLoadingInvoice(true);
    try {
      const inv = await folioService.getInvoice(activeFolio.id);
      setInvoiceData(inv);
      setInvoiceModalOpen(true);
    } catch (err: any) {
      // Fallback: trigger standard browser print of page
      window.print();
    } finally {
      setIsLoadingInvoice(false);
    }
  };

  const handlePostCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFolio) return;
    setIsPostingCharge(true);
    setPostError(null);

    try {
      const debit = Number(chargeAmountPaise);
      await folioService.postCharge(
        activeFolio.id,
        chargeDescription,
        debit,
        calculatedTaxPaise,
        chargeType,
        currentGst.sac
      );
      await queryClient.invalidateQueries({ queryKey: ['folios'] });
      setAddChargeModalOpen(false);
    } catch (err: any) {
      setPostError(err.message || 'Failed to post ancillary charge.');
    } finally {
      setIsPostingCharge(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFolio) return;
    const amount = Number(paymentAmountPaise);
    if (isNaN(amount) || amount <= 0) {
      setPaymentError('Payment amount must be greater than zero.');
      return;
    }
    setIsRecordingPayment(true);
    setPaymentError(null);

    try {
      await folioService.recordPayment(
        activeFolio.id,
        amount,
        paymentMethod,
        paymentRef ? paymentRef.trim() : undefined
      );
      await queryClient.invalidateQueries({ queryKey: ['folios'] });
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      setRecordPaymentModalOpen(false);
      setPaymentSuccessNotice(
        `Payment of ₹${(amount / 100).toFixed(2)} recorded successfully via ${paymentMethod}.`
      );
      setTimeout(() => setPaymentSuccessNotice(null), 6000);
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to record payment on folio.');
    } finally {
      setIsRecordingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Success Alert */}
      {paymentSuccessNotice && (
        <div className="no-print p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-900 text-xs flex items-center justify-between shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{paymentSuccessNotice}</span>
          </div>
          <button
            onClick={() => setPaymentSuccessNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-sans font-bold text-slate-900 tracking-tight">
              Master Folio &amp; Financial Settlement
            </h1>
            {isFetching && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full font-medium animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" /> Syncing...
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Double-entry immutable ledger, split folios, corporate billing, and GST tax invoice generation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFetchAndPrintInvoice}
            isLoading={isLoadingInvoice}
            className="text-xs bg-ivory"
          >
            <Printer className="w-3.5 h-3.5 mr-1" /> Print Official Tax Invoice
          </Button>
          <Button
            variant="gold"
            size="sm"
            onClick={() => {
              setPaymentError(null);
              setPaymentAmountPaise(String(activeFolio?.outstandingBalancePaise || ''));
              setPaymentRef(`REC-${Date.now().toString().slice(-6)}`);
              setRecordPaymentModalOpen(true);
            }}
            disabled={!activeFolio || activeFolio.status === 'CLOSED' || (activeFolio.outstandingBalancePaise || 0) <= 0}
            className="text-xs"
          >
            <CreditCard className="w-3.5 h-3.5 mr-1" /> Record Payment
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPostError(null);
              setAddChargeModalOpen(true);
            }}
            className="text-xs bg-ivory"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Post Ancillary Charge
          </Button>
        </div>
      </div>

      {/* Active Folio Switcher & Summary Card */}
      {isLoading && (!folios || folios.length === 0) ? (
        <LoadingState message="Loading financial ledger..." />
      ) : (
        <div className="space-y-6">
          {/* Top Bar Switcher (no-print) */}
          <div className="no-print bg-ivory p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500 uppercase">Select Active Folio:</span>
              <select
                value={selectedFolioId}
                onChange={(e) => setSelectedFolioId(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none"
              >
                {folios?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.folioNumber} — Room {f.roomNumber || 'N/A'} ({f.guestName})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" size="md" className="font-mono">
                Status: {activeFolio?.status}
              </Badge>
              <span className="text-slate-400">|</span>
              <span className="text-slate-600">Credit Limit: <CurrencyDisplay amountPaise={activeFolio?.creditLimitPaise || 5000000} /></span>
            </div>
          </div>

          {/* Printable Invoice Header (Visible on print & web) */}
          <div className="bg-ivory rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-200 pb-6">
              <div>
                <span className="font-serif font-bold text-xl text-slate-900 block">{propertyName}</span>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {hotelAddress}<br />
                  {legal?.gstin ? `GSTIN: ${legal.gstin} • ` : ''}SAC Category: 9963 Accommodation
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">GST Tax Invoice</span>
                <span className="font-mono text-xl font-bold text-slate-900">{activeFolio?.folioNumber}</span>
                <span className="text-xs text-slate-500 block mt-0.5">Date: {businessDate}</span>
              </div>
            </div>

            {/* Guest & Room Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Billed To (Guest)</span>
                <span className="font-bold text-slate-900 text-sm">{activeFolio?.guestName}</span>
                <span className="text-slate-500 block">Guest ID: {activeFolio?.guestId}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Assigned Physical Room</span>
                <span className="font-bold text-slate-900 text-sm">Room {activeFolio?.roomNumber || 'N/A'}</span>
                <span className="text-slate-500 block">Stay Ref: {activeFolio?.stayId || 'Active Stay'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Folio Balance Due</span>
                <span className={`font-mono font-bold text-base block ${(activeFolio?.outstandingBalancePaise || 0) > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  <CurrencyDisplay amountPaise={activeFolio?.outstandingBalancePaise || 0} />
                </span>
                <span className="text-[11px] text-slate-500">
                  {activeFolio?.outstandingBalancePaise === 0 ? 'Fully Settled' : 'Payment Required'}
                </span>
              </div>
            </div>

            {/* Split Folios Notice */}
            {activeFolio?.splitFolios && activeFolio.splitFolios.length > 0 && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs flex items-center justify-between no-print">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-amber-900 font-semibold">
                    Multi-Folio Split Configured: {activeFolio.splitFolios.map(s => s.folioCode).join(' & ')}
                  </span>
                </div>
                <Badge variant="gold" size="sm">Corporate Split</Badge>
              </div>
            )}

            {/* Double-Entry Transaction Ledger Table */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Itemized Folio Transactions Ledger (Immutable Audit Log)
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                      <th className="py-2.5 px-3">Date & Time</th>
                      <th className="py-2.5 px-3">Transaction Description</th>
                      <th className="py-2.5 px-3">SAC Code</th>
                      <th className="py-2.5 px-3 text-right">Debit (+)</th>
                      <th className="py-2.5 px-3 text-right">Credit (-)</th>
                      <th className="py-2.5 px-3 text-right">GST Tax</th>
                      <th className="py-2.5 px-3">Posted By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {activeFolio?.items?.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {item.postedAt.replace('T', ' ').slice(0, 16)}
                        </td>
                        <td className="py-2.5 px-3 font-sans font-medium text-slate-800">
                          {item.description}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">{item.sacCode || '—'}</td>
                        <td className="py-2.5 px-3 text-right text-slate-900 font-semibold">
                          {item.debitPaise > 0 ? <CurrencyDisplay amountPaise={item.debitPaise} /> : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold">
                          {item.creditPaise > 0 ? <CurrencyDisplay amountPaise={item.creditPaise} /> : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          {item.taxPaise > 0 ? <CurrencyDisplay amountPaise={item.taxPaise} /> : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-[10px] text-slate-400 font-sans">{item.postedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary Calculation */}
            <div className="flex justify-end pt-3">
              <div className="w-full sm:w-72 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Gross Charges (Debits):</span>
                  <CurrencyDisplay amountPaise={activeFolio?.totalChargesPaise || 0} />
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Payments (Credits):</span>
                  <span className="text-emerald-700 font-semibold">
                    -<CurrencyDisplay amountPaise={activeFolio?.totalPaymentsPaise || 0} />
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Goods & Services Tax (GST):</span>
                  <CurrencyDisplay amountPaise={activeFolio?.totalTaxesPaise || 0} />
                </div>
                <div className="flex justify-between font-bold text-slate-900 text-sm pt-2 border-t border-slate-200">
                  <span>Net Outstanding Balance:</span>
                  <CurrencyDisplay amountPaise={activeFolio?.outstandingBalancePaise || 0} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Post Ancillary Charge Modal */}
      {addChargeModalOpen && (
        <Modal
          isOpen={addChargeModalOpen}
          onClose={() => setAddChargeModalOpen(false)}
          title="Post Ancillary Charge to Folio"
          subtitle={`Folio ${activeFolio?.folioNumber} • Double-entry Persisted Ledger Item`}
          maxWidth="md"
        >
          <form onSubmit={handlePostCharge} className="space-y-4 text-xs">
            {postError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                {postError}
              </div>
            )}

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Service Category</label>
              <select
                value={chargeType}
                onChange={(e) => setChargeType(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white text-slate-800"
              >
                <option value="ROOM_CHARGE">Room Charge / Surcharge (SAC 996311 - 12% GST)</option>
                <option value="FNB_CHARGE">Food &amp; Beverage / Room Service (SAC 996331 - 5% GST)</option>
                <option value="LAUNDRY">Laundry Service (SAC 996311 - 12% GST)</option>
                <option value="SPA">Spa &amp; Ayurvedic Treatment (SAC 999711 - 18% GST)</option>
                <option value="MINIBAR">Minibar In-Room (SAC 996331 - 12% GST)</option>
                <option value="MISC">Miscellaneous Ancillary Charge (12% GST)</option>
              </select>
            </div>

            <div>
              <Input
                label="Charge Description"
                required
                value={chargeDescription}
                onChange={(e) => setChargeDescription(e.target.value)}
              />
            </div>

            <div>
              <Input
                label="Net Amount (₹)"
                required
                type="number"
                value={Number(chargeAmountPaise) / 100}
                onChange={(e) => setChargeAmountPaise(String(Number(e.target.value) * 100))}
              />
            </div>

            {/* Tax Calculation Preview */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-[11px] text-slate-600">
              <div className="flex justify-between">
                <span>Tax Category:</span>
                <span className="font-semibold">{currentGst.label} (SAC {currentGst.sac})</span>
              </div>
              <div className="flex justify-between">
                <span>Calculated GST:</span>
                <span className="font-semibold font-mono"><CurrencyDisplay amountPaise={calculatedTaxPaise} /></span>
              </div>
              <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-slate-200">
                <span>Total Debit to Folio:</span>
                <span className="font-mono text-amber-900"><CurrencyDisplay amountPaise={Number(chargeAmountPaise) + calculatedTaxPaise} /></span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" type="button" onClick={() => setAddChargeModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="gold" size="sm" type="submit" isLoading={isPostingCharge}>
                Post Charge to Folio
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Official Tax Invoice Printable Modal */}
      {invoiceModalOpen && invoiceData && (
        <Modal
          isOpen={invoiceModalOpen}
          onClose={() => setInvoiceModalOpen(false)}
          title="Official GST Tax Invoice Preview"
          subtitle={`Invoice ${invoiceData.invoiceNumber} • FY ${invoiceData.financialYear}`}
          maxWidth="lg"
        >
          <div className="space-y-6 text-xs font-sans print:p-0">
            {/* Invoice Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-slate-900">{invoiceData.hotelDetails.name}</h3>
                <p className="text-[11px] text-slate-600 mt-0.5">{invoiceData.hotelDetails.legalName}</p>
                <p className="text-[11px] text-slate-500">{invoiceData.hotelDetails.address}</p>
                <p className="text-[11px] text-slate-700 font-mono font-semibold mt-1">
                  GSTIN: {invoiceData.hotelDetails.gstin} • State: {invoiceData.hotelDetails.stateCode}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Tax Invoice</span>
                <span className="font-mono text-base font-bold text-slate-900 block">{invoiceData.invoiceNumber}</span>
                <span className="text-slate-500 text-[11px]">Date: {invoiceData.invoiceDate}</span>
              </div>
            </div>

            {/* Guest Details */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px]">
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Guest Name</span>
                <span className="font-bold text-slate-900">{invoiceData.guestDetails.name}</span>
                <span className="text-slate-500 block">GSTIN: {invoiceData.guestDetails.gstin || 'B2C (Unregistered)'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Room &amp; Stay</span>
                <span className="font-bold text-slate-900">Room {invoiceData.guestDetails.roomNumber}</span>
                <span className="text-slate-500 block">Booking: {invoiceData.guestDetails.reservationId}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Folio Reference</span>
                <span className="font-mono font-bold text-slate-800">{invoiceData.guestDetails.folioNumber}</span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                    <th className="p-2">Description</th>
                    <th className="p-2">SAC</th>
                    <th className="p-2 text-right">Taxable (₹)</th>
                    <th className="p-2 text-right">CGST (₹)</th>
                    <th className="p-2 text-right">SGST (₹)</th>
                    <th className="p-2 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {invoiceData.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2 font-sans font-medium text-slate-800">{item.description}</td>
                      <td className="p-2 text-slate-500">{item.sacCode}</td>
                      <td className="p-2 text-right"><CurrencyDisplay amountPaise={item.taxablePaise} /></td>
                      <td className="p-2 text-right"><CurrencyDisplay amountPaise={item.cgstPaise} /></td>
                      <td className="p-2 text-right"><CurrencyDisplay amountPaise={item.sgstPaise} /></td>
                      <td className="p-2 text-right font-bold text-slate-900"><CurrencyDisplay amountPaise={item.totalPaise} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Total Taxable:</span>
                  <CurrencyDisplay amountPaise={invoiceData.totalTaxablePaise} />
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>CGST Total:</span>
                  <CurrencyDisplay amountPaise={invoiceData.totalCgstPaise} />
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>SGST Total:</span>
                  <CurrencyDisplay amountPaise={invoiceData.totalSgstPaise} />
                </div>
                <div className="flex justify-between font-bold text-slate-900 text-sm pt-1.5 border-t border-slate-200">
                  <span>Invoice Grand Total:</span>
                  <CurrencyDisplay amountPaise={invoiceData.totalInvoicePaise} />
                </div>
                {!!invoiceData.roundOffPaise && (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Round off:</span>
                      <span>{invoiceData.roundOffPaise > 0 ? '+' : '−'}<CurrencyDisplay amountPaise={Math.abs(invoiceData.roundOffPaise)} /></span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 text-sm">
                      <span>Amount Payable:</span>
                      <CurrencyDisplay amountPaise={invoiceData.amountPayablePaise ?? invoiceData.totalInvoicePaise} />
                    </div>
                  </>
                )}
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Less Payments Applied:</span>
                  <span>-<CurrencyDisplay amountPaise={invoiceData.paymentsAppliedPaise} /></span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Balance Due / Status:</span>
                  <span>
                    {invoiceData.balanceDuePaise === 0 ? (
                      <span className="text-emerald-700 font-bold">PAID (₹0.00)</span>
                    ) : (
                      <span className="text-rose-700"><CurrencyDisplay amountPaise={invoiceData.balanceDuePaise} /></span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
              <Button variant="outline" size="sm" onClick={() => setInvoiceModalOpen(false)}>
                Close
              </Button>
              <Button variant="primary" size="sm" onClick={() => window.print()}>
                <Printer className="w-3.5 h-3.5 mr-1" /> Print Official Invoice
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Record Payment Settlement Modal */}
      {recordPaymentModalOpen && activeFolio && (
        <Modal
          isOpen={recordPaymentModalOpen}
          onClose={() => {
            if (!isRecordingPayment) {
              setRecordPaymentModalOpen(false);
              setPaymentError(null);
            }
          }}
          title={`Record Payment — ${activeFolio.folioNumber}`}
          maxWidth="md"
        >
          <form onSubmit={handleRecordPayment} className="space-y-4">
            {paymentError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                {paymentError}
              </div>
            )}

            {/* Folio & Balance Info */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block uppercase tracking-wider text-[10px]">Guest</span>
                <span className="font-semibold text-slate-900 block">{activeFolio.guestName}</span>
                <span className="text-slate-500">Room {activeFolio.roomNumber || 'N/A'}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block uppercase tracking-wider text-[10px]">Outstanding Balance</span>
                <span className="font-mono font-bold text-amber-700 text-sm block">
                  <CurrencyDisplay amountPaise={activeFolio.outstandingBalancePaise} />
                </span>
                <span className="text-slate-500 text-[11px]">Due for settlement</span>
              </div>
            </div>

            {/* Payment Tender Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-800 block mb-1.5">
                Payment Tender / Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['CASH', 'UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer text-center ${
                      paymentMethod === method
                        ? 'border-amber-600 bg-amber-100 text-amber-900 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {method === 'CREDIT_CARD' ? 'Credit Card' : method === 'DEBIT_CARD' ? 'Debit Card' : method === 'BANK_TRANSFER' ? 'Bank Transfer' : method}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Amount */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-800">
                  Payment Amount (in Paise / Minor Units)
                </label>
                <button
                  type="button"
                  onClick={() => setPaymentAmountPaise(String(activeFolio.outstandingBalancePaise))}
                  className="text-[11px] text-amber-700 hover:text-amber-900 font-semibold underline cursor-pointer"
                >
                  Pay Full Balance (₹{(activeFolio.outstandingBalancePaise / 100).toFixed(2)})
                </button>
              </div>
              <Input
                type="number"
                value={paymentAmountPaise}
                onChange={(e) => setPaymentAmountPaise(e.target.value)}
                placeholder="Amount in paise (e.g. 100000 = ₹1,000)"
                required
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Entered: <span className="font-semibold text-slate-800">₹{((Number(paymentAmountPaise) || 0) / 100).toFixed(2)}</span>
              </span>
            </div>

            {/* Reference Number */}
            <div>
              <label className="text-xs font-semibold text-slate-800 block mb-1">
                Reference / Receipt Identifier
              </label>
              <Input
                type="text"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="e.g. REC-99281 or UPI Ref Number"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={isRecordingPayment}
                onClick={() => {
                  setRecordPaymentModalOpen(false);
                  setPaymentError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="gold"
                size="sm"
                type="submit"
                isLoading={isRecordingPayment}
              >
                Confirm &amp; Record Payment
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
