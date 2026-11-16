import { NextRequest, NextResponse } from 'next/server'
import { decodeMfaChallenge, decodeMfaOk, readMfaCookie } from '@/lib/auth/mfa/mfaCookies'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const challenge = decodeMfaChallenge(readMfaCookie(request, 'challenge'))
  const ok = decodeMfaOk(readMfaCookie(request, 'ok'))
  const pending = Boolean(challenge && challenge.exp > Date.now())
  const verified = Boolean(ok)
  return NextResponse.json({
    pending,
    verified,
    next: challenge?.next || '',
    emailMasked: pending
      ? challenge!.email.replace(/^(.)(.*)(@.*)$/, (_m, a, _mid, domain) => `${a}•••${domain}`)
      : null,
  })
}
