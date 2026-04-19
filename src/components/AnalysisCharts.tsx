import { motion } from 'framer-motion'
import { ColorLegend } from './ColorLegend'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
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
} from '../copy'
import { formatHebYmd, todayYmd, addDaysYmd } from '../dates'
import type { Customer, Transaction, Priority, WorkGroup } from '../types'

type Props = {
  customers: Customer[]
  transactions: Transaction[]
}

export function AnalysisCharts({ customers, transactions }: Props) {
  const open = customers.filter((c) => c.status !== 'done')

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

  const today = todayYmd()
  const flow = [
    {
      name: 'באיחור',
      count: open.filter(
        (c) => c.callbackDate && c.callbackDate < today,
      ).length,
    },
    {
      name: 'היום',
      count: open.filter((c) => c.callbackDate === today).length,
    },
    {
      name: 'עתידי',
      count: open.filter(
        (c) => c.callbackDate && c.callbackDate > today,
      ).length,
    },
    {
      name: 'ללא תאריך',
      count: open.filter((c) => !c.callbackDate).length,
    },
  ]

  const last14: { day: string; label: string; charges: number; paid: number }[] =
    []
  for (let i = 13; i >= 0; i--) {
    const ymd = addDaysYmd(today, -i)
    const charges = transactions
      .filter((t) => t.date === ymd && t.type === 'charge')
      .reduce((s, t) => s + t.amount, 0)
    const paid = transactions
      .filter((t) => t.date === ymd && t.type === 'payment')
      .reduce((s, t) => s + t.amount, 0)
    last14.push({
      day: ymd,
      label: formatHebYmd(ymd),
      charges,
      paid,
    })
  }

  const totalOpenDebt = open.reduce((s, c) => {
    const bal = transactions
      .filter((t) => t.customerId === c.id)
      .reduce((x, t) => x + (t.type === 'charge' ? t.amount : -t.amount), 0)
    return s + (bal > 0 ? bal : 0)
  }, 0)

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
            <strong>{open.length}</strong> כרטיסים פתוחים · חובות פתוחים משוערים{' '}
            <strong>₪{totalOpenDebt.toLocaleString('he-IL')}</strong>
          </p>
        </div>
      </motion.div>

      <div className="analysis-chart-legend">
        <ColorLegend variant="inline" />
        <span className="muted analysis-legend-note">
          רלוונטי לגרפים הצבעוניים למטה
        </span>
      </div>

      <div className="chart-grid">
        <motion.div
          className="chart-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <h4>לקוחות פתוחים לפי קבוצה</h4>
          <p className="chart-caption">איפה העומס השבועי</p>
          <div className="chart-area">
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
          <h4>דחיפות בכרטיסים הפתוחים</h4>
          <p className="chart-caption">סיכון תפעולי — דחוף ביותר ראשון</p>
          <div className="chart-area">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byPriority} layout="vertical" margin={{ left: 8 }}>
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
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {byPriority.map((e) => (
                    <Cell key={e.key} fill={PRIORITY_CHART_COLOR[e.key]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          className="chart-card chart-card-wide"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h4>חזרות: איחור / היום / עתיד</h4>
          <p className="chart-caption">כמה כרטיסים דורשים תזמון מחדש</p>
          <div className="chart-area">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={flow}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip
                  formatter={(value) => [`${value ?? 0}`, 'כרטיסים']}
                />
                <Bar dataKey="count" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          className="chart-card chart-card-wide"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h4>חיובים מול תשלומים (14 יום)</h4>
          <p className="chart-caption">מגמת מזומן — לא רק יתרה סופית</p>
          <div className="chart-area">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={last14}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
                <YAxis />
                <Tooltip
                  formatter={(value) => {
                    const n = typeof value === 'number' ? value : Number(value)
                    const safe = Number.isFinite(n) ? n : 0
                    return [`₪${safe.toLocaleString('he-IL')}`, '']
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="charges"
                  name="חיוב"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="paid"
                  name="תשלום"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
