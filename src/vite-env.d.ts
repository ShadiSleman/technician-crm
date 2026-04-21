/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  /** Auto-login (bundled in client — use only for a single trusted device / internal build). */
  readonly VITE_LOGIN_USERNAME?: string
  readonly VITE_LOGIN_PASSWORD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
