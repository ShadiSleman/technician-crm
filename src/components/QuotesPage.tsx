import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { formatHebYmd } from '../dates'
import {
  formatIls,
  lineSum,
  lineVatBreakdown,
  linesTotal,
  refreshQuoteFromPriceList,
  totalVatBreakdown,
} from '../quoteUtils'
import {
  elementToPdfBlob,
  shareOrDownloadPdf,
  waitAnimationFrames,
} from '../shareQuotePdf'
import type { AppData, Customer, PriceListItem, Quote, QuoteLine } from '../types'
import { AiadLogoMark } from './AiadLogoMark'

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
  /** אחרי שינויים ב-Mongo / מכשיר אחר: רענון מלא מ-workspace */
  isRemote?: boolean
  onRefreshFromServer?: () => void | Promise<void>
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

function linePriceStale(l: QuoteLine, priceList: PriceListItem[]): boolean {
  if (!l.priceListItemId) return false
  const p = priceList.find((x) => x.id === l.priceListItemId)
  if (!p) return true
  return (
    p.unitPriceInclVat !== l.unitPriceInclVat || (p.name || '') !== l.description
  )
}

export function QuotesPage({
  data,
  setData,
  quotesCustomerFocus,
  onQuotesCustomerFocusApplied,
  isRemote,
  onRefreshFromServer,
}: Props) {
  const [quoteCustomerId, setQuoteCustomerId] = useState('')
  const [quoteRows, setQuoteRows] = useState<CatalogQuoteRow[]>(() =>
    ensureTrailingEmptyRow([emptyRow()]),
  )
  const [quoteNotes, setQuoteNotes] = useState('')
  const [printBuffer, setPrintBuffer] = useState<Quote | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

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

  const draftAsQuote: Quote | null = useMemo(() => {
    if (quoteLinesPreview.length === 0) return null
    const c = data.customers.find((x) => x.id === quoteCustomerId)
    const now = new Date().toISOString()
    return {
      id: 'draft',
      customerId: quoteCustomerId || null,
      customerNameSnapshot: c?.name ?? '',
      customerPhoneSnapshot: c?.phone ?? '',
      lines: quoteLinesPreview,
      totalInclVat: linesTotal(quoteLinesPreview),
      notes: quoteNotes.trim(),
      createdAt: now,
      updatedAt: now,
    }
  }, [quoteLinesPreview, quoteCustomerId, data.customers, quoteNotes])

  async function handleRefreshFromServer() {
    if (!onRefreshFromServer) return
    setRefreshing(true)
    try {
      await onRefreshFromServer()
    } finally {
      setRefreshing(false)
    }
  }

  function applyCatalogPricesToQuote(quoteId: string) {
    setData((d) => ({
      ...d,
      quotes: d.quotes.map((q) =>
        q.id === quoteId
          ? refreshQuoteFromPriceList(q, d.priceList)
          : q,
      ),
    }))
  }

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

  function openPrintForQuote(q: Quote) {
    setPrintBuffer(q)
    setTimeout(() => {
      window.print()
      setTimeout(() => setPrintBuffer(null), 400)
    }, 200)
  }

  async function shareAsPdf(q: Quote) {
    if (q.lines.length === 0) {
      alert('אין שורות.')
      return
    }
    setPdfBusy(true)
    setPrintBuffer(q)
    await waitAnimationFrames(3)
    try {
      const el = document.querySelector(
        '[data-quote-pdf-capture="quote-print"]',
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
      setPrintBuffer(null)
      setPdfBusy(false)
    }
  }

  return (
    <>
      <main>
        <p className="muted section-subcount" style={{ marginTop: 0 }}>
          <strong>ההצעות</strong> נשמרות <strong>בחשבון שלך</strong> (ענן) בכל מכשיר
          שבו אותו משתמש מחובר. המחירים בטבלאות נלקחים מהמחירון בעת העריכה; בהצעה
          <strong> שמורה</strong> נשמרים מחירי רגע השמירה — לעדכן אחרי שינוי
          מחירון, לחצו <strong>«עדכן מחירים מהמחירון»</strong> בכרטיס.
        </p>
        {isRemote && onRefreshFromServer ? (
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className="btn"
              onClick={() => void handleRefreshFromServer()}
              disabled={refreshing}
            >
              {refreshing ? 'טוען מהענן…' : 'רענן נתונים מהענן'}
            </button>
            <span className="muted" style={{ fontSize: '0.9rem' }}>
              אם ערכת ב-Mongo או במכשיר אחר, רענון ימשוך את הגרסה האחרונה.
            </span>
          </div>
        ) : null}

        <h2 className="section-title">הצעת מחיר חדשה</h2>
        <p className="muted section-subcount">
          <strong>לקוח חובה</strong> לשמירה. הוסיפו שורות מהמחירון, ואז{' '}
          <strong>שמור הצעת מחיר</strong> — השמירה מסתנכרנת אוטומטית לענן.
          (מחירי יחידה משתנים בזמן אמת לפי לשונית <strong>מחירון</strong>.)
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

        {data.priceList.length === 0 ? (
          <p className="muted" style={{ marginBottom: 8 }}>
            אין פריטים במחירון — הוסיפו בלשונית <strong>מחירון</strong>.
          </p>
        ) : null}
        <div className="table-wrap quote-editor-lines-wrap">
          <table className="quote-editor-lines-table">
            <thead>
              <tr>
                <th>פריט</th>
                <th>כמות</th>
                <th>מחיר יחידה ₪</th>
                <th>מחיר ₪ (כמות×יחידה)</th>
                <th aria-label="הסר שורה" />
              </tr>
            </thead>
            <tbody>
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
                  <tr key={row.rowKey}>
                    <td>
                      <select
                        className="table-inline-input quote-editor-select"
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
                            {p.name || '(ללא שם)'}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="table-inline-input quote-editor-qty"
                        inputMode="numeric"
                        value={row.qty}
                        disabled={!row.priceListItemId}
                        onChange={(e) =>
                          setQuoteRows((rows) =>
                            rows.map((r, j) =>
                              j === i
                                ? {
                                    ...r,
                                    qty: Math.max(
                                      1,
                                      Number(e.target.value) || 1,
                                    ),
                                  }
                                : r,
                            ),
                          )
                        }
                      />
                    </td>
                    <td dir="ltr" className="quote-editor-num">
                      {item ? (
                        <>₪{formatIls(item.unitPriceInclVat)}</>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td dir="ltr" className="quote-editor-num quote-editor-line-total">
                      {lineForSum ? (
                        <>₪{formatIls(lineSum(lineForSum))}</>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost quote-editor-remove"
                        onClick={() =>
                          setQuoteRows((rows) => {
                            const next = rows.filter((_, j) => j !== i)
                            return ensureTrailingEmptyRow(
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
        <div style={{ marginTop: 12 }}>
          <label className="field">הערות להצעה</label>
          <input
            value={quoteNotes}
            onChange={(e) => setQuoteNotes(e.target.value)}
            placeholder="תוקף, תנאי תשלום..."
          />
        </div>

        <p className="quote-total-banner">
          <span className="quote-total-main">
            סה״כ:{' '}
            <strong>₪{formatIls(linesTotal(quoteLinesPreview))}</strong>
          </span>
          <span className="muted quote-total-vat-note">
            {' '}
            (מחירים כוללים מע״מ 18%)
          </span>
        </p>
        <div
          className="toolbar"
          style={{ marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}
        >
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveQuote}
          >
            שמור הצעת מחיר
          </button>
          <button
            type="button"
            className="btn"
            disabled={!draftAsQuote}
            onClick={() => draftAsQuote && openPrintForQuote(draftAsQuote)}
          >
            הדפס (טיוטה)
          </button>
          <button
            type="button"
            className="btn"
            disabled={!draftAsQuote || pdfBusy}
            onClick={() => draftAsQuote && void shareAsPdf(draftAsQuote)}
          >
            {pdfBusy ? 'מכין…' : 'שתף PDF (טיוטה)'}
          </button>
        </div>

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
                      {l.description} — כמות {l.qty} — מחיר יחידה ₪
                      {formatIls(l.unitPriceInclVat)} — מחיר ₪
                      {formatIls(lineSum(l))}
                    </li>
                  ))}
                </ul>
                {q.notes ? <p className="meta">{q.notes}</p> : null}
                {q.lines.some((l) => linePriceStale(l, data.priceList)) ? (
                  <p className="meta" style={{ color: 'var(--pri-high, #f59e0b)' }}>
                    מחיר או שם בלשונית «מחירון» השתנו — ליישר את ההצעה הישנה לחצו
                    &quot;עדכן מחירים מהמחירון&quot;.
                  </p>
                ) : null}
                <div className="actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => applyCatalogPricesToQuote(q.id)}
                  >
                    עדכן מחירים מהמחירון
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={pdfBusy}
                    onClick={() => void shareAsPdf(q)}
                  >
                    {pdfBusy ? 'מכין PDF…' : 'שתף PDF'}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={pdfBusy}
                    onClick={() => openPrintForQuote(q)}
                  >
                    הדפס
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

      {printBuffer ? (
        <div className="print-quote-portal" aria-hidden>
          <div
            className="quote-print-sheet quote-print-sheet--solo quote-pdf-capture-root"
            data-quote-pdf-capture="quote-print"
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
                {printBuffer.customerNameSnapshot || '—'}
              </p>
              <p>
                <strong>טלפון:</strong>{' '}
                {printBuffer.customerPhoneSnapshot || '—'}
              </p>
              <p>
                <strong>תאריך:</strong>{' '}
                {formatHebYmd(printBuffer.createdAt.slice(0, 10))}
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
                  {printBuffer.lines.map((l, idx) => {
                    const line = lineVatBreakdown(l.qty, l.unitPriceInclVat)
                    return (
                      <tr key={idx}>
                        <td>{l.description}</td>
                        <td>{l.qty}</td>
                        <td dir="ltr">₪{formatIls(l.unitPriceInclVat)}</td>
                        <td dir="ltr">
                          <strong>₪{formatIls(line.incl)}</strong>
                        </td>
                      </tr>
                    )
                  })}
                  {(() => {
                    const b = totalVatBreakdown(printBuffer.totalInclVat)
                    return (
                      <>
                        <tr className="quote-print-summary">
                          <td colSpan={3}>סה״כ לפני מע״מ</td>
                          <td dir="ltr">
                            ₪{formatIls(b.ex)}
                          </td>
                        </tr>
                        <tr className="quote-print-summary">
                          <td colSpan={3}>מע״מ (18%)</td>
                          <td dir="ltr">
                            ₪{formatIls(b.vat)}
                          </td>
                        </tr>
                        <tr className="quote-print-summary quote-print-summary--final">
                          <td colSpan={3}>סה״כ לתשלום (כולל מע״מ)</td>
                          <td dir="ltr">
                            ₪{formatIls(b.incl)}
                          </td>
                        </tr>
                      </>
                    )
                  })()}
                </tbody>
              </table>
              {printBuffer.notes ? (
                <p className="quote-print-notes">{printBuffer.notes}</p>
              ) : null}
              <p className="quote-print-brand-footer">איאד מזגנים</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
