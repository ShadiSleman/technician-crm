import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnalysisCharts } from './components/AnalysisCharts'
import { ColorLegend } from './components/ColorLegend'
import { PriceCatalogPage } from './components/PriceCatalogPage'
import { QuotesPage } from './components/QuotesPage'
import { TabNavIcon } from './components/TabNavIcon'
import { WorkCalendar, type CalMode } from './components/WorkCalendar'
import {
  GROUP_LABEL,
  PAYMENT_METHOD_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
} from './copy'
import { createDemoData } from './demo'
import { addDaysYmd, formatHebYmd, todayYmd } from './dates'
import {
  dedupePriceList,
  exportJson,
  importAppData,
  loadAppData,
  mergeInitialPriceListSeed,
  normalizeAppData,
  saveAppData,
} from './storage'
import { pickDeviceContact } from './pickDeviceContact'
import type {
  AppData,
  CallLog,
  Customer,
  CustomerStatus,
  PaymentMethod,
  Priority,
  Transaction,
  WorkGroup,
} from './types'
import { formatIls } from './quoteUtils'
import {
  PRIORITY_ORDER,
  customerBalance,
  customerPaymentTotals,
  emptyAppData,
} from './types'

type Tab =
  | 'dashboard'
  | 'insights'
  | 'customers'
  | 'pricelist'
  | 'quotes'
  | 'billing'
  | 'calendar'
  | 'backup'

function getInitialData() {
  const loaded = loadAppData()
  if (
    loaded.customers.length === 0 &&
    loaded.transactions.length === 0 &&
    loaded.meetings.length === 0 &&
    loaded.callLogs.length === 0 &&
    loaded.priceList.length === 0 &&
    loaded.quotes.length === 0
  ) {
    return createDemoData()
  }
  return loaded
}

function sortCustomers(list: Customer[]): Customer[] {
  return [...list].sort((a, b) => {
    const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (pd !== 0) return pd
    if (a.callbackDate && b.callbackDate) {
      return a.callbackDate.localeCompare(b.callbackDate)
    }
    if (a.callbackDate) return -1
    if (b.callbackDate) return 1
    return a.name.localeCompare(b.name, 'he')
  })
}

function priorityRowClass(p: Priority): string {
  switch (p) {
    case 'critical':
      return 'pri-critical'
    case 'high':
      return 'pri-high'
    case 'medium':
      return 'pri-medium'
    default:
      return 'pri-low'
  }
}

function emptyCustomer(): Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: '',
    phone: '',
    address: '',
    priority: 'medium',
    group: 'service',
    status: 'new',
    notes: '',
    callbackDate: null,
  }
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

function findCustomerIdByPhone(
  phone: string,
  customers: Customer[],
): string | null {
  const d = digitsOnly(phone)
  if (d.length < 7) return null
  const c = customers.find((x) => {
    const xd = digitsOnly(x.phone)
    return xd === d || xd.endsWith(d.slice(-9)) || d.endsWith(xd.slice(-9))
  })
  return c?.id ?? null
}

type AppProps = {
  /** כתובת API (כולל /api) — כשמוגדרת ב-VITE_API_URL */
  remoteApiBase?: string
  remoteToken?: string
  onRemoteLogout?: () => void
}

export default function App({
  remoteApiBase,
  remoteToken,
  onRemoteLogout,
}: AppProps = {}) {
  const isRemote = Boolean(
    remoteApiBase && remoteToken && onRemoteLogout,
  )

  const [data, setData] = useState<AppData>(() =>
    isRemote ? emptyAppData() : getInitialData(),
  )

  const remoteHydrated = useRef(false)
  const remoteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [customerModal, setCustomerModal] = useState<{
    mode: 'new' | 'edit'
    id?: string
    draft: ReturnType<typeof emptyCustomer>
  } | null>(null)
  const [callContext, setCallContext] = useState<{
    phone: string
    note: string
  } | null>(null)
  const [callModal, setCallModal] = useState(false)
  const [callDraft, setCallDraft] = useState({ phone: '', note: '' })

  const [filterGroup, setFilterGroup] = useState<WorkGroup | 'all'>('all')
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<CustomerStatus | 'all'>(
    'all',
  )
  const [onlyOverdue, setOnlyOverdue] = useState(false)

  const [dashOpen, setDashOpen] = useState({
    work: false,
    calls: false,
  })

  const [addCustomerStep, setAddCustomerStep] = useState<
    null | 'choose' | 'paste'
  >(null)
  const [phonePasteDraft, setPhonePasteDraft] = useState('')

  const [calMode, setCalMode] = useState<CalMode>('week')
  const [calAnchor, setCalAnchor] = useState(() => new Date())

  const [txDraft, setTxDraft] = useState({
    customerId: '' as string,
    type: 'charge' as 'charge' | 'payment',
    amount: '',
    description: '',
    date: todayYmd(),
    paymentMethod: 'cash' as PaymentMethod,
    reference: '',
  })

  const [payTrackCustomerId, setPayTrackCustomerId] = useState('')

  const [meetDraft, setMeetDraft] = useState({
    customerId: '' as string,
    title: '',
    startAt: '',
    notes: '',
  })

  const [quotesCustomerFocus, setQuotesCustomerFocus] = useState<{
    customerId: string
    nonce: number
  } | null>(null)

  useEffect(() => {
    if (!isRemote || !remoteApiBase || !remoteToken || !onRemoteLogout) {
      remoteHydrated.current = true
      return
    }
    let cancelled = false
    remoteHydrated.current = false
    void (async () => {
      try {
        const r = await fetch(`${remoteApiBase}/workspace`, {
          headers: { Authorization: `Bearer ${remoteToken}` },
        })
        if (r.status === 401) {
          onRemoteLogout()
          return
        }
        if (!r.ok) {
          console.warn('[CRM] טעינה מהשרת', r.status, '— מציג נתונים מקומיים')
          if (!cancelled) {
            setData(mergeInitialPriceListSeed(loadAppData()))
            remoteHydrated.current = true
          }
          return
        }
        const body = (await r.json()) as { data?: unknown }
        if (cancelled) return
        const normalized = normalizeAppData(
          (body.data ?? null) as Partial<AppData> | null,
        )
        setData(mergeInitialPriceListSeed(normalized))
      } catch (e) {
        console.warn('[CRM] טעינה מהשרת — שגיאת רשת, נתונים מקומיים', e)
        if (!cancelled) {
          setData(mergeInitialPriceListSeed(loadAppData()))
        }
      } finally {
        if (!cancelled) remoteHydrated.current = true
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isRemote, remoteApiBase, remoteToken, onRemoteLogout])

  useEffect(() => {
    const pl = dedupePriceList(data.priceList)
    const same =
      pl.length === data.priceList.length &&
      pl.every((p, i) => p.id === data.priceList[i]?.id)
    if (!same) {
      setData((d) => ({ ...d, priceList: pl }))
      return
    }
    if (!isRemote || remoteHydrated.current) {
      saveAppData(data)
    }
    if (
      isRemote &&
      remoteHydrated.current &&
      remoteApiBase &&
      remoteToken &&
      onRemoteLogout
    ) {
      if (remoteSaveTimer.current) clearTimeout(remoteSaveTimer.current)
      remoteSaveTimer.current = setTimeout(() => {
        void (async () => {
          try {
            const r = await fetch(`${remoteApiBase}/workspace`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${remoteToken}`,
              },
              body: JSON.stringify({ data }),
            })
            if (r.status === 401) onRemoteLogout()
            else if (!r.ok) {
              const errText = await r.text().catch(() => '')
              console.warn(
                '[CRM] שמירה לשרת נכשלה',
                r.status,
                errText.slice(0, 200),
              )
            }
          } catch (e) {
            console.warn('[CRM] שמירה לשרת — שגיאת רשת', e)
          }
        })()
      }, 600)
    }
  }, [data, isRemote, remoteApiBase, remoteToken, onRemoteLogout])

  const uiRef = useRef({
    callModal: false,
    addCustomerStep: null as null | 'choose' | 'paste',
    customerModal: false,
    tab: 'dashboard' as Tab,
  })
  uiRef.current = {
    callModal,
    addCustomerStep,
    customerModal: customerModal != null,
    tab,
  }

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const sub = CapacitorApp.addListener('backButton', () => {
      const u = uiRef.current
      if (u.callModal) {
        setCallModal(false)
        return
      }
      if (u.addCustomerStep === 'paste') {
        setAddCustomerStep('choose')
        return
      }
      if (u.addCustomerStep === 'choose') {
        setAddCustomerStep(null)
        return
      }
      if (u.customerModal) {
        setCallContext(null)
        setAddCustomerStep(null)
        setCustomerModal(null)
        return
      }
      if (u.tab !== 'dashboard') {
        setTab('dashboard')
        return
      }
      void CapacitorApp.exitApp()
    })
    return () => {
      void sub.then((h: { remove: () => Promise<void> }) => h.remove())
    }
  }, [])

  const customersSorted = useMemo(
    () => sortCustomers(data.customers),
    [data.customers],
  )

  const filteredCustomers = useMemo(() => {
    return customersSorted.filter((c) => {
      if (filterGroup !== 'all' && c.group !== filterGroup) return false
      if (filterPriority !== 'all' && c.priority !== filterPriority)
        return false
      if (filterStatus !== 'all' && c.status !== filterStatus) return false
      if (onlyOverdue) {
        if (
          !(
            c.callbackDate &&
            c.callbackDate < todayYmd() &&
            c.status !== 'done'
          )
        ) {
          return false
        }
      }
      return true
    })
  }, [
    customersSorted,
    filterGroup,
    filterPriority,
    filterStatus,
    onlyOverdue,
  ])

  const today = todayYmd()

  const dashboard = useMemo(() => {
    const open = data.customers.filter((c) => c.status !== 'done')
    const dueToday = open.filter((c) => c.callbackDate === today)
    const overdue = open.filter(
      (c) => c.callbackDate && c.callbackDate < today,
    )
    const balances = data.customers.map((c) => ({
      c,
      bal: customerBalance(c.id, data.transactions),
    }))
    const owed = balances.filter((b) => b.bal > 0)
    const totalOwed = owed.reduce((s, b) => s + b.bal, 0)
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)
    const meetingsToday = data.meetings.filter((m) => {
      const d = new Date(m.startAt)
      return d >= startOfDay && d <= endOfDay
    })
    const installOpen = open.filter((c) => c.group === 'installation')
    return {
      dueToday,
      overdue,
      installOpenCount: installOpen.length,
      totalOwed,
      owedCount: owed.length,
      meetingsToday,
    }
  }, [data.customers, data.meetings, data.transactions, today])

  const callbackBuckets = useMemo(() => {
    const open = data.customers.filter((c) => c.status !== 'done')
    const overdue = open.filter(
      (c) => c.callbackDate && c.callbackDate < today,
    )
    const dueToday = open.filter((c) => c.callbackDate === today)
    const other = open.filter((c) => {
      if (!c.callbackDate) return true
      if (c.callbackDate < today) return false
      if (c.callbackDate === today) return false
      return true
    })
    return {
      overdue: sortCustomers(overdue),
      dueToday: sortCustomers(dueToday),
      other: sortCustomers(other),
      totalOpen: open.length,
    }
  }, [data.customers, today])

  const recentCalls = useMemo(
    () =>
      [...data.callLogs].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      ),
    [data.callLogs],
  )

  const paymentTracker = useMemo(() => {
    if (!payTrackCustomerId) return null
    const txs = data.transactions
      .filter((t) => t.customerId === payTrackCustomerId)
      .sort((a, b) => a.date.localeCompare(b.date))
    let charged = 0
    let paid = 0
    for (const t of txs) {
      if (t.type === 'charge') charged += t.amount
      else paid += t.amount
    }
    return {
      txs,
      charged,
      paid,
      balance: charged - paid,
    }
  }, [payTrackCustomerId, data.transactions])

  function upsertCustomer(
    id: string | undefined,
    payload: ReturnType<typeof emptyCustomer>,
  ) {
    const now = new Date().toISOString()
    if (id) {
      setData((d) => ({
        ...d,
        customers: d.customers.map((c) =>
          c.id === id
            ? {
                ...c,
                ...payload,
                updatedAt: now,
              }
            : c,
        ),
      }))
      setCallContext(null)
    } else {
      const newId = crypto.randomUUID()
      const logFromCall =
        callContext &&
        ({
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          direction: 'in' as const,
          phone: callContext.phone.trim() || payload.phone.trim(),
          note: callContext.note.trim() || 'נוצר משיחה נכנסת',
          customerId: newId,
        } satisfies CallLog)
      setData((d) => ({
        ...d,
        customers: [
          ...d.customers,
          {
            id: newId,
            ...payload,
            createdAt: now,
            updatedAt: now,
          },
        ],
        callLogs: logFromCall ? [logFromCall, ...d.callLogs] : d.callLogs,
      }))
      setCallContext(null)
    }
    setCustomerModal(null)
  }

  function deleteCustomer(id: string) {
    if (!confirm('למחוק לקוח? פעולה בלתי הפיכה.')) return
    setData((d) => ({
      ...d,
      customers: d.customers.filter((c) => c.id !== id),
      transactions: d.transactions.map((t) =>
        t.customerId === id ? { ...t, customerId: null } : t,
      ),
      meetings: d.meetings.map((m) =>
        m.customerId === id ? { ...m, customerId: null } : m,
      ),
      callLogs: d.callLogs.map((cl) =>
        cl.customerId === id ? { ...cl, customerId: null } : cl,
      ),
    }))
    setCustomerModal(null)
  }

  function snoozeCustomer(c: Customer) {
    const base = c.callbackDate ?? today
    const next = addDaysYmd(base, 1)
    patchCustomer(c.id, { callbackDate: next })
  }

  function markCalledBack(c: Customer) {
    patchCustomer(c.id, {
      callbackDate: null,
      status: c.status === 'callback' ? 'scheduled' : c.status,
    })
  }

  function patchCustomer(id: string, partial: Partial<Customer>) {
    const now = new Date().toISOString()
    setData((d) => ({
      ...d,
      customers: d.customers.map((c) =>
        c.id === id ? { ...c, ...partial, updatedAt: now } : c,
      ),
    }))
  }

  function addTransaction() {
    const amount = Number(txDraft.amount.replace(',', '.'))
    if (!amount || amount <= 0) {
      alert('נא להזין סכום תקין')
      return
    }
    const tx: Transaction = {
      id: crypto.randomUUID(),
      customerId: txDraft.customerId || null,
      type: txDraft.type,
      amount,
      description: txDraft.description.trim() || 'ללא תיאור',
      date: txDraft.date,
    }
    if (txDraft.type === 'payment') {
      tx.paymentMethod = txDraft.paymentMethod
      const ref = txDraft.reference.trim()
      if (ref) tx.reference = ref
    }
    setData((d) => ({ ...d, transactions: [tx, ...d.transactions] }))
    setTxDraft({
      customerId: txDraft.customerId,
      type: 'charge',
      amount: '',
      description: '',
      date: todayYmd(),
      paymentMethod: 'cash',
      reference: '',
    })
  }

  function deleteTransaction(id: string) {
    setData((d) => ({
      ...d,
      transactions: d.transactions.filter((t) => t.id !== id),
    }))
  }

  function addMeeting() {
    if (!meetDraft.title.trim()) {
      alert('נא להזין כותרת')
      return
    }
    let startAt = meetDraft.startAt
    if (!startAt) {
      const d = new Date()
      d.setMinutes(0, 0, 0)
      d.setHours(d.getHours() + 1)
      startAt = d.toISOString().slice(0, 16)
    }
    const iso = new Date(startAt).toISOString()
    setData((d) => ({
      ...d,
      meetings: [
        {
          id: crypto.randomUUID(),
          customerId: meetDraft.customerId || null,
          title: meetDraft.title.trim(),
          startAt: iso,
          notes: meetDraft.notes.trim(),
        },
        ...d.meetings,
      ],
    }))
    setMeetDraft({
      customerId: meetDraft.customerId,
      title: '',
      startAt: '',
      notes: '',
    })
  }

  function deleteMeeting(id: string) {
    setData((d) => ({
      ...d,
      meetings: d.meetings.filter((m) => m.id !== id),
    }))
  }

  function customerName(id: string | null): string {
    if (!id) return '—'
    return data.customers.find((c) => c.id === id)?.name ?? '—'
  }

  function openNewCustomer() {
    setCallContext(null)
    setAddCustomerStep(null)
    setCustomerModal({ mode: 'new', draft: emptyCustomer() })
  }

  function openAddCustomerMenu() {
    setAddCustomerStep('choose')
    setPhonePasteDraft('')
  }

  async function openNewCustomerFromDeviceContact() {
    const res = await pickDeviceContact()
    if (!res) {
      if (Capacitor.isNativePlatform()) {
        alert(
          'לא נבחר איש קשר או חסרה הרשאה. נפתח בורר אנשי הקשר של המכשיר — אנשי קשר שמופיעים שם כוללים גם כאלה שנשמרו מ־Truecaller (כשמסנכרנים לאנשי הקשר). אין גישה ישירה לאפליקציית Truecaller עצמה.',
        )
      } else {
        alert(
          'בחירה מרשימת אנשי קשר זמינה באפליקציה על האנדרואיד. בדפדפן השתמשו בהזנה ידנית.',
        )
      }
      return
    }
    setAddCustomerStep(null)
    setPhonePasteDraft('')
    const phone =
      res.phone && digitsOnly(res.phone).length >= 7
        ? formatPhoneFromDigits(res.phone)
        : ''
    setCustomerModal({
      mode: 'new',
      draft: {
        ...emptyCustomer(),
        name: res.name,
        phone,
      },
    })
  }

  function formatPhoneFromDigits(d: string): string {
    const core = d.replace(/\D/g, '')
    let n = core
    if (n.startsWith('972') && n.length >= 11) n = `0${n.slice(3)}`
    if (n.length >= 9) {
      const last = n.slice(-9)
      return `${last.slice(0, 3)}-${last.slice(3, 6)}-${last.slice(6, 10)}`
    }
    if (n.length >= 7) return n
    return ''
  }

  async function pastePhoneFromClipboard() {
    try {
      const t = await navigator.clipboard.readText()
      const f = formatPhoneFromDigits(t)
      if (f) setPhonePasteDraft(f)
      else alert('לא זיהינו מספר טלפון בלוח. נסו להעתיק רק את המספר.')
    } catch {
      alert(
        'לא ניתן לקרוא את הלוח. אפשר לאשר הרשאה בדפדפן/אפליקציה, או להקליד את המספר ידנית.',
      )
    }
  }

  function confirmPastedPhoneCustomer() {
    const f = formatPhoneFromDigits(phonePasteDraft)
    if (!f || digitsOnly(f).length < 7) {
      alert('נא להזין או להדביק מספר טלפון תקין')
      return
    }
    setAddCustomerStep(null)
    setPhonePasteDraft('')
    setCustomerModal({
      mode: 'new',
      draft: {
        ...emptyCustomer(),
        phone: f,
        status: 'callback',
        priority: 'high',
        callbackDate: todayYmd(),
        notes: 'מיומן השיחות בטלפון',
      },
    })
  }

  function openEditCustomer(c: Customer) {
    setCallContext(null)
    setCustomerModal({
      mode: 'edit',
      id: c.id,
      draft: {
        name: c.name,
        phone: c.phone,
        address: c.address,
        priority: c.priority,
        group: c.group,
        status: c.status,
        notes: c.notes,
        callbackDate: c.callbackDate,
      },
    })
  }

  function saveCallLogOnly() {
    const phone = callDraft.phone.trim()
    if (!phone) {
      alert('נא להזין מספר טלפון')
      return
    }
    const matched = findCustomerIdByPhone(phone, data.customers)
    const entry: CallLog = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      direction: 'in',
      phone,
      note: callDraft.note.trim() || 'שיחה נכנסת',
      customerId: matched,
    }
    setData((d) => ({ ...d, callLogs: [entry, ...d.callLogs] }))
    setCallDraft({ phone: '', note: '' })
    setCallModal(false)
  }

  function startNewCustomerFromCall() {
    const phone = callDraft.phone.trim()
    const note = callDraft.note.trim()
    if (!phone) {
      alert('נא להזין מספר טלפון')
      return
    }
    setCallContext({
      phone,
      note: note || 'שיחה נכנסת',
    })
    setCallDraft({ phone: '', note: '' })
    setCallModal(false)
    setCustomerModal({
      mode: 'new',
      draft: {
        ...emptyCustomer(),
        phone,
        status: 'callback',
        priority: 'high',
        callbackDate: todayYmd(),
        notes: note || '',
      },
    })
  }

  function renderCustomerCard(c: Customer, compact = false) {
    const bal = customerBalance(c.id, data.transactions)
    const pay = customerPaymentTotals(c.id, data.transactions)
    const hasPaymentActivity = pay.charged > 0 || pay.paid > 0
    const overdue =
      c.callbackDate && c.callbackDate < today && c.status !== 'done'
    const quotesForCustomer = data.quotes.filter((q) => q.customerId === c.id)
    return (
      <motion.article
        key={c.id}
        layout
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className={`customer-card ${priorityRowClass(c.priority)}`}
      >
        <header>
          <h3>{c.name}</h3>
          <div className="badges">
            <span className="badge">{GROUP_LABEL[c.group]}</span>
            <span className="badge">{STATUS_LABEL[c.status]}</span>
            <span className="badge">{PRIORITY_LABEL[c.priority]}</span>
          </div>
        </header>
        <p className="meta">
          <a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a>
          {c.address ? ` · ${c.address}` : ''}
        </p>
        {c.callbackDate ? (
          <p className={overdue ? 'meta pill-overdue' : 'meta'}>
            חזרה: {formatHebYmd(c.callbackDate)}
            {overdue ? ' · באיחור' : c.callbackDate === today ? ' · היום' : ''}
          </p>
        ) : null}
        {hasPaymentActivity ? (
          <div className="customer-pay-summary">
            <p className="meta customer-pay-lines">
              חיובים כולל:{' '}
              <strong>₪{pay.charged.toLocaleString('he-IL')}</strong>
              {' · '}שולם:{' '}
              <strong>₪{pay.paid.toLocaleString('he-IL')}</strong>
              {' · '}נשאר:{' '}
              <strong
                className={pay.balance > 0 ? 'pill-overdue-inline' : undefined}
              >
                {pay.balance > 0
                  ? `₪${pay.balance.toLocaleString('he-IL')} חוב`
                  : pay.balance < 0
                    ? `־₪${Math.abs(pay.balance).toLocaleString('he-IL')} זכות`
                    : 'אפס'}
              </strong>
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setPayTrackCustomerId(c.id)
                setTab('billing')
              }}
            >
              פירוט ועריכת תשלומים
            </button>
          </div>
        ) : bal !== 0 ? (
          <p className="meta">
            יתרה:{' '}
            <strong>
              {bal > 0
                ? `חוב ₪${bal.toLocaleString('he-IL')}`
                : `זכות ₪${Math.abs(bal).toLocaleString('he-IL')}`}
            </strong>
          </p>
        ) : null}
        {!compact && c.notes ? (
          <p className="meta">{c.notes}</p>
        ) : null}
        {!compact ? (
          <div
            className="customer-quotes-cta"
            style={{ marginTop: 12, marginBottom: 4 }}
          >
            <p className="meta" style={{ marginBottom: 8 }}>
              הצעות מחיר משויכות:{' '}
              <strong>
                {quotesForCustomer.length === 0
                  ? 'אין'
                  : `${quotesForCustomer.length} (${quotesForCustomer
                      .slice(0, 2)
                      .map(
                        (q) =>
                          `${formatHebYmd(q.createdAt.slice(0, 10))} ₪${formatIls(q.totalInclVat)}`,
                      )
                      .join(' · ')}${quotesForCustomer.length > 2 ? '…' : ''})`}
              </strong>
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setQuotesCustomerFocus({
                  customerId: c.id,
                  nonce: Date.now(),
                })
                setTab('quotes')
              }}
            >
              {quotesForCustomer.length > 0
                ? `פתח בלשונית הצעות (${quotesForCustomer.length})`
                : 'הצעת מחיר ללקוח'}
            </button>
          </div>
        ) : null}
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openEditCustomer(c)}
          >
            עריכה
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => markCalledBack(c)}
          >
            חזרתי
          </button>
          <button type="button" className="btn" onClick={() => snoozeCustomer(c)}>
            דחה יום
          </button>
        </div>
      </motion.article>
    )
  }

  return (
    <div className="app-shell" data-active-tab={tab}>
      <header className="app-header">
        <div className="app-brand">
          <h1 className="app-title">מעקב לקוחות · מזגנים</h1>
          <div className="app-header-actions">
            <button
              type="button"
              className="btn btn-ghost header-mini-btn"
              onClick={() => setCallModal(true)}
            >
              שיחה ליומן
            </button>
          </div>
        </div>
        <nav className="tabs" aria-label="ניווט ראשי">
          {(
            [
              ['dashboard', 'לוח בקרה'],
              ['customers', 'לקוחות'],
              ['pricelist', 'מחירון'],
              ['quotes', 'הצעות מחיר'],
              ['billing', 'חיובים'],
              ['calendar', 'יומן'],
              ['insights', 'ניתוח'],
              ['backup', 'גיבוי'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`tab ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
            >
              <span className="tab-icon" aria-hidden>
                <TabNavIcon id={id} />
              </span>
              {label}
            </button>
          ))}
        </nav>
      </header>

      {!isRemote && (
        <div className="local-only-banner" role="status">
          <strong>מצב מקומי.</strong> אין שרת או שאתה לא מחובר — הלקוחות נשמרים
          רק במכשיר (localStorage) ולא יופיעו ב-Mongo. הגדר
          <code> VITE_API_URL </code> והתחבר, או השתמש ב־<code>app-config.json</code>
          + התחברות.
        </div>
      )}

      {tab === 'dashboard' && (
        <main>
          <h2 className="section-title">סיכום מהיר</h2>
          <div className="cards cards-grid-2">
            {[
              {
                k: 'overdue',
                v: dashboard.overdue.length,
                l: 'באיחור',
                sub: 'תאריך החזרה לפני היום',
                danger: true,
                onClick: () => {
                  setFilterGroup('all')
                  setFilterPriority('all')
                  setFilterStatus('all')
                  setOnlyOverdue(true)
                  setTab('customers')
                },
              },
              {
                k: 'today',
                v:
                  dashboard.dueToday.length + dashboard.meetingsToday.length,
                l: 'היום',
                sub: `חזרות ללקוח ${dashboard.dueToday.length} · מהיומן ${dashboard.meetingsToday.length}`,
                danger: false,
                onClick: () => {
                  setCalMode('day')
                  setCalAnchor(new Date())
                  setTab('calendar')
                },
              },
              {
                k: 'install',
                v: dashboard.installOpenCount,
                l: 'התקנות פתוחות',
                sub: `${GROUP_LABEL.installation} — מזגנים, מפצלים, צנרת`,
                danger: false,
                cardClass: 'stat-card-install',
                onClick: () => {
                  setFilterPriority('all')
                  setFilterStatus('all')
                  setOnlyOverdue(false)
                  setFilterGroup('installation')
                  setTab('customers')
                },
              },
              {
                k: 'debts',
                v: `₪${dashboard.totalOwed.toLocaleString('he-IL')}`,
                l: `חובות פתוחים (${dashboard.owedCount})`,
                sub: 'יתרה חיובית לפי רישום',
                danger: false,
                onClick: () => setTab('billing'),
              },
            ].map((s, i) => (
              <motion.button
                key={s.k}
                type="button"
                className={`stat-card stat-card-btn stat-card-rich${'cardClass' in s && s.cardClass ? ` ${s.cardClass}` : ''}`}
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, type: 'spring', stiffness: 300 }}
                onClick={s.onClick}
              >
                <strong className={s.danger ? 'pill-overdue' : undefined}>
                  {s.v}
                </strong>
                <span className="stat-card-label">{s.l}</span>
                <span className="stat-card-sub">{s.sub}</span>
              </motion.button>
            ))}
          </div>

          <div className="dash-acc dash-acc-calls">
            <button
              type="button"
              className="dash-acc-head"
              aria-expanded={dashOpen.calls}
              onClick={() => setDashOpen((s) => ({ ...s, calls: !s.calls }))}
            >
              <span>יומן שיחות באפליקציה</span>
              <span className="dash-acc-count">{recentCalls.length}</span>
            </button>
            {dashOpen.calls ? (
              <div className="dash-acc-body">
                <p className="muted dash-call-hint">
                  רישום מהיר: &quot;שיחה ליומן&quot; למעלה · הוספת לקוח: כפתור ירוק
                </p>
                <ul className="call-log-list">
                  <AnimatePresence initial={false}>
                    {recentCalls.slice(0, 20).map((cl) => (
                      <motion.li
                        key={cl.id}
                        layout
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className={`call-log-item ${cl.direction === 'in' ? 'in' : 'out'}`}
                      >
                        <div className="call-log-top">
                          <span>
                            <a href={`tel:${cl.phone.replace(/\s/g, '')}`}>
                              {cl.phone}
                            </a>
                            {cl.customerId
                              ? ` · ${customerName(cl.customerId)}`
                              : ''}
                          </span>
                          <span className="call-dir">
                            {cl.direction === 'in' ? 'נכנסת' : 'יוצאת'}
                          </span>
                        </div>
                        <span className="muted">
                          {new Date(cl.at).toLocaleString('he-IL', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          · {cl.note}
                        </span>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
                {recentCalls.length === 0 ? (
                  <p className="muted">אין שיחות — התחילו מ&quot;שיחה ליומן&quot;</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="dash-acc">
            <button
              type="button"
              className="dash-acc-head"
              aria-expanded={dashOpen.work}
              onClick={() => setDashOpen((s) => ({ ...s, work: !s.work }))}
            >
              <span>כל הכרטיסים הפתוחים</span>
              <span className="dash-acc-count">{callbackBuckets.totalOpen}</span>
            </button>
            {dashOpen.work ? (
              <div className="dash-acc-body">
                {callbackBuckets.totalOpen === 0 ? (
                  <p className="muted">אין כרטיסים פתוחים</p>
                ) : (
                  <>
                    {callbackBuckets.overdue.length > 0 ? (
                      <>
                        <h4 className="dash-block-title pill-overdue">
                          באיחור ({callbackBuckets.overdue.length})
                        </h4>
                        <p className="muted dash-block-hint">
                          אותם כרטיסים כמו בכרטיס באיחור למעלה — ממוינים לפי דחיפות
                          בכרטיס
                        </p>
                        <div className="list">
                          {callbackBuckets.overdue.map((c) =>
                            renderCustomerCard(c, true),
                          )}
                        </div>
                      </>
                    ) : null}
                    {callbackBuckets.dueToday.length > 0 ||
                    dashboard.meetingsToday.length > 0 ? (
                      <>
                        <h4 className="dash-block-title">
                          היום — חזרות ופגישות (
                          {callbackBuckets.dueToday.length +
                            dashboard.meetingsToday.length}
                          )
                        </h4>
                        <p className="muted dash-block-hint">
                          חזרות לפי תאריך החזרה בכרטיס; אירועי יומן בנפרד
                        </p>
                        {dashboard.meetingsToday.length > 0 ? (
                          <div className="list">
                            {dashboard.meetingsToday.map((m) => (
                              <motion.div
                                key={m.id}
                                layout
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="customer-card pri-low"
                              >
                                <header>
                                  <h3>{m.title}</h3>
                                </header>
                                <p className="meta">
                                  {new Date(m.startAt).toLocaleTimeString(
                                    'he-IL',
                                    {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    },
                                  )}
                                  {m.customerId
                                    ? ` · ${customerName(m.customerId)}`
                                    : ''}
                                </p>
                                {m.notes ? (
                                  <p className="meta">{m.notes}</p>
                                ) : null}
                              </motion.div>
                            ))}
                          </div>
                        ) : null}
                        {callbackBuckets.dueToday.length > 0 ? (
                          <div className="list">
                            {callbackBuckets.dueToday.map((c) =>
                              renderCustomerCard(c, true),
                            )}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    {callbackBuckets.other.length > 0 ? (
                      <>
                        <h4 className="dash-block-title">
                          עתידי / בלי תאריך חזרה ({callbackBuckets.other.length})
                        </h4>
                        <div className="list">
                          {callbackBuckets.other.map((c) =>
                            renderCustomerCard(c, true),
                          )}
                        </div>
                      </>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>

        </main>
      )}

      {tab === 'insights' && (
        <main>
          <AnalysisCharts
            customers={data.customers}
            transactions={data.transactions}
          />
        </main>
      )}

      {tab === 'customers' && (
        <main>
          <div className="section-title-row">
            <h2 className="section-title section-title-inline">לקוחות</h2>
            <ColorLegend variant="inline" />
          </div>
          <div className="toolbar">
            <button
              type="button"
              className="btn btn-primary"
              onClick={openAddCustomerMenu}
            >
              + לקוח חדש
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setCallModal(true)}
            >
              שיחה נכנסת
            </button>
            <label className="muted" style={{ display: 'flex', gap: 8 }}>
              <input
                type="checkbox"
                checked={onlyOverdue}
                onChange={(e) => setOnlyOverdue(e.target.checked)}
              />
              רק באיחור
            </label>
          </div>
          <div className="form-grid two">
            <div>
              <label className="field">קבוצה</label>
              <select
                value={filterGroup}
                onChange={(e) =>
                  setFilterGroup(e.target.value as WorkGroup | 'all')
                }
              >
                <option value="all">הכל</option>
                <option value="service">{GROUP_LABEL.service}</option>
                <option value="installation">{GROUP_LABEL.installation}</option>
                <option value="completion">{GROUP_LABEL.completion}</option>
              </select>
            </div>
            <div>
              <label className="field">דחיפות</label>
              <select
                value={filterPriority}
                onChange={(e) =>
                  setFilterPriority(e.target.value as Priority | 'all')
                }
              >
                <option value="all">הכל</option>
                {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field">סטטוס</label>
              <select
                value={filterStatus}
                onChange={(e) =>
                  setFilterStatus(e.target.value as CustomerStatus | 'all')
                }
              >
                <option value="all">הכל</option>
                {(Object.keys(STATUS_LABEL) as CustomerStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h3 className="section-subcount">
            מציגים {filteredCustomers.length} כרטיסים
          </h3>
          <div className="list">
            {filteredCustomers.map((c) => renderCustomerCard(c))}
          </div>
        </main>
      )}

      {tab === 'pricelist' && (
        <PriceCatalogPage data={data} setData={setData} />
      )}

      {tab === 'quotes' && (
        <QuotesPage
          data={data}
          setData={setData}
          quotesCustomerFocus={quotesCustomerFocus}
          onQuotesCustomerFocusApplied={() => setQuotesCustomerFocus(null)}
        />
      )}

      {tab === 'billing' && (
        <main>
          <h2 className="section-title">רישום חיוב / תשלום</h2>
          <div className="billing-type-hint" role="note">
            <p>
              <strong>חיוב</strong> — סכום שאתה <strong>רושם לחוב הלקוח</strong>{' '}
              (עלות עבודה, חלקים, ביקור). היתרה החיובית שלו <strong>עולה</strong>
              — הוא חייב לך יותר.
            </p>
            <p>
              <strong>תשלום</strong> — כסף ש<strong>התקבל</strong> מהלקוח (מזומן,
              העברה, צ׳ק). היתרה <strong>יורדת</strong> — החוב קטן.
            </p>
          </div>

          <div className="payment-tracker-panel">
            <h3 className="section-title" style={{ marginTop: 0 }}>
              מעקב תשלומים לפי לקוח
            </h3>
            <p className="muted" style={{ marginTop: -6 }}>
              סך חיובים מול סך תשלומים, שיטת תשלום ואסמכתא לכל תשלום.
            </p>
            <label className="field">בחר לקוח</label>
            <select
              value={payTrackCustomerId}
              onChange={(e) => setPayTrackCustomerId(e.target.value)}
            >
              <option value="">—</option>
              {sortCustomers(data.customers).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {paymentTracker && payTrackCustomerId ? (
              <>
                <div className="payment-tracker-stats">
                  <div className="payment-stat">
                    סך חיובים
                    <strong>
                      ₪{paymentTracker.charged.toLocaleString('he-IL')}
                    </strong>
                  </div>
                  <div className="payment-stat">
                    שולם
                    <strong>
                      ₪{paymentTracker.paid.toLocaleString('he-IL')}
                    </strong>
                  </div>
                  <div className="payment-stat">
                    נשאר (יתרה)
                    <strong
                      className={
                        paymentTracker.balance > 0 ? 'pill-overdue' : undefined
                      }
                    >
                      {paymentTracker.balance > 0
                        ? `₪${paymentTracker.balance.toLocaleString('he-IL')} חוב`
                        : paymentTracker.balance < 0
                          ? `־₪${Math.abs(paymentTracker.balance).toLocaleString('he-IL')} זכות`
                          : 'אפס'}
                    </strong>
                  </div>
                </div>
                {paymentTracker.txs.length === 0 ? (
                  <p className="muted">אין תנועות ללקוח זה</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>תאריך</th>
                          <th>סוג</th>
                          <th>סכום</th>
                          <th>אמצעי / אסמכתא</th>
                          <th>תיאור</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentTracker.txs.map((t) => (
                          <tr key={t.id}>
                            <td>{formatHebYmd(t.date)}</td>
                            <td>{t.type === 'charge' ? 'חיוב' : 'תשלום'}</td>
                            <td>₪{t.amount.toLocaleString('he-IL')}</td>
                            <td>
                              {t.type === 'payment'
                                ? [
                                    t.paymentMethod
                                      ? PAYMENT_METHOD_LABEL[t.paymentMethod]
                                      : '—',
                                    t.reference ? ` · ${t.reference}` : '',
                                  ].join('')
                                : '—'}
                            </td>
                            <td>{t.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : null}
          </div>

          <div className="form-grid two">
            <div>
              <label className="field">לקוח (אופציונלי)</label>
              <select
                value={txDraft.customerId}
                onChange={(e) =>
                  setTxDraft((s) => ({ ...s, customerId: e.target.value }))
                }
              >
                <option value="">ללא שיוך</option>
                {data.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field">סוג</label>
              <select
                value={txDraft.type}
                onChange={(e) =>
                  setTxDraft((s) => ({
                    ...s,
                    type: e.target.value as 'charge' | 'payment',
                  }))
                }
              >
                <option value="charge">חיוב (הלקוח חייב)</option>
                <option value="payment">תשלום (התקבל)</option>
              </select>
            </div>
            {txDraft.type === 'payment' ? (
              <>
                <div>
                  <label className="field">שיטת תשלום</label>
                  <select
                    value={txDraft.paymentMethod}
                    onChange={(e) =>
                      setTxDraft((s) => ({
                        ...s,
                        paymentMethod: e.target.value as PaymentMethod,
                      }))
                    }
                  >
                    {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map(
                      (m) => (
                        <option key={m} value={m}>
                          {PAYMENT_METHOD_LABEL[m]}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div>
                  <label className="field">אסמכתא (אופציונלי)</label>
                  <input
                    value={txDraft.reference}
                    onChange={(e) =>
                      setTxDraft((s) => ({ ...s, reference: e.target.value }))
                    }
                    placeholder="מספר העברה, 4 ספרות אשראי..."
                  />
                </div>
              </>
            ) : null}
            <div>
              <label className="field">סכום ₪</label>
              <input
                inputMode="decimal"
                value={txDraft.amount}
                onChange={(e) =>
                  setTxDraft((s) => ({ ...s, amount: e.target.value }))
                }
                placeholder="0"
              />
            </div>
            <div>
              <label className="field">תאריך</label>
              <input
                type="date"
                value={txDraft.date}
                onChange={(e) =>
                  setTxDraft((s) => ({ ...s, date: e.target.value }))
                }
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="field">תיאור</label>
              <input
                value={txDraft.description}
                onChange={(e) =>
                  setTxDraft((s) => ({ ...s, description: e.target.value }))
                }
                placeholder="למשל: ביקור, חלקים, מקדמה"
              />
            </div>
          </div>
          <button type="button" className="btn btn-primary" onClick={addTransaction}>
            שמור תנועה
          </button>

          <h2 className="section-title">יתרות לפי לקוח</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>לקוח</th>
                  <th>יתרה</th>
                </tr>
              </thead>
              <tbody>
                {sortCustomers(data.customers).map((c) => {
                  const b = customerBalance(c.id, data.transactions)
                  if (b === 0) return null
                  return (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>
                        {b > 0
                          ? `₪${b.toLocaleString('he-IL')}`
                          : `־₪${Math.abs(b).toLocaleString('he-IL')} זכות`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <h2 className="section-title">כל התנועות</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>תאריך</th>
                  <th>לקוח</th>
                  <th>סוג</th>
                  <th>סכום</th>
                  <th>אמצעי / אסמכתא</th>
                  <th>תיאור</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...data.transactions]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((t) => (
                    <tr key={t.id}>
                      <td>{formatHebYmd(t.date)}</td>
                      <td>{customerName(t.customerId)}</td>
                      <td>{t.type === 'charge' ? 'חיוב' : 'תשלום'}</td>
                      <td>₪{t.amount.toLocaleString('he-IL')}</td>
                      <td>
                        {t.type === 'payment'
                          ? [
                              t.paymentMethod
                                ? PAYMENT_METHOD_LABEL[t.paymentMethod]
                                : '—',
                              t.reference ? ` · ${t.reference}` : '',
                            ].join('')
                          : '—'}
                      </td>
                      <td>{t.description}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => deleteTransaction(t.id)}
                        >
                          מחק
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {tab === 'calendar' && (
        <main>
          <WorkCalendar
            mode={calMode}
            onMode={setCalMode}
            anchor={calAnchor}
            onAnchor={setCalAnchor}
            meetings={data.meetings}
            customers={data.customers}
            customerName={customerName}
          />
          <h2 className="section-title">פגישה / ביקור חדש</h2>
          <div className="form-grid two">
            <div>
              <label className="field">לקוח (אופציונלי)</label>
              <select
                value={meetDraft.customerId}
                onChange={(e) =>
                  setMeetDraft((s) => ({ ...s, customerId: e.target.value }))
                }
              >
                <option value="">ללא שיוך</option>
                {data.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field">כותרת</label>
              <input
                value={meetDraft.title}
                onChange={(e) =>
                  setMeetDraft((s) => ({ ...s, title: e.target.value }))
                }
                placeholder="התקנה / ביקור שירות"
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="field">מועד</label>
              <input
                type="datetime-local"
                value={meetDraft.startAt}
                onChange={(e) =>
                  setMeetDraft((s) => ({ ...s, startAt: e.target.value }))
                }
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="field">הערות</label>
              <textarea
                value={meetDraft.notes}
                onChange={(e) =>
                  setMeetDraft((s) => ({ ...s, notes: e.target.value }))
                }
              />
            </div>
          </div>
          <button type="button" className="btn btn-primary" onClick={addMeeting}>
            שמור פגישה
          </button>

          <h2 className="section-title">כל הפגישות (לפי מועד)</h2>
          <div className="list">
            {[...data.meetings]
              .sort((a, b) => a.startAt.localeCompare(b.startAt))
              .map((m) => (
                <motion.div
                  key={m.id}
                  layout
                  className="customer-card pri-medium"
                >
                  <header>
                    <h3>{m.title}</h3>
                  </header>
                  <p className="meta">
                    {new Date(m.startAt).toLocaleString('he-IL', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {m.customerId ? ` · ${customerName(m.customerId)}` : ''}
                  </p>
                  {m.notes ? <p className="meta">{m.notes}</p> : null}
                  <div className="actions">
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => deleteMeeting(m.id)}
                    >
                      מחק
                    </button>
                  </div>
                </motion.div>
              ))}
          </div>
        </main>
      )}

      {tab === 'backup' && (
        <main>
          <p className="muted">
            ייצוא וייבוא מאפשרים גיבוי קובץ או העברה בין מחשבים.
          </p>
          <div className="actions" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const blob = new Blob([exportJson(data)], {
                  type: 'application/json',
                })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = `technician-crm-backup-${today}.json`
                a.click()
                URL.revokeObjectURL(a.href)
              }}
            >
              ייצוא JSON
            </button>
            <label className="btn" style={{ cursor: 'pointer' }}>
              ייבוא JSON
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    const text = String(reader.result)
                    const imp = importAppData(text)
                    if (!imp) {
                      alert('קובץ לא תקין')
                      return
                    }
                    if (!confirm('לייבא ולהחליף את כל הנתונים?')) return
                    setData(imp)
                  }
                  reader.readAsText(f)
                  e.target.value = ''
                }}
              />
            </label>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (!confirm('לאפס את כל הנתונים?')) return
                setData(emptyAppData())
              }}
            >
              איפוס מלא
            </button>
          </div>
          <div className="alert">
            טעינת דמו ממלאת את כל המסכים בנתוני לדוגמה (ודורסת נתונים קיימים).
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (
                !confirm(
                  'לטעון נתוני דמו? כל המידע הנוכחי יימחק ויוחלף.',
                )
              )
                return
              setData(createDemoData())
              setTab('dashboard')
            }}
          >
            טען דמו
          </button>
        </main>
      )}

      <button
        type="button"
        className="fab-call"
        title="הוספת לקוח"
        aria-label="הוספת לקוח"
        onClick={openAddCustomerMenu}
      >
        +
      </button>

      {addCustomerStep === 'choose' ? (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-choose-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAddCustomerStep(null)
          }}
        >
          <motion.div
            className="sheet"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <h2 id="add-choose-title">הוספת לקוח חדש</h2>
            <p className="muted">
              <strong>מאנשי הקשר במכשיר</strong> (מומלץ באנדרואיד): נפתח בורר של
              המערכת עם שם ומספר. אנשי קשר שמסונכרנים מ־Truecaller יופיעו כאן{' '}
              <strong>רק אם נשמרו כאנשי קשר</strong> בטלפון — אין חיבור ישיר
              לאפליקציית Truecaller.
            </p>
            <div className="actions" style={{ flexDirection: 'column' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => {
                  void openNewCustomerFromDeviceContact()
                }}
              >
                בחר מאנשי הקשר (שם + מספר)
              </button>
              <button
                type="button"
                className="btn"
                style={{ width: '100%' }}
                onClick={() => {
                  setAddCustomerStep(null)
                  openNewCustomer()
                }}
              >
                הזנה ידנית — כל הפרטים
              </button>
              <button
                type="button"
                className="btn"
                style={{ width: '100%' }}
                onClick={() => {
                  setPhonePasteDraft('')
                  setAddCustomerStep('paste')
                }}
              >
                מספר מהלוח (העתקה והדבקה)
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%' }}
                onClick={() => setAddCustomerStep(null)}
              >
                ביטול
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}

      {addCustomerStep === 'paste' ? (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-paste-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAddCustomerStep(null)
          }}
        >
          <motion.div
            className="sheet"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <h2 id="add-paste-title">מספר מיומן השיחות</h2>
            <ol className="muted" style={{ paddingRight: 18, margin: '0 0 12px' }}>
              <li>פתחו את אפליקציית הטלפון ואת יומן השיחות האחרונות</li>
              <li>לחצו לחיצה ארוכה על המספר והעתיקו</li>
              <li>חזרו לכאן ולחצו &quot;הדבק מהלוח&quot; או הקלידו ידנית</li>
            </ol>
            <div className="form-grid">
              <div>
                <label className="field">טלפון</label>
                <input
                  inputMode="tel"
                  dir="ltr"
                  style={{ textAlign: 'left' }}
                  value={phonePasteDraft}
                  onChange={(e) => setPhonePasteDraft(e.target.value)}
                  placeholder="050-1234567"
                />
              </div>
            </div>
            <div className="actions" style={{ flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={pastePhoneFromClipboard}
              >
                הדבק מהלוח
              </button>
              <button
                type="button"
                className="btn"
                onClick={confirmPastedPhoneCustomer}
              >
                המשך לכרטיס לקוח
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setAddCustomerStep('choose')}
              >
                חזרה
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}

      {callModal ? (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="call-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCallModal(false)
          }}
        >
          <motion.div
            className="sheet"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <h2 id="call-title">שיחה נכנסת</h2>
            <p className="muted">
              רשמו מספר והערה קצרה. אפשר רק לשמור ביומן או לפתוח כרטיס לקוח
              חדש עם אותם פרטים.
            </p>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <div>
                <label className="field">טלפון</label>
                <input
                  inputMode="tel"
                  value={callDraft.phone}
                  onChange={(e) =>
                    setCallDraft((s) => ({ ...s, phone: e.target.value }))
                  }
                  placeholder="050-..."
                />
              </div>
              <div>
                <label className="field">מה אמרו / מה לזכור</label>
                <textarea
                  value={callDraft.note}
                  onChange={(e) =>
                    setCallDraft((s) => ({ ...s, note: e.target.value }))
                  }
                  placeholder="תקלה, כתובת, שעה לחזרה..."
                />
              </div>
            </div>
            <div className="actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveCallLogOnly}
              >
                שמור ביומן בלבד
              </button>
              <button
                type="button"
                className="btn"
                onClick={startNewCustomerFromCall}
              >
                צור לקוח חדש
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setCallModal(false)}
              >
                סגור
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}

      {customerModal ? (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setAddCustomerStep(null)
              setCustomerModal(null)
            }
          }}
        >
          <motion.div
            className="sheet"
            initial={{ y: 36, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <h2>
              {customerModal.mode === 'new' ? 'לקוח חדש' : 'עריכת לקוח'}
            </h2>
            <div className="form-grid two">
              <div>
                <label className="field">שם</label>
                <input
                  value={customerModal.draft.name}
                  onChange={(e) =>
                    setCustomerModal((m) =>
                      m
                        ? {
                            ...m,
                            draft: { ...m.draft, name: e.target.value },
                          }
                        : m,
                    )
                  }
                />
              </div>
              <div>
                <label className="field">טלפון</label>
                <input
                  value={customerModal.draft.phone}
                  onChange={(e) =>
                    setCustomerModal((m) =>
                      m
                        ? {
                            ...m,
                            draft: { ...m.draft, phone: e.target.value },
                          }
                        : m,
                    )
                  }
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="field">כתובת</label>
                <input
                  value={customerModal.draft.address}
                  onChange={(e) =>
                    setCustomerModal((m) =>
                      m
                        ? {
                            ...m,
                            draft: { ...m.draft, address: e.target.value },
                          }
                        : m,
                    )
                  }
                />
              </div>
              <div>
                <label className="field">דחיפות (צבע)</label>
                <select
                  value={customerModal.draft.priority}
                  onChange={(e) =>
                    setCustomerModal((m) =>
                      m
                        ? {
                            ...m,
                            draft: {
                              ...m.draft,
                              priority: e.target.value as Priority,
                            },
                          }
                        : m,
                    )
                  }
                >
                  {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field">קבוצה</label>
                <select
                  value={customerModal.draft.group}
                  onChange={(e) =>
                    setCustomerModal((m) =>
                      m
                        ? {
                            ...m,
                            draft: {
                              ...m.draft,
                              group: e.target.value as WorkGroup,
                            },
                          }
                        : m,
                    )
                  }
                >
                  {(Object.keys(GROUP_LABEL) as WorkGroup[]).map((g) => (
                    <option key={g} value={g}>
                      {GROUP_LABEL[g]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field">סטטוס</label>
                <select
                  value={customerModal.draft.status}
                  onChange={(e) =>
                    setCustomerModal((m) =>
                      m
                        ? {
                            ...m,
                            draft: {
                              ...m.draft,
                              status: e.target.value as CustomerStatus,
                            },
                          }
                        : m,
                    )
                  }
                >
                  {(Object.keys(STATUS_LABEL) as CustomerStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field">תאריך חזרה</label>
                <input
                  type="date"
                  value={customerModal.draft.callbackDate ?? ''}
                  onChange={(e) =>
                    setCustomerModal((m) =>
                      m
                        ? {
                            ...m,
                            draft: {
                              ...m.draft,
                              callbackDate: e.target.value || null,
                            },
                          }
                        : m,
                    )
                  }
                />
                <button
                  type="button"
                  className="btn"
                  style={{ marginTop: 6 }}
                  onClick={() =>
                    setCustomerModal((m) =>
                      m
                        ? { ...m, draft: { ...m.draft, callbackDate: null } }
                        : m,
                    )
                  }
                >
                  בלי תאריך חזרה
                </button>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="field">הערות</label>
                <textarea
                  value={customerModal.draft.notes}
                  onChange={(e) =>
                    setCustomerModal((m) =>
                      m
                        ? {
                            ...m,
                            draft: { ...m.draft, notes: e.target.value },
                          }
                        : m,
                    )
                  }
                />
              </div>
            </div>
            <div className="actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (!customerModal.draft.name.trim()) {
                    alert('נא להזין שם')
                    return
                  }
                  upsertCustomer(
                    customerModal.mode === 'edit' ? customerModal.id : undefined,
                    {
                      ...customerModal.draft,
                      name: customerModal.draft.name.trim(),
                      phone: customerModal.draft.phone.trim(),
                      address: customerModal.draft.address.trim(),
                      notes: customerModal.draft.notes.trim(),
                    },
                  )
                }}
              >
                שמור
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setCallContext(null)
                  setAddCustomerStep(null)
                  setCustomerModal(null)
                }}
              >
                ביטול
              </button>
              {customerModal.mode === 'edit' && customerModal.id ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => deleteCustomer(customerModal.id!)}
                >
                  מחק לקוח
                </button>
              ) : null}
            </div>
          </motion.div>
        </div>
      ) : null}
    </div>
  )
}
