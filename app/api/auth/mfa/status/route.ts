import { NextRequest, NextResponse } from 'next/server'
import { decodeSigned, MFA_CHALLENGE_COOKIE, MFA_OK_COOKIE, type MfaChallenge, type MfaOk } from '@/lib/auth/mfa/mfaCookies'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const challenge = decodeSigned<MfaChallenge>(request.cookies.get(MFA_CHALLENGE_COOKIE)?.value)
  const ok = decodeSigned<MfaOk>(request.cookies.get(MFA_OK_COOKIE)?.value)
  const pending = Boolean(challenge && challenge.exp > Date.now())
  const verified = Boolean(ok && ok.exp > Date.now())
  return NextResponse.json({
    pending,
    verified,
    next: challenge?.next || '',
    emailMasked: pending
      ? challenge!.email.replace(/^(.)(.*)(@.*)$/, (_m, a, _mid, domain) => `${a}•••${domain}`)
      : null,
  })
}
