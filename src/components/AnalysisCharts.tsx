import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ColorLegend } from './ColorLegend'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  GROUP_CHART_COLOR,
  GROUP_LABEL,
  PRIORITY_CHART_COLOR,
  PRIORITY_LABEL,
  STATUS_CHART_COLOR,
  STATUS_LABEL,
} from '../copy'
import { addDaysYmd, formatHebYmd, todayYmd } from '../dates'
import { customerBalance } from '../types'
import type {
  Customer,
  CustomerStatus,
  Meeting,
  Priority,
  Quote,
  Transaction,
  WorkGroup,
} from '../types'

export type AnalysisNavigate =
  | { type: 'customers_open' }
  | { type: 'customers_done' }
  | { type: 'billing' }
  | { type: 'calendar' }
  | { type: 'quotes' }
  | { type: 'customers_group'; group: WorkGroup }
  | { type: 'customers_priority'; priority: Priority }
  | { type: 'customers_status'; status: CustomerStatus }

type Props = {
  customers: Customer[]
  transactions: Transaction[]
  meetings: Meeting[]
  quotes: Quote[]
  onNavigate?: (action: AnalysisNavigate) => void
  onOpenCustomer?: (customerId: string) => void
}

function txAmount(t: Transaction): number {
  const n = Number(t.amount)
  return Number.isFinite(n) ? n : 0
}

function sumQuoteTotal(q: Quote): number {
  const n = Number(q.totalInclVat)
  return Number.isFinite(n) ? n : 0
}

function formatIls(n: number): string {
  const v = Number.isFinite(n) ? n : 0
  return `₪${Math.round(v).toLocaleString('he-IL')}`
}

function formatIlsAxis(n: number): string {
  const v = Number.isFinite(n) ? n : 0
  const x = Math.abs(v)
  if (x >= 1_000_000) {
    return `₪${(v / 1_000_000).toFixed(1)}M`
  }
  if (x >= 10_000) {
    return `₪${(v / 1000).toFixed(0)}K`
  }
  if (x >= 1000) {
    return `₪${(v / 1000).toFixed(1)}K`
  }
  return `₪${Math.round(v)}`
}

function MetricValue({
  children,
  onPress,
  className = '',
  aria,
}: {
  children: ReactNode
  onPress?: () => void
  className?: string
  aria: string
}) {
  if (onPress) {
    return (
      <button
        type="button"
        className={`insight-metric-value insight-metric-hit ${className}`.trim()}
        onClick={onPress}
        aria-label={aria}
      >
        {children}
      </button>
    )
  }
  return (
    <span className={`insight-metric-value ${className}`.trim()}>{children}</span>
  )
}

export function AnalysisCharts({
  customers,
  transactions,
  meetings,
  quotes,
  onNavigate,
  onOpenCustomer,
}: Props) {
  const nav = onNavigate
  const open = customers.filter((c) => c.status !== 'done')
  const closedCount = customers.filter((c) => c.status === 'done').length

  const byGroup: { name: string; value: number; key: WorkGroup }[] = (
    ['service', 'installation', 'completion'] as WorkGroup[]
  ).map((g) => ({
    key: g,
    name: GROUP_LABEL[g],
    value: open.filter((c) => c.group === g).length,
  }))

  const byPriority: { name: string; value: number; key: Priority }[] = (
    ['critical', 'high', 'medium', 'low'] as Priority[]
  ).map((p) => ({
    key: p,
    name: PRIORITY_LABEL[p],
    value: open.filter((c) => c.priority === p).length,
  }))

  const openStatuses: CustomerStatus[] = [
    'new',
    'callback',
    'waiting_parts',
    'pending_payment',
    'scheduled',
  ]
  const byStatus: { name: string; value: number; key: CustomerStatus }[] =
    openStatuses.map((s) => ({
      key: s,
      name: STATUS_LABEL[s],
      value: open.filter((c) => c.status === s).length,
    }))

  const topDebtors: { name: string; balance: number; customerId: string }[] =
    open
      .map((c) => ({
        name: c.name || 'ללא שם',
        customerId: c.id,
        balance: customerBalance(c.id, transactions),
      }))
      .filter((x) => x.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 6)

  const now = new Date()
  const weekEnd = new Date(now)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const meetingsNext7 = meetings.filter((m) => {
    const t0 = new Date(m.startAt).getTime()
    if (!Number.isFinite(t0)) return false
    return t0 >= now.getTime() && t0 <= weekEnd.getTime()
  })

  const quotesTotal = quotes.reduce((s, q) => s + sumQuoteTotal(q), 0)
  const today = todayYmd()

  const last14: {
    day: string
    shortLabel: string
    label: string
    charges: number
    paid: number
  }[] = []
  for (let i = 13; i >= 0; i--) {
    const ymd = addDaysYmd(today, -i)
    const parts = ymd.split('-')
    const mo = parts[1] ?? ''
    const da = parts[2] ?? ''
    const charges = transactions
      .filter((t) => t.date === ymd && t.type === 'charge')
      .reduce((s, t) => s + txAmount(t), 0)
    const paid = transactions
      .filter((t) => t.date === ymd && t.type === 'payment')
      .reduce((s, t) => s + txAmount(t), 0)
    last14.push({
      day: ymd,
      shortLabel: `${da}/${mo}`,
      label: formatHebYmd(ymd),
      charges,
      paid,
    })
  }

  let sum14Charge = 0
  let sum14Paid = 0
  for (const d of last14) {
    sum14Charge += d.charges
    sum14Paid += d.paid
  }

  let sum30Charge = 0
  let sum30Paid = 0
  for (let i = 0; i < 30; i++) {
    const ymd = addDaysYmd(today, -i)
    sum30Charge += transactions
      .filter((t) => t.date === ymd && t.type === 'charge')
      .reduce((s, t) => s + txAmount(t), 0)
    sum30Paid += transactions
      .filter((t) => t.date === ymd && t.type === 'payment')
      .reduce((s, t) => s + txAmount(t), 0)
  }

  const serviceJobs = open.filter((c) => c.group === 'service').length
  const installs = open.filter((c) => c.group === 'installation').length
  const criticalOpen = open.filter((c) => c.priority === 'critical').length

  const totalOpenDebt = open.reduce((s, c) => {
    const bal = customerBalance(c.id, transactions)
    const b = Number.isFinite(bal) ? bal : 0
    return s + (b > 0 ? b : 0)
  }, 0)
  const totalOpenDebtDisplay = Number.isFinite(totalOpenDebt)
    ? totalOpenDebt
    : 0

  const groupData = byGroup.filter((d) => d.value > 0)

  return (
    <div className="analysis-stack">
      <motion.div
        className="insight-banner"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      >
        <div>
          <span className="insight-kicker">תמונת מצב</span>
          <p className="insight-text">
            {nav ? (
              <>
                <button
                  type="button"
                  className="insight-stat-link"
                  onClick={() => nav({ type: 'customers_open' })}
                  aria-label="רשימת לקוחות — כל הכרטיסים הפתוחים"
                >
                  <strong>{open.length}</strong>
                </button>{' '}
                כרטיסים פתוחים · חובות פתוחים משוערים{' '}
                <button
                  type="button"
                  className="insight-stat-link"
                  onClick={() => nav({ type: 'billing' })}
                  aria-label="מעבר ללשונית חיובים"
                >
                  <strong>₪{totalOpenDebtDisplay.toLocaleString('he-IL')}</strong>
                </button>
              </>
            ) : (
              <>
                <strong>{open.length}</strong> כרטיסים פתוחים · חובות פתוחים
                משוערים{' '}
                <strong>₪{totalOpenDebtDisplay.toLocaleString('he-IL')}</strong>
              </>
            )}
          </p>
        </div>
      </motion.div>

      <div className="insight-metric-row">
        <div className="insight-metric-tile">
          <span className="insight-metric-label">שירות / תקלות פתוח</span>
          <MetricValue
            aria="רשימת לקוחות — קבוצת שירות (פתוחים)"
            onPress={
              nav
                ? () => nav({ type: 'customers_group', group: 'service' })
                : undefined
            }
          >
            {serviceJobs}
          </MetricValue>
        </div>
        <div className="insight-metric-tile">
          <span className="insight-metric-label">התקנות בטיפול</span>
          <MetricValue
            aria="רשימת לקוחות — התקנות (פתוחים)"
            onPress={
              nav
                ? () => nav({ type: 'customers_group', group: 'installation' })
                : undefined
            }
          >
            {installs}
          </MetricValue>
        </div>
        <div className="insight-metric-tile insight-metric-tile--alert">
          <span className="insight-metric-label">דחוף ביותר (פתוח)</span>
          <MetricValue
            aria="רשימת לקוחות — דחיפות קריטית (פתוחים)"
            onPress={
              nav
                ? () => nav({ type: 'customers_priority', priority: 'critical' })
                : undefined
            }
          >
            {criticalOpen}
          </MetricValue>
        </div>
        <div className="insight-metric-tile">
          <span className="insight-metric-label">פגישות בשבוע הקרוב</span>
          <MetricValue
            aria="מעבר ליומן"
            onPress={nav ? () => nav({ type: 'calendar' }) : undefined}
          >
            {meetingsNext7.length}
          </MetricValue>
        </div>
        <div className="insight-metric-tile">
          <span className="insight-metric-label">הצעות מחיר (מס׳ / סה״כ)</span>
          <MetricValue
            aria="מעבר להצעות מחיר"
            onPress={nav ? () => nav({ type: 'quotes' }) : undefined}
          >
            {quotes.length} / {formatIls(quotesTotal)}
          </MetricValue>
        </div>
        <div className="insight-metric-tile">
          <span className="insight-metric-label">כרטיסים סגורים (אוסף)</span>
          <MetricValue
            aria="רשימת לקוחות — כרטיסים סגורים"
            onPress={
              nav
                ? () => nav({ type: 'customers_done' })
                : undefined
            }
          >
            {closedCount}
          </MetricValue>
        </div>
      </div>

      <div className="analysis-chart-legend">
        <ColorLegend variant="inline" />
        <span className="muted analysis-legend-note">קבוצה, דחיפות ומצב</span>
      </div>

      <div className="chart-grid">
        <motion.div
          className="chart-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <h4>לקוחות פתוחים לפי קבוצה</h4>
          <p className="chart-caption">שירות · התקנה · השלמה</p>
          <div
            className="chart-area"
            style={nav ? { cursor: 'pointer' } : undefined}
          >
            {groupData.length === 0 ? (
              <p className="muted chart-empty">אין כרטיסים פתוחים לפילוח</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={groupData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={3}
                    onClick={(sector) => {
                      if (!nav) return
                      const p = sector?.payload as
                        | (typeof groupData)[number]
                        | undefined
                      if (p?.key) {
                        nav({ type: 'customers_group', group: p.key })
                      }
                    }}
                  >
                    {groupData.map((e) => (
                      <Cell key={e.key} fill={GROUP_CHART_COLOR[e.key]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${value ?? 0}`, 'כמות']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        <motion.div
          className="chart-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h4>דחיפות (פתוח)</h4>
          <p className="chart-caption">נדרש טיפול לפי דחיפות</p>
          <div
            className="chart-area"
            style={nav ? { cursor: 'pointer' } : undefined}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={byPriority}
                layout="vertical"
                margin={{ left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => [`${value ?? 0}`, 'כרטיסים']}
                />
                <Bar
                  dataKey="value"
                  radius={[0, 6, 6, 0]}
                  onClick={(item) => {
                    if (!nav) return
                    const p = item?.payload as
                      | (typeof byPriority)[number]
                      | undefined
                    if (p?.key) {
                      nav({ type: 'customers_priority', priority: p.key })
                    }
                  }}
                >
                  {byPriority.map((e) => (
                    <Cell key={e.key} fill={PRIORITY_CHART_COLOR[e.key]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          className="chart-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <h4>מצב כרטיס (פעיל)</h4>
          <p className="chart-caption">חדש, חזרה, חלקים, תשלום, ביקור</p>
          <div
            className="chart-area"
            style={nav ? { cursor: 'pointer' } : undefined}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={byStatus}
                layout="vertical"
                margin={{ left: 8, right: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={108}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value) => [`${value ?? 0}`, 'כרטיסים']}
                />
                <Bar
                  dataKey="value"
                  radius={[0, 6, 6, 0]}
                  onClick={(item) => {
                    if (!nav) return
                    const p = item?.payload as
                      | (typeof byStatus)[number]
                      | undefined
                    if (p?.key) {
                      nav({ type: 'customers_status', status: p.key })
                    }
                  }}
                >
                  {byStatus.map((e) => (
                    <Cell key={e.key} fill={STATUS_CHART_COLOR[e.key]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          className="chart-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
        >
          <h4>לקוחות — חוב מוביל (פתוח)</h4>
          <p className="chart-caption">לפי יתרה חיובית ברישום (עד 6) — לחיצה לפתיחת הכרטיס</p>
          <div
            className="chart-area"
            style={
              onOpenCustomer ? { cursor: 'pointer' } : undefined
            }
          >
            {topDebtors.length === 0 ? (
              <p className="muted chart-empty">אין יתרות חיוביות בכרטיסים פתוחים</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={topDebtors}
                  layout="vertical"
                  margin={{ left: 8, right: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatIlsAxis(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={88}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    formatter={(v) => [
                      formatIls(
                        typeof v === 'number' ? v : Number(v) || 0,
                      ),
                      'חוב',
                    ]}
                  />
                  <Bar
                    dataKey="balance"
                    name="חוב"
                    fill="#f43f5e"
                    radius={[0, 6, 6, 0]}
                    onClick={(item) => {
                      if (!onOpenCustomer) return
                      const p = item?.payload as
                        | (typeof topDebtors)[number]
                        | undefined
                      if (p?.customerId) onOpenCustomer(p.customerId)
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        <motion.div
          className="chart-card chart-card-wide"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <h4>חיובים מול תשלומים — 14 ימים (בש״ח)</h4>
          <p className="chart-caption">
            עמודות: סכום בכל יום — לחיצה על הסכומים מעל הגרף לפתיחת חיובים
          </p>
          <div className="money-kpi-strip">
            <div>
              <span className="money-kpi-label">סה״כ חיובים (14 יום)</span>
              {nav ? (
                <button
                  type="button"
                  className="money-kpi-num money-kpi-num--charge money-kpi-hit"
                  onClick={() => nav({ type: 'billing' })}
                  aria-label="מעבר ללשונית חיובים"
                >
                  {formatIls(sum14Charge)}
                </button>
              ) : (
                <span className="money-kpi-num money-kpi-num--charge">
                  {formatIls(sum14Charge)}
                </span>
              )}
            </div>
            <div>
              <span className="money-kpi-label">סה״כ תשלומים (14 יום)</span>
              {nav ? (
                <button
                  type="button"
                  className="money-kpi-num money-kpi-num--paid money-kpi-hit"
                  onClick={() => nav({ type: 'billing' })}
                  aria-label="מעבר ללשונית חיובים"
                >
                  {formatIls(sum14Paid)}
                </button>
              ) : (
                <span className="money-kpi-num money-kpi-num--paid">
                  {formatIls(sum14Paid)}
                </span>
              )}
            </div>
            <div>
              <span className="money-kpi-label">מאזן 14 יום (חיוב − תשלום)</span>
              {nav ? (
                <button
                  type="button"
                  className="money-kpi-num money-kpi-hit"
                  onClick={() => nav({ type: 'billing' })}
                  aria-label="מעבר ללשונית חיובים"
                >
                  {formatIls(sum14Charge - sum14Paid)}
                </button>
              ) : (
                <span className="money-kpi-num">
                  {formatIls(sum14Charge - sum14Paid)}
                </span>
              )}
            </div>
            <div>
              <span className="money-kpi-label">30 ימים: חיוב / תשלום</span>
              {nav ? (
                <button
                  type="button"
                  className="money-kpi-num money-kpi-hit"
                  style={{ fontSize: '0.9rem' }}
                  onClick={() => nav({ type: 'billing' })}
                  aria-label="מעבר ללשונית חיובים"
                >
                  {formatIls(sum30Charge)} · {formatIls(sum30Paid)}
                </button>
              ) : (
                <span className="money-kpi-num" style={{ fontSize: '0.9rem' }}>
                  {formatIls(sum30Charge)} · {formatIls(sum30Paid)}
                </span>
              )}
            </div>
          </div>
          <div className="chart-area" style={{ minHeight: 280 }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={last14}
                margin={{ top: 8, right: 6, left: 4, bottom: 8 }}
                barGap={2}
                barCategoryGap="12%"
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis
                  dataKey="shortLabel"
                  tick={{ fontSize: 9 }}
                  interval={0}
                  height={40}
                  angle={-32}
                  textAnchor="end"
                />
                <YAxis
                  tickFormatter={(v) => formatIlsAxis(v)}
                  width={44}
                />
                <Tooltip
                  labelFormatter={(label) => {
                    const d0 = last14.find((x) => x.shortLabel === label)
                    return d0?.label ?? String(label)
                  }}
                  formatter={(value) => {
                    const n = typeof value === 'number' ? value : Number(value)
                    return [formatIls(Number.isFinite(n) ? n : 0), '']
                  }}
                />
                <Legend />
                <Bar
                  dataKey="charges"
                  name="חיובים"
                  fill="#f97316"
                  maxBarSize={28}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="paid"
                  name="תשלומים"
                  fill="#16a34a"
                  maxBarSize={28}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
