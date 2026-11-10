import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Download, Printer, Share2, X, Store, FileText } from 'lucide-react'
import type { CartLine, MenuItem, RestaurantFeatures } from '../../../../types/customer'

export interface ReceiptData {
  orderId?: string
  displayNumber: string
  referenceNumber?: string
  restaurantName?: string
  restaurantLogo?: string
  restaurantAddress?: string
  restaurantCity?: string
  restaurantState?: string
  restaurantPincode?: string
  gstin?: string
  fssaiLicense?: string
  table: string
  roomNumber?: string
  customerName?: string
  customerPhone?: string
  createdAt?: string
  lines: CartLine[]
  subtotal: number
  discount: number
  tax: number
  /** GST per rate (a dish can carry its own); absent on older servers. */
  taxBreakdown?: { percent: number; taxable: number; tax: number }[]
  total: number
  payment: 'online' | 'counter'
  paymentMethod?: string
  status: string
  features?: RestaurantFeatures
}

/** Tax lines for the bill: the server's per-rate breakdown, or (older servers) one line at the rate implied by the totals. */
function receiptTaxRows(data: { subtotal: number; discount: number; tax: number; taxBreakdown?: { percent: number; taxable: number; tax: number }[] }) {
  if (data.taxBreakdown?.length) return data.taxBreakdown.filter((r) => r.tax > 0)
  if (data.tax <= 0) return []
  const base = data.subtotal - data.discount
  return [{ percent: base > 0 ? Math.round((data.tax / base) * 100) : 5, taxable: base, tax: data.tax }]
}

interface CustomerReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  data: ReceiptData
  menuItems: MenuItem[]
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function generateInvoiceHtml(data: ReceiptData, menuItems: MenuItem[]): string {
  const itemFor = (itemId: string) => menuItems.find((m) => m.id === itemId)

  const dateStr = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-IN')

  const timeStr = data.createdAt
    ? new Date(data.createdAt).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleTimeString('en-IN')

  const taxRows = receiptTaxRows(data)

  let itemsRows = ''
  data.lines.forEach((line, index) => {
    const item = itemFor(line.itemId)
    const variant = item?.variants?.find((v) => v.id === line.variantId)
    const unitPrice =
      (variant?.price ?? item?.price ?? 0) +
      line.addOnIds.reduce(
        (sum, id) => sum + (item?.addOns?.find((a) => a.id === id)?.price ?? 0),
        0
      )
    const lineTotal = unitPrice * line.qty

    const addOnNames = line.addOnIds
      .map((id) => item?.addOns?.find((a) => a.id === id)?.name)
      .filter(Boolean)

    itemsRows += `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #64748b;">${index + 1}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #0f172a;">
          ${escapeHtml(item?.name || line.itemId)}
          ${variant ? `<div style="font-size: 10.5px; color: #64748b; font-weight: normal;">Variant: ${escapeHtml(variant.name)}</div>` : ''}
          ${addOnNames.length > 0 ? `<div style="font-size: 10.5px; color: #64748b; font-weight: normal;">+ ${escapeHtml(addOnNames.join(', '))}</div>` : ''}
        </td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: center; font-family: monospace; font-weight: 600;">${line.qty}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace;">₹${unitPrice.toFixed(2)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace; font-weight: bold; color: #0f172a;">₹${lineTotal.toFixed(2)}</td>
      </tr>
    `
  })

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Tax Invoice - #${escapeHtml(data.displayNumber)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.4;
      font-size: 12px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .invoice-wrapper {
      max-width: 680px;
      margin: 0 auto;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 24px;
      background: #ffffff;
    }
    .header {
      text-align: center;
      padding-bottom: 14px;
      border-bottom: 2px dashed #cbd5e1;
      margin-bottom: 14px;
    }
    .restaurant-name {
      font-size: 18px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
    }
    .restaurant-meta {
      font-size: 11px;
      color: #475569;
      margin-top: 3px;
    }
    .badges-row {
      margin-top: 6px;
      display: flex;
      justify-content: center;
      gap: 12px;
      font-size: 11px;
      font-family: monospace;
      color: #334155;
    }
    .title-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 14px;
      margin-bottom: 14px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 14px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11.5px;
    }
    .meta-col {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .meta-label {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      color: #94a3b8;
    }
    .meta-val {
      font-weight: 600;
      color: #1e293b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    th {
      background: #f1f5f9;
      padding: 8px;
      font-size: 10.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 800;
      color: #475569;
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
    }
    .summary-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 14px;
    }
    .summary-table {
      width: 260px;
      font-size: 12px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      color: #475569;
    }
    .summary-row.total {
      border-top: 2px solid #0f172a;
      padding-top: 6px;
      margin-top: 4px;
      font-size: 14px;
      font-weight: 900;
      color: #0f172a;
    }
    .stamp-box {
      border: 1px solid #a7f3d0;
      background: #ecfdf5;
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }
    .stamp-text {
      color: #065f46;
      font-size: 11px;
      font-weight: 600;
    }
    .stamp-badge {
      background: #059669;
      color: #ffffff;
      font-size: 10.5px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 4px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .footer {
      text-align: center;
      font-size: 10.5px;
      color: #94a3b8;
      border-top: 1px dashed #cbd5e1;
      padding-top: 10px;
    }
  </style>
</head>
<body>
  <div class="invoice-wrapper">
    <div class="header">
      <h1 class="restaurant-name">${escapeHtml(data.restaurantName || 'TapMenu Restaurant')}</h1>
      ${data.restaurantAddress ? `<div class="restaurant-meta">${escapeHtml(data.restaurantAddress)}${data.restaurantCity ? `, ${escapeHtml(data.restaurantCity)}` : ''}${data.restaurantPincode ? ` - ${escapeHtml(data.restaurantPincode)}` : ''}</div>` : ''}
      <div class="badges-row">
        ${data.gstin ? `<span>GSTIN: <b>${escapeHtml(data.gstin)}</b></span>` : ''}
        ${data.fssaiLicense ? `<span>FSSAI: <b>${escapeHtml(data.fssaiLicense)}</b></span>` : ''}
      </div>
    </div>

    <div class="title-banner">
      <div>
        <span style="font-size: 13px; font-weight: 900; letter-spacing: 0.5px;">TAX INVOICE</span>
        <span style="font-size: 10.5px; color: #64748b; margin-left: 8px; font-family: monospace;">${escapeHtml(data.referenceNumber || `REF-${data.displayNumber}`)}</span>
      </div>
      <div style="font-size: 11px; font-weight: 700; color: #0284c7; background: #e0f2fe; padding: 2px 8px; border-radius: 4px;">
        ORIGINAL FOR RECIPIENT
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-col">
        <span class="meta-label">Order Number</span>
        <span class="meta-val" style="font-size: 14px; font-weight: 800; color: #0f172a;">#${escapeHtml(data.displayNumber)}</span>
      </div>
      <div class="meta-col" style="text-align: right;">
        <span class="meta-label">Dining Location</span>
        <span class="meta-val" style="font-size: 14px; font-weight: 800; color: #0f172a;">
          ${escapeHtml(data.table)}${data.roomNumber ? ` (Room ${escapeHtml(data.roomNumber)})` : ''}
        </span>
      </div>
      <div class="meta-col">
        <span class="meta-label">Invoice Date & Time</span>
        <span class="meta-val">${dateStr} ${timeStr}</span>
      </div>
      <div class="meta-col" style="text-align: right;">
        <span class="meta-label">Guest Details</span>
        <span class="meta-val">${escapeHtml(data.customerName || 'Guest')}${data.customerPhone ? ` (${escapeHtml(data.customerPhone)})` : ''}</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 32px; text-align: center;">#</th>
          <th style="text-align: left;">Item Description</th>
          <th style="width: 50px; text-align: center;">Qty</th>
          <th style="width: 80px; text-align: right;">Rate</th>
          <th style="width: 90px; text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div class="summary-section">
      <div class="summary-table">
        <div class="summary-row">
          <span>Subtotal</span>
          <span style="font-family: monospace; font-weight: 600;">₹${data.subtotal.toFixed(2)}</span>
        </div>
        ${data.discount > 0 ? `
        <div class="summary-row" style="color: #059669;">
          <span>Discount</span>
          <span style="font-family: monospace; font-weight: 600;">-₹${data.discount.toFixed(2)}</span>
        </div>` : ''}
        ${taxRows.map((r) => `
        <div class="summary-row">
          <span>CGST (${r.percent / 2}%)</span>
          <span style="font-family: monospace;">₹${(r.tax / 2).toFixed(2)}</span>
        </div>
        <div class="summary-row">
          <span>SGST (${r.percent / 2}%)</span>
          <span style="font-family: monospace;">₹${(r.tax / 2).toFixed(2)}</span>
        </div>`).join('')}
        <div class="summary-row total">
          <span>Grand Total</span>
          <span style="font-family: monospace;">₹${data.total.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <div class="stamp-box">
      <div class="stamp-text">
        <div>Payment Mode: <b>${data.payment === 'online' ? 'Paid Online via Razorpay' : 'Pay at Counter'}</b></div>
        <div style="font-size: 10px; color: #047857; margin-top: 1px;">Status: ${data.status === 'awaiting_payment' ? 'Payment Pending' : 'Settled & Verified'}</div>
      </div>
      <div class="stamp-badge">
        ${data.status === 'awaiting_payment' ? 'UNPAID' : 'PAID'}
      </div>
    </div>

    <div class="footer">
      <p>Thank you for dining with us! This is a computer-generated tax invoice.</p>
      <p style="margin-top: 2px;">Powered by <b>TapMenu</b> • Verified Dining Experience</p>
    </div>
  </div>
</body>
</html>`
}

export function CustomerReceiptModal({
  isOpen,
  onClose,
  data,
  menuItems,
}: CustomerReceiptModalProps) {
  if (!isOpen) return null

  const itemFor = (itemId: string) => menuItems.find((m) => m.id === itemId)

  const dateStr = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-IN')

  const timeStr = data.createdAt
    ? new Date(data.createdAt).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleTimeString('en-IN')

  const taxRows = receiptTaxRows(data)

  const handlePrint = () => {
    // Generate clean isolated invoice HTML
    const invoiceHtml = generateInvoiceHtml(data, menuItems)

    // Create a hidden print iframe to guarantee a single-page clean print without parent CSS leakage
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.visibility = 'hidden'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) {
      document.body.removeChild(iframe)
      window.print()
      return
    }

    doc.open()
    doc.write(invoiceHtml)
    doc.close()

    const cleanup = () => {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
        }
      }, 1000)
    }

    try {
      iframe.contentWindow?.addEventListener('afterprint', cleanup)
    } catch {}

    // Wait for frames to lay out before triggering print
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus()
            iframe.contentWindow?.print()
          } catch {
            window.print()
          }
          setTimeout(cleanup, 10000)
        }, 150)
      })
    })
  }

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `🧾 Tax Invoice for Order #${data.displayNumber} at ${data.restaurantName || 'TapMenu Restaurant'}\n` +
      `Table: ${data.table}${data.roomNumber ? ` (Room ${data.roomNumber})` : ''}\n` +
      `Total: ₹${data.total}\n` +
      `Payment: ${data.payment === 'online' ? 'Paid Online via Razorpay' : 'Pay at Counter'}\n` +
      `Date: ${dateStr} ${timeStr}\n` +
      `Thank you for dining with us!`
    )
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank')
  }

  return (
    <AnimatePresence>
      <div className="customer-receipt-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="customer-receipt-modal-card relative w-full max-w-lg max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-neutral-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-neutral-50/70">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-bold">
                <FileText className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-neutral-900">
                  Tax Invoice & E-Receipt
                </h3>
                <p className="text-[10px] text-neutral-500 font-mono">
                  {data.referenceNumber || `REF-${data.displayNumber}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="no-print w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-200/60 transition-colors cursor-pointer"
              aria-label="Close receipt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Printable Receipt Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 print:p-0 print:overflow-visible">
            <div className="text-center space-y-1 pb-4 border-b border-dashed border-neutral-300">
              <h2 className="text-lg font-black text-neutral-900 uppercase tracking-tight">
                {data.restaurantName || 'TapMenu Restaurant'}
              </h2>
              {data.restaurantAddress && (
                <p className="text-xs text-neutral-600">
                  {data.restaurantAddress}
                  {data.restaurantCity ? `, ${data.restaurantCity}` : ''}
                  {data.restaurantPincode ? ` - ${data.restaurantPincode}` : ''}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-x-3 text-[11px] text-neutral-500 pt-1 font-mono">
                {data.gstin && <span>GSTIN: <b>{data.gstin}</b></span>}
                {data.fssaiLicense && <span>FSSAI: <b>{data.fssaiLicense}</b></span>}
              </div>
            </div>

            {/* Order & Customer Metadata */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono py-1 border-b border-dashed border-neutral-300 text-neutral-700">
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase font-sans font-bold">Order</span>
                <span className="font-bold text-neutral-900 text-sm">#{data.displayNumber}</span>
              </div>
              <div className="text-right">
                <span className="text-neutral-400 block text-[10px] uppercase font-sans font-bold">Table</span>
                <span className="font-bold text-neutral-900 text-sm">
                  {data.table}{data.roomNumber ? ` (Room ${data.roomNumber})` : ''}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase font-sans font-bold">Date & Time</span>
                <span>{dateStr} {timeStr}</span>
              </div>
              <div className="text-right">
                <span className="text-neutral-400 block text-[10px] uppercase font-sans font-bold">Guest</span>
                <span className="truncate block font-sans font-semibold">
                  {data.customerName || 'Guest'}
                </span>
                {data.customerPhone && (
                  <span className="text-[10px] text-neutral-500 block">{data.customerPhone}</span>
                )}
              </div>
            </div>

            {/* Itemized Table */}
            <div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-400 uppercase text-[10px] font-bold">
                    <th className="text-left py-1.5 font-bold">Item</th>
                    <th className="text-center py-1.5 font-bold w-12">Qty</th>
                    <th className="text-right py-1.5 font-bold w-16">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {data.lines.map((line, idx) => {
                    const item = itemFor(line.itemId)
                    const variant = item?.variants?.find((v) => v.id === line.variantId)
                    const unitPrice =
                      (variant?.price ?? item?.price ?? 0) +
                      line.addOnIds.reduce(
                        (sum, id) => sum + (item?.addOns?.find((a) => a.id === id)?.price ?? 0),
                        0
                      )
                    const lineTotal = unitPrice * line.qty

                    return (
                      <tr key={idx} className="py-2">
                        <td className="py-1.5 text-neutral-900 font-medium">
                          <div>{item?.name || line.itemId}</div>
                          {variant && (
                            <span className="text-[10px] text-neutral-500">
                              Variant: {variant.name}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 text-center font-mono font-bold text-neutral-700">
                          {line.qty}
                        </td>
                        <td className="py-1.5 text-right font-mono font-bold text-neutral-900">
                          ₹{lineTotal}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Calculations Breakdown */}
            <div className="pt-3 border-t border-dashed border-neutral-300 space-y-1.5 text-xs text-neutral-600 font-mono">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{data.subtotal}</span>
              </div>
              {data.discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>-₹{data.discount}</span>
                </div>
              )}
              {taxRows.map((r) => (
                <div key={r.percent}>
                  <div className="flex justify-between text-[11px] text-neutral-500">
                    <span>CGST ({r.percent / 2}%)</span>
                    <span>₹{(r.tax / 2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-neutral-500">
                    <span>SGST ({r.percent / 2}%)</span>
                    <span>₹{(r.tax / 2).toFixed(2)}</span>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-neutral-200 flex justify-between items-baseline text-sm font-black text-neutral-900">
                <span className="font-sans">Grand Total</span>
                <span className="text-base text-emerald-600">₹{data.total}</span>
              </div>
            </div>

            {/* Payment Status Stamp */}
            <div className="rounded-2xl p-3 bg-emerald-50 border border-emerald-200 flex items-center justify-between text-emerald-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-xs font-bold">
                    {data.payment === 'online' ? 'Paid Online via Razorpay' : 'Pay at Counter'}
                  </div>
                  <div className="text-[10.5px] text-emerald-700 font-mono">
                    Status: {data.status === 'awaiting_payment' ? 'Pending Payment' : 'Settled & Verified'}
                  </div>
                </div>
              </div>
              <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-600 text-white font-mono">
                {data.status === 'awaiting_payment' ? 'UNPAID' : 'PAID'}
              </span>
            </div>

            <p className="text-[10px] text-center text-neutral-400 font-sans">
              Thank you for dining with us! This is a system-generated digital invoice.
            </p>
          </div>

          {/* Actions Footer */}
          <div className="no-print px-5 py-4 border-t border-neutral-100 bg-neutral-50 flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex-1 h-10 rounded-xl bg-neutral-900 text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            {data.features?.whatsappReceipts !== false && (
              <button
                onClick={handleShareWhatsApp}
                className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share on WhatsApp</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
