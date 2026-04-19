import type { QuoteLine } from './types'

/** תצוגת שקלים: שתי ספרות אחרי הנקודה (לא שלוש) */
export function formatIls(amount: number): string {
  return amount.toLocaleString('he-IL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** מכפיל מחיר כולל מע״מ (מע״מ סטנדרטי 18%) */
export const VAT_INCL_MULTIPLIER = 1.18

export function unitPriceExVat(unitPriceInclVat: number): number {
  return unitPriceInclVat / VAT_INCL_MULTIPLIER
}

export function lineVatBreakdown(qty: number, unitPriceInclVat: number) {
  const incl = qty * unitPriceInclVat
  const ex = qty * unitPriceExVat(unitPriceInclVat)
  const vat = incl - ex
  return { ex, vat, incl }
}

export function totalVatBreakdown(totalInclVat: number) {
  const ex = totalInclVat / VAT_INCL_MULTIPLIER
  const vat = totalInclVat - ex
  return { ex, vat, incl: totalInclVat }
}

export function lineSum(l: QuoteLine): number {
  return l.qty * l.unitPriceInclVat
}

export function linesTotal(lines: QuoteLine[]): number {
  return lines.reduce((s, l) => s + lineSum(l), 0)
}

export function emptyQuoteLine(): QuoteLine {
  return {
    priceListItemId: null,
    description: '',
    qty: 1,
    unitPriceInclVat: 0,
  }
}
