import { NextRequest, NextResponse } from 'next/server'
import { sendProjectPlannerEmail } from '@/lib/email/resendClient'
import { clientSafeMessage, enforceRateLimit, jsonError } from '@/lib/security/apiGuard'
import { buildMfaEmailHtml, mfaEmailSubject } from '@/lib/auth/mfa/mfaEmail'
import {
  cookieOptions,
  decodeSigned,
  encodeSigned,
  generateMfaCode,
  hashMfaCode,
  MFA_CHALLENGE_COOKIE,
  MFA_CODE_TTL_MS,
  MFA_RESEND_MS,
  type MfaChallenge,
} from '@/lib/auth/mfa/mfaCookies'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'mfa-resend', 6, 10 * 60 * 1000)
  if (limited) return limited

  const challenge = decodeSigned<MfaChallenge>(request.cookies.get(MFA_CHALLENGE_COOKIE)?.value)
  if (!challenge || challenge.exp < Date.now()) {
    return jsonError('Sign in again to receive a new verification code.', 401)
  }
  const wait = MFA_RESEND_MS - (Date.now() - challenge.lastSentAt)
  if (wait > 0) {
    return jsonError('Please wait a moment before requesting another code.', 429, Math.ceil(wait / 1000))
  }

  try {
    const code = generateMfaCode()
    await sendProjectPlannerEmail({
      to: challenge.email,
      subject: mfaEmailSubject(),
      html: buildMfaEmailHtml(code),
    })
    const next: MfaChallenge = {
      ...challenge,
      codeHash: hashMfaCode(code, challenge.uid),
      exp: Date.now() + MFA_CODE_TTL_MS,
      attempts: 0,
      lastSentAt: Date.now(),
    }
    const response = NextResponse.json({ ok: true, sent: true })
    response.cookies.set(MFA_CHALLENGE_COOKIE, encodeSigned(next), cookieOptions(MFA_CODE_TTL_MS))
    return response
  } catch (error) {
    console.error('[auth/mfa/resend]', error)
    return jsonError(clientSafeMessage(error, 'Could not resend the verification code.'), 502)
  }
}
