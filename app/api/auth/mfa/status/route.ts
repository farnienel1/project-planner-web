import { NextRequest, NextResponse } from 'next/server'
import { decodeMfaChallenge, decodeMfaOk, mfaOkBelongsTo, readMfaCookie } from '@/lib/auth/mfa/mfaCookies'
import { verifyFirebaseIdToken } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

function bearer(request: NextRequest): string {
  const header = request.headers.get('authorization') || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

/**
 * "verified" only when the ok cookie belongs to the person signed in now: the cookie's signed uid must equal
 * the uid of the caller's verified Firebase ID token. A cookie left in the browser by another account, or a
 * request with no (or an invalid) token, is never verified.
 */
export async function GET(request: NextRequest) {
  const challenge = decodeMfaChallenge(readMfaCookie(request, 'challenge'))
  const ok = decodeMfaOk(readMfaCookie(request, 'ok'))
  const pending = Boolean(challenge && challenge.exp > Date.now())
  let verified = false
  if (ok) {
    const token = bearer(request)
    const user = token ? await verifyFirebaseIdToken(token) : null
    verified = mfaOkBelongsTo(ok, user?.uid)
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
