import type { CustomerStatus, PaymentMethod, Priority, WorkGroup } from './types'

export const PRIORITY_LABEL: Record<Priority, string> = {
  critical: 'דחוף ביותר',
  high: 'דחוף',
  medium: 'רגיל',
  low: 'נמוך',
}

export const PRIORITY_HINT: Record<Priority, string> = {
  critical: 'טיפול מיידי — לקוח מחכה או תקלה חמורה',
  high: 'להתקשר היום / לתאם ביקור בהקדם',
  medium: 'שגרה — לסגור תוך יומיים–שלושה',
  low: 'לא דחוף — כשיהיה זמן',
}

export const GROUP_LABEL: Record<WorkGroup, string> = {
  service: 'שירות',
  installation: 'התקנה',
  completion: 'השלמה',
}

export const GROUP_HINT: Record<WorkGroup, string> = {
  service: 'תיקונים, טיפולים וביקורי שירות',
  installation: 'התקנות חדשות והרחבות',
  completion: 'גמר עבודה, אחרי התקנה, איסוף תשלום',
}

export const STATUS_LABEL: Record<CustomerStatus, string> = {
  new: 'חדש',
  callback: 'לחזור',
  waiting_parts: 'ממתין לחלקים',
  pending_payment: 'ממתין לתשלום',
  scheduled: 'ביקור מתוכנן',
  done: 'סגור',
}

/** צבעים לגרפים ולתגיות קבוצה */
export const GROUP_CHART_COLOR: Record<WorkGroup, string> = {
  service: '#6366f1',
  installation: '#0ea5e9',
  completion: '#14b8a6',
}

export const PRIORITY_CHART_COLOR: Record<Priority, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#94a3b8',
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'מזומן',
  transfer: 'העברה בנקאית',
  card: 'אשראי',
  check: 'צ׳ק',
  bit: 'ביט / אפליקציה',
  other: 'אחר',
}
