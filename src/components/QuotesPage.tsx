import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  /** אחרי שינויים ב-Mongo / מכשיר אחר: רענון מלא מ-workspace; מחזיר את הנתונים המרוחקים אחרי כן */
  isRemote?: boolean
  onRefreshFromServer?: () => void | Promise<AppData | null | void>
}

const QUOTE_UNIT_PRICE_EPS = 1e-6

/** שורה בעורך: פריט+כמות; מחיר — ברירת מחדל מהמחירון או עריכה לשורה (נשמר בלשורה) */
type CatalogQuoteRow = {
  rowKey: string
  priceListItemId: string | null
  qty: number
  /** null = מחיר לפי המחירון; מספר = ערך שנשלח בהצעה (כולל התאמות) */
  unitPriceInclVat: number | null
  /** פריט שבהצעה אבל אינו (עוד) במחירון */
  staleLineDescription?: string
}

function emptyRow(): CatalogQuoteRow {
  return {
    rowKey: crypto.randomUUID(),
    priceListItemId: null,
    qty: 1,
    unitPriceInclVat: null,
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

function effectiveRowUnitInEditor(
  row: CatalogQuoteRow,
  item: PriceListItem | null,
): number {
  if (row.staleLineDescription) {
    if (row.unitPriceInclVat === null) return 0
    return row.unitPriceInclVat
  }
  if (!item) return 0
  if (row.unitPriceInclVat === null) return item.unitPriceInclVat
  return row.unitPriceInclVat
}

function rowSavesWithCustomUnitPrice(
  row: CatalogQuoteRow,
  item: PriceListItem | null,
): boolean {
  if (row.staleLineDescription) return true
  if (!item) return false
  if (row.unitPriceInclVat === null) return false
  return (
    Math.abs(row.unitPriceInclVat - item.unitPriceInclVat) > QUOTE_UNIT_PRICE_EPS
  )
}

function lineToEditorRow(
  l: QuoteLine,
  pl: PriceListItem[],
): CatalogQuoteRow {
  const item = l.priceListItemId
    ? pl.find((p) => p.id === l.priceListItemId)
    : undefined
  if (l.priceListItemId && !item) {
    return {
      rowKey: crypto.randomUUID(),
      priceListItemId: l.priceListItemId,
      qty: Math.max(1, l.qty),
      unitPriceInclVat: l.unitPriceInclVat,
      staleLineDescription: l.description,
    }
  }
  if (!l.priceListItemId) {
    return {
      rowKey: crypto.randomUUID(),
      priceListItemId: null,
      qty: Math.max(1, l.qty),
      unitPriceInclVat: l.unitPriceInclVat,
    }
  }
  const u =
    l.useCustomUnitPrice ||
    Math.abs(l.unitPriceInclVat - item!.unitPriceInclVat) > QUOTE_UNIT_PRICE_EPS
      ? l.unitPriceInclVat
      : null
  return {
    rowKey: crypto.randomUUID(),
    priceListItemId: l.priceListItemId,
    qty: Math.max(1, l.qty),
    unitPriceInclVat: u,
  }
}

function quoteToEditorRows(
  q: Quote,
  priceList: PriceListItem[],
): CatalogQuoteRow[] {
  const raw = Array.isArray(q.lines) ? q.lines : []
  if (raw.length === 0) return ensureTrailingEmptyRow([emptyRow()])
  return ensureTrailingEmptyRow(
    raw.map((l) => lineToEditorRow(l, priceList)),
  )
}

function linePriceStale(l: QuoteLine, priceList: PriceListItem[]): boolean {
  if (!l.priceListItemId) return false
  const p = priceList.find((x) => x.id === l.priceListItemId)
  if (!p) return true
  if ((p.name || '') !== l.description) return true
  if (l.useCustomUnitPrice) return false
  return p.unitPriceInclVat !== l.unitPriceInclVat
}

function buildLinesForSave(
  rows: CatalogQuoteRow[],
  priceList: PriceListItem[],
): QuoteLine[] {
  const lines: QuoteLine[] = []
  for (const r of rows) {
    if (r.staleLineDescription && r.priceListItemId) {
      if (r.qty <= 0) continue
      lines.push({
        priceListItemId: r.priceListItemId,
        description: r.staleLineDescription,
        qty: r.qty,
        unitPriceInclVat: r.unitPriceInclVat ?? 0,
        useCustomUnitPrice: true,
      })
      continue
    }
    const item = priceList.find((p) => p.id === r.priceListItemId)
    if (!item || r.qty <= 0) continue
    const unit = effectiveRowUnitInEditor(r, item)
    lines.push({
      priceListItemId: item.id,
      description: item.name,
      qty: r.qty,
      unitPriceInclVat: unit,
      useCustomUnitPrice: rowSavesWithCustomUnitPrice(r, item),
    })
  }
  return lines
}

export function QuotesPage({
  data,
  setData,
  quotesCustomerFocus,
  onQuotesCustomerFocusApplied,
  isRemote,
  onRefreshFromServer,
}: Props) {
  const [newQuoteCustomerId, setNewQuoteCustomerId] = useState('')
  const [newQuoteRows, setNewQuoteRows] = useState<CatalogQuoteRow[]>(() =>
    ensureTrailingEmptyRow([emptyRow()]),
  )
  const [newQuoteNotes, setNewQuoteNotes] = useState('')
  const [editQuoteId, setEditQuoteId] = useState<string | null>(null)
  const [editRows, setEditRows] = useState<CatalogQuoteRow[]>(() =>
    ensureTrailingEmptyRow([emptyRow()]),
  )
  const [editCustomerId, setEditCustomerId] = useState('')
  const [editNotes, setEditNotes] = useState('')
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
    setNewQuoteCustomerId(quotesCustomerFocus.customerId)
    onQuotesCustomerFocusApplied?.()
  }, [quotesCustomerFocus?.nonce, quotesCustomerFocus?.customerId])

  const newQuoteLinesPreview: QuoteLine[] = useMemo(
    () => buildLinesForSave(newQuoteRows, data.priceList),
    [newQuoteRows, data.priceList],
  )

  const newDraftAsQuote: Quote | null = useMemo(() => {
    if (newQuoteLinesPreview.length === 0) return null
    const c = data.customers.find((x) => x.id === newQuoteCustomerId)
    const now = new Date().toISOString()
    return {
      id: 'draft',
      customerId: newQuoteCustomerId || null,
      customerNameSnapshot: c?.name ?? '',
      customerPhoneSnapshot: c?.phone ?? '',
      lines: newQuoteLinesPreview,
      totalInclVat: linesTotal(newQuoteLinesPreview),
      notes: newQuoteNotes.trim(),
      createdAt: now,
      updatedAt: now,
    }
  }, [newQuoteLinesPreview, newQuoteCustomerId, newQuoteNotes, data.customers])

  const editQuoteLinesPreview: QuoteLine[] = useMemo(
    () => buildLinesForSave(editRows, data.priceList),
    [editRows, data.priceList],
  )

  const cancelEdit = useCallback(() => {
    setEditQuoteId(null)
    setEditCustomerId('')
    setEditNotes('')
    setEditRows(ensureTrailingEmptyRow([emptyRow()]))
  }, [])

  useEffect(() => {
    if (!editQuoteId) return
    window.scrollTo(0, 0)
  }, [editQuoteId])

  useEffect(() => {
    if (!editQuoteId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelEdit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editQuoteId, cancelEdit])

  async function handleRefreshFromServer() {
    if (!onRefreshFromServer) return
    setRefreshing(true)
    try {
      const fresh = await onRefreshFromServer()
      if (fresh && Array.isArray(fresh.priceList)) {
        setNewQuoteRows((rows) =>
          rows.map((r) =>
            r.priceListItemId
              ? { ...r, unitPriceInclVat: null }
              : r,
          ),
        )
      }
    } finally {
      setRefreshing(false)
    }
  }

  function applyCatalogToEditingQuote() {
    if (!editQuoteId) return
    setData((d) => {
      const current = d.quotes.find((x) => x.id === editQuoteId)
      if (!current) return d
      const pl = d.priceList
      const next = refreshQuoteFromPriceList(current, pl)
      queueMicrotask(() => {
        setEditRows(quoteToEditorRows(next, pl))
      })
      return {
        ...d,
        quotes: d.quotes.map((q) =>
          q.id === editQuoteId ? next : q,
        ),
      }
    })
  }

  function beginEditQuote(q: Quote) {
    if (!q.id) {
      alert('אין מזהה להצעה — לא ניתן לערוך')
      return
    }
    if (editQuoteId === q.id) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    try {
      setEditQuoteId(q.id)
      setEditCustomerId(q.customerId || '')
      setEditNotes(q.notes ?? '')
      setEditRows(quoteToEditorRows(q, data.priceList))
    } catch (e) {
      console.error(e)
      alert('שגיאה בטעינת ההצעה לעריכה')
    }
  }

  function saveNewQuote() {
    if (!newQuoteCustomerId) {
      alert('נא לבחור לקוח — ההצעה נשמרת משויכת ללקוח.')
      return
    }
    const lines = buildLinesForSave(newQuoteRows, data.priceList)
    if (lines.length === 0) {
      if (data.priceList.length === 0) {
        alert('אין פריטים במחירון — הוסיפו פריטים בלשונית «מחירון» ואז חזרו לכאן.')
      } else {
        alert('נא לבחור לפחות פריט אחד מהמחירון.')
      }
      return
    }
    const c: Customer | undefined = data.customers.find(
      (x) => x.id === newQuoteCustomerId,
    )
    const now = new Date().toISOString()
    const q: Quote = {
      id: crypto.randomUUID(),
      customerId: newQuoteCustomerId,
      customerNameSnapshot: c?.name ?? '',
      customerPhoneSnapshot: c?.phone ?? '',
      lines,
      totalInclVat: linesTotal(lines),
      notes: newQuoteNotes.trim(),
      createdAt: now,
      updatedAt: now,
    }
    setData((d) => ({ ...d, quotes: [q, ...d.quotes] }))
    setNewQuoteRows(ensureTrailingEmptyRow([emptyRow()]))
    setNewQuoteNotes('')
    alert('ההצעה נשמרה')
  }

  function saveEditQuote() {
    if (!editQuoteId) return
    if (!editCustomerId) {
      alert('נא לבחור לקוח — ההצעה נשמרת משויכת ללקוח.')
      return
    }
    const lines = buildLinesForSave(editRows, data.priceList)
    if (lines.length === 0) {
      if (data.priceList.length === 0) {
        alert('אין פריטים במחירון — הוסיפו פריטים בלשונית «מחירון» ואז חזרו לכאן.')
      } else {
        alert('נא לבחור לפחות פריט אחד מהמחירון.')
      }
      return
    }
    const c: Customer | undefined = data.customers.find(
      (x) => x.id === editCustomerId,
    )
    const now = new Date().toISOString()
    setData((d) => ({
      ...d,
      quotes: d.quotes.map((q) =>
        q.id === editQuoteId
          ? {
              ...q,
              customerId: editCustomerId,
              customerNameSnapshot: c?.name ?? '',
              customerPhoneSnapshot: c?.phone ?? '',
              lines,
              totalInclVat: linesTotal(lines),
              notes: editNotes.trim(),
              updatedAt: now,
            }
          : q,
      ),
    }))
    cancelEdit()
    alert('ההצעה עודכנה')
  }

  function deleteQuote(id: string) {
    if (!confirm('למחוק הצעת מחיר זו?')) return
    if (editQuoteId === id) cancelEdit()
    setData((d) => ({ ...d, quotes: d.quotes.filter((q) => q.id !== id) }))
  }

  async function openPrintForQuote(q: Quote) {
    setPrintBuffer(q)
    await waitAnimationFrames(3)
    try {
      window.print()
    } finally {
      setTimeout(() => setPrintBuffer(null), 500)
    }
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

  const renderQuoteRowsTable = (
    rows: CatalogQuoteRow[],
    setRows: Dispatch<SetStateAction<CatalogQuoteRow[]>>,
  ) => (
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
          {rows.map((row, i) => {
            const item = row.priceListItemId
              ? (data.priceList.find((p) => p.id === row.priceListItemId) ??
                null)
              : null
            const lineForSum: QuoteLine | null = row.staleLineDescription
              ? {
                  priceListItemId: row.priceListItemId,
                  description: row.staleLineDescription,
                  qty: row.qty,
                  unitPriceInclVat: effectiveRowUnitInEditor(row, null),
                }
              : item
                ? {
                    priceListItemId: item.id,
                    description: item.name,
                    qty: row.qty,
                    unitPriceInclVat: effectiveRowUnitInEditor(row, item),
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
                      setRows((rws) => {
                        const next = rws.map((r, j) =>
                          j === i
                            ? {
                                ...r,
                                priceListItemId: v || null,
                                unitPriceInclVat: null,
                                staleLineDescription: undefined,
                              }
                            : r,
                        )
                        const isLast = i === rws.length - 1
                        if (v && isLast) {
                          return ensureTrailingEmptyRow(next)
                        }
                        return next
                      })
                    }}
                  >
                    <option value="">— בחרו פריט —</option>
                    {row.staleLineDescription && row.priceListItemId ? (
                      <option value={row.priceListItemId}>
                        {row.staleLineDescription} (הוסר מהמחירון — בחרו אחר)
                      </option>
                    ) : null}
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
                      setRows((rws) =>
                        rws.map((r, j) =>
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
                </td>
                <td dir="ltr" className="quote-editor-num">
                  {item || row.staleLineDescription ? (
                    <input
                      className="table-inline-input quote-editor-unit"
                      inputMode="decimal"
                      style={{ textAlign: 'left' }}
                      value={String(
                        effectiveRowUnitInEditor(row, item),
                      )}
                      onChange={(e) => {
                        const n =
                          Number(
                            e.target.value.replace(',', '.'),
                          ) || 0
                        setRows((rws) =>
                          rws.map((r, j) =>
                            j === i
                              ? { ...r, unitPriceInclVat: n }
                              : r,
                          ),
                        )
                      }}
                    />
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td
                  dir="ltr"
                  className="quote-editor-num quote-editor-line-total"
                >
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
                      setRows((rws) => {
                        const next = rws.filter((_, j) => j !== i)
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
  )

  const editingQuote = editQuoteId
    ? data.quotes.find((q) => q.id === editQuoteId)
    : undefined

  return (
    <div className="quotes-page">
      {editQuoteId ? (
        <main className="quote-edit-full">
          <div className="quote-edit-full-bar">
            <button
              type="button"
              className="btn quote-edit-back"
              onClick={cancelEdit}
            >
              ← חזרה
            </button>
            <h2 className="section-title quote-edit-full-title">
              עריכת הצעה
              {editingQuote ? (
                <span className="quote-edit-full-sub">
                  · {editingQuote.customerNameSnapshot || 'ללא שם'} ·{' '}
                  {formatHebYmd(editingQuote.createdAt.slice(0, 10))}
                </span>
              ) : null}
            </h2>
          </div>
          <p className="muted section-subcount">
            <strong>חזרה</strong> — יוצאים בלי לשמור.{' '}
            <strong>שמור שינויים</strong> — לעדכן את הרשומה.{' '}
            <strong>עדכן ממחירון</strong> — מיישר מחירים לפי המחירון. Esc לסגור.
          </p>
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className="btn"
              onClick={applyCatalogToEditingQuote}
            >
              עדכן מחירים מהמחירון
            </button>
          </div>
          <div className="form-grid two">
            <div>
              <label className="field">לקוח (חובה לשמירה)</label>
              <select
                value={editCustomerId}
                onChange={(e) => setEditCustomerId(e.target.value)}
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
          {renderQuoteRowsTable(editRows, setEditRows)}
          <div style={{ marginTop: 12 }}>
            <label className="field">הערות להצעה</label>
            <input
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="תוקף, תנאי תשלום..."
            />
          </div>
          <p className="quote-total-banner">
            <span className="quote-total-main">
              סה״כ:{' '}
              <strong>₪{formatIls(linesTotal(editQuoteLinesPreview))}</strong>
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
              onClick={saveEditQuote}
            >
              שמור שינויים
            </button>
          </div>
        </main>
      ) : (
      <main>
        <p className="muted section-subcount" style={{ marginTop: 0 }}>
          <strong>רענן</strong> מעדכן מהענן ומיישר <strong>טיוטה חדשה</strong>{' '}
          למחירון. <strong>עריכה</strong> — מסך נפרד אחרי «ערוך» בכרטיס.
        </p>
        {isRemote && onRefreshFromServer ? (
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className="btn"
              onClick={() => void handleRefreshFromServer()}
              disabled={refreshing}
            >
              {refreshing ? 'טוען…' : 'רענן ממחירון (ענן)'}
            </button>
            <span className="muted" style={{ fontSize: '0.9rem' }}>
              אחרי שינוי מחירון ממקום אחר — רענון כאן, והטיוטה תשקף מחירים
              מעודכנים.
            </span>
          </div>
        ) : null}

        <h2 className="section-title">הצעת מחיר חדשה (טיוטה)</h2>
        <p className="muted section-subcount">
          <strong>לקוח</strong> (חובה) · פריט · מחיר לשורה לפי מחירון או ידני.{' '}
          <strong>שמור</strong> מוסיף לרשימה למטה. <strong>עריכה</strong> — דרך
          «ערוך» בכרטיס (מסך נפרד).
        </p>
        <div className="form-grid two">
          <div>
            <label className="field">לקוח (חובה לשמירה)</label>
            <select
              value={newQuoteCustomerId}
              onChange={(e) => setNewQuoteCustomerId(e.target.value)}
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
        {renderQuoteRowsTable(newQuoteRows, setNewQuoteRows)}
        <div style={{ marginTop: 12 }}>
          <label className="field">הערות להצעה</label>
          <input
            value={newQuoteNotes}
            onChange={(e) => setNewQuoteNotes(e.target.value)}
            placeholder="תוקף, תנאי תשלום..."
          />
        </div>

        <p className="quote-total-banner">
          <span className="quote-total-main">
            סה״כ:{' '}
            <strong>₪{formatIls(linesTotal(newQuoteLinesPreview))}</strong>
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
            onClick={saveNewQuote}
          >
            שמור הצעת מחיר
          </button>
          <button
            type="button"
            className="btn"
            disabled={!newDraftAsQuote}
            onClick={() => newDraftAsQuote && openPrintForQuote(newDraftAsQuote)}
          >
            הדפס (טיוטה)
          </button>
          <button
            type="button"
            className="btn"
            disabled={!newDraftAsQuote || pdfBusy}
            onClick={() => newDraftAsQuote && void shareAsPdf(newDraftAsQuote)}
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
                    שם/מחיר במחירון כבר לא תואמים — פתחו <strong>ערוך</strong>{' '}
                    ויישרו שם.
                  </p>
                ) : null}
                <div className="actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => beginEditQuote(q)}
                  >
                    {editQuoteId === q.id ? 'המשך בעריכה' : 'ערוך'}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={pdfBusy}
                    onClick={() => void shareAsPdf(q)}
                  >
                    {pdfBusy ? 'מכין PDF…' : 'שתף PDF'}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={pdfBusy}
                    onClick={() => void openPrintForQuote(q)}
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
      )}

      {printBuffer ? (
        <div className="print-quote-portal">
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
    </div>
  )
}
