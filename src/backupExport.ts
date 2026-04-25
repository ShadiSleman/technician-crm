import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import type { AppData } from './types'
import { exportJson } from './storage'

/**
 * בדפדפן: הורדה כקובץ. באנדרואיד/אייפון: כתיבה לקובץ + גיליון שיתוף (לשמירה בדרייב / וואטסאפ וכו׳),
 * כי ‎<a download>‎ לא אמין ב־WebView.
 */
export async function downloadBackupJson(
  data: AppData,
  dateLabel: string,
): Promise<void> {
  const json = exportJson(data)
  const filename = `technician-crm-backup-${dateLabel}.json`

  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })
    try {
      await Share.share({
        title: 'גיבוי JSON — מעקב לקוחות',
        text: 'בחרו «שמירה לקובץ» / Drive, או אפליקציה אחרת לשמירת הגיבוי.',
        dialogTitle: 'שמירה או שיתוף גיבוי',
        files: [uri],
      })
    } catch (e) {
      if (isUserCancelledShare(e)) {
        return
      }
      throw e
    }
  } else {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 2_000)
  }
}

function isUserCancelledShare(e: unknown): boolean {
  const s = String(e)
  if (/cancel|dismiss|abort|cancell?ed|User/i.test(s)) return true
  if (e && typeof e === 'object' && 'message' in e) {
    const m = String((e as { message: unknown }).message)
    if (/cancel|dismiss|abort/i.test(m)) return true
  }
  return false
}
