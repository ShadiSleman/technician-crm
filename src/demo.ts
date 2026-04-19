import type { AppData, CallLog, PriceListItem } from './types'

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function iso(d: Date): string {
  return d.toISOString()
}

function atHours(base: Date, h: number, min: number): string {
  const d = new Date(base)
  d.setHours(h, min, 0, 0)
  return d.toISOString()
}

/** מחירון ברירת־מחדל (אותם מזהים כמו בדמו) — למיזוג ל-localStorage קיים */
export function buildSeedPriceList(now: Date): PriceListItem[] {
  const addDays = (n: number) => {
    const x = new Date(now)
    x.setDate(x.getDate() + n)
    return x
  }
  return [
    /* ——— ביקורים ושירות כללי ——— */
    {
      id: 'pl-demo-1',
      name: 'ביקור אבחון ושיחת שטח (כולל מע״מ)',
      unitPriceInclVat: 350,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-srv-urgent',
      name: 'ביקור חירום / מעבר שעות (תוספת לביקור רגיל)',
      unitPriceInclVat: 180,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-srv-maint',
      name: 'טיפול מונע שנתי — עד 2 כ״ס (ניקוי מעבים + בדיקות)',
      unitPriceInclVat: 450,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-srv-maint-lg',
      name: 'טיפול מונע שנתי — 2.5–4 כ״ס (ניקוי מעבים + בדיקות)',
      unitPriceInclVat: 580,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-demo-9',
      name: 'שטיפה כימית / חיטוי מעבה — יחידה פנימית',
      unitPriceInclVat: 380,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-srv-extwash',
      name: 'שטיפת סוללה חיצונית + בדיקת מאוורר',
      unitPriceInclVat: 320,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    /* ——— התקנות מזגן עילי (חומר בסיסי + ניקוז סטנדרטי) ——— */
    {
      id: 'pl-demo-3',
      name: 'התקנת מזגן עילי 1 כ״ס — חומר בסיסי, ניקוז וחשמל עד 5 מ׳',
      unitPriceInclVat: 3950,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-inst-15',
      name: 'התקנת מזגן עילי 1.5 כ״ס — חומר בסיסי וניקוז',
      unitPriceInclVat: 4350,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-inst-2',
      name: 'התקנת מזגן עילי 2 כ״ס — חומר בסיסי וניקוז',
      unitPriceInclVat: 4750,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-inst-25',
      name: 'התקנת מזגן עילי 2.5 כ״ס — חומר בסיסי וניקוז',
      unitPriceInclVat: 5150,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-demo-3b',
      name: 'התקנת מזגן עילי 3 כ״ס — חומר בסיסי וניקוז',
      unitPriceInclVat: 5600,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-inst-35',
      name: 'התקנת מזגן עילי 3.5 כ״ס — חומר בסיסי וניקוז',
      unitPriceInclVat: 6050,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-inst-4',
      name: 'התקנת מזגן עילי 4 כ״ס — חומר בסיסי וניקוז',
      unitPriceInclVat: 6550,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-inst-45',
      name: 'התקנת מזגן עילי 4.5 כ״ס — חומר בסיסי וניקוז',
      unitPriceInclVat: 7050,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-inst-5',
      name: 'התקנת מזגן עילי 5 כ״ס — חומר בסיסי וניקוז',
      unitPriceInclVat: 7650,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-inst-floor',
      name: 'תוספת: התקנה בקומה גבוהה / גישה מורכבת (ליחידה)',
      unitPriceInclVat: 350,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-inst-bracket',
      name: 'זוג ברקטים / תושבת קיר מחוזקת (חומר)',
      unitPriceInclVat: 220,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-inst-dismantle',
      name: 'פירוק והובלת מזגן ישן (ליחידה)',
      unitPriceInclVat: 450,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    /* ——— מערכות VRF / מולטי ——— */
    {
      id: 'pl-vrf-survey',
      name: 'ביקור תכנון והצעת מחיר — מערכת VRF / מולטי',
      unitPriceInclVat: 650,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-vrf-outdoor',
      name: 'התקנת יחידת חוץ VRF — עבודה + חומר בסיסי (ללא המדחס)',
      unitPriceInclVat: 4800,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-vrf-indoor',
      name: 'התקנת יחידת פנים VRF / קנאלי (ליחידה)',
      unitPriceInclVat: 1850,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-vrf-refnet',
      name: 'צנרת נחושת / בידוד ומילוי אזוטופ (למטר — הערכה)',
      unitPriceInclVat: 280,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-vrf-comm',
      name: 'חיווט תקשורת ומגעון בין יחידות VRF (למערכת)',
      unitPriceInclVat: 950,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-multi-2',
      name: 'התקנת מערכת מולטי ספליט 2 כניסות (עבודה + חומר בסיסי)',
      unitPriceInclVat: 9200,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-multi-3',
      name: 'התקנת מערכת מולטי ספליט 3 כניסות (עבודה + חומר בסיסי)',
      unitPriceInclVat: 11800,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-multi-extra',
      name: 'תוספת כניסה במולטי / VRF (עבודה בלבד)',
      unitPriceInclVat: 1650,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    /* ——— מדחס ומערכת קירור ——— */
    {
      id: 'pl-comp-diag',
      name: 'אבחון מדחס — בדיקות לחות, זרימה ואלקטרוניקה',
      unitPriceInclVat: 480,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-comp-repair-sm',
      name: 'תיקון מדחס — עד 2 כ״ס (עבודה, ללא חלקי חילוף)',
      unitPriceInclVat: 890,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-comp-repair-lg',
      name: 'תיקון מדחס — 2.5–4 כ״ס (עבודה, ללא חלקי חילוף)',
      unitPriceInclVat: 1150,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-comp-replace-sm',
      name: 'החלפת מדחס — יחידה עד 2 כ״ס (עבודה + איזון גז, ללא מדחס)',
      unitPriceInclVat: 2350,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-comp-replace-lg',
      name: 'החלפת מדחס — 2.5–4 כ״ס (עבודה + איזון, ללא מדחס)',
      unitPriceInclVat: 2950,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-comp-part-inv',
      name: 'מדחס Inverter חדש — טווח 2 כ״ס (חומר בלבד, לפי דגם)',
      unitPriceInclVat: 4850,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-comp-part-inv-lg',
      name: 'מדחס Inverter חדש — טווח 3–4 כ״ס (חומר בלבד, לפי דגם)',
      unitPriceInclVat: 6200,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-4way',
      name: 'החלפת שסתום הפוך (ארבע דרכים) כולל עבודה',
      unitPriceInclVat: 780,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-capillary',
      name: 'החלפת קפילרה / מסנן מיסוף (עבודה + חומר בסיסי)',
      unitPriceInclVat: 420,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    /* ——— גז ולחות ——— */
    {
      id: 'pl-demo-4',
      name: 'מילוי גז / בדיקת לחות ואטימות (לפי ביקור)',
      unitPriceInclVat: 280,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-demo-10',
      name: 'בדיקת לחות ותוספת גז — עד 1 כ״ס',
      unitPriceInclVat: 320,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-demo-11',
      name: 'בדיקת לחות ותוספת גז — 2–3 כ״ס',
      unitPriceInclVat: 420,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-gas-4cs',
      name: 'בדיקת לחות ותוספת גז — 4–5 כ״ס',
      unitPriceInclVat: 520,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-leak-find',
      name: 'איתור נקודת דליפה (ללא תיקון)',
      unitPriceInclVat: 350,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-leak-fix',
      name: 'איטום דליפה / הדבקה מקומית (אחרי איתור)',
      unitPriceInclVat: 290,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    /* ——— תיקונים לפי גודל ——— */
    {
      id: 'pl-demo-2',
      name: 'תיקון תקלה כללי — מזגן עד 1.5 כ״ס (עבודה + בדיקות)',
      unitPriceInclVat: 420,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-demo-2b',
      name: 'תיקון תקלה כללי — מזגן 2–3 כ״ס (עבודה + בדיקות)',
      unitPriceInclVat: 520,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-fix-4cs',
      name: 'תיקון תקלה כללי — מזגן 4–5 כ״ס (עבודה + בדיקות)',
      unitPriceInclVat: 650,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-drain-pump',
      name: 'התקנת משאבת ניקוז / תיקון צנרת ניקוז סתומה',
      unitPriceInclVat: 380,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-noise',
      name: 'טיפול ברעשים — קיבוע סוללה, משענות, בידוד רטט',
      unitPriceInclVat: 340,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    /* ——— חלקים נפוצים ——— */
    {
      id: 'pl-demo-5',
      name: 'פילטר אוויר מקורי (ספק, ללא עבודה)',
      unitPriceInclVat: 120,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-part-remote',
      name: 'שלט חלופי / זיווג שלט (כולל עבודה)',
      unitPriceInclVat: 180,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-demo-7',
      name: 'חיישן טמפ׳ פנימי / חיצוני (חומר + התקנה קצרה)',
      unitPriceInclVat: 220,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-demo-6',
      name: 'מנוע מאוורר חיצוני / קפיץ (חומר + עבודה)',
      unitPriceInclVat: 380,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-demo-8',
      name: 'לוח אלקטרוני פנימי (הערכה לפי דגם, כולל עבודה בסיסית)',
      unitPriceInclVat: 720,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-pcb-out',
      name: 'לוח אלקטרוני יחידת חוץ (הערכה, כולל עבודה בסיסית)',
      unitPriceInclVat: 890,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-relay',
      name: 'מגעון / קונטקטור חשמל (חומר + עבודה)',
      unitPriceInclVat: 260,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    /* ——— צנרת וחשמל ——— */
    {
      id: 'pl-demo-12',
      name: 'הארכת צנרת ניקוז / קירור (למטר)',
      unitPriceInclVat: 180,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-cable',
      name: 'הארכת כבל חשמל / ארון ממסר (עד 10 מ׳, הערכה)',
      unitPriceInclVat: 450,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-breaker',
      name: 'מפסק ייעודי למזגן (חומר + התקנה)',
      unitPriceInclVat: 320,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-line-hide',
      name: 'הסתרת צנרת בפרופיל / גומחה (למטר)',
      unitPriceInclVat: 140,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    /* ——— מסחרי / צנטרלי (הערכות) ——— */
    {
      id: 'pl-duct-mini',
      name: 'חיבור וכיול מזגן תעלה קטן (עבודה)',
      unitPriceInclVat: 650,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
    {
      id: 'pl-cassette',
      name: 'התקנת מזגן קסטה (עבודה + תליה, ללא המזגן)',
      unitPriceInclVat: 850,
      createdAt: iso(addDays(-60)),
      updatedAt: iso(addDays(-1)),
    },
  ]
}

/** גרסת מחירון ברירת־מחדל — העלה כשמוסיפים מזהי pl- חדשים ל־buildSeedPriceList */
export const PRICE_LIST_SEED_DATA_VERSION = 1

/** מוסיף לסוף הרשימה רק פריטי תבנית שחסרים (לא שוחזר פריט שנמחק בכוונה) */
export function appendMissingSeedPriceItems(
  existing: PriceListItem[],
): PriceListItem[] {
  const seed = buildSeedPriceList(new Date())
  const ids = new Set(existing.map((p) => p.id))
  const toAdd = seed.filter((s) => !ids.has(s.id))
  if (toAdd.length === 0) return existing
  return [...existing, ...toAdd]
}

/** נתוני הדגמה מלאים — לטעינה ידנית או אוטומטית כשאין נתונים */
export function createDemoData(): AppData {
  const now = new Date()
  const addDays = (n: number) => {
    const x = new Date(now)
    x.setDate(x.getDate() + n)
    return x
  }

  const c1 = 'demo-c1'
  const c2 = 'demo-c2'
  const c3 = 'demo-c3'
  const c4 = 'demo-c4'
  const c5 = 'demo-c5'
  const c6 = 'demo-c6'
  const c7 = 'demo-c7'
  const c8 = 'demo-c8'

  const callAt = (daysAgo: number, h: number, m: number) =>
    atHours(addDays(-daysAgo), h, m)

  const callLogs: CallLog[] = [
    {
      id: 'cl1',
      at: callAt(0, 9, 12),
      direction: 'in',
      phone: '050-1234567',
      customerId: c1,
      note: 'רעש במזגן — לחזור',
    },
    {
      id: 'cl2',
      at: callAt(0, 11, 40),
      direction: 'in',
      phone: '052-9876543',
      customerId: c2,
      note: 'אישור שעת התקנה',
    },
    {
      id: 'cl3',
      at: callAt(1, 16, 5),
      direction: 'out',
      phone: '054-1112233',
      customerId: c3,
      note: 'תזכורת תשלום',
    },
    {
      id: 'cl4',
      at: callAt(2, 8, 55),
      direction: 'in',
      phone: '050-0001111',
      customerId: c4,
      note: 'מתי מגיע החלק?',
    },
    {
      id: 'cl5',
      at: callAt(2, 14, 20),
      direction: 'in',
      phone: '053-9998877',
      customerId: null,
      note: 'מספר לא שמור — בקשת הצעה',
    },
    {
      id: 'cl6',
      at: callAt(3, 10, 0),
      direction: 'out',
      phone: '052-1112233',
      customerId: c6,
      note: 'עדכון הגעה',
    },
    {
      id: 'cl7',
      at: callAt(4, 18, 30),
      direction: 'in',
      phone: '054-7654321',
      customerId: c7,
      note: 'דליפה במזגן סלון',
    },
    {
      id: 'cl8',
      at: callAt(5, 12, 15),
      direction: 'in',
      phone: '050-2223344',
      customerId: null,
      note: 'ניתוק שיחה — לחזור',
    },
  ]

  return {
    customers: [
      {
        id: c1,
        name: 'יוסי כהן',
        phone: '050-1234567',
        priority: 'critical',
        group: 'service',
        status: 'callback',
        notes: 'תלונה על רעש בלילה — לחזור היום',
        callbackDate: ymd(now),
        createdAt: iso(addDays(-12)),
        updatedAt: iso(now),
        address: 'רחוב הרצל 12, תל אביב',
      },
      {
        id: c2,
        name: 'מיכל לוי',
        phone: '052-9876543',
        priority: 'high',
        group: 'installation',
        status: 'scheduled',
        notes: 'התקנה חדשה — וידוא חיבור ניקוז',
        callbackDate: ymd(addDays(1)),
        createdAt: iso(addDays(-8)),
        updatedAt: iso(now),
        address: 'שדרות רוטשילד 44',
      },
      {
        id: c3,
        name: 'דני אברהם',
        phone: '054-1112233',
        priority: 'medium',
        group: 'completion',
        status: 'pending_payment',
        notes: 'השלמת עבודה — ממתין לצ׳ק',
        callbackDate: ymd(addDays(-1)),
        createdAt: iso(addDays(-20)),
        updatedAt: iso(now),
        address: 'רמת גן, ז׳בוטינסקי 8',
      },
      {
        id: c4,
        name: 'שרה גולן',
        phone: '050-0001111',
        priority: 'low',
        group: 'service',
        status: 'waiting_parts',
        notes: 'חלקים בהזמנה — לעדכן כשמגיע',
        callbackDate: ymd(addDays(5)),
        createdAt: iso(addDays(-4)),
        updatedAt: iso(now),
        address: 'הרצליה פיתוח',
      },
      {
        id: c5,
        name: 'אבי מזרחי',
        phone: '053-4445566',
        priority: 'high',
        group: 'service',
        status: 'new',
        notes: 'התקשר — לא הספקתי לענות',
        callbackDate: ymd(now),
        createdAt: iso(addDays(0)),
        updatedAt: iso(now),
        address: 'פתח תקווה',
      },
      {
        id: c6,
        name: 'רונית שמעוני',
        phone: '052-1112233',
        priority: 'medium',
        group: 'installation',
        status: 'scheduled',
        notes: 'הרחבה לחדר ילדים',
        callbackDate: ymd(addDays(3)),
        createdAt: iso(addDays(-6)),
        updatedAt: iso(now),
        address: 'כפר סבא',
      },
      {
        id: c7,
        name: 'עומרי דוד',
        phone: '054-7654321',
        priority: 'critical',
        group: 'service',
        status: 'callback',
        notes: 'דליפת מים מהיחידה החיצונית',
        callbackDate: ymd(addDays(-2)),
        createdAt: iso(addDays(-1)),
        updatedAt: iso(now),
        address: 'רעננה',
      },
      {
        id: c8,
        name: 'נועה קריגר',
        phone: '050-8889900',
        priority: 'low',
        group: 'completion',
        status: 'done',
        notes: 'נסגר — שביעות רצון',
        callbackDate: null,
        createdAt: iso(addDays(-30)),
        updatedAt: iso(addDays(-2)),
        address: 'הוד השרון',
      },
    ],
    transactions: [
      {
        id: 'tx1',
        customerId: c3,
        type: 'charge',
        amount: 1850,
        description: 'שירות + חומר',
        date: ymd(addDays(-10)),
      },
      {
        id: 'tx2',
        customerId: c3,
        type: 'payment',
        amount: 500,
        description: 'מקדמה',
        date: ymd(addDays(-8)),
        paymentMethod: 'transfer',
        reference: 'העברה 4521',
      },
      {
        id: 'tx3',
        customerId: c1,
        type: 'charge',
        amount: 420,
        description: 'ביקור אבחון',
        date: ymd(addDays(-3)),
      },
      {
        id: 'tx4',
        customerId: c2,
        type: 'charge',
        amount: 6200,
        description: 'התקנה מלאה',
        date: ymd(addDays(-2)),
      },
      {
        id: 'tx5',
        customerId: c2,
        type: 'payment',
        amount: 3000,
        description: 'מקדמה התקנה',
        date: ymd(addDays(-1)),
        paymentMethod: 'card',
      },
      {
        id: 'tx6',
        customerId: c6,
        type: 'charge',
        amount: 2800,
        description: 'הרחבת קווים',
        date: ymd(addDays(-4)),
      },
      {
        id: 'tx7',
        customerId: c7,
        type: 'charge',
        amount: 350,
        description: 'ביקור חירום',
        date: ymd(addDays(0)),
      },
      {
        id: 'tx8',
        customerId: null,
        type: 'payment',
        amount: 200,
        description: 'החזר ספק (כללי)',
        date: ymd(addDays(-1)),
      },
      {
        id: 'tx9',
        customerId: c4,
        type: 'payment',
        amount: 180,
        description: 'שירות שוטף',
        date: ymd(addDays(-5)),
      },
      {
        id: 'tx10',
        customerId: c1,
        type: 'payment',
        amount: 200,
        description: 'תשלום חלקי אבחון',
        date: ymd(addDays(-2)),
        paymentMethod: 'cash',
      },
    ],
    meetings: [
      {
        id: 'm1',
        customerId: c2,
        title: 'התקנה — מיכל לוי',
        startAt: atHours(addDays(1), 10, 30),
        notes: 'להביא מדחס גיבוי',
      },
      {
        id: 'm2',
        customerId: null,
        title: 'ספק חלקים — איסוף',
        startAt: atHours(addDays(2), 14, 0),
        notes: '',
      },
      {
        id: 'm3',
        customerId: c6,
        title: 'הרחבה — רונית',
        startAt: atHours(addDays(3), 9, 0),
        notes: 'לוודא גישה לגג',
      },
      {
        id: 'm4',
        customerId: c1,
        title: 'חזרה — רעש לילה',
        startAt: atHours(addDays(0), 15, 45),
        notes: 'בדיקת משענת',
      },
      {
        id: 'm5',
        customerId: c5,
        title: 'ביקור אבחון — אבי',
        startAt: atHours(addDays(4), 11, 0),
        notes: '',
      },
      {
        id: 'm6',
        customerId: c7,
        title: 'דליפה — עומרי',
        startAt: atHours(addDays(-1), 17, 0),
        notes: 'היסטוריה',
      },
      {
        id: 'm7',
        customerId: c3,
        title: 'גבייה — דני',
        startAt: atHours(addDays(6), 10, 0),
        notes: 'לוודא צ׳ק',
      },
    ],
    callLogs,
    priceList: buildSeedPriceList(now),
    quotes: [
      {
        id: 'q-demo-1',
        customerId: c2,
        customerNameSnapshot: 'מיכל לוי',
        customerPhoneSnapshot: '052-9876543',
        lines: [
          {
            priceListItemId: 'pl-demo-3',
            description: 'התקנת מזגן עילי 1 כ״ס — חומר בסיסי, ניקוז וחשמל עד 5 מ׳',
            qty: 1,
            unitPriceInclVat: 3950,
          },
        ],
        totalInclVat: 3950,
        notes: 'תקף 14 יום',
        createdAt: iso(addDays(-3)),
        updatedAt: iso(addDays(-3)),
      },
    ],
  }
}
