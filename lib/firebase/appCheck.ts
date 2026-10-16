import type { FirebaseApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check'

let started = false
let instance: AppCheck | null = null

export function recaptchaEnterpriseSiteKey(): string {
  return (process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY || '').trim()
}

export function shouldUseAppCheckDebugToken(nodeEnv = process.env.NODE_ENV): boolean {
  return nodeEnv !== 'production'
}

/** Once per browser tab, next to initializeApp. No-op on the server or when the site key is missing. */
export function ensureAppCheck(app: FirebaseApp): void {
  if (started || typeof window === 'undefined') return
  const siteKey = recaptchaEnterpriseSiteKey()
  if (!siteKey) return
  started = true
  if (shouldUseAppCheckDebugToken()) {
    ;(self as typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true
  }
  instance = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  })
}

export function initializedAppCheck(): AppCheck | null {
  return instance
}

/** Wait until reCAPTCHA has minted a token. First Auth/gate calls used to fire with none. */
export async function awaitAppCheckToken(
  appCheck: AppCheck | null,
  options?: {
    timeoutMs?: number
    now?: () => number
    sleep?: (ms: number) => Promise<void>
    readToken?: (forceRefresh: boolean) => Promise<string>
  }
): Promise<string> {
  if (!appCheck) return ''
  if (typeof window === 'undefined' && !options?.readToken) return ''
  const timeoutMs = options?.timeoutMs ?? 8_000
  const now = options?.now || Date.now
  const sleep = options?.sleep || ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))
  const readToken =
    options?.readToken ||
    (async (forceRefresh: boolean) => {
      const { getToken } = await import('firebase/app-check')
      const { token } = await getToken(appCheck, forceRefresh)
      return token || ''
    })
  const deadline = now() + timeoutMs
  while (now() < deadline) {
    try {
      const token = await readToken(false)
      if (token) return token
    } catch {
      /* reCAPTCHA still loading */
    }
    await sleep(250)
  }
  try {
    return (await readToken(true)) || ''
  } catch {
    return ''
  }
}
