/**
 * KOT (Kitchen Order Ticket) Thermal Printing Engine
 * Generates sanitized, CSS-paged HTML tickets for 80mm and 58mm thermal rolls.
 * Follows the architecture decision in docs/DECISIONS.md:
 * Universal hardware compatibility across Bluetooth, USB, and network thermal printers.
 */

export interface KOTItem {
  name: string
  quantity: number
  prepStation?: string
  variantName?: string
  notes?: string
}

export interface KOTPrintData {
  orderNumber: string
  tableName?: string
  roomNumber?: string
  orderType: string
  createdAt: string
  station?: string
  isRushPriority?: boolean
  specialInstructions?: string
  items: KOTItem[]
  restaurantName?: string
  subtotalPaise?: number
  taxPaise?: number
  totalPaise?: number
}

export function formatRupees(paise?: number): string {
  if (paise === undefined || Number.isNaN(paise)) return '—'
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`
}

export function generateKOTHourTimestamp(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return dateStr
  }
}

export function generateKOTDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export function buildKOTHtml(data: KOTPrintData, rollWidth: '80mm' | '58mm' = '80mm'): string {
  const stationLabel = data.station && data.station !== 'all' ? data.station.toUpperCase() : 'KITCHEN'
  const time = generateKOTHourTimestamp(data.createdAt)
  const date = generateKOTDate(data.createdAt)
  const destination = data.roomNumber ? `ROOM ${data.roomNumber.toUpperCase()}` : data.tableName ? data.tableName.toUpperCase() : 'WALK-IN'

  const itemsHtml = data.items
    .map(
      (item) => `
      <tr style="border-bottom: 1px dashed #000;">
        <td style="font-size: 16px; font-weight: 900; padding: 6px 4px; vertical-align: top; width: 32px; text-align: center; border-right: 1px solid #000;">
          ${item.quantity}
        </td>
        <td style="padding: 6px 6px; vertical-align: top;">
          <div style="font-size: 14px; font-weight: 800; line-height: 1.2;">
            ${item.name}
          </div>
          ${item.variantName ? `<div style="font-size: 12px; font-weight: 600; color: #222;">[${item.variantName}]</div>` : ''}
          ${item.notes ? `<div style="font-size: 12px; font-style: italic; font-weight: 700; color: #000; margin-top: 2px;">*** NOTE: ${item.notes} ***</div>` : ''}
        </td>
      </tr>
    `
    )
    .join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KOT #${data.orderNumber}</title>
  <style>
    @media print {
      @page {
        size: ${rollWidth} auto;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 8px;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace;
      color: #000;
      background: #fff;
      margin: 0 auto;
      padding: 10px;
      width: ${rollWidth === '80mm' ? '76mm' : '54mm'};
      box-sizing: border-box;
      font-size: 13px;
      line-height: 1.3;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 6px;
      margin-bottom: 6px;
    }
    .title {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 1px;
      margin: 0;
    }
    .station-badge {
      display: inline-block;
      font-size: 12px;
      font-weight: 900;
      border: 2px solid #000;
      padding: 2px 8px;
      margin-top: 4px;
      text-transform: uppercase;
    }
    .priority-banner {
      background: #000;
      color: #fff;
      text-align: center;
      font-weight: 900;
      font-size: 14px;
      padding: 4px;
      margin: 6px 0;
      letter-spacing: 1px;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
      font-size: 13px;
    }
    .meta-table td {
      padding: 2px 0;
    }
    .order-num {
      font-size: 22px;
      font-weight: 900;
    }
    .dest-badge {
      font-size: 18px;
      font-weight: 900;
      text-align: right;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
    }
    .financial-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: 13px;
    }
    .financial-table td {
      padding: 2px 4px;
    }
    .financial-table .total-row td {
      border-top: 1px dashed #000;
      font-weight: 900;
      font-size: 14px;
      padding-top: 4px;
    }
    .instructions-box {
      margin-top: 8px;
      border: 1px dashed #000;
      padding: 6px;
      font-size: 12px;
      font-weight: 700;
    }
    .footer {
      margin-top: 12px;
      padding-top: 6px;
      border-top: 1px solid #000;
      text-align: center;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    ${data.restaurantName ? `<div style="font-size: 12px; font-weight: 600; margin-bottom: 2px;">${data.restaurantName}</div>` : ''}
    <h1 class="title">KITCHEN ORDER TICKET</h1>
    <div class="station-badge">${stationLabel}</div>
  </div>

  ${data.isRushPriority ? '<div class="priority-banner">★★★ RUSH PRIORITY / VIP ★★★</div>' : ''}

  <table class="meta-table">
    <tr>
      <td class="order-num">#${data.orderNumber}</td>
      <td class="dest-badge">${destination}</td>
    </tr>
    <tr>
      <td>Type: <strong>${data.orderType.toUpperCase()}</strong></td>
      <td style="text-align: right;">Time: <strong>${time}</strong></td>
    </tr>
    <tr>
      <td>Date: ${date}</td>
      <td style="text-align: right;">Items: <strong>${data.items.reduce((s, i) => s + i.quantity, 0)}</strong></td>
    </tr>
  </table>

  <table class="items-table">
    <thead>
      <tr style="border-bottom: 1px solid #000; text-align: left; font-size: 11px;">
        <th style="padding: 4px; width: 32px; text-align: center;">QTY</th>
        <th style="padding: 4px 6px;">ITEM DESCRIPTION</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  ${
    data.subtotalPaise !== undefined && data.totalPaise !== undefined
      ? `
  <table class="financial-table">
    <tr>
      <td>Amount:</td>
      <td style="text-align: right; font-weight: 700;">${formatRupees(data.subtotalPaise)}</td>
    </tr>
    <tr>
      <td>GST:</td>
      <td style="text-align: right; font-weight: 700;">${data.taxPaise !== undefined ? formatRupees(data.taxPaise) : '—'}</td>
    </tr>
    <tr class="total-row">
      <td>Total Amount:</td>
      <td style="text-align: right;">${formatRupees(data.totalPaise)}</td>
    </tr>
  </table>
  `
      : ''
  }

  ${
    data.specialInstructions
      ? `
    <div class="instructions-box">
      <div style="text-transform: uppercase; font-size: 10px; color: #444;">Special Order Instructions:</div>
      <div>${data.specialInstructions}</div>
    </div>
  `
      : ''
  }

  <div class="footer">
    <div>Prepared by: _________________ &nbsp; Checked: _________________</div>
    <div style="margin-top: 4px; font-family: monospace;">TAPMENU KOT ENGINE • PRINTED ${time}</div>
  </div>
</body>
</html>
  `
}

/**
 * Triggers thermal KOT print job via browser print dialog using hidden iframe.
 */
export function printKOTTicket(data: KOTPrintData, rollWidth: '80mm' | '58mm' = '80mm'): Promise<void> {
  return new Promise((resolve) => {
    const html = buildKOTHtml(data, rollWidth)
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.setAttribute('aria-hidden', 'true')
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) {
      document.body.removeChild(iframe)
      resolve()
      return
    }

    doc.open()
    doc.write(html)
    doc.close()

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
        } catch (e) {
          console.error('[KOTPrinter] Print dialog invocation failed', e)
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe)
            }
            resolve()
          }, 1500)
        }
      }, 250)
    }
  })
}
