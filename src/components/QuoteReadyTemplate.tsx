import { useMemo, useState } from 'react'
import { formatHebYmd, todayYmd } from '../dates'
import {
  elementToPdfBlob,
  shareOrDownloadPdf,
  waitAnimationFrames,
} from '../shareQuotePdf'
import {
  formatIls,
  lineVatBreakdown,
  totalVatBreakdown,
} from '../quoteUtils'
import type { Customer, PriceListItem } from '../types'
import { AiadLogoMark } from './AiadLogoMark'

type Props = {
  priceList: PriceListItem[]
  /** אופציונלי — בחירת לקוח ממלאת שם וטלפון בגיליון */
  customers?: Customer[]
}

type TemplateRow = {
  rowKey: string
  priceListItemId: string | null
  qty: number
}

function emptyRow(): TemplateRow {
  return {
    rowKey: crypto.randomUUID(),
    priceListItemId: null,
    qty: 1,
  }
}

function ensureTrailingTemplateRow(rows: TemplateRow[]): TemplateRow[] {
  if (rows.length === 0) return [emptyRow()]
  const last = rows[rows.length - 1]
  if (last.priceListItemId != null) {
    return [...rows, emptyRow()]
  }
  return rows
}

export function QuoteReadyTemplate({ priceList, customers = [] }: Props) {
  const [linkedCustomerId, setLinkedCustomerId] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [quoteDate, setQuoteDate] = useState(todayYmd())
  const [rows, setRows] = useState<TemplateRow[]>(() =>
    ensureTrailingTemplateRow([emptyRow()]),
  )
  const [printOpen, setPrintOpen] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)

  const priceListSorted = useMemo(
    () =>
      [...priceList].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'he'),
      ),
    [priceList],
  )

  const customersSorted = useMemo(
    () =>
      [...customers].sort((a, b) => a.name.localeCompare(b.name, 'he')),
    [customers],
  )

  function rowItem(id: string | null): PriceListItem | undefined {
    if (!id) return undefined
    return priceList.find((p) => p.id === id)
  }

  const filledRows = rows.filter((r) => r.priceListItemId != null)

  const templateTotalIncl = useMemo(
    () =>
      filledRows.reduce((sum, r) => {
        const item = rowItem(r.priceListItemId)
        if (!item) return sum
        return sum + r.qty * item.unitPriceInclVat
      }, 0),
    [filledRows, priceList],
  )

  const templateBreakdown = useMemo(
    () => totalVatBreakdown(templateTotalIncl),
    [templateTotalIncl],
  )

  async function sharePdf() {
    if (filledRows.length === 0) {
      alert('בחרו לפחות פריט אחד מהמחירון לפני שיתוף PDF.')
      return
    }
    setPdfBusy(true)
    setPrintOpen(true)
    await waitAnimationFrames(3)
    try {
      const el = document.querySelector(
        '[data-quote-pdf-capture="template"]',
      ) as HTMLElement | null
      if (!el) {
        throw new Error('capture root missing')
      }
      const blob = await elementToPdfBlob(el)
      await shareOrDownloadPdf(
        blob,
        `aiad-quote-${quoteDate}.pdf`,
        'הצעת מחיר — איאד מזגנים',
      )
    } catch (e) {
      console.error(e)
      alert(
        'לא הצלחנו ליצור או לשתף PDF. נסו «פתח להדפסה / PDF» ובחרו «שמור כ־PDF» מהתפריט.',
      )
    } finally {
      setPrintOpen(false)
      setPdfBusy(false)
    }
  }

  function openPrint() {
    setPrintOpen(true)
    setTimeout(() => {
      window.print()
      setTimeout(() => setPrintOpen(false), 500)
    }, 200)
  }

  return (
    <section className="quote-template-section">
      <h2 className="section-title">הצעת מחיר מוכנה (תבנית)</h2>
      <p className="muted section-subcount">
        בוחרים פריטים מהמחירון — אחרי בחירה בשורה האחרונה נפתחת שורה חדשה
        אוטומטית. אפשר <strong>להסיר שורה</strong> בלחיצה על «הסר».{' '}
        <strong>שיתוף PDF</strong> / הדפסה.
      </p>
      <div className="customer-card pri-low quote-template-editor">
        <div className="form-grid two">
          {customersSorted.length > 0 ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="field">לקוח מהרשימה (ממלא שם וטלפון)</label>
              <select
                value={linkedCustomerId}
                onChange={(e) => {
                  const id = e.target.value
                  setLinkedCustomerId(id)
                  const c = customersSorted.find((x) => x.id === id)
                  if (c) {
                    setClientName(c.name)
                    setClientPhone(c.phone)
                  } else {
                    setClientName('')
                    setClientPhone('')
                  }
                }}
              >
                <option value="">— הקלדה ידנית למטה —</option>
                {customersSorted.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.phone}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label className="field">שם לקוח</label>
            <input
              value={clientName}
              onChange={(e) => {
                setClientName(e.target.value)
                setLinkedCustomerId('')
              }}
            />
          </div>
          <div>
            <label className="field">טלפון</label>
            <input
              value={clientPhone}
              onChange={(e) => {
                setClientPhone(e.target.value)
                setLinkedCustomerId('')
              }}
              dir="ltr"
              style={{ textAlign: 'left' }}
            />
          </div>
          <div>
            <label className="field">תאריך הצעה</label>
            <input
              type="date"
              value={quoteDate}
              onChange={(e) => setQuoteDate(e.target.value)}
            />
          </div>
        </div>
        {priceList.length === 0 ? (
          <p className="muted" style={{ marginTop: 14 }}>
            אין פריטים במחירון — הוסיפו בלשונית <strong>מחירון</strong> כדי לבחור
            כאן פריטים.
          </p>
        ) : null}
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table>
            <thead>
              <tr>
                <th>פריט</th>
                <th>כמות</th>
                <th>מחיר יחידה ₪</th>
                <th>מחיר ₪ (כמות × יחידה)</th>
                <th aria-label="הסר שורה" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const item = rowItem(r.priceListItemId)
                const line = item
                  ? lineVatBreakdown(r.qty, item.unitPriceInclVat)
                  : null
                return (
                  <tr key={r.rowKey}>
                    <td>
                      <select
                        className="table-inline-input"
                        style={{ width: '100%', minWidth: 200 }}
                        value={r.priceListItemId ?? ''}
                        onChange={(e) => {
                          const v = e.target.value
                          setRows((prev) => {
                            const next = prev.map((x, j) =>
                              j === i
                                ? {
                                    ...x,
                                    priceListItemId: v || null,
                                  }
                                : x,
                            )
                            const isLast = i === prev.length - 1
                            if (v && isLast) {
                              return ensureTrailingTemplateRow(next)
                            }
                            return next
                          })
                        }}
                      >
                        <option value="">— בחרו פריט —</option>
                        {priceListSorted.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name || '(ללא שם)'} — ₪
                            {formatIls(p.unitPriceInclVat)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="table-inline-input"
                        inputMode="numeric"
                        disabled={!r.priceListItemId}
                        value={r.qty}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x, j) =>
                              j === i
                                ? {
                                    ...x,
                                    qty: Math.max(
                                      1,
                                      Number(e.target.value) || 1,
                                    ),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                    </td>
                    <td dir="ltr" style={{ textAlign: 'left' }}>
                      {item ? (
                        <span>₪{formatIls(item.unitPriceInclVat)}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td dir="ltr" style={{ textAlign: 'left' }}>
                      {line ? (
                        <strong>₪{formatIls(line.incl)}</strong>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                        onClick={() =>
                          setRows((prev) => {
                            const next = prev.filter((_, j) => j !== i)
                            return ensureTrailingTemplateRow(
                              next.length === 0 ? [emptyRow()] : next,
                            )
                          })
                        }
                      >
                        הסר
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filledRows.length > 0 ? (
          <p className="quote-total-banner" style={{ marginTop: 12 }}>
            סה״כ לתשלום (כולל מע״מ):{' '}
            <strong>₪{formatIls(templateBreakdown.incl)}</strong>
          </p>
        ) : null}
        <p className="muted" style={{ fontSize: '0.82rem', marginTop: 12 }}>
          תנאים כלליים: המחירים כוללים מע״מ 18%. תוקף ההצעה לפי מה שייקבע מול
          הלקוח. ביצוע העבודה כפוף לזמינות ולתיאום.
        </p>
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={pdfBusy}
            onClick={() => void sharePdf()}
          >
            {pdfBusy ? 'מכין PDF…' : 'שתף PDF'}
          </button>
          <button
            type="button"
            className="btn"
            disabled={pdfBusy}
            onClick={openPrint}
          >
            פתח להדפסה / PDF
          </button>
        </div>
      </div>

      {printOpen ? (
        <div className="print-quote-portal" aria-hidden>
          <div
            className="quote-print-sheet quote-print-sheet--solo quote-pdf-capture-root"
            data-quote-pdf-capture="template"
          >
            <div className="quote-brand-watermark" aria-hidden>
              איאד מזגנים
            </div>
            <div className="quote-print-inner">
              <div className="quote-print-logo-row">
                <AiadLogoMark variant="print" />
              </div>
              <h1 className="quote-print-title">הצעת מחיר</h1>
              <p>
                <strong>לכבוד:</strong> {clientName || '________________'}
              </p>
              <p>
                <strong>טלפון:</strong> {clientPhone || '________________'}
              </p>
              <p>
                <strong>תאריך:</strong> {formatHebYmd(quoteDate)}
              </p>
              <table className="quote-print-table">
                <thead>
                  <tr>
                    <th>תיאור</th>
                    <th>כמות</th>
                    <th>מחיר יחידה ₪</th>
                    <th>מחיר ₪ (כמות × יחידה)</th>
                  </tr>
                </thead>
                <tbody>
                  {filledRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted">
                        {' '}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {filledRows
                        .map((r) => ({
                          r,
                          item: rowItem(r.priceListItemId),
                        }))
                        .filter(
                          (x): x is { r: TemplateRow; item: PriceListItem } =>
                            x.item != null,
                        )
                        .map(({ r, item }) => {
                          const line = lineVatBreakdown(r.qty, item.unitPriceInclVat)
                          return (
                            <tr key={r.rowKey}>
                              <td>{item.name}</td>
                              <td>{r.qty}</td>
                              <td dir="ltr">₪{formatIls(item.unitPriceInclVat)}</td>
                              <td dir="ltr">
                                <strong>
                                  ₪{formatIls(line.incl)}
                                </strong>
                              </td>
                            </tr>
                          )
                        })}
                      <tr className="quote-print-summary">
                        <td colSpan={3}>סה״כ לפני מע״מ</td>
                        <td dir="ltr">
                          ₪{formatIls(templateBreakdown.ex)}
                        </td>
                      </tr>
                      <tr className="quote-print-summary">
                        <td colSpan={3}>מע״מ (18%)</td>
                        <td dir="ltr">
                          ₪{formatIls(templateBreakdown.vat)}
                        </td>
                      </tr>
                      <tr className="quote-print-summary quote-print-summary--final">
                        <td colSpan={3}>סה״כ לתשלום (כולל מע״מ)</td>
                        <td dir="ltr">
                          ₪{formatIls(templateBreakdown.incl)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
              <p className="quote-print-notes">
                תנאים: המחירים כוללים מע״מ 18%. ההצעה אינה מחייבת עד לאישור
                הזמנה. אחריות ציוד לפי יצרן.
              </p>
              <p className="quote-print-brand-footer">איאד מזגנים</p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
