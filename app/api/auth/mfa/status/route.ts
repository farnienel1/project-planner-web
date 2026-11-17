import { NextRequest, NextResponse } from 'next/server'
import { decodeMfaChallenge, decodeMfaOk, mfaOkBelongsTo, readMfaCookie } from '@/lib/auth/mfa/mfaCookies'
import { lookupFirebaseIdToken } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

function bearer(request: NextRequest): string {
  const header = request.headers.get('authorization') || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

/**
 * "verified" only when the ok cookie belongs to the person signed in now: the cookie's signed uid must equal
 * the uid of the caller's verified Firebase ID token. A cookie left in the browser by another account, or a
 * request with no (or an invalid) token, is never verified. When the token could not be checked for a
 * passing reason (Auth unreachable, 429 or 5xx), the answer is 503 `{ error: 'unavailable' }` so the browser
 * tries again instead of sending the person to the code screen.
 */
export async function GET(request: NextRequest) {
  const challenge = decodeMfaChallenge(readMfaCookie(request, 'challenge'))
  const ok = decodeMfaOk(readMfaCookie(request, 'ok'))
  const pending = Boolean(challenge && challenge.exp > Date.now())
  let verified = false
  if (ok) {
    const token = bearer(request)
    if (token) {
      const lookup = await lookupFirebaseIdToken(token)
      if (lookup.status === 'unavailable') {
        return NextResponse.json(
          { error: 'unavailable', retry: true },
          { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '2' } }
        )
      }
      verified = lookup.status === 'ok' && mfaOkBelongsTo(ok, lookup.user.uid)
    }
  }
  return NextResponse.json(
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
}
