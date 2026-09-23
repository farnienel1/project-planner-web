import { jsonAuthHeaders } from '@/lib/security/clientAuthHeaders'
import { MFA_GATE_KEY, MFA_SIGNED_OUT_KEY, mfaGateMatches, mfaVerifyHref, safePostMfaPath } from '@/lib/auth/mfa/mfaConstants'

export { MFA_GATE_KEY, MFA_SIGNED_OUT_KEY, mfaGateMatches, mfaVerifyHref, safePostMfaPath }

const FETCH_OPTS: RequestInit = { credentials: 'include', cache: 'no-store' }

export class MfaRequiredError extends Error {
  readonly code = 'mfa_required'
  constructor(message = 'Enter the verification code emailed to you to finish signing in.') {
    super(message)
    this.name = 'MfaRequiredError'
  }
}

export function isMfaRequiredError(error: unknown): error is MfaRequiredError {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code: unknown }).code === 'mfa_required')
}

export function writeSignedOutFlag(signedOut: boolean) {
  if (typeof window === 'undefined') return
  try {
    if (signedOut) window.localStorage.setItem(MFA_SIGNED_OUT_KEY, '1')
    else window.localStorage.removeItem(MFA_SIGNED_OUT_KEY)
  } catch {
    /* private mode */
  }
}

export function readSignedOutFlag(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(MFA_SIGNED_OUT_KEY) === '1'
  } catch {
    return false
  }
}

export function openMfaGate(uid: string, nextPath?: string) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(MFA_GATE_KEY, JSON.stringify({ uid, next: nextPath || '', at: Date.now() }))
  } catch {
    /* private mode */
  }
}

export function readMfaGate(): { uid: string; next: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(MFA_GATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { uid?: string; next?: string }
    if (!parsed.uid) return null
    return { uid: parsed.uid, next: parsed.next || '' }
  } catch {
    return null
  }
}

export function clearMfaGate() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(MFA_GATE_KEY)
  } catch {
    /* private mode */
  }
}

export function isMfaGateOpen(uid?: string | null): boolean {
  return mfaGateMatches(readMfaGate()?.uid, uid)
}

async function readError(response: Response): Promise<{ error: string; retryAfterSec?: number }> {
  const data = (await response.json().catch(() => ({}))) as { error?: string; retryAfterSec?: number }
  return {
    error: data.error || `Request failed (${response.status})`,
    retryAfterSec: data.retryAfterSec,
  }
}

let startInflight: Promise<{ required: boolean; skipped?: boolean; sent?: boolean; retryAfterSec?: number }> | null = null

export async function startEmailMfa(nextPath?: string): Promise<{
  required: boolean
  skipped?: boolean
  sent?: boolean
  retryAfterSec?: number
}> {
  if (startInflight) return startInflight
  startInflight = (async () => {
    const response = await fetch('/api/auth/mfa/start', {
      ...FETCH_OPTS,
      method: 'POST',
      headers: await jsonAuthHeaders(),
      body: JSON.stringify({ next: nextPath || readMfaGate()?.next || '' }),
    })
    const data = (await response.json().catch(() => ({}))) as {
      error?: string
      required?: boolean
      skipped?: boolean
      sent?: boolean
      retryAfterSec?: number
    }
    if (response.status === 429) {
      return { required: true, sent: true, retryAfterSec: data.retryAfterSec }
    }
    if (!response.ok) {
      throw new Error(data.error || 'Could not send a verification code. Sign in again to retry.')
    }
    return {
      required: data.required !== false && !data.skipped,
      skipped: data.skipped === true,
      sent: data.sent === true,
      retryAfterSec: data.retryAfterSec,
    }
  })().finally(() => {
    startInflight = null
  })
  return startInflight
}

export async function verifyEmailMfa(code: string): Promise<{ next: string }> {
  const response = await fetch('/api/auth/mfa/verify', {
    ...FETCH_OPTS,
    method: 'POST',
    headers: await jsonAuthHeaders(),
    body: JSON.stringify({ code }),
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string; next?: string }
  if (!response.ok) throw new Error(data.error || 'That code was not accepted.')
  return { next: data.next || '' }
}

export async function resendEmailMfa(): Promise<{ retryAfterSec?: number; sent?: boolean }> {
  if (startInflight) {
    const started = await startInflight
    return { sent: started.sent, retryAfterSec: started.retryAfterSec }
  }
  const response = await fetch('/api/auth/mfa/resend', {
    ...FETCH_OPTS,
    method: 'POST',
    headers: await jsonAuthHeaders(),
    body: JSON.stringify({}),
  })
  if (response.status === 401) {
    return startEmailMfa(readMfaGate()?.next)
  }
  const data = await readError(response)
  if (response.status === 429) {
    const error = new Error(data.error) as Error & { retryAfterSec?: number }
    error.retryAfterSec = data.retryAfterSec
    throw error
  }
  if (!response.ok) {
    const error = new Error(data.error) as Error & { retryAfterSec?: number }
    error.retryAfterSec = data.retryAfterSec
    throw error
  }
  return { sent: true, retryAfterSec: data.retryAfterSec }
}

export async function grantMfaSkip(): Promise<void> {
  writeSignedOutFlag(false)
  await fetch('/api/auth/mfa/grant-setup', {
    ...FETCH_OPTS,
    method: 'POST',
    headers: await jsonAuthHeaders(),
  })
}

export async function clearMfaCookiesOnly(): Promise<void> {
  try {
    await fetch('/api/auth/mfa/logout', { ...FETCH_OPTS, method: 'POST' })
  } catch {
    /* still continue locally */
  }
}

export async function clearMfaSession(): Promise<void> {
  await clearMfaCookiesOnly()
  clearMfaGate()
}

export async function readMfaStatus(): Promise<{ pending: boolean; verified: boolean; next?: string }> {
  try {
    const response = await fetch('/api/auth/mfa/status', FETCH_OPTS)
    const data = (await response.json().catch(() => ({}))) as { pending?: boolean; verified?: boolean; next?: string }
    return { pending: data.pending === true, verified: data.verified === true, next: data.next }
  } catch {
    return { pending: false, verified: false }
  }
}
