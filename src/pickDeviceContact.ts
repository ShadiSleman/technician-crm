import { Capacitor } from '@capacitor/core'
import { Contacts } from '@capacitor-community/contacts'

/** שם תצוגה + מספר ראשון — מבורר אנשי הקשר של המכשיר (יכול לכלול רשומות מ־Truecaller אם נשמרו לאנשי קשר). */
export async function pickDeviceContact(): Promise<{
  name: string
  phone: string
} | null> {
  if (!Capacitor.isNativePlatform()) {
    return null
  }
  try {
    const perm = await Contacts.requestPermissions()
    if (perm.contacts !== 'granted' && perm.contacts !== 'limited') {
      return null
    }
    const { contact } = await Contacts.pickContact({
      projection: { name: true, phones: true },
    })
    const name =
      contact.name?.display?.trim() ||
      [contact.name?.given, contact.name?.family]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      'ללא שם'
    const raw =
      contact.phones?.find((p) => p.isPrimary)?.number ||
      contact.phones?.[0]?.number ||
      ''
    const phone = raw.replace(/\s/g, '').trim()
    if (!phone) return { name, phone: '' }
    return { name, phone }
  } catch {
    return null
  }
}
