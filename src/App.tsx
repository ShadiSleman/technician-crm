import { App as CapacitorApp } from '@capacitor/app'
import { AiadLogoMark } from './components/AiadLogoMark'
import { Capacitor } from '@capacitor/core'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AnalysisCharts,
  type AnalysisNavigate,
} from './components/AnalysisCharts'
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
import { downloadBackupJson } from './backupExport'
import { FULL_RESET_PASSWORD } from './resetPassword'
import {
  dedupePriceList,
  importAppData,
  loadAppData,
  mergeInitialPriceListSeed,
  normalizeAppData,
  saveAppData,
} from './storage'
import { TruecallerLogoMark } from './components/TruecallerLogoMark'
import {
  loadDeviceContactsForPicker,
  pickOneContactFromSystem,
  type DeviceContactRow,
} from './deviceContactsList'
import {
  callTypeLabelHe,
  fetchRecentCallsForImport,
  type RecentCallEntry,
} from './recentCalls'
import type {
  AppData,
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
    loaded.priceList.length === 0 &&
    loaded.quotes.length === 0
  ) {
    return createDemoData()
  }
  return loaded
}

/** כרטיסים סגורים (סטטוס «סגור») תמיד בסוף הרשימה */
function sortCustomers(list: Customer[]): Customer[] {
  return [...list].sort((a, b) => {
    const aDone = a.status === 'done' ? 1 : 0
    const bDone = b.status === 'done' ? 1 : 0
    if (aDone !== bDone) {
      return aDone - bDone
    }
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
  const dataRef = useRef(data)
  dataRef.current = data

  const remoteHydrated = useRef(false)
  const remoteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [customerModal, setCustomerModal] = useState<{
    mode: 'new' | 'edit'
    id?: string
    draft: ReturnType<typeof emptyCustomer>
  } | null>(null)
  const [callModal, setCallModal] = useState(false)
  const [callDraft, setCallDraft] = useState({ phone: '', note: '' })

  const [filterGroup, setFilterGroup] = useState<WorkGroup | 'all'>('all')
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<CustomerStatus | 'all'>(
    'all',
  )
  const [onlyOverdue, setOnlyOverdue] = useState(false)
  /** מסתיר כרטיסים «סגור» ברשימת לקוחות (מנותב ממסך ניתוח) */
  const [onlyOpen, setOnlyOpen] = useState(false)

  const [dashOpen, setDashOpen] = useState({
    work: false,
    done: false,
  })

  const [addCustomerStep, setAddCustomerStep] = useState<
    null | 'choose' | 'calllog' | 'contactpick'
  >(null)
  const [callLogRows, setCallLogRows] = useState<RecentCallEntry[]>([])
  const [callLogLoading, setCallLogLoading] = useState(false)
  const [contactPickRows, setContactPickRows] = useState<DeviceContactRow[]>(
    [],
  )
  const [contactPickLoading, setContactPickLoading] = useState(false)
  const [contactPickFilter, setContactPickFilter] = useState('')
  const [contactPickLoadError, setContactPickLoadError] = useState<
    string | null
  >(null)

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

  const refreshWorkspaceFromServer = useCallback(async (): Promise<AppData | null> => {
    if (!isRemote || !remoteApiBase || !remoteToken || !onRemoteLogout)
      return null
    try {
      const r = await fetch(`${remoteApiBase}/workspace`, {
        headers: { Authorization: `Bearer ${remoteToken}` },
      })
      if (r.status === 401) {
        onRemoteLogout()
        return null
      }
      if (!r.ok) {
        alert('רענון מהענן נכשל. נסו שוב עוד מעט.')
        return null
      }
      const body = (await r.json()) as { data?: unknown }
      const normalized = normalizeAppData(
        (body.data ?? null) as Partial<AppData> | null,
      )
      const merged = mergeInitialPriceListSeed(normalized)
      setData(merged)
      return merged
    } catch (e) {
      console.warn('[CRM] רענון משרת', e)
      alert('שגיאת רשת — לא נטענו עדכונים.')
      return null
    }
  }, [isRemote, remoteApiBase, remoteToken, onRemoteLogout])

  const flushWorkspaceToServer = useCallback(async () => {
    if (
      !isRemote ||
      !remoteHydrated.current ||
      !remoteApiBase ||
      !remoteToken ||
      !onRemoteLogout
    ) {
      if (!isRemote) saveAppData(dataRef.current)
      return
    }
    if (remoteSaveTimer.current) {
      clearTimeout(remoteSaveTimer.current)
      remoteSaveTimer.current = null
    }
    const d = dataRef.current
    const pl = dedupePriceList(d.priceList)
    const same =
      pl.length === d.priceList.length &&
      pl.every((p, i) => p.id === d.priceList[i]?.id)
    const payload: AppData = same ? d : { ...d, priceList: pl }
    if (!same) {
      setData(payload)
    }
    try {
      const r = await fetch(`${remoteApiBase}/workspace`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${remoteToken}`,
        },
        body: JSON.stringify({ data: payload }),
      })
      if (r.status === 401) onRemoteLogout()
      else if (!r.ok) {
        const errText = await r.text().catch(() => '')
        console.warn('[CRM] שמירה מיידית נכשלה', r.status, errText.slice(0, 200))
        alert('השמירה לענן נכשלה. בדקו חיבור.')
      }
    } catch (e) {
      console.warn('[CRM] שמירה מיידית — שגיאת רשת', e)
      alert('שגיאת רשת — לא נשמר לענן.')
    }
  }, [isRemote, remoteApiBase, remoteToken, onRemoteLogout])

  /** רענון כשחוזרים ללשונית/לאפליקציה (עדכוני Mongo בלי לסגור) */
  const lastAutoRefetchAt = useRef(0)
  useEffect(() => {
    if (!isRemote) return
    const run = (source: 'vis' | 'focus') => {
      if (source === 'vis' && document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastAutoRefetchAt.current < 4000) return
      lastAutoRefetchAt.current = now
      void refreshWorkspaceFromServer()
    }
    const onVis = () => run('vis')
    const onFocus = () => run('focus')
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onFocus)
    }
  }, [isRemote, refreshWorkspaceFromServer])

  useEffect(() => {
    if (tab !== 'pricelist' || !isRemote) return
    const t = setTimeout(() => {
      const now = Date.now()
      if (now - lastAutoRefetchAt.current < 2000) return
      lastAutoRefetchAt.current = now
      void refreshWorkspaceFromServer()
    }, 200)
    return () => clearTimeout(t)
  }, [tab, isRemote, refreshWorkspaceFromServer])

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
    const toSave: AppData = same ? data : { ...data, priceList: pl }
    if (!same) {
      setData((d) => ({ ...d, priceList: pl }))
    }
    if (!isRemote || remoteHydrated.current) {
      saveAppData(toSave)
    }
    if (
      isRemote &&
      remoteHydrated.current &&
      remoteApiBase &&
      remoteToken &&
      onRemoteLogout
    ) {
      if (remoteSaveTimer.current) clearTimeout(remoteSaveTimer.current)
      const payload = toSave
      remoteSaveTimer.current = setTimeout(() => {
        void (async () => {
          try {
            const r = await fetch(`${remoteApiBase}/workspace`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${remoteToken}`,
              },
              body: JSON.stringify({ data: payload }),
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
    addCustomerStep: null as null | 'choose' | 'calllog' | 'contactpick',
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
      if (u.addCustomerStep === 'calllog') {
        setAddCustomerStep('choose')
        return
      }
      if (u.addCustomerStep === 'contactpick') {
        setAddCustomerStep('choose')
        return
      }
      if (u.addCustomerStep === 'choose') {
        setAddCustomerStep(null)
        return
      }
      if (u.customerModal) {
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

  const contactPickFiltered = useMemo(() => {
    const q = contactPickFilter.trim().toLowerCase()
    if (!q) return contactPickRows
    const qd = q.replace(/\D/g, '')
    return contactPickRows.filter((r) => {
      if (r.name.toLowerCase().includes(q)) return true
      if (r.phoneRaw.toLowerCase().includes(q)) return true
      if (qd.length >= 2) {
        const d = r.phoneRaw.replace(/\D/g, '')
        if (d.includes(qd) || d.endsWith(qd)) return true
      }
      return false
    })
  }, [contactPickRows, contactPickFilter])

  const filteredCustomers = useMemo(() => {
    return customersSorted.filter((c) => {
      if (filterGroup !== 'all' && c.group !== filterGroup) return false
      if (filterPriority !== 'all' && c.priority !== filterPriority)
        return false
      if (filterStatus !== 'all' && c.status !== filterStatus) return false
      if (onlyOpen && c.status === 'done') return false
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
    onlyOpen,
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

  const closedCards = useMemo(
    () =>
      sortCustomers(
        data.customers.filter((c) => c.status === 'done'),
      ),
    [data.customers],
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
    } else {
      const newId = crypto.randomUUID()
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
      }))
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
    setAddCustomerStep(null)
    setCustomerModal({ mode: 'new', draft: emptyCustomer() })
  }

  function openAddCustomerMenu() {
    setAddCustomerStep('choose')
    setContactPickFilter('')
    setContactPickLoadError(null)
  }

  function openContactPickStep() {
    setAddCustomerStep('contactpick')
    setContactPickLoading(true)
    setContactPickRows([])
    setContactPickFilter('')
    setContactPickLoadError(null)
    void loadDeviceContactsForPicker(500)
      .then((res) => {
        setContactPickRows(res.rows)
        setContactPickLoadError(res.error)
      })
      .catch((e) => {
        console.warn('[openContactPickStep]', e)
        setContactPickRows([])
        setContactPickLoadError('שגיאה בטעינת אנשי הקשר. נסו «בחירה מהמערכת».')
      })
      .finally(() => {
        setContactPickLoading(false)
      })
  }

  async function trySystemContactPicker() {
    setContactPickLoading(true)
    setContactPickLoadError(null)
    try {
      const r = await pickOneContactFromSystem()
      if (r) {
        selectContactPickRow(r)
        return
      }
      setContactPickLoadError(
        'לא נבחר איש קשר, או שאין מספר. נסו שוב או הזינו ידנית.',
      )
    } finally {
      setContactPickLoading(false)
    }
  }

  function openCallLogStep() {
    setAddCustomerStep('calllog')
    setCallLogLoading(true)
    setCallLogRows([])
    void fetchRecentCallsForImport(2000).then((rows) => {
      setCallLogRows(rows)
      setCallLogLoading(false)
    })
  }

  function selectCallLogRow(c: RecentCallEntry) {
    setAddCustomerStep(null)
    setCallLogRows([])
    const phone = formatPhoneFromDigits(c.phoneRaw)
    const rawPhone = c.phoneRaw.replace(/\D/g, '')
    const name =
      (c.name || '').trim() ||
      (rawPhone.length >= 4
        ? `לקוח ·${rawPhone.slice(-4)}`
        : 'לקוח חדש')
    setCustomerModal({
      mode: 'new',
      draft: {
        ...emptyCustomer(),
        name,
        phone: phone || c.phoneRaw.replace(/\s/g, ''),
        status: 'callback',
        priority: 'high',
        callbackDate: todayYmd(),
        notes: 'מיומן שיחות',
      },
    })
  }

  function selectContactPickRow(r: DeviceContactRow) {
    setAddCustomerStep(null)
    setContactPickRows([])
    setContactPickFilter('')
    setContactPickLoadError(null)
    const phone =
      digitsOnly(r.phoneRaw).length >= 7
        ? formatPhoneFromDigits(r.phoneRaw)
        : ''
    setCustomerModal({
      mode: 'new',
      draft: {
        ...emptyCustomer(),
        name: r.name,
        phone: phone || r.phoneRaw.replace(/\s/g, ''),
      },
    })
    if (!phone) {
      alert(
        'לא נמצא מספר תקין לאיש הקשר. ניתן להקליד ידנית בכרטיס.',
      )
    }
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

  function openEditCustomer(c: Customer) {
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

  const handleAnalysisNavigate = useCallback((action: AnalysisNavigate) => {
    setOnlyOverdue(false)
    switch (action.type) {
      case 'billing':
        setTab('billing')
        return
      case 'calendar':
        setTab('calendar')
        return
      case 'quotes':
        setTab('quotes')
        return
      case 'customers_open':
        setFilterGroup('all')
        setFilterPriority('all')
        setFilterStatus('all')
        setOnlyOpen(true)
        setTab('customers')
        return
      case 'customers_done':
        setFilterGroup('all')
        setFilterPriority('all')
        setFilterStatus('done')
        setOnlyOpen(false)
        setTab('customers')
        return
      case 'customers_group':
        setFilterGroup(action.group)
        setFilterPriority('all')
        setFilterStatus('all')
        setOnlyOpen(true)
        setTab('customers')
        return
      case 'customers_priority':
        setFilterGroup('all')
        setFilterPriority(action.priority)
        setFilterStatus('all')
        setOnlyOpen(true)
        setTab('customers')
        return
      case 'customers_status':
        setFilterGroup('all')
        setFilterPriority('all')
        setFilterStatus(action.status)
        setOnlyOpen(false)
        setTab('customers')
        return
    }
  }, [])

  function openEditCustomerById(id: string) {
    const c = data.customers.find((x) => x.id === id)
    if (c) {
      openEditCustomer(c)
      setTab('customers')
    }
  }

  function startNewCustomerFromCall() {
    const phone = callDraft.phone.trim()
    const note = callDraft.note.trim()
    if (!phone) {
      alert('נא להזין מספר טלפון')
      return
    }
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
            ביקור: {formatHebYmd(c.callbackDate)}
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
          <div className="dash-header-brand">
            <AiadLogoMark variant="compact" />
          </div>
          <h2 className="section-title">סיכום מהיר</h2>
          <div className="cards cards-grid-2">
            {[
              {
                k: 'overdue',
                v: dashboard.overdue.length,
                l: 'באיחור',
                sub: 'תאריך ביקור לפני היום',
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
                sub: `ביקורים מתוכננים ${dashboard.dueToday.length} · מהיומן ${dashboard.meetingsToday.length}`,
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
                danger: true,
                cardClass: 'stat-card-debts',
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
                          היום — ביקורים ופגישות (
                          {callbackBuckets.dueToday.length +
                            dashboard.meetingsToday.length}
                          )
                        </h4>
                        <p className="muted dash-block-hint">
                          ביקורים לפי תאריך ביקור בכרטיס; אירועי יומן בנפרד
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
                          עתידי / בלי תאריך ביקור ({callbackBuckets.other.length})
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

          <div className="dash-acc">
            <button
              type="button"
              className="dash-acc-head"
              aria-expanded={dashOpen.done}
              onClick={() => setDashOpen((s) => ({ ...s, done: !s.done }))}
            >
              <span>כרטיסים סגורים</span>
              <span className="dash-acc-count">{closedCards.length}</span>
            </button>
            {dashOpen.done ? (
              <div className="dash-acc-body">
                <p className="muted dash-block-hint" style={{ marginBottom: 12 }}>
                  כרטיסים במצב &quot;סגור&quot; — ברשימת הלקוחות הם מסודרים
                  בסוף.
                </p>
                {closedCards.length === 0 ? (
                  <p className="muted">אין כרטיסים סגורים</p>
                ) : (
                  <div className="list">
                    {closedCards.map((c) => renderCustomerCard(c, true))}
                  </div>
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
            meetings={data.meetings}
            quotes={data.quotes}
            onNavigate={handleAnalysisNavigate}
            onOpenCustomer={openEditCustomerById}
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
                onChange={(e) => {
                  if (e.target.checked) setOnlyOpen(false)
                  setOnlyOverdue(e.target.checked)
                }}
              />
              רק באיחור
            </label>
            <label className="muted" style={{ display: 'flex', gap: 8 }}>
              <input
                type="checkbox"
                checked={onlyOpen}
                onChange={(e) => {
                  const on = e.target.checked
                  if (on) {
                    setOnlyOverdue(false)
                    if (filterStatus === 'done') setFilterStatus('all')
                  }
                  setOnlyOpen(on)
                }}
              />
              רק פתוחים
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
                onChange={(e) => {
                  const v = e.target.value as CustomerStatus | 'all'
                  setFilterStatus(v)
                  if (v === 'done') setOnlyOpen(false)
                }}
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
        <PriceCatalogPage
          data={data}
          setData={setData}
          isRemote={isRemote}
          onFlushToServer={flushWorkspaceToServer}
          onRefreshFromServer={isRemote ? refreshWorkspaceFromServer : undefined}
        />
      )}

      {tab === 'quotes' && (
        <QuotesPage
          data={data}
          setData={setData}
          quotesCustomerFocus={quotesCustomerFocus}
          onQuotesCustomerFocusApplied={() => setQuotesCustomerFocus(null)}
          isRemote={isRemote}
          onRefreshFromServer={isRemote ? refreshWorkspaceFromServer : undefined}
        />
      )}

      {tab === 'billing' && (
        <main>
          <h2 className="section-title">רישום חיוב / תשלום</h2>

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
                  <div className="table-wrap billing-tx-table">
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
                          <tr
                            key={t.id}
                            className={
                              t.type === 'charge'
                                ? 'billing-tx-row--charge'
                                : 'billing-tx-row--payment'
                            }
                          >
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
          <div className="table-wrap billing-tx-table billing-tx-table-all">
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
                    <tr
                      key={t.id}
                      className={
                        t.type === 'charge'
                          ? 'billing-tx-row--charge'
                          : 'billing-tx-row--payment'
                      }
                    >
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
                void downloadBackupJson(data, today)
                  .then(() => {
                    /* native: share sheet; web: download */
                  })
                  .catch((e) => {
                    console.error(e)
                    alert(
                      'ייצוא JSON נכשל. ' +
                        (e instanceof Error ? e.message : String(e)) +
                        '\n\nבמכשיר: בדקו שיתוף/קבצים. בדפדפן: נסו שוב או בדפדפן אחר.',
                    )
                  })
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
                const pw = window.prompt(
                  'איפוס מלא — הזינו את סיסמת האיפוס (מוגדרת בקוד ב־src/resetPassword.ts):',
                )
                if (pw === null) {
                  return
                }
                if (pw.trim() !== FULL_RESET_PASSWORD) {
                  alert('סיסמה שגויה. הנתונים לא נמחקו.')
                  return
                }
                if (
                  !confirm(
                    'למחוק לצמיתות את כל הלקוחות, הכספים, פגישות, מחירון וההצעות? פעולה בלתי הפיכה.',
                  )
                ) {
                  return
                }
                setData(emptyAppData())
                alert('הנתונים אופסו (מאגר ריק).')
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
              <strong>הכי נוח (אנדרואיד):</strong> &quot;משיחות TRUE
              CALLER&quot; — שם ומספר מיומן השיחות (כולל זיהויים שנשמרו ביומן).
              <strong> אנשי קשר</strong> — רשימה מתוך אנשי הקשר של המכשיר (לא
              דרך בורר המערכת).
            </p>
            <div className="actions" style={{ flexDirection: 'column' }}>
              {Capacitor.getPlatform() === 'android' ? (
                <button
                  type="button"
                  className="btn btn-primary add-customer-truecaller-btn"
                  style={{ width: '100%' }}
                  onClick={openCallLogStep}
                >
                  <TruecallerLogoMark size={24} className="add-customer-tc-ico" />
                  <span>
                    משיחות TRUE CALLER — שם ומספר (מומלץ)
                  </span>
                </button>
              ) : null}
              <button
                type="button"
                className="btn"
                style={{ width: '100%' }}
                onClick={openContactPickStep}
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

      {addCustomerStep === 'contactpick' ? (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-contact-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAddCustomerStep('choose')
          }}
        >
          <motion.div
            className="sheet sheet--calllog"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <h2 id="add-contact-title">בחרו איש קשר</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              מוצגת רשימה מ־אנשי הקשר של המכשיר. בחירה אחת מהמערכת (למטה) עובדת
              גם כשהרשימה איטית או נכשלת.
            </p>
            {!contactPickLoading && contactPickRows.length > 0 ? (
              <div className="form-grid" style={{ marginBottom: 10 }}>
                <div>
                  <label className="field" htmlFor="contact-pick-filter">
                    חיפוש
                  </label>
                  <input
                    id="contact-pick-filter"
                    value={contactPickFilter}
                    onChange={(e) => setContactPickFilter(e.target.value)}
                    placeholder="שם או מספר"
                    autoComplete="off"
                  />
                </div>
              </div>
            ) : null}
            {contactPickLoading ? (
              <p className="muted" role="status">
                טוען אנשי קשר…
                {Capacitor.getPlatform() === 'android' ? (
                  <>
                    <br />
                    <span>באנשי קשר כבדים זה עשוי לקחת עד כדקה.</span>
                  </>
                ) : null}
              </p>
            ) : !Capacitor.isNativePlatform() ? (
              <p className="muted">
                רשימה זו זמינה באפליקציית האנדרואיד/אייפון. בדפדפן השתמשו
                ב־הזנה ידנית.
              </p>
            ) : null}
            {!contactPickLoading && Capacitor.isNativePlatform() &&
            contactPickLoadError ? (
              <p className="contact-pick-err" role="alert">
                {contactPickLoadError}
              </p>
            ) : null}
            {!contactPickLoading &&
            Capacitor.isNativePlatform() &&
            !contactPickLoadError &&
            contactPickRows.length === 0 ? (
              <p className="muted">
                לא נמצאו אנשי קשר עם מספר טלפון. הוסיפו בטלפון או השתמשו
                ב־&quot;בחירה אחת מהמערכת&quot; / &quot;משיחות TRUE CALLER&quot; /
                הזנה ידנית.
              </p>
            ) : null}
            {!contactPickLoading && contactPickRows.length > 0
              && contactPickFiltered.length === 0 ? (
                <p className="muted">אין תוצאות שמתאימות לחיפוש.</p>
            ) : null}
            {!contactPickLoading && contactPickFiltered.length > 0 ? (
              <ul className="calllog-pick-list">
                {contactPickFiltered.map((r) => (
                  <li key={`${r.id}-${r.phoneRaw}`}>
                    <button
                      type="button"
                      className="calllog-pick-row"
                      onClick={() => selectContactPickRow(r)}
                    >
                      <span className="calllog-pick-name">{r.name}</span>
                      <span className="calllog-pick-phone" dir="ltr">
                        {r.phoneRaw}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="actions" style={{ flexWrap: 'wrap', marginTop: 12 }}>
              {Capacitor.isNativePlatform() ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    void trySystemContactPicker()
                  }}
                  disabled={contactPickLoading}
                >
                  בחירה אחת מהמערכת
                </button>
              ) : null}
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

      {addCustomerStep === 'calllog' ? (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-calllog-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAddCustomerStep('choose')
          }}
        >
          <motion.div
            className="sheet sheet--calllog"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <h2
              id="add-calllog-title"
              className="sheet__titleWithLogo"
            >
              <TruecallerLogoMark
                height={36}
                className="add-customer-tc-ico"
              />
              <span>משיחות TRUE CALLER — בחרו שיחה</span>
            </h2>
            <p className="muted" style={{ marginTop: 0 }}>
              רשימה מיומן השיחות (מספר + שם אם הופיע). לחיצה אחת פותחת כרטיס
              מלא.
            </p>
            {callLogLoading ? (
              <p className="muted">טוען…</p>
            ) : callLogRows.length === 0 ? (
              <p className="muted">
                אין שיחות או שחסרה הרשאה ליומן שיחות. בדקו בהגדרות המכשיר
                (הרשאות) או הוסיפו בדרך אחרת.
              </p>
            ) : (
              <ul className="calllog-pick-list">
                {callLogRows.map((c, idx) => (
                  <li key={`${c.phoneRaw}-${c.dateMs}-${idx}`}>
                    <button
                      type="button"
                      className="calllog-pick-row"
                      onClick={() => selectCallLogRow(c)}
                    >
                      <span className="calllog-pick-name">
                        {c.name?.trim() ? c.name : '— ללא שם —'}
                      </span>
                      <span className="calllog-pick-phone" dir="ltr">
                        {c.phoneRaw}
                      </span>
                      <span className="calllog-pick-meta">
                        {new Date(c.dateMs).toLocaleString('he-IL', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        · {callTypeLabelHe(c.type)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="actions" style={{ flexWrap: 'wrap', marginTop: 12 }}>
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
              רשמו מספר והערה — ייפתח כרטיס לקוח חדש לפי הפרטים (ללא יומן שיחות
              נפרד באפליקציה).
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
                  placeholder="תקלה, כתובת, שעה לביקור..."
                />
              </div>
            </div>
            <div className="actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-primary"
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
                <label className="field">תאריך ביקור</label>
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
                  בלי תאריך ביקור
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
