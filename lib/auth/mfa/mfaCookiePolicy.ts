export const MFA_OK_COOKIE_LEGACY = 'pp_mfa_ok'
export const MFA_CHALLENGE_COOKIE_LEGACY = 'pp_mfa_challenge'
export const MFA_OK_COOKIE_HOST = '__Host-pp_mfa_ok'
export const MFA_CHALLENGE_COOKIE_HOST = '__Host-pp_mfa_challenge'

export type MfaCookieKind = 'ok' | 'challenge'

type HeaderReader = { get(name: string): string | null }

export function requestUsesHttps(request: { nextUrl?: { protocol?: string }; headers: HeaderReader }): boolean {
  if (request.nextUrl?.protocol === 'https:') return true
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
  if (proto === 'https') return true
  const forwarded = request.headers.get('forwarded') || ''
  return /(?:^|;)\s*proto=https\b/i.test(forwarded)
}

/** HTTPS, Netlify, or a production build — never key Secure off NODE_ENV alone when the request is already https. */
export function shouldSecureMfaCookies(request?: { nextUrl?: { protocol?: string }; headers: HeaderReader }): boolean {
  if (request && requestUsesHttps(request)) return true
  if (process.env.NETLIFY === 'true') return true
  const site = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.SITE_URL || ''
  if (site.startsWith('https://')) return true
  return process.env.NODE_ENV === 'production'
}

export function mfaCookieNames(secure: boolean): { ok: string; challenge: string } {
  return secure
    ? { ok: MFA_OK_COOKIE_HOST, challenge: MFA_CHALLENGE_COOKIE_HOST }
    : { ok: MFA_OK_COOKIE_LEGACY, challenge: MFA_CHALLENGE_COOKIE_LEGACY }
}

export function mfaCookieName(kind: MfaCookieKind, secure: boolean): string {
  return mfaCookieNames(secure)[kind]
}

export function cookieOptions(maxAgeMs: number, secure: boolean) {
  const maxAge = Math.max(0, Math.floor(maxAgeMs / 1000))
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
    expires: new Date(Date.now() + Math.max(0, maxAgeMs)),
  }
}

export function expireMfaCookieOptions(secure: boolean) {
  return { ...cookieOptions(0, secure), maxAge: 0 }
}

export function readMfaCookie(
  request: { cookies: { get(name: string): { value: string } | undefined }; nextUrl?: { protocol?: string }; headers: HeaderReader },
  kind: MfaCookieKind
): string | undefined {
  const secure = shouldSecureMfaCookies(request)
  return request.cookies.get(mfaCookieName(kind, secure))?.value
}

type CookieSetter = {
  set: (name: string, value: string, options: ReturnType<typeof cookieOptions>) => void
}

/** Write the generation that matches this request. On HTTPS, also expire the old `pp_mfa_*` cookies with Secure so they actually die. */
export function writeMfaCookie(
  cookies: CookieSetter,
  request: { nextUrl?: { protocol?: string }; headers: HeaderReader },
  kind: MfaCookieKind,
  value: string,
  maxAgeMs: number
) {
  const secure = shouldSecureMfaCookies(request)
  cookies.set(mfaCookieName(kind, secure), value, cookieOptions(maxAgeMs, secure))
  if (secure) {
    cookies.set(mfaCookieName(kind, false), '', expireMfaCookieOptions(true))
  }
}

export function clearMfaCookies(
  cookies: CookieSetter,
  request?: { nextUrl?: { protocol?: string }; headers: HeaderReader }
) {
  const secure = request ? shouldSecureMfaCookies(request) : shouldSecureMfaCookies()
  cookies.set(MFA_OK_COOKIE_HOST, '', expireMfaCookieOptions(true))
  cookies.set(MFA_CHALLENGE_COOKIE_HOST, '', expireMfaCookieOptions(true))
  cookies.set(MFA_OK_COOKIE_LEGACY, '', expireMfaCookieOptions(secure))
  cookies.set(MFA_CHALLENGE_COOKIE_LEGACY, '', expireMfaCookieOptions(secure))
}
