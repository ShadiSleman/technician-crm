/**
 * POST /auth/login — parse safely so HTML 404/502 pages do not throw.
 */
export async function fetchAuthLogin(
  apiBase: string,
  username: string,
  password: string,
): Promise<{ token?: string; error?: string }> {
  const base = apiBase.replace(/\/+$/, '')
  const url = `${base}/auth/login`
  let r: Response
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
  } catch {
    return { error: 'אין חיבור לשרת. בדוק אינטרנט, VPN, ו-HTTPS.' }
  }
  const text = await r.text()
  let body: { token?: string; error?: string } = {}
  try {
    if (text) body = JSON.parse(text) as { token?: string; error?: string }
  } catch {
    if (r.status === 404) {
      return {
        error:
          'הכתובת שגויה. חייבת להסתיים ב- /api (למשל …onrender.com/api) — בדוק באפליקציה / בהגדרות שמורה.',
      }
    }
    return {
      error: `השרת החזיר HTML במקום JSON (קוד ${r.status}). בדוק בכתובת …/api/health (חייב /api).`,
    }
  }
  if (body.token) return { token: body.token }
  return { error: body.error || (r.ok ? 'התחברות נכשלה' : `שגיאה ${r.status}`) }
}
