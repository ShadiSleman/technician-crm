/** עזרי תאריך מקומיים (שעון ישראל) */

export function todayYmd(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

export function formatHebYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function ymdFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return ymdFromDate(dt)
}

export function startOfWeekSunday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = x.getDay()
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDaysDate(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function addMonthsClamp(d: Date, delta: number): Date {
  const x = new Date(d)
  const day = x.getDate()
  x.setMonth(x.getMonth() + delta)
  if (x.getDate() < day) x.setDate(0)
  return x
}

export function sameYmd(a: Date, ymd: string): boolean {
  return ymdFromDate(a) === ymd
}
