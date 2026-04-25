import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useLayoutEffect, useState } from 'react'
import type { AppData, PriceListItem } from '../types'

type Props = {
  data: AppData
  setData: Dispatch<SetStateAction<AppData>>
  isRemote?: boolean
  /** שמירה מיידית לענן (מבטלת המתנת 600ms) */
  onFlushToServer?: () => void | Promise<void>
  onRefreshFromServer?: () => void | Promise<void | AppData | null>
}

export function PriceCatalogPage({
  data,
  setData,
  isRemote,
  onFlushToServer,
  onRefreshFromServer,
}: Props) {
  const [rowSavedFlash, setRowSavedFlash] = useState<string | null>(null)
  const [allSavedFlash, setAllSavedFlash] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  /** כדי לדעת אם «0» במחיר הוא הזנה מפורשת, לא רק ברירת מחדל (כדי ש־+ יישאר מושבת בלי הזנת מחיר) */
  const [priceFieldTouched, setPriceFieldTouched] = useState<
    Record<string, boolean>
  >({})

  useEffect(() => {
    if (!rowSavedFlash) return
    const t = setTimeout(() => setRowSavedFlash(null), 1800)
    return () => clearTimeout(t)
  }, [rowSavedFlash])

  useEffect(() => {
    if (!allSavedFlash) return
    const t = setTimeout(() => setAllSavedFlash(false), 2000)
    return () => clearTimeout(t)
  }, [allSavedFlash])

  /** שורת טיוטה אחת כשהמחירון ריק — אין «פריט חדש» בראש, רק + בשורה האחרונה */
  useLayoutEffect(() => {
    if (data.priceList.length > 0) return
    setData((d) => {
      if (d.priceList.length > 0) return d
      const now = new Date().toISOString()
      return {
        ...d,
        priceList: [
          {
            id: crypto.randomUUID(),
            name: '',
            unitPriceInclVat: 0,
            createdAt: now,
            updatedAt: now,
          },
        ],
      }
    })
  }, [data.priceList.length, setData])

  function updatePriceRow(id: string, patch: Partial<PriceListItem>) {
    const now = new Date().toISOString()
    setData((d) => ({
      ...d,
      priceList: d.priceList.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: now } : p,
      ),
    }))
  }

  function deletePriceRow(id: string) {
    if (!confirm('למחוק את פריט המחירון?')) return
    setPriceFieldTouched((t) => {
      if (!t[id]) return t
      const { [id]: _removed, ...rest } = t
      return rest
    })
    setData((d) => ({ ...d, priceList: d.priceList.filter((p) => p.id !== id) }))
  }

  async function saveRowToCloud(rowId: string) {
    await onFlushToServer?.()
    setRowSavedFlash(rowId)
  }

  async function saveAllToCloud() {
    await onFlushToServer?.()
    setAllSavedFlash(true)
  }

  function canAddNextFromRow(p: PriceListItem): boolean {
    if (!p.name.trim()) return false
    if (!Number.isFinite(p.unitPriceInclVat) || p.unitPriceInclVat < 0)
      return false
    if (p.unitPriceInclVat > 0) return true
    return priceFieldTouched[p.id] === true
  }

  async function commitLastRowAndAddNext(completedRowId: string) {
    await onFlushToServer?.()
    setRowSavedFlash(completedRowId)
    const now = new Date().toISOString()
    const row: PriceListItem = {
      id: crypto.randomUUID(),
      name: '',
      unitPriceInclVat: 0,
      createdAt: now,
      updatedAt: now,
    }
    setData((d) => ({ ...d, priceList: [...d.priceList, row] }))
  }

  async function handleRefresh() {
    if (!onRefreshFromServer) return
    setRefreshing(true)
    try {
      await onRefreshFromServer()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <main>
      <h2 className="section-title">מחירון</h2>
      <p className="muted section-subcount">
        מחירים <strong>ליחידה, כולל מע״מ 18%</strong>. העריכה נשמרת אוטומטית
        (עם שיהוי קצר); <strong>שמור</strong> = שמירה <strong>מיידית</strong> (
        {isRemote ? 'לענן' : 'למכשיר'}). <strong>+ פריט חדש</strong> מופיע ליד
        השורה <strong>האחרונה</strong> (מושבת עד הזנת תיאור ומחיר), ומוסיף
        שורה נוספת אחרי שמירה מיידית.
      </p>
      <div
        className="toolbar"
        style={{ marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}
      >
        {isRemote && onRefreshFromServer ? (
          <button
            type="button"
            className="btn"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
          >
            {refreshing ? 'טוען…' : 'רענן מהענן'}
          </button>
        ) : null}
        {onFlushToServer ? (
          <button
            type="button"
            className="btn"
            onClick={() => void saveAllToCloud()}
          >
            שמור הכל (מיידי)
          </button>
        ) : null}
        {allSavedFlash ? (
          <span className="muted" style={{ fontSize: '0.9rem' }}>
            {isRemote ? 'נשמר לענן' : 'נשמר'}
          </span>
        ) : null}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>תיאור</th>
              <th>מחיר ₪ (כולל מע״מ)</th>
              <th aria-label="פעולות" />
            </tr>
          </thead>
          <tbody>
            {data.priceList.length === 0 ? null : (
              data.priceList.map((p, i) => {
                const isLast = i === data.priceList.length - 1
                return (
                <tr key={p.id}>
                  <td>
                    <input
                      className="table-inline-input"
                      value={p.name}
                      onChange={(e) =>
                        updatePriceRow(p.id, { name: e.target.value })
                      }
                      placeholder="למשל: התקנה / ביקור"
                    />
                  </td>
                  <td>
                    <input
                      className="table-inline-input"
                      inputMode="decimal"
                      dir="ltr"
                      style={{ textAlign: 'left' }}
                      value={p.unitPriceInclVat || ''}
                      onChange={(e) => {
                        setPriceFieldTouched((t) => ({ ...t, [p.id]: true }))
                        updatePriceRow(p.id, {
                          unitPriceInclVat:
                            Number(e.target.value.replace(',', '.')) || 0,
                        })
                      }}
                    />
                  </td>
                  <td>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                      }}
                    >
                      {isLast ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          title="שמירה מיידית ואז הוספת שורה לפריט נוסף"
                          disabled={!canAddNextFromRow(p)}
                          onClick={() =>
                            void commitLastRowAndAddNext(p.id)
                          }
                        >
                          + פריט חדש
                        </button>
                      ) : null}
                      {onFlushToServer ? (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => void saveRowToCloud(p.id)}
                        >
                          {rowSavedFlash === p.id ? 'נשמר ✓' : 'שמור'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => deletePriceRow(p.id)}
                      >
                        מחק
                      </button>
                    </div>
                  </td>
                </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      {onFlushToServer && data.priceList.length > 0 ? (
        <div className="toolbar" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void saveAllToCloud()}
          >
            שמור את כל המחירון (מיידי)
          </button>
          {allSavedFlash ? (
            <span className="muted" style={{ fontSize: '0.9rem' }}>
              נשמר
            </span>
          ) : null}
        </div>
      ) : null}
    </main>
  )
}
