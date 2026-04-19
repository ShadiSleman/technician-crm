import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import {
  GROUP_CHART_COLOR,
  GROUP_HINT,
  GROUP_LABEL,
  PRIORITY_CHART_COLOR,
  PRIORITY_HINT,
  PRIORITY_LABEL,
} from '../copy'
import type { Priority, WorkGroup } from '../types'

type Props = {
  /** default = כפתור רגיל; inline = קישור קטן ליד כותרות / גרפים */
  variant?: 'default' | 'inline'
}

export function ColorLegend({ variant = 'default' }: Props) {
  const [open, setOpen] = useState(false)
  const pri = Object.keys(PRIORITY_LABEL) as Priority[]
  const grp = Object.keys(GROUP_LABEL) as WorkGroup[]

  const isInline = variant === 'inline'

  return (
    <div className={isInline ? 'legend-wrap legend-wrap-inline' : 'legend-wrap'}>
      <button
        type="button"
        className={isInline ? 'legend-toggle legend-toggle-inline' : 'legend-toggle'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{isInline ? 'מה הצבעים?' : 'משמעות הצבעים והתגים'}</span>
        {!isInline ? (
          <span className="legend-chevron" data-open={open}>
            ‹
          </span>
        ) : null}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.section
            key="panel"
            className={
              isInline ? 'legend-panel legend-panel-floating' : 'legend-panel'
            }
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="legend-panel-inner">
              <p className="legend-intro">
                <strong>פס צבע בכרטיס</strong> = רמת דחיפות שקבעת (לא קשור לתאריך
                חזרה). <strong>תג קבוצה</strong> = סוג עבודה (שירות / התקנה /
                השלמה).
              </p>
              <div className="legend-grid">
                <div>
                  <h4 className="legend-sub">דחיפות (פס)</h4>
                  <ul className="legend-list legend-list-compact">
                    {pri.map((p) => (
                      <li key={p}>
                        <span
                          className="legend-swatch"
                          style={{ background: PRIORITY_CHART_COLOR[p] }}
                        />
                        <span>
                          <strong>{PRIORITY_LABEL[p]}</strong>
                          <span className="legend-hint">
                            {' '}
                            — {PRIORITY_HINT[p]}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="legend-sub">קבוצות (תג)</h4>
                  <ul className="legend-list legend-list-compact">
                    {grp.map((g) => (
                      <li key={g}>
                        <span
                          className="legend-swatch legend-swatch-soft"
                          style={{ background: GROUP_CHART_COLOR[g] }}
                        />
                        <span>
                          <strong>{GROUP_LABEL[g]}</strong>
                          <span className="legend-hint">
                            {' '}
                            — {GROUP_HINT[g]}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
