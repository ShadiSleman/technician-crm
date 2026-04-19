import { useEffect, useState } from 'react'
import App from './App.tsx'
import {
  getResolvedApiBase,
  loadBundledApiConfig,
} from './api/apiBase'
import { BootSplash } from './components/BootSplash.tsx'
import { LoginScreen } from './components/LoginScreen.tsx'

const TOKEN_KEY = 'hvac-crm-jwt'

export default function Root() {
  const [booted, setBooted] = useState(false)
  const [api, setApi] = useState('')
  const [token, setToken] = useState<string | null>(() =>
    typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem(TOKEN_KEY)
      : null,
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

  function handleLoggedIn(t: string) {
    sessionStorage.setItem(TOKEN_KEY, t)
    setApi(getResolvedApiBase())
    setToken(t)
  }

  function handleLogout() {
    sessionStorage.removeItem(TOKEN_KEY)
    setToken(null)
  }

  if (!booted) {
    return <BootSplash />
  }

  if (!token) {
    return <LoginScreen apiBase={api} onLoggedIn={handleLoggedIn} />
  }

  const activeApi = getResolvedApiBase() || api
  if (!activeApi) {
    handleLogout()
    return <LoginScreen apiBase="" onLoggedIn={handleLoggedIn} />
  }

  return (
    <App
      remoteApiBase={activeApi}
      remoteToken={token}
      onRemoteLogout={handleLogout}
    />
  )
}
