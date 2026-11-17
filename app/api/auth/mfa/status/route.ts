import { NextRequest, NextResponse } from 'next/server'
import { decodeMfaChallenge, decodeMfaOk, mfaOkBelongsTo, readMfaCookie, writeMfaCookie } from '@/lib/auth/mfa/mfaCookies'
import { clearSessionCookie } from '@/lib/auth/mfa/mfaCookiePolicy'
import { sessionCookiePlan, verifyAppSessionCookie } from '@/lib/auth/mfa/mfaSessionCookie'
import { mintFirebaseSessionCookie } from '@/lib/auth/mfa/mfaSessionCookieMint'
import { lookupFirebaseIdToken } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

function bearer(request: NextRequest): string {
  const header = request.headers.get('authorization') || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

function unavailable() {
  return NextResponse.json(
    { error: 'unavailable', retry: true },
    { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '2' } }
  )
}

/**
 * "verified" only when the ok cookie belongs to the person signed in now: the cookie's signed uid must equal the
 * uid of the caller's verified Firebase ID token. A cookie left in the browser by another account, or a request
 * with no (or an invalid) token, is never verified. When the token could not be checked for a passing reason
 * (Auth unreachable, 429 or 5xx), the answer is 503 `{ error: 'unavailable' }` so the browser tries again instead
 * of sending the person to the code screen.
 *
 * Owner decision 17 Nov (server-side session cookie): when verified, this route also makes sure the browser holds
 * a Firebase session cookie for that same uid — the cookie the middleware checks for /dashboard and /developer
 * (lib/auth/mfa/mfaSessionCookie.ts). A valid one with more than an hour left is kept; otherwise a new one is
 * minted from this ID token. If it cannot be minted right now, 503 (retry), never "not verified". When the token
 * names someone else, or the MFA pass is gone, the session cookie is expired.
 */
export async function GET(request: NextRequest) {
  const challenge = decodeMfaChallenge(readMfaCookie(request, 'challenge'))
  const ok = decodeMfaOk(readMfaCookie(request, 'ok'))
  const sessionRaw = readMfaCookie(request, 'session')
  const pending = Boolean(challenge && challenge.exp > Date.now())
  let verified = false
  let clearSession = !ok && Boolean(sessionRaw)
  let mintedSession: { cookie: string; maxAgeMs: number } | null = null

  if (ok) {
    const token = bearer(request)
    if (token) {
      const lookup = await lookupFirebaseIdToken(token)
      if (lookup.status === 'unavailable') return unavailable()
      verified = lookup.status === 'ok' && mfaOkBelongsTo(ok, lookup.user.uid)
      if (!verified) clearSession = Boolean(sessionRaw)
      if (verified && lookup.status === 'ok') {
        const current = await verifyAppSessionCookie(sessionRaw)
        if (sessionCookiePlan(lookup.user.uid, current) === 'mint') {
          const minted = await mintFirebaseSessionCookie(token)
          if (minted.status === 'unavailable') return unavailable()
          if (minted.status === 'invalid') {
            verified = false
            clearSession = Boolean(sessionRaw)
          } else {
            mintedSession = { cookie: minted.cookie, maxAgeMs: Math.min(minted.maxAgeMs, Math.max(0, ok.exp - Date.now())) }
          }
        }
      }
    }
  }

  const response = NextResponse.json(
    {
      pending,
      verified,
      next: challenge?.next || '',
      emailMasked: pending
        ? challenge!.email.replace(/^(.)(.*)(@.*)$/, (_m, a, _mid, domain) => `${a}•••${domain}`)
        : null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
  if (mintedSession) writeMfaCookie(response.cookies, request, 'session', mintedSession.cookie, mintedSession.maxAgeMs)
  else if (clearSession) clearSessionCookie(response.cookies, request)
  return response
}
