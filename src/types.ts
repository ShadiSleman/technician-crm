export type Priority = 'critical' | 'high' | 'medium' | 'low'

export type WorkGroup = 'service' | 'installation' | 'completion'

export type CustomerStatus =
  | 'new'
  | 'callback'
  | 'waiting_parts'
  | 'pending_payment'
  | 'scheduled'
  | 'done'

export interface Customer {
  id: string
  name: string
  phone: string
  priority: Priority
  group: WorkGroup
  status: CustomerStatus
  notes: string
  /** תאריך ביקור מתוכנן בפורמט YYYY-MM-DD (שעון מקומי); מוצג ב־UI כ«תאריך ביקור» */
  callbackDate: string | null
  createdAt: string
  updatedAt: string
  address: string
}

export type PaymentMethod =
  | 'cash'
  | 'transfer'
  | 'card'
  | 'check'
  | 'bit'
  | 'other'

export interface Transaction {
  id: string
  customerId: string | null
  type: 'charge' | 'payment'
  amount: number
  description: string
  /** YYYY-MM-DD */
  date: string
  /** רלוונטי לתשלום בלבד */
  paymentMethod?: PaymentMethod
  /** אסמכתא / מספר צ׳ק וכד׳ */
  reference?: string
}

/** פריט במחירון — מחיר ליחידה כולל מע״מ 18% */
export interface PriceListItem {
  id: string
  name: string
  unitPriceInclVat: number
  createdAt: string
  updatedAt: string
}

export interface QuoteLine {
  priceListItemId: string | null
  description: string
  qty: number
  unitPriceInclVat: number
  /** true אם המחיר נשמר כעריכה ידנית (לא זהה למחירון); אזהרת ״המחירון השתנה״ מתייחסת לשם/נעדרים בלבד */
  useCustomUnitPrice?: boolean
}

export interface Quote {
  id: string
  customerId: string | null
  customerNameSnapshot: string
  customerPhoneSnapshot: string
  lines: QuoteLine[]
  /** סה״כ כולל מע״מ */
  totalInclVat: number
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Meeting {
  id: string
  customerId: string | null
  title: string
  /** ISO מ-local datetime */
  startAt: string
  notes: string
}

export interface AppData {
  customers: Customer[]
  transactions: Transaction[]
  meetings: Meeting[]
  priceList: PriceListItem[]
  quotes: Quote[]
}

export const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export function customerBalance(
  customerId: string,
  transactions: Transaction[],
): number {
  return transactions
    .filter((t) => t.customerId === customerId)
    .reduce(
      (sum, t) => sum + (t.type === 'charge' ? t.amount : -t.amount),
      0,
    )
}

/** סיכום חיובים מול תשלומים (לא כולל תנועות ללא שיוך ללקוח) */
export function customerPaymentTotals(
  customerId: string,
  transactions: Transaction[],
): { charged: number; paid: number; balance: number } {
  let charged = 0
  let paid = 0
  for (const t of transactions) {
    if (t.customerId !== customerId) continue
    if (t.type === 'charge') charged += t.amount
    else paid += t.amount
  }
  return { charged, paid, balance: charged - paid }
}

export function emptyAppData(): AppData {
  return {
    customers: [],
    transactions: [],
    meetings: [],
    priceList: [],
    quotes: [],
  }
}
