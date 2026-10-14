import { NextRequest, NextResponse } from 'next/server'
import {
  decodeSigned,
  encodeSigned,
  hashMfaCode,
  codesMatch,
  MFA_MAX_ATTEMPTS,
  MFA_OK_TTL_MS,
  readMfaCookie,
  writeMfaCookie,
  type MfaChallenge,
  type MfaOk,
} from '@/lib/auth/mfa/mfaCookies'
import { enforceRateLimit, jsonError, readJsonBody } from '@/lib/security/apiGuard'
import { extractMfaCode } from '@/lib/auth/mfa/mfaCode'

export const runtime = 'nodejs'

type VerifyBody = { code?: string }

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'mfa-verify', 30, 10 * 60 * 1000)
  if (limited) return limited
  const body = await readJsonBody<VerifyBody>(request)
  if (!body.ok) return body.response
  const code = extractMfaCode(String(body.value.code || ''))
  if (!/^\d{6}$/.test(code)) return jsonError('Enter the 6-digit code from your email.', 400)

  const raw = readMfaCookie(request, 'challenge')
  const challenge = decodeSigned<MfaChallenge>(raw)
  if (!challenge || challenge.exp < Date.now()) {
    const response = jsonError('That code has expired. Sign in again to receive a new one.', 401)
    writeMfaCookie(response.cookies, request, 'challenge', '', 0)
    return response
  }

  if (challenge.attempts >= MFA_MAX_ATTEMPTS) {
    const response = jsonError('Too many incorrect attempts. Sign in again to receive a new code.', 429)
    writeMfaCookie(response.cookies, request, 'challenge', '', 0)
    return response
  }

  const expected = hashMfaCode(code, challenge.uid)
  if (!codesMatch(expected, challenge.codeHash)) {
    const next: MfaChallenge = { ...challenge, attempts: challenge.attempts + 1 }
    if (next.attempts >= MFA_MAX_ATTEMPTS) {
      const response = jsonError('Too many incorrect attempts. Sign in again to receive a new code.', 429)
      writeMfaCookie(response.cookies, request, 'challenge', '', 0)
      return response
    }
    const remaining = MFA_MAX_ATTEMPTS - next.attempts
    const response = jsonError(`That code was not recognised. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`, 401)
    writeMfaCookie(response.cookies, request, 'challenge', encodeSigned(next), Math.max(1_000, challenge.exp - Date.now()))
    return response
  }

  const ok: MfaOk = { uid: challenge.uid, exp: Date.now() + MFA_OK_TTL_MS }
  const next = challenge.next || ''
  const response = NextResponse.json({ ok: true, next })
  writeMfaCookie(response.cookies, request, 'challenge', '', 0)
  writeMfaCookie(response.cookies, request, 'ok', encodeSigned(ok), MFA_OK_TTL_MS)
  return response
}
