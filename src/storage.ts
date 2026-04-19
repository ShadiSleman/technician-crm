import {
  PRICE_LIST_SEED_DATA_VERSION,
  appendMissingSeedPriceItems,
} from './demo'
import type { AppData, PriceListItem } from './types'
import { emptyAppData } from './types'

const STORAGE_KEY = 'technician-crm-he-v1'
const PRICE_LIST_USER_VERSION_KEY = 'technician-crm-he-pl-seed-ver'

/** נירמול תיאור להשוואת כפילויות (גרשיים, כ״ס, מקפים) */
export function normalizePriceListLabel(raw: string): string {
  let s = raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u201C\u201D\u05F4"'״`´]/g, '"')
    .replace(/כ״ס/g, 'כס')
    .replace(/כ"\s*ס/g, 'כס')
    .replace(/כ'ס/g, 'כס')
    .replace(/[\u2014\u2013\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return s
}

/** מפתחות להשוואה — אם שניים חולקים מפתח, אחד מהם כפול */
function priceListDedupeKeys(p: PriceListItem): string[] {
  const price = p.unitPriceInclVat
  const norm = normalizePriceListLabel(p.name)
  const keys: string[] = []

  const wallHp = norm.match(
    /התקנת\s+מזגן\s+((?:עילי|עלי)\s+)?([\d.]+)/u,
  )
  if (wallHp) {
    keys.push(`wall-עילי:${wallHp[2]}`)
  }

  const gasTier = norm.match(/בדיקת\s+לחות\s+ו?תוספת\s+גז\s+(.+)/u)
  if (gasTier) {
    const tier = gasTier[1].trim().replace(/\s+/g, ' ')
    keys.push(`gas-tier:${tier}`)
  }

  const fixGen = norm.match(/תיקון\s+תקלה\s+כללי\s+(.+)/u)
  if (fixGen) {
    const tail = fixGen[1].trim().replace(/\s+/g, ' ')
    keys.push(`fix-gen:${tail}`)
  }

  keys.push(`name-only:${norm}`)
  keys.push(`full:${norm}:${price}`)
  return keys
}

/**
 * מסיר כפילויות: אותו id; אותו ניסוח מנורמל + מחיר;
 * או אותה קטגוריה סמנטית (למשל אותה התקנת עילי לפי כ״ס, אותו טווח גז/תיקון כללי)
 * גם אם המחיר שונה — נשארת שורה אחת (עדיפות ל־pl-...).
 */
export function dedupePriceList(items: PriceListItem[]): PriceListItem[] {
  const indexed = items.map((p, i) => ({ p, i }))
  indexed.sort((a, b) => {
    const seedA = a.p.id.startsWith('pl-') ? 0 : 1
    const seedB = b.p.id.startsWith('pl-') ? 0 : 1
    if (seedA !== seedB) return seedA - seedB
    return a.i - b.i
  })

  const seenId = new Set<string>()
  const seenLogical = new Set<string>()
  const out: PriceListItem[] = []

  for (const { p } of indexed) {
    if (seenId.has(p.id)) continue
    const keys = priceListDedupeKeys(p)
    if (keys.some((k) => seenLogical.has(k))) continue
    seenId.add(p.id)
    for (const k of keys) seenLogical.add(k)
    out.push(p)
  }

  out.sort((a, b) => {
    const ia = items.findIndex((x) => x.id === a.id)
    const ib = items.findIndex((x) => x.id === b.id)
    return ia - ib
  })

  return out
}

export function normalizeAppData(raw: Partial<AppData> | null): AppData {
  if (!raw || !Array.isArray(raw.customers)) return emptyAppData()
  const rawPl = Array.isArray(raw.priceList) ? raw.priceList : []
  return {
    customers: raw.customers,
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    meetings: Array.isArray(raw.meetings) ? raw.meetings : [],
    callLogs: Array.isArray(raw.callLogs) ? raw.callLogs : [],
    priceList: dedupePriceList(rawPl),
    quotes: Array.isArray(raw.quotes) ? raw.quotes : [],
  }
}

/** מיזוג פריטי מחירון ברירת מחדל (גרסת seed) — גם אחרי טעינה מהשרת */
export function mergeInitialPriceListSeed(data: AppData): AppData {
  const verRaw = localStorage.getItem(PRICE_LIST_USER_VERSION_KEY)
  const userPlVer = verRaw == null ? 0 : parseInt(verRaw, 10) || 0

  if (userPlVer < PRICE_LIST_SEED_DATA_VERSION) {
    const nextList = dedupePriceList(
      appendMissingSeedPriceItems(data.priceList),
    )
    localStorage.setItem(
      PRICE_LIST_USER_VERSION_KEY,
      String(PRICE_LIST_SEED_DATA_VERSION),
    )
    return { ...data, priceList: nextList }
  }

  return { ...data, priceList: dedupePriceList(data.priceList) }
}

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyAppData()
    const parsed = JSON.parse(raw) as AppData
    const data = normalizeAppData(parsed)
    return mergeInitialPriceListSeed(data)
  } catch {
    return emptyAppData()
  }
}

export function saveAppData(data: AppData): void {
  const priceList = dedupePriceList(data.priceList)
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...data, priceList }),
  )
}

export function exportJson(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

export function importAppData(json: string): AppData | null {
  try {
    const parsed = JSON.parse(json) as unknown
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray((parsed as AppData).customers)
    ) {
      return null
    }
    return normalizeAppData(parsed as AppData)
  } catch {
    return null
  }
}
