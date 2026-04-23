/** Saved on device so Android can reach your PC or cloud API (Mongo is only used on the server). */
const STORAGE_KEY = 'hvac_crm_api_base'

function trimBase(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

/**
 * If the user saved only the host (e.g. https://x.onrender.com), routes become
 * /auth/login on the host root → 404 HTML and login breaks. The API is mounted
 * at /api on this project.
 */
export function normalizeApiBase(s: string): string {
  const t = trimBase(s)
  if (!t) return t
  try {
    const u = new URL(t)
    const path = (u.pathname || '/').replace(/\/+$/, '') || '/'
    if (path === '/' || path === '') {
      u.pathname = '/api'
      // normalize trailing slash: keep path /api
      return trimBase(u.toString())
    }
  } catch {
    /* not a full URL, return as-is */
  }
  return t
}

/**
 * Order: saved URL on device → Vite env → dev-only localhost fallback.
 * Production: bake VITE_API_URL at build time (see .env.production / app-config.json).
 */
export function getResolvedApiBase(): string {
  if (typeof window === 'undefined') return ''
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved?.trim()) return normalizeApiBase(saved)
  } catch {
    /* private mode / storage blocked */
  }
  const env = import.meta.env.VITE_API_URL?.trim()
  if (env) return normalizeApiBase(env)
  if (import.meta.env.DEV) return 'http://localhost:5050/api'
  return ''
}

export function setStoredApiBase(url: string): void {
  if (typeof window === 'undefined') return
  const u = normalizeApiBase(url)
  if (!u) {
    window.localStorage.removeItem(STORAGE_KEY)
    return
  }
  window.localStorage.setItem(STORAGE_KEY, u)
}

export function clearStoredApiBase(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}

/**
 * Shipped with the APK as `app-config.json` (from /public).
 * Fills the default API URL when the user has not saved one yet and VITE_API_URL was not set at build time.
 * Set `apiBase` to your public HTTPS API before `npm run build` (e.g. https://your-api.onrender.com/api).
 */
export async function loadBundledApiConfig(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    if (window.localStorage.getItem(STORAGE_KEY)?.trim()) return
    if (import.meta.env.VITE_API_URL?.trim()) return
    const r = await fetch(`${import.meta.env.BASE_URL}app-config.json`, {
      cache: 'no-store',
    })
    if (!r.ok) return
    const j = (await r.json()) as { apiBase?: string }
    const ab = j?.apiBase?.trim()
    if (ab) window.localStorage.setItem(STORAGE_KEY, normalizeApiBase(ab))
  } catch {
    /* missing file or file:// quirks */
  }
}
