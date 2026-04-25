import type { ContactPayload } from '@capacitor-community/contacts'
import { Contacts } from '@capacitor-community/contacts'
import { Capacitor } from '@capacitor/core'
import { DeviceContactsList } from './plugins/DeviceContactsList'

export type DeviceContactRow = {
  id: string
  name: string
  phoneRaw: string
}

export type LoadContactsResult = {
  rows: DeviceContactRow[]
  /** הודעה כשהטעינה נכשלה, נדחה (הרשאה), או timeout */
  error: string | null
  timedOut: boolean
}

const GET_CONTACTS_TIMEOUT_MS = 90_000

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(Object.assign(new Error('__timeout__'), { name: 'Timeout' })),
      ms,
    )
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

function mapContactToRow(c: ContactPayload): DeviceContactRow | null {
  const name =
    c.name?.display?.trim() ||
    [c.name?.given, c.name?.family].filter(Boolean).join(' ').trim() ||
    'ללא שם'
  const phoneList = c.phones?.filter((p) => p?.number) ?? []
  const raw =
    phoneList.find((p) => p.isPrimary)?.number ||
    phoneList[0]?.number ||
    null
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length < 7) return null
  return {
    id: c.contactId,
    name: name || 'ללא שם',
    phoneRaw: String(raw).replace(/\s/g, ' ').trim(),
  }
}

async function loadViaCapacitorCommunity(
  max: number,
): Promise<LoadContactsResult> {
  try {
    let perm = await Contacts.checkPermissions()
    if (perm.contacts !== 'granted' && perm.contacts !== 'limited') {
      perm = await Contacts.requestPermissions()
    }
    if (perm.contacts !== 'granted' && perm.contacts !== 'limited') {
      return {
        rows: [],
        error: 'אין גישה לאנשי קשר. אפשרו הרשאה בהגדרות האפליקציה.',
        timedOut: false,
      }
    }
    const result = await withTimeout(
      Contacts.getContacts({
        projection: { name: true, phones: true },
      }),
      GET_CONTACTS_TIMEOUT_MS,
    )
    const contacts = Array.isArray(result?.contacts) ? result.contacts : []
    const rows: DeviceContactRow[] = []
    for (const c of contacts) {
      const r = mapContactToRow(c)
      if (r) rows.push(r)
    }
    const seen = new Set<string>()
    const deduped: DeviceContactRow[] = []
    for (const r of rows) {
      const k = r.phoneRaw.replace(/\D/g, '')
      if (seen.has(k)) continue
      seen.add(k)
      deduped.push(r)
    }
    deduped.sort((a, b) => a.name.localeCompare(b.name, 'he'))
    return { rows: deduped.slice(0, max), error: null, timedOut: false }
  } catch (e) {
    if (e instanceof Error && e.message === '__timeout__') {
      return {
        rows: [],
        error:
          'פג הזמן בטעינת אנשי הקשר. נסו «בחירה מהמערכת» או נסו שוב.',
        timedOut: true,
      }
    }
    console.warn('[loadDeviceContacts] community getContacts', e)
    return {
      rows: [],
      error: 'לא ניתן לטעון את רשימת אנשי הקשר. נסו «בחירה מהמערכת».',
      timedOut: false,
    }
  }
}

/**
 * אנדרואיד: ContentResolver (פלאגין מקומי). אייפון / גיבוי: ‎@capacitor-community/contacts
 */
export async function loadDeviceContactsForPicker(
  max = 500,
): Promise<LoadContactsResult> {
  if (!Capacitor.isNativePlatform()) {
    return { rows: [], error: null, timedOut: false }
  }
  if (Capacitor.getPlatform() === 'android') {
    try {
      const { rows: raw } = await withTimeout(
        DeviceContactsList.getPhoneRows({ max }),
        120_000,
      )
      const rows: DeviceContactRow[] = raw.map((r) => ({
        id: r.id,
        name: r.name,
        phoneRaw: r.phoneRaw,
      }))
      rows.sort((a, b) => a.name.localeCompare(b.name, 'he'))
      return { rows: rows.slice(0, max), error: null, timedOut: false }
    } catch (e) {
      if (e instanceof Error && e.message === '__timeout__') {
        return {
          rows: [],
          error: 'פג הזמן בטעינת אנשי הקשר. נסו «בחירה מהמערכת».',
          timedOut: true,
        }
      }
      console.warn(
        '[loadDeviceContacts] android native failed, trying community plugin',
        e,
      )
    }
  }
  return loadViaCapacitorCommunity(max)
}

/**
 * בורר אחד של המערכת (pickContact) — פעלול גיבוי אם getContacts איטי או נכשל.
 */
export async function pickOneContactFromSystem(): Promise<DeviceContactRow | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    let perm = await Contacts.checkPermissions()
    if (perm.contacts !== 'granted' && perm.contacts !== 'limited') {
      perm = await Contacts.requestPermissions()
    }
    if (perm.contacts !== 'granted' && perm.contacts !== 'limited') {
      return null
    }
    const res = await withTimeout(
      Contacts.pickContact({ projection: { name: true, phones: true } }),
      120_000,
    )
    if (!res?.contact) return null
    return mapContactToRow(res.contact)
  } catch (e) {
    if (e instanceof Error && e.message === '__timeout__') {
      return null
    }
    console.warn('[pickOneContactFromSystem]', e)
    return null
  }
}
