/** GST on tax-exclusive prices, per rate. Mirrors backend pos_service.tax_breakdown: a discount is spread over the lines pro rata,
 *  lines without a rate (older orders) use defaultPercent, and tax is rounded once per rate. All amounts are paise. */
export interface TaxLine { pricePaise: number; quantity: number; taxPercent?: number | null }
export interface TaxRow { percent: number; taxablePaise: number; taxPaise: number }

export function taxBreakdown(lines: TaxLine[], discountPaise: number, defaultPercent: number): TaxRow[] {
  const gross = lines.reduce((n, l) => n + l.pricePaise * l.quantity, 0);
  const discount = Math.max(0, Math.min(discountPaise, gross));
  const taxable = new Map<number, number>();
  let given = 0;
  lines.forEach((l, n) => {
    const line = l.pricePaise * l.quantity;
    const share = n === lines.length - 1 ? discount - given : gross ? Math.floor((discount * line) / gross) : 0;
    given += share;
    const rate = l.taxPercent ?? defaultPercent;
    taxable.set(rate, (taxable.get(rate) ?? 0) + line - share);
  });
  return [...taxable.entries()].sort((a, b) => a[0] - b[0]).map(([percent, t]) => ({ percent, taxablePaise: t, taxPaise: Math.floor((t * percent + 50) / 100) }));
}

export const totalTax = (rows: TaxRow[]) => rows.reduce((n, r) => n + r.taxPaise, 0);
