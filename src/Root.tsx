import { useEffect, useState } from 'react'
import App from './App.tsx'
import { fetchAuthLogin } from './api/authLogin'
import {
  getResolvedApiBase,
  loadBundledApiConfig,
} from './api/apiBase'
import { BootSplash } from './components/BootSplash.tsx'
import { LoginScreen } from './components/LoginScreen.tsx'

const TOKEN_KEY = 'hvac-crm-jwt'

/** localStorage — נשמר אחרי סגירת האפליקציה (בניגוד ל-sessionStorage ב-WebView). */
function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const a = localStorage.getItem(TOKEN_KEY)
    if (a) return a
    const b = sessionStorage.getItem(TOKEN_KEY)
    if (b) {
      localStorage.setItem(TOKEN_KEY, b)
      sessionStorage.removeItem(TOKEN_KEY)
      return b
    }
  } catch {
    /* private mode */
  }
  return null
}

function setStoredToken(token: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
      sessionStorage.removeItem(TOKEN_KEY)
    } else {
      localStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(TOKEN_KEY)
    }
  } catch {
    /* private mode */
  }
}

async function fetchToken(
  base: string,
  username: string,
  password: string,
): Promise<{ token?: string; error?: string }> {
  return fetchAuthLogin(base, username, password)
}

export default function Root() {
  const [booted, setBooted] = useState(false)
  const [api, setApi] = useState('')
  const [authReady, setAuthReady] = useState(false)
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [envLoginError, setEnvLoginError] = useState<string | undefined>(
    undefined,
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await loadBundledApiConfig()
      if (!cancelled) {
        setApi(getResolvedApiBase())
        setBooted(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!booted) return
    let cancelled = false
    const base = (getResolvedApiBase() || api).trim()
    if (!base) {
      setStoredToken(null)
      setToken(null)
      setEnvLoginError(undefined)
      setAuthReady(true)
      return
    }

    const user = import.meta.env.VITE_LOGIN_USERNAME?.trim()
    const pass = import.meta.env.VITE_LOGIN_PASSWORD?.trim()

    void (async () => {
      if (user && pass) {
        try {
          const res = await fetchToken(base, user, pass)
          if (cancelled) return
          if (res.token) {
            setStoredToken(res.token)
            setToken(res.token)
            setEnvLoginError(undefined)
          } else {
            setStoredToken(null)
            setToken(null)
            setEnvLoginError(res.error)
          }
        } catch {
          if (!cancelled) {
            setStoredToken(null)
            setToken(null)
            setEnvLoginError('אין חיבור לשרת. בדוק אינטרנט, VPN, ו-HTTPS.')
          }
        }
        setAuthReady(true)
        return
      }
      setEnvLoginError(undefined)

      const existing = getStoredToken()
      if (existing) {
        setToken(existing)
        setAuthReady(true)
        return
      }

      setToken(null)
      setAuthReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [booted, api])

  function handleLogout() {
    setStoredToken(null)
    setToken(null)
  }

  if (!booted || !authReady) {
    return <BootSplash />
  }

  const activeApi = (getResolvedApiBase() || api).trim()
  const isRemote = Boolean(activeApi && token)

  if (activeApi && !token) {
    return (
      <LoginScreen
        apiBase={activeApi}
        initialError={envLoginError}
        onLoggedIn={(t) => {
          setStoredToken(t)
          setToken(t)
          setEnvLoginError(undefined)
        }}
      />
    )
  }

  if (isRemote) {
    return (
      <App
        remoteApiBase={activeApi}
        remoteToken={token!}
        onRemoteLogout={handleLogout}
      />
    )
  }

  return <App />
}
