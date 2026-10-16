export const ANALYTICS_CONSENT_STORAGE_KEY = 'pp.analyticsConsent.v1'
export const PRODUCT_SESSION_ID_KEY = 'pp.productSessionId'
export const LOGIN_TRACKED_KEY = 'pp.loginTracked'
export const ANALYTICS_CONSENT_CHANGE_EVENT = 'pp.analyticsConsent'
export const ANALYTICS_CONSENT_OPEN_SETTINGS_EVENT = 'pp.analyticsConsent.openSettings'

export type AnalyticsConsentChoice = 'granted' | 'denied'

export const ANALYTICS_CONSENT_COPY =
  'We record first-party usage events (for example that a page was opened) with your user and organisation ids and the page path. We do not store names or emails in those events. Reject still lets you use the product.'

let memory: AnalyticsConsentChoice | null | undefined

function canUseWindow(): boolean {
  return typeof window !== 'undefined'
}

function parseChoice(value: string | null): AnalyticsConsentChoice | null {
  return value === 'granted' || value === 'denied' ? value : null
}

function notifyAnalyticsConsentChanged(): void {
  if (!canUseWindow()) return
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGE_EVENT))
}

export function getAnalyticsConsent(): AnalyticsConsentChoice | null {
  if (!canUseWindow()) return null
  try {
    const choice = parseChoice(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY))
    memory = choice
    return choice
  } catch {
    return memory === 'granted' || memory === 'denied' ? memory : null
  }
}

export function hasGrantedAnalyticsConsent(): boolean {
  return getAnalyticsConsent() === 'granted'
}

export function clearProductAnalyticsRuntime(): void {
  if (!canUseWindow()) return
  try {
    window.sessionStorage.removeItem(PRODUCT_SESSION_ID_KEY)
  } catch {
    /* private mode */
  }
  try {
    window.sessionStorage.removeItem(LOGIN_TRACKED_KEY)
  } catch {
    /* private mode */
  }
}

export function setAnalyticsConsent(choice: AnalyticsConsentChoice): void {
  if (choice !== 'granted' && choice !== 'denied') return
  memory = choice
  if (choice === 'denied') clearProductAnalyticsRuntime()
  if (canUseWindow()) {
    try {
      window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, choice)
    } catch {
      /* private mode */
    }
  }
  notifyAnalyticsConsentChanged()
}

export function clearAnalyticsConsent(): void {
  memory = null
  clearProductAnalyticsRuntime()
  if (canUseWindow()) {
    try {
      window.localStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY)
    } catch {
      /* private mode */
    }
  }
  notifyAnalyticsConsentChanged()
}

export function subscribeAnalyticsConsent(onChange: (choice: AnalyticsConsentChoice | null) => void): () => void {
  if (!canUseWindow()) return () => undefined
  const handler = () => onChange(getAnalyticsConsent())
  window.addEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

export function openAnalyticsConsentSettings(): void {
  if (!canUseWindow()) return
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_OPEN_SETTINGS_EVENT))
}

export function subscribeAnalyticsConsentSettings(onOpen: () => void): () => void {
  if (!canUseWindow()) return () => undefined
  window.addEventListener(ANALYTICS_CONSENT_OPEN_SETTINGS_EVENT, onOpen)
  return () => window.removeEventListener(ANALYTICS_CONSENT_OPEN_SETTINGS_EVENT, onOpen)
}

export function resetAnalyticsConsentMemoryForTests(): void {
  memory = undefined
}
