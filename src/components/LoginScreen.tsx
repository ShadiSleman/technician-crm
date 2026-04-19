import { type FormEvent, useEffect, useState } from 'react'
import { setStoredApiBase } from '../api/apiBase'

type Props = {
  apiBase: string
  onLoggedIn: (token: string) => void
}

export function LoginScreen({ apiBase, onLoggedIn }: Props) {
  const [serverUrl, setServerUrl] = useState(apiBase)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setServerUrl(apiBase)
  }, [apiBase])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    const base = serverUrl.trim().replace(/\/+$/, '')
    if (!base) {
      setErr('Enter the API server URL (see hint below).')
      return
    }
    setBusy(true)
    try {
      setStoredApiBase(base)
      const r = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      })
      const body = (await r.json().catch(() => ({}))) as {
        error?: string
        token?: string
      }
      if (!r.ok || !body.token) {
        setErr(body.error || 'Login failed')
        return
      }
      onLoggedIn(body.token)
    } catch {
      setErr(
        'Cannot reach the API. On Android use your PC LAN IP, not localhost — e.g. http://192.168.1.10:5050/api',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card customer-card pri-low">
        <h1 className="login-title">מעקב לקוחות · מזגנים</h1>
        <p className="muted login-sub">התחברות · Login</p>
        <form className="login-form" onSubmit={(e) => void submit(e)}>
          <label className="field">
            API server URL
            <input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              dir="ltr"
              style={{ textAlign: 'left' }}
              placeholder="http://YOUR_PC_IP:5050/api"
              autoComplete="off"
            />
          </label>
          <p className="muted login-api-hint">
            Data is stored in <strong>cloud MongoDB</strong>. The phone only talks to your{' '}
            <strong>public API</strong> (HTTPS), e.g. <code>https://your-api.onrender.com/api</code>.
            <br />
            <strong>localhost / home PC IP</strong> does not work for friends on another network —
            deploy the server (see <code>server/DEPLOY.md</code>), then paste that URL here or ship
            it inside <code>app-config.json</code>. This field is saved on the device.
          </p>
          <label className="field">
            שם משתמש
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              dir="ltr"
              style={{ textAlign: 'left' }}
            />
          </label>
          <label className="field">
            סיסמה
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
              style={{ textAlign: 'left' }}
            />
          </label>
          {err ? <p className="login-error">{err}</p> : null}
          <button type="submit" className="btn btn-primary login-submit" disabled={busy}>
            {busy ? 'מתחבר…' : 'כניסה'}
          </button>
        </form>
      </div>
    </div>
  )
}
