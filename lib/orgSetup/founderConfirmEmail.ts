export const FOUNDER_CONFIRM_STORAGE_KEY = 'pp.founderConfirmEmail'

export type FounderConfirmEmailPayload = {
  confirmationToken: string
  organizationName: string
  firstName: string
  to: string
  lastError?: string
}

export function saveFounderConfirmEmailPayload(payload: FounderConfirmEmailPayload): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(FOUNDER_CONFIRM_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // private mode
  }
}

export function loadFounderConfirmEmailPayload(): FounderConfirmEmailPayload | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(FOUNDER_CONFIRM_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FounderConfirmEmailPayload
    if (!parsed?.confirmationToken || !parsed?.to) return null
    return parsed
  } catch {
    return null
  }
}

export function clearFounderConfirmEmailPayload(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(FOUNDER_CONFIRM_STORAGE_KEY)
  } catch {
    // ignore
  }
}
