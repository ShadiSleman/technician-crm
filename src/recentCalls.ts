import { Capacitor, registerPlugin } from '@capacitor/core'

export type RecentCallEntry = {
  phoneRaw: string
  /** שם שמור ביומן (אנשי קשר / זיהוי) — לעיתים אחרי Truecaller */
  name: string
  dateMs: number
  /** Android CallLog: 1=נכנסת, 2=יוצאת, 3=נענת… */
  type: number
}

export interface RecentCallsPlugin {
  getRecent(options: { limit?: number }): Promise<{ calls: RecentCallEntry[] }>
}

const RecentCalls = registerPlugin<RecentCallsPlugin>('RecentCalls', {
  web: {
    getRecent: async () => ({ calls: [] }),
  },
  ios: {
    getRecent: async () => ({ calls: [] }),
  },
})

function filterValidPhoneRows(calls: RecentCallEntry[]): RecentCallEntry[] {
  return calls.filter((c) => {
    const d = c.phoneRaw.replace(/\D/g, '')
    return d.length >= 7
  })
}

/**
 * בלי איחוד לפי מספר — מציגים כמה שיותר שורות מיומן (כולל אותו מספר בזמנים שונים).
 */
export async function fetchRecentCallsForImport(
  limit = 50,
): Promise<RecentCallEntry[]> {
  if (Capacitor.getPlatform() !== 'android') {
    return []
  }
  try {
    const { calls } = await RecentCalls.getRecent({ limit })
    return filterValidPhoneRows(calls)
  } catch (e) {
    console.warn('[RecentCalls]', e)
    return []
  }
}

/** android.provider.CallLog.Calls */
export function callTypeLabelHe(t: number): string {
  switch (t) {
    case 1:
      return 'נכנסת'
    case 2:
      return 'יוצאת'
    case 3:
      return 'נענת'
    case 4:
    case 5:
    case 6:
    default:
      return 'אחר'
  }
}
