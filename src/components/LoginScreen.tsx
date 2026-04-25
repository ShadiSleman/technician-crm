import { useState, type FormEvent } from 'react'
import { fetchAuthLogin } from '../api/authLogin'
import { AiadLogoMark } from './AiadLogoMark'

type Props = {
  apiBase: string
  initialError?: string
  onLoggedIn: (token: string) => void
}

/**
 * הוצג כש־VITE_API_URL / app-config מגדירים שרת, אבל אין JWT (ואין VITE_LOGIN מלא).
 * בלי מסך זה כל הלקוחות נשמרים רק ב־localStorage — לא ב־Mongo.
 */
export function LoginScreen({ apiBase, initialError, onLoggedIn }: Props) {
  const [u, setU] = useState(
    () => import.meta.env.VITE_LOGIN_USERNAME?.trim() || '',
  )
  const [p, setP] = useState('')
  const [err, setErr] = useState<string | null>(initialError || null)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      const res = await fetchAuthLogin(apiBase, u.trim(), p)
      if (res.token) onLoggedIn(res.token)
      else setErr(res.error || 'התחברות נכשלה')
    } catch {
      setErr('אין חיבור לשרת. בדוק אינטרנט ו-HTTPS.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand-mark">
          <AiadLogoMark variant="compact" />
        </div>
        <h1 className="login-title">התחברות לענן</h1>
        <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>
          בלי כניסה, הנתונים נשמרים רק במכשיר (לא ב-Mongo). התחבר עם משתמש
          שקיים ב־<code>hvacusers</code> (ריצת
          seed על השרת).
        </p>
        <p className="login-api-hint muted" title={apiBase}>
          {apiBase}
        </p>
        <form onSubmit={submit} className="form-grid">
          <div>
            <label className="field">שם משתמש</label>
            <input
              name="username"
              autoComplete="username"
              value={u}
              onChange={(e) => setU(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="field">סיסמה</label>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={p}
              onChange={(e) => setP(e.target.value)}
              required
            />
          </div>
          {err && <p className="login-error">{err}</p>}
          <div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'מתחבר…' : 'התחבר'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
