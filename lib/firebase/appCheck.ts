import type { FirebaseApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'

let started = false

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
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  })
}
