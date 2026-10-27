export const MFA_GATE_KEY = 'pp.mfa.gate'
export const MFA_SIGNED_OUT_KEY = 'pp.signedOut'

export const POST_AUTH_PATHS = ['/dashboard', '/dashboard/change-organisation', '/developer'] as const
export type PostAuthPath = (typeof POST_AUTH_PATHS)[number]

export function mfaVerifyHref(next: PostAuthPath): string {
  return `/auth/mfa?next=${encodeURIComponent(next)}`
}

/** A verification gate is only open for that Firebase uid — never for a missing user. */
export function mfaGateMatches(gateUid?: string | null, uid?: string | null): boolean {
  return Boolean(gateUid && uid && gateUid === uid)
}

export function postSignOutHref(pathname?: string | null): '/login' | '/developer-login' {
  return (pathname || '').startsWith('/developer') ? '/developer-login' : '/login'
}

export function safePostMfaPath(next: string | undefined | null, fallback: PostAuthPath = '/dashboard'): PostAuthPath {
  const path = (next || '').trim().split('?')[0]
  if (path === '/developer' || path.startsWith('/developer/')) return '/developer'
  if (path === '/dashboard/change-organisation') return '/dashboard/change-organisation'
  if (path === '/dashboard' || path.startsWith('/dashboard/')) return '/dashboard'
  return fallback === '/developer' ? '/developer' : fallback === '/dashboard/change-organisation' ? '/dashboard/change-organisation' : '/dashboard'
}

export type MfaStartResult = { required: boolean; skipped?: boolean; sent?: boolean; retryAfterSec?: number }

/**
 * Read a /api/auth/mfa/start reply. The route answers an active cooldown with 200 + retryAfterSec,
 * so a 429 there is only the rate limiter: no code was emailed and the screen must not say it was.
 */
export function mfaStartResult(
  status: number,
  data: { error?: string; required?: boolean; skipped?: boolean; sent?: boolean; retryAfterSec?: number }
): MfaStartResult {
  if (status === 429) {
    const wait = data.retryAfterSec && data.retryAfterSec > 0 ? ` Try again in ${data.retryAfterSec} seconds.` : ''
    const error = new Error(`Too many verification codes were requested, so no new code was sent.${wait}`) as Error & {
      retryAfterSec?: number
    }
    error.retryAfterSec = data.retryAfterSec
    throw error
  }
  if (status < 200 || status >= 300) {
    throw new Error(data.error || 'Could not send a verification code. Sign in again to retry.')
  }
  return {
    required: data.required !== false && !data.skipped,
    skipped: data.skipped === true,
    sent: data.sent === true,
    retryAfterSec: data.retryAfterSec,
  }
}
