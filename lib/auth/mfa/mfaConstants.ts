export const MFA_CHALLENGE_COOKIE = 'pp_mfa_challenge'
export const MFA_OK_COOKIE = 'pp_mfa_ok'
export const MFA_GATE_KEY = 'pp.mfa.gate'
export const MFA_SIGNED_OUT_KEY = 'pp.signedOut'

export function mfaVerifyHref(next: '/dashboard' | '/developer'): string {
  return `/auth/mfa?next=${encodeURIComponent(next)}`
}

/** A verification gate is only open for that Firebase uid — never for a missing user. */
export function mfaGateMatches(gateUid?: string | null, uid?: string | null): boolean {
  return Boolean(gateUid && uid && gateUid === uid)
}

export function postSignOutHref(pathname?: string | null): '/login' | '/developer-login' {
  return (pathname || '').startsWith('/developer') ? '/developer-login' : '/login'
}

export function expireMfaCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  }
}

export function safePostMfaPath(next: string | undefined | null, fallback: '/dashboard' | '/developer' = '/dashboard'): '/dashboard' | '/developer' {
  const path = (next || '').trim().split('?')[0]
  if (path === '/developer' || path.startsWith('/developer/')) return '/developer'
  if (path === '/dashboard' || path.startsWith('/dashboard/')) return '/dashboard'
  return fallback
}
