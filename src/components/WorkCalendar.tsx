import { motion } from 'framer-motion'
import {
  addDaysDate,
  addMonthsClamp,
  formatHebYmd,
  startOfWeekSunday,
  ymdFromDate,
} from '../dates'
import type { Customer, Meeting } from '../types'

export type CalMode = 'day' | 'week' | 'month'

type Props = {
  mode: CalMode
  onMode: (m: CalMode) => void
  anchor: Date
  onAnchor: (d: Date) => void
  meetings: Meeting[]
  customers: Customer[]
  customerName: (id: string | null) => string
}

function meetingsOnYmd(meetings: Meeting[], ymd: string): Meeting[] {
  return meetings.filter((m) => ymdFromDate(new Date(m.startAt)) === ymd)
}

function callbacksOnYmd(customers: Customer[], ymd: string): Customer[] {
  return customers.filter(
    (c) => c.status !== 'done' && c.callbackDate === ymd,
  )
}

const WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

export function WorkCalendar({
  mode,
  onMode,
  anchor,
  onAnchor,
  meetings,
  customers,
  customerName,
}: Props) {
  const labelMonth = anchor.toLocaleDateString('he-IL', {
    month: 'long',
    year: 'numeric',
  })

  if (mode === 'day') {
    const ymd = ymdFromDate(anchor)
    const ms = meetingsOnYmd(meetings, ymd).sort(
      (a, b) => a.startAt.localeCompare(b.startAt),
    )
    const cbs = callbacksOnYmd(customers, ymd)

    return (
      <div className="cal-wrap">
        <div className="cal-toolbar">
          <div className="cal-modes">
            {(['day', 'week', 'month'] as CalMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`cal-mode ${mode === m ? 'on' : ''}`}
                onClick={() => onMode(m)}
              >
                {m === 'day' ? 'יום' : m === 'week' ? 'שבוע' : 'חודש'}
              </button>
            ))}
          </div>
          <div className="cal-nav">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onAnchor(addDaysDate(anchor, -1))}
            >
              יום קודם
            </button>
            <span className="cal-range">{formatHebYmd(ymd)}</span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onAnchor(addDaysDate(anchor, 1))}
            >
              יום הבא
            </button>
          </div>
        </div>
        <motion.div
          className="cal-day-body"
          key={ymd}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          <h4 className="cal-section-title">פגישות וביקורים</h4>
          {ms.length === 0 ? (
            <p className="muted">אין אירועים ביום הזה</p>
          ) : (
            <ul className="cal-events">
              {ms.map((m) => (
                <li key={m.id} className="cal-event cal-event-meet">
                  <span className="cal-time">
                    {new Date(m.startAt).toLocaleTimeString('he-IL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span>
                    {m.title}
                    {m.customerId ? ` · ${customerName(m.customerId)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h4 className="cal-section-title">חזרות ללקוחות</h4>
          {cbs.length === 0 ? (
            <p className="muted">אין תאריכי חזרה ליום הזה</p>
          ) : (
            <ul className="cal-events">
              {cbs.map((c) => (
                <li key={c.id} className="cal-event cal-event-cb">
                  {c.name} · {c.phone}
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </div>
    )
  }

  if (mode === 'week') {
    const start = startOfWeekSunday(anchor)
    const days = Array.from({ length: 7 }, (_, i) => addDaysDate(start, i))

    return (
      <div className="cal-wrap">
        <div className="cal-toolbar">
          <div className="cal-modes">
            {(['day', 'week', 'month'] as CalMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`cal-mode ${mode === m ? 'on' : ''}`}
                onClick={() => onMode(m)}
              >
                {m === 'day' ? 'יום' : m === 'week' ? 'שבוע' : 'חודש'}
              </button>
            ))}
          </div>
          <div className="cal-nav">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onAnchor(addDaysDate(anchor, -7))}
            >
              שבוע קודם
            </button>
            <span className="cal-range">
              {formatHebYmd(ymdFromDate(days[0]))} –{' '}
              {formatHebYmd(ymdFromDate(days[6]))}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onAnchor(addDaysDate(anchor, 7))}
            >
              שבוע הבא
            </button>
          </div>
        </div>
        <div className="cal-week-scroll">
          <div className="cal-week-grid">
          {days.map((d, i) => {
            const ymd = ymdFromDate(d)
            const ms = meetingsOnYmd(meetings, ymd)
            const cbs = callbacksOnYmd(customers, ymd)
            return (
              <motion.div
                key={ymd}
                className="cal-week-cell"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <div className="cal-week-head">
                  <span>{WEEKDAYS[i]}</span>
                  <strong>{d.getDate()}</strong>
                </div>
                <div className="cal-week-dots">
                  {ms.length > 0 ? (
                    <span className="dot dot-meet">{ms.length} פגישות</span>
                  ) : null}
                  {cbs.length > 0 ? (
                    <span className="dot dot-cb">{cbs.length} חזרות</span>
                  ) : null}
                </div>
              </motion.div>
            )
          })}
          </div>
        </div>
        <p className="muted cal-hint">
          לפרטים מלאים עבור יום — עברו לתצוגת &quot;יום&quot; ובחרו תאריך.
        </p>
      </div>
    )
  }

  // month
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  const startPad = first.getDay()
  const daysInMonth = last.getDate()
  const cells: ({ ymd: string | null; inMonth: boolean } | null)[] = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(anchor.getFullYear(), anchor.getMonth(), d)
    cells.push({ ymd: ymdFromDate(dt), inMonth: true })
  }
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="cal-wrap">
      <div className="cal-toolbar">
        <div className="cal-modes">
          {(['day', 'week', 'month'] as CalMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`cal-mode ${mode === m ? 'on' : ''}`}
              onClick={() => onMode(m)}
            >
              {m === 'day' ? 'יום' : m === 'week' ? 'שבוע' : 'חודש'}
            </button>
          ))}
        </div>
        <div className="cal-nav">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onAnchor(addMonthsClamp(anchor, -1))}
          >
            חודש קודם
          </button>
          <span className="cal-range">{labelMonth}</span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onAnchor(addMonthsClamp(anchor, 1))}
          >
            חודש הבא
          </button>
        </div>
      </div>
      <div className="cal-month-grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-month-dow">
            {w}
          </div>
        ))}
        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`e-${idx}`} className="cal-month-cell empty" />
          }
          const { ymd } = cell
          if (!ymd) return null
          const ms = meetingsOnYmd(meetings, ymd).length
          const cbs = callbacksOnYmd(customers, ymd).length
          const isToday = ymd === ymdFromDate(new Date())
          return (
            <motion.button
              key={ymd}
              type="button"
              className={`cal-month-cell ${isToday ? 'today' : ''}`}
              onClick={() => {
                onMode('day')
                const [y, m, d] = ymd.split('-').map(Number)
                onAnchor(new Date(y, m - 1, d))
              }}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: (idx % 7) * 0.015 }}
            >
              <span className="cal-month-num">{ymd.split('-')[2]}</span>
              <span className="cal-month-badges">
                {ms > 0 ? <i className="badge-dot meet" /> : null}
                {cbs > 0 ? <i className="badge-dot cb" /> : null}
              </span>
            </motion.button>
          )
        })}
      </div>
      <p className="muted cal-legend-mini">
        <i className="badge-dot meet inline" /> פגישה ·{' '}
        <i className="badge-dot cb inline" /> חזרה ללקוח — לחיצה על יום פותחת
        תצוגת יום
      </p>
    </div>
  )
}
