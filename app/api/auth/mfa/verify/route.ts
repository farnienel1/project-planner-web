import { NextRequest, NextResponse } from 'next/server'
import {
  cookieOptions,
  decodeSigned,
  encodeSigned,
  hashMfaCode,
  codesMatch,
  MFA_CHALLENGE_COOKIE,
  MFA_MAX_ATTEMPTS,
  MFA_OK_COOKIE,
  MFA_OK_TTL_MS,
  type MfaChallenge,
  type MfaOk,
} from '@/lib/auth/mfa/mfaCookies'
import { jsonError, readJsonBody } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

type VerifyBody = { code?: string }

export async function POST(request: NextRequest) {
  const body = await readJsonBody<VerifyBody>(request)
  if (!body.ok) return body.response
  const code = String(body.value.code || '').replace(/\s+/g, '')
  if (!/^\d{6}$/.test(code)) return jsonError('Enter the 6-digit code from your email.', 400)

  const raw = request.cookies.get(MFA_CHALLENGE_COOKIE)?.value
  const challenge = decodeSigned<MfaChallenge>(raw)
  if (!challenge || challenge.exp < Date.now()) {
    const response = jsonError('That code has expired. Sign in again to receive a new one.', 401)
    response.cookies.delete(MFA_CHALLENGE_COOKIE)
    return response
  }

  if (challenge.attempts >= MFA_MAX_ATTEMPTS) {
    const response = jsonError('Too many incorrect attempts. Sign in again to receive a new code.', 429)
    response.cookies.delete(MFA_CHALLENGE_COOKIE)
    return response
  }

  const expected = hashMfaCode(code, challenge.uid)
  if (!codesMatch(expected, challenge.codeHash)) {
    const next: MfaChallenge = { ...challenge, attempts: challenge.attempts + 1 }
    if (next.attempts >= MFA_MAX_ATTEMPTS) {
      const response = jsonError('Too many incorrect attempts. Sign in again to receive a new code.', 429)
      response.cookies.delete(MFA_CHALLENGE_COOKIE)
      return response
    }
    const remaining = MFA_MAX_ATTEMPTS - next.attempts
    const response = jsonError(`That code was not recognised. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`, 401)
    response.cookies.set(MFA_CHALLENGE_COOKIE, encodeSigned(next), cookieOptions(Math.max(1_000, challenge.exp - Date.now())))
    return response
  }

  const ok: MfaOk = { uid: challenge.uid, exp: Date.now() + MFA_OK_TTL_MS }
  const response = NextResponse.json({ ok: true, next: challenge.next || '' })
  response.cookies.delete(MFA_CHALLENGE_COOKIE)
  response.cookies.set(MFA_OK_COOKIE, encodeSigned(ok), cookieOptions(MFA_OK_TTL_MS))
  return response
}
