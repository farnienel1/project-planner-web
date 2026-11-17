import { getClientAuthHeaders, jsonAuthHeaders } from '@/lib/security/clientAuthHeaders'
import {
  MFA_GATE_KEY,
  MFA_SIGNED_OUT_KEY,
  mfaGateMatches,
  mfaStartResult,
  mfaVerifyHref,
  safePostMfaPath,
  type MfaStartResult,
} from '@/lib/auth/mfa/mfaConstants'
import { extractMfaCode } from '@/lib/auth/mfa/mfaCode'

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

let startInflight: Promise<MfaStartResult> | null = null

export async function startEmailMfa(nextPath?: string): Promise<MfaStartResult> {
  if (startInflight) return startInflight
  startInflight = (async () => {
    const response = await fetch('/api/auth/mfa/start', {
      ...FETCH_OPTS,
      method: 'POST',
      headers: await jsonAuthHeaders(),
      body: JSON.stringify({ next: nextPath || readMfaGate()?.next || '' }),
    })
    const data = (await response.json().catch(() => ({}))) as Parameters<typeof mfaStartResult>[1]
    return mfaStartResult(response.status, data)
  })().finally(() => {
    startInflight = null
  })
  return startInflight
}

export async function verifyEmailMfa(code: string): Promise<{ next: string }> {
  const response = await fetch('/api/auth/mfa/verify', {
    ...FETCH_OPTS,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: extractMfaCode(code) }),
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

export async function grantMfaSkip(context?: { invitationId?: string; organizationId?: string }): Promise<void> {
  writeSignedOutFlag(false)
  await fetch('/api/auth/mfa/grant-setup', {
    ...FETCH_OPTS,
    method: 'POST',
    headers: await jsonAuthHeaders(),
    body: JSON.stringify({
      invitationId: context?.invitationId || undefined,
      organizationId: context?.organizationId || undefined,
    }),
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
  clearMfaBounces()
}

/**
 * The server cannot finish sign-in (a setup problem: the session cookie cannot be issued or fails its own check).
 * Retrying will not help, so this is never shown as "trying again" and never as "not verified".
 */
export const MFA_SETUP_ERROR_MESSAGE =
  "We can't finish signing you in because of a problem on our side. Please try again later or contact support."

export class MfaSetupError extends Error {
  readonly code = 'mfa_setup'
  constructor(message = MFA_SETUP_ERROR_MESSAGE) {
    super(message)
    this.name = 'MfaSetupError'
  }
}

export function isMfaSetupError(error: unknown): error is MfaSetupError {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code: unknown }).code === 'mfa_setup')
}

/** Loop guard (review of #359): after this many trips from the code screen to the app within the window, stop. */
export const MFA_BOUNCE_LIMIT = 3
export const MFA_BOUNCE_WINDOW_MS = 60_000
export const MFA_BOUNCE_KEY = 'pp.mfa.bounces'
export const MFA_BOUNCE_LOOP_MESSAGE =
  "We couldn't finish signing you in: the app kept sending you back to this page. Press Try again, or sign out and sign in again. If it keeps happening, contact support."
/** The button under the loop message: clears the guard's history (a reload alone would hit the guard again). */
export const MFA_BOUNCE_TRY_AGAIN_LABEL = 'Try again'

/** Pure: may another trip to the app go ahead, given the earlier trips (ms)? Returns the history to store. */
export function mfaBounceDecision(
  history: readonly number[],
  nowMs: number,
  limit = MFA_BOUNCE_LIMIT,
  windowMs = MFA_BOUNCE_WINDOW_MS
): { allowed: boolean; history: number[] } {
  const recent = history.filter((at) => Number.isFinite(at) && at <= nowMs && nowMs - at < windowMs)
  if (recent.length >= limit) return { allowed: false, history: recent }
  return { allowed: true, history: [...recent, nowMs] }
}

function readBounces(): number[] {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(MFA_BOUNCE_KEY) || '[]') as unknown
    return Array.isArray(parsed) ? parsed.filter((value): value is number => typeof value === 'number') : []
  } catch {
    return []
  }
}

/** Records one trip from the code screen to the app; false when the loop guard says stop. */
export function recordMfaBounce(nowMs = Date.now()): boolean {
  if (typeof window === 'undefined') return true
  const decision = mfaBounceDecision(readBounces(), nowMs)
  try {
    window.sessionStorage.setItem(MFA_BOUNCE_KEY, JSON.stringify(decision.history))
  } catch {
    /* private mode: no guard, as before */
  }
  return decision.allowed
}

export function clearMfaBounces() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(MFA_BOUNCE_KEY)
  } catch {
    /* private mode */
  }
}

/** The status check could not be answered right now (server 503 or no network). Try again; never a "not verified". */
export class MfaStatusUnavailableError extends Error {
  readonly code = 'mfa_status_unavailable'
  constructor(message = 'Could not check your sign-in right now. Trying again…') {
    super(message)
    this.name = 'MfaStatusUnavailableError'
  }
}

export function isMfaStatusUnavailable(error: unknown): error is MfaStatusUnavailableError {
  return Boolean(
    error && typeof error === 'object' && 'code' in error && (error as { code: unknown }).code === 'mfa_status_unavailable'
  )
}

export type MfaStatus = { pending: boolean; verified: boolean; next?: string }

/**
 * Throws `MfaStatusUnavailableError` on a 503 or a network failure, so callers retry rather than treat the
 * person as not verified. Any other answer is read as before.
 */
export async function readMfaStatus(): Promise<MfaStatus> {
  let response: Response
  try {
    response = await fetch('/api/auth/mfa/status', { ...FETCH_OPTS, headers: await getClientAuthHeaders() })
  } catch {
    throw new MfaStatusUnavailableError()
  }
  if (response.status === 503) {
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    if (body.error === 'setup') throw new MfaSetupError()
    throw new MfaStatusUnavailableError()
  }
  const data = (await response.json().catch(() => ({}))) as { pending?: boolean; verified?: boolean; next?: string }
  return { pending: data.pending === true, verified: data.verified === true, next: data.next }
}

/** Delay before retry `attempt` (0-based) of an unavailable status check: 1s, 2s, 4s … capped at 15s. */
export function mfaStatusRetryDelayMs(attempt: number): number {
  return Math.min(15_000, 1_000 * 2 ** Math.max(0, attempt))
}

/** `readMfaStatus`, retrying an unavailable answer up to `attempts` times with backoff; rethrows the last one. */
export async function readMfaStatusWithRetry(
  attempts = 4,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
): Promise<MfaStatus> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await readMfaStatus()
    } catch (error) {
      if (!isMfaStatusUnavailable(error) || attempt + 1 >= attempts) throw error
      await sleep(mfaStatusRetryDelayMs(attempt))
    }
  }
}
