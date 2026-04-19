import type { Dispatch, SetStateAction } from 'react'
import { appendMissingSeedPriceItems } from '../demo'
import { dedupePriceList } from '../storage'
import type { AppData, PriceListItem } from '../types'

type Props = {
  data: AppData
  setData: Dispatch<SetStateAction<AppData>>
}

export function PriceCatalogPage({ data, setData }: Props) {
  function addPriceRow() {
    const now = new Date().toISOString()
    const row: PriceListItem = {
      id: crypto.randomUUID(),
      name: '',
      unitPriceInclVat: 0,
      createdAt: now,
      updatedAt: now,
    }
    setData((d) => ({ ...d, priceList: [row, ...d.priceList] }))
  }

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
    setData((d) => ({ ...d, priceList: d.priceList.filter((p) => p.id !== id) }))
  }

  return (
    <main>
      <h2 className="section-title">מחירון</h2>
      <p className="muted section-subcount">
        עריכת פריטים לשימוש ב<strong>הצעות מחיר</strong> (לשונית נפרדת). כל מחיר
        הוא <strong>ליחידה, כולל מע״מ 18%</strong>. בעת טעינת גרסה חדשה נוספים
        אוטומטית פריטי תבנית שחסרים (פעם אחת לפי גרסה) — אם לא רואים רשימה מלאה,
        רעננו את האפליקציה או לחצו &quot;השלם מהתבנית&quot;.
      </p>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="btn"
          onClick={() =>
            setData((d) => ({
              ...d,
              priceList: dedupePriceList(
                appendMissingSeedPriceItems(d.priceList),
              ),
            }))
          }
        >
          השלם פריטים חסרים מהתבנית
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>תיאור</th>
              <th>מחיר ₪ (כולל מע״מ)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.priceList.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  אין פריטים — הוסיפו שורה או טענו דמו
                </td>
              </tr>
            ) : (
              data.priceList.map((p) => (
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
                      onChange={(e) =>
                        updatePriceRow(p.id, {
                          unitPriceInclVat:
                            Number(e.target.value.replace(',', '.')) || 0,
                        })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => deletePriceRow(p.id)}
                    >
                      מחק
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn btn-primary" onClick={addPriceRow}>
        + פריט למחירון
      </button>
    </main>
  )
}
