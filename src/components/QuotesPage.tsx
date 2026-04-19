import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { formatHebYmd } from '../dates'
import {
  formatIls,
  lineSum,
  lineVatBreakdown,
  linesTotal,
  totalVatBreakdown,
} from '../quoteUtils'
import {
  elementToPdfBlob,
  shareOrDownloadPdf,
  waitAnimationFrames,
} from '../shareQuotePdf'
import type { AppData, Customer, Quote, QuoteLine } from '../types'
import { AiadLogoMark } from './AiadLogoMark'
import { QuoteReadyTemplate } from './QuoteReadyTemplate'

export type QuotesCustomerFocus = {
  customerId: string
  nonce: number
}

type Props = {
  data: AppData
  setData: Dispatch<SetStateAction<AppData>>
  /** מכרטיס לקוח: לבחור לקוח בעורך הצעה חדשה */
  quotesCustomerFocus?: QuotesCustomerFocus | null
  onQuotesCustomerFocusApplied?: () => void
}

/** שורה בעורך — רק מזהה ממחירון וכמות (תיאור/מחיר נמשכים מהמחירון בשמירה) */
type CatalogQuoteRow = {
  rowKey: string
  priceListItemId: string | null
  qty: number
}

function emptyRow(): CatalogQuoteRow {
  return {
    rowKey: crypto.randomUUID(),
    priceListItemId: null,
    qty: 1,
  }
}

/** שורת קלט ריקה אחרונה — אחרי מילוי שורה נוספת נפתחת אוטומטית */
function ensureTrailingEmptyRow(rows: CatalogQuoteRow[]): CatalogQuoteRow[] {
  if (rows.length === 0) return [emptyRow()]
  const last = rows[rows.length - 1]
  if (last.priceListItemId != null) {
    return [...rows, emptyRow()]
  }
  return rows
}

export function QuotesPage({
  data,
  setData,
  quotesCustomerFocus,
  onQuotesCustomerFocusApplied,
}: Props) {
  const [quoteCustomerId, setQuoteCustomerId] = useState('')
  const [quoteRows, setQuoteRows] = useState<CatalogQuoteRow[]>(() =>
    ensureTrailingEmptyRow([emptyRow()]),
  )
  const [quoteNotes, setQuoteNotes] = useState('')
  const [printQuoteId, setPrintQuoteId] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  const customersSorted = useMemo(
    () =>
      [...data.customers].sort((a, b) => a.name.localeCompare(b.name, 'he')),
    [data.customers],
  )

  const priceListSorted = useMemo(
    () =>
      [...data.priceList].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'he'),
      ),
    [data.priceList],
  )

  useEffect(() => {
    if (!quotesCustomerFocus) return
    setQuoteCustomerId(quotesCustomerFocus.customerId)
    onQuotesCustomerFocusApplied?.()
  }, [quotesCustomerFocus?.nonce, quotesCustomerFocus?.customerId])

  /** לחישוב סה״כ בתצוגה */
  const quoteLinesPreview: QuoteLine[] = useMemo(() => {
    const out: QuoteLine[] = []
    for (const r of quoteRows) {
      if (!r.priceListItemId) continue
      const item = data.priceList.find((p) => p.id === r.priceListItemId)
      if (!item) continue
      out.push({
        priceListItemId: item.id,
        description: item.name,
        qty: r.qty,
        unitPriceInclVat: item.unitPriceInclVat,
      })
    }
    return out
  }, [quoteRows, data.priceList])

  function saveQuote() {
    if (!quoteCustomerId) {
      alert('נא לבחור לקוח — ההצעה נשמרת משויכת ללקוח.')
      return
    }

    const lines: QuoteLine[] = []
    for (const r of quoteRows) {
      const item = data.priceList.find((p) => p.id === r.priceListItemId)
      if (!item || r.qty <= 0) continue
      lines.push({
        priceListItemId: item.id,
        description: item.name,
        qty: r.qty,
        unitPriceInclVat: item.unitPriceInclVat,
      })
    }

    if (lines.length === 0) {
      if (data.priceList.length === 0) {
        alert('אין פריטים במחירון — הוסיפו פריטים בלשונית «מחירון» ואז חזרו לכאן.')
      } else {
        alert('נא לבחור לפחות פריט אחד מהמחירון.')
      }
      return
    }

    const c: Customer | undefined = data.customers.find(
      (x) => x.id === quoteCustomerId,
    )
    const now = new Date().toISOString()
    const q: Quote = {
      id: crypto.randomUUID(),
      customerId: quoteCustomerId,
      customerNameSnapshot: c?.name ?? '',
      customerPhoneSnapshot: c?.phone ?? '',
      lines,
      totalInclVat: linesTotal(lines),
      notes: quoteNotes.trim(),
      createdAt: now,
      updatedAt: now,
    }
    setData((d) => ({ ...d, quotes: [q, ...d.quotes] }))
    setQuoteRows(ensureTrailingEmptyRow([emptyRow()]))
    setQuoteNotes('')
    alert('ההצעה נשמרה')
  }

  function deleteQuote(id: string) {
    if (!confirm('למחוק הצעת מחיר זו?')) return
    setData((d) => ({ ...d, quotes: d.quotes.filter((q) => q.id !== id) }))
  }

  function printQuote(q: Quote) {
    setPrintQuoteId(q.id)
    setTimeout(() => {
      window.print()
      setTimeout(() => setPrintQuoteId(null), 400)
    }, 200)
  }

  async function shareSavedQuotePdf(q: Quote) {
    if (q.lines.length === 0) {
      alert('אין שורות בהצעה זו.')
      return
    }
    setPdfBusy(true)
    setPrintQuoteId(q.id)
    await waitAnimationFrames(3)
    try {
      const el = document.querySelector(
        '[data-quote-pdf-capture="saved"]',
      ) as HTMLElement | null
      if (!el) throw new Error('capture root missing')
      const blob = await elementToPdfBlob(el)
      const day = q.createdAt.slice(0, 10)
      await shareOrDownloadPdf(
        blob,
        `aiad-quote-${day}.pdf`,
        'הצעת מחיר — איאד מזגנים',
      )
    } catch (e) {
      console.error(e)
      alert(
        'לא הצלחנו ליצור או לשתף PDF. נסו «הדפס / PDF» ובחרו שמירה כ־PDF.',
      )
    } finally {
      setPrintQuoteId(null)
      setPdfBusy(false)
    }
  }

  const quoteForPrint =
    printQuoteId != null
      ? data.quotes.find((q) => q.id === printQuoteId)
      : null

  return (
    <>
      <main>
        <QuoteReadyTemplate
          priceList={data.priceList}
          customers={data.customers}
        />

        <h2 className="section-title">הצעת מחיר חדשה</h2>
        <p className="muted section-subcount">
          <strong>לקוח חובה</strong> לשמירה. בוחרים פריט מהמחירון — אחרי בחירה בשורה
          האחרונה נפתחת שורה חדשה אוטומטית. ניתן להסיר שורות בלחיצה על «הסר».
        </p>
        <div className="form-grid two">
          <div>
            <label className="field">לקוח (חובה לשמירה)</label>
            <select
              value={quoteCustomerId}
              onChange={(e) => setQuoteCustomerId(e.target.value)}
            >
              <option value="">— בחרו לקוח —</option>
              {customersSorted.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.phone}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="quote-lines-editor">
          {quoteRows.map((row, i) => {
            const item = row.priceListItemId
              ? data.priceList.find((p) => p.id === row.priceListItemId)
              : null
            const lineForSum: QuoteLine | null = item
              ? {
                  priceListItemId: item.id,
                  description: item.name,
                  qty: row.qty,
                  unitPriceInclVat: item.unitPriceInclVat,
                }
              : null

            return (
              <div key={row.rowKey} className="quote-line-row">
                <div>
                  <label className="field">פריט</label>
                  <select
                    value={row.priceListItemId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      setQuoteRows((rows) => {
                        const next = rows.map((r, j) =>
                          j === i
                            ? {
                                ...r,
                                priceListItemId: v || null,
                              }
                            : r,
                        )
                        const isLast = i === rows.length - 1
                        if (v && isLast) {
                          return ensureTrailingEmptyRow(next)
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
                  {data.priceList.length === 0 ? (
                    <p
                      className="muted"
                      style={{ marginTop: 8, fontSize: '0.85rem' }}
                    >
                      אין פריטים במחירון — הוסיפו בלשונית <strong>מחירון</strong>.
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="field">כמות</label>
                  <input
                    inputMode="numeric"
                    value={row.qty}
                    disabled={!row.priceListItemId}
                    onChange={(e) =>
                      setQuoteRows((rows) =>
                        rows.map((r, j) =>
                          j === i
                            ? {
                                ...r,
                                qty: Math.max(1, Number(e.target.value) || 1),
                              }
                            : r,
                        ),
                      )
                    }
                  />
                </div>

                <div>
                  <label className="field">מחיר יחידה ₪ (כולל מע״מ)</label>
                  {item ? (
                    <p
                      className="quote-line-readonly-value"
                      dir="ltr"
                      style={{
                        margin: 0,
                        minHeight: 38,
                        padding: '8px 10px',
                        textAlign: 'left',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        background: 'var(--surface2)',
                      }}
                    >
                      ₪{formatIls(item.unitPriceInclVat)}
                    </p>
                  ) : (
                    <p
                      className="muted"
                      style={{
                        margin: 0,
                        minHeight: 38,
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px dashed var(--border)',
                      }}
                    >
                      —
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    setQuoteRows((rows) => {
                      const next = rows.filter((_, j) => j !== i)
                      return ensureTrailingEmptyRow(
                        next.length === 0 ? [emptyRow()] : next,
                      )
                    })
                  }
                >
                  הסר שורה
                </button>

                <div className="quote-line-sum">
                  שורה: ₪
                  {lineForSum ? formatIls(lineSum(lineForSum)) : '—'}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: 12 }}>
          <label className="field">הערות להצעה</label>
          <input
            value={quoteNotes}
            onChange={(e) => setQuoteNotes(e.target.value)}
            placeholder="תוקף, תנאי תשלום..."
          />
        </div>

        <p className="quote-total-banner">
          סה״כ כולל מע״מ (18%):{' '}
          <strong>
            ₪{formatIls(linesTotal(quoteLinesPreview))}
          </strong>
        </p>
        <button type="button" className="btn btn-primary" onClick={saveQuote}>
          שמור הצעת מחיר
        </button>

        <h2 className="section-title">הצעות שמורות</h2>
        <div className="list">
          {data.quotes.length === 0 ? (
            <p className="muted">אין עדיין הצעות</p>
          ) : (
            data.quotes.map((q) => (
              <article key={q.id} className="customer-card pri-low">
                <header>
                  <h3>
                    {q.customerNameSnapshot || 'ללא שם'} ·{' '}
                    {formatHebYmd(q.createdAt.slice(0, 10))}
                  </h3>
                  <span className="badge">₪{formatIls(q.totalInclVat)}</span>
                </header>
                {q.customerPhoneSnapshot ? (
                  <p className="meta">{q.customerPhoneSnapshot}</p>
                ) : null}
                <ul className="quote-lines-preview">
                  {q.lines.map((l, idx) => (
                    <li key={idx}>
                      {l.description} × {l.qty} = ₪
                      {formatIls(lineSum(l))}
                    </li>
                  ))}
                </ul>
                {q.notes ? <p className="meta">{q.notes}</p> : null}
                <div className="actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={pdfBusy}
                    onClick={() => void shareSavedQuotePdf(q)}
                  >
                    {pdfBusy ? 'מכין PDF…' : 'שתף PDF'}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={pdfBusy}
                    onClick={() => printQuote(q)}
                  >
                    הדפס / PDF
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={pdfBusy}
                    onClick={() => deleteQuote(q.id)}
                  >
                    מחק
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </main>

      {quoteForPrint ? (
        <div className="print-quote-portal" aria-hidden>
          <div
            className="quote-print-sheet quote-print-sheet--solo quote-pdf-capture-root"
            data-quote-pdf-capture="saved"
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
                <strong>לכבוד:</strong>{' '}
                {quoteForPrint.customerNameSnapshot || '—'}
              </p>
              <p>
                <strong>טלפון:</strong>{' '}
                {quoteForPrint.customerPhoneSnapshot || '—'}
              </p>
              <p>
                <strong>תאריך:</strong>{' '}
                {formatHebYmd(quoteForPrint.createdAt.slice(0, 10))}
              </p>
              <table className="quote-print-table">
                <thead>
                  <tr>
                    <th>תיאור</th>
                    <th>כמות</th>
                    <th>סה״כ שורה ₪ (כולל מע״מ)</th>
                  </tr>
                </thead>
                <tbody>
                  {quoteForPrint.lines.map((l, idx) => {
                    const line = lineVatBreakdown(l.qty, l.unitPriceInclVat)
                    return (
                      <tr key={idx}>
                        <td>{l.description}</td>
                        <td>{l.qty}</td>
                        <td dir="ltr">
                          <strong>₪{formatIls(line.incl)}</strong>
                        </td>
                      </tr>
                    )
                  })}
                  {(() => {
                    const b = totalVatBreakdown(quoteForPrint.totalInclVat)
                    return (
                      <>
                        <tr className="quote-print-summary">
                          <td colSpan={2}>סה״כ לפני מע״מ</td>
                          <td dir="ltr">
                            ₪{formatIls(b.ex)}
                          </td>
                        </tr>
                        <tr className="quote-print-summary">
                          <td colSpan={2}>מע״מ (18%)</td>
                          <td dir="ltr">
                            ₪{formatIls(b.vat)}
                          </td>
                        </tr>
                        <tr className="quote-print-summary quote-print-summary--final">
                          <td colSpan={2}>סה״כ לתשלום (כולל מע״מ)</td>
                          <td dir="ltr">
                            ₪{formatIls(b.incl)}
                          </td>
                        </tr>
                      </>
                    )
                  })()}
                </tbody>
              </table>
              {quoteForPrint.notes ? (
                <p className="quote-print-notes">{quoteForPrint.notes}</p>
              ) : null}
              <p className="quote-print-brand-footer">איאד מזגנים</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
