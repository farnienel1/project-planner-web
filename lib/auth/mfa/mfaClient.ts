export const MFA_GATE_KEY = 'pp.mfa.gate'

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
  const gate = readMfaGate()
  if (!gate) return false
  if (uid && gate.uid !== uid) return false
  return true
}

export async function startEmailMfa(idToken: string, nextPath?: string): Promise<{ required: boolean; skipped?: boolean }> {
  const response = await fetch('/api/auth/mfa/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ next: nextPath || '' }),
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string; required?: boolean; skipped?: boolean }
  if (!response.ok) {
    throw new Error(data.error || 'Could not send a verification code. Sign in again to retry.')
  }
  return { required: data.required !== false && !data.skipped, skipped: data.skipped === true }
}

export async function verifyEmailMfa(code: string): Promise<void> {
  const response = await fetch('/api/auth/mfa/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(data.error || 'That code was not accepted.')
}

export async function resendEmailMfa(): Promise<{ retryAfterSec?: number }> {
  const response = await fetch('/api/auth/mfa/resend', { method: 'POST' })
  const data = (await response.json().catch(() => ({}))) as { error?: string; retryAfterSec?: number }
  if (!response.ok) {
    const error = new Error(data.error || 'Could not resend the code yet.') as Error & { retryAfterSec?: number }
    error.retryAfterSec = data.retryAfterSec
    throw error
  }
  return { retryAfterSec: data.retryAfterSec }
}
