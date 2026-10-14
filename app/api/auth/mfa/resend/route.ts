import { NextRequest, NextResponse } from 'next/server'
import { sendProjectPlannerEmail } from '@/lib/email/resendClient'
import {
  clientSafeMessage,
  enforceRateLimit,
  isFirebaseUser,
  jsonError,
  requireFirebaseUser,
} from '@/lib/security/apiGuard'
import { buildMfaEmailHtml, mfaEmailSubject } from '@/lib/auth/mfa/mfaEmail'
import {
  decodeSigned,
  encodeSigned,
  generateMfaCode,
  hashMfaCode,
  MFA_CODE_TTL_MS,
  MFA_RESEND_MS,
  readMfaCookie,
  writeMfaCookie,
  type MfaChallenge,
} from '@/lib/auth/mfa/mfaCookies'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'mfa-resend', 20, 10 * 60 * 1000)
  if (limited) return limited

  const signedIn = await requireFirebaseUser(request)
  const uid = isFirebaseUser(signedIn) ? signedIn.uid : ''
  const email = isFirebaseUser(signedIn) ? (signedIn.email || '').toLowerCase() : ''

  const challenge = decodeSigned<MfaChallenge>(readMfaCookie(request, 'challenge'))
  const active = challenge && challenge.exp > Date.now() ? challenge : null
  if (!active && !email) {
    return jsonError('Sign in again to receive a new verification code.', 401)
  }

  const lastSentAt = active?.lastSentAt || 0
  const wait = MFA_RESEND_MS - (Date.now() - lastSentAt)
  if (lastSentAt && wait > 0) {
    return jsonError(`Please wait ${Math.ceil(wait / 1000)} seconds before requesting another code.`, 429, Math.ceil(wait / 1000))
  }

  const targetEmail = (active?.email || email).toLowerCase()
  const targetUid = active?.uid || uid
  if (!targetEmail || !targetUid) {
    return jsonError('Sign in again to receive a new verification code.', 401)
  }

  try {
    const code = generateMfaCode()
    await sendProjectPlannerEmail({
      to: targetEmail,
      subject: mfaEmailSubject(),
      html: buildMfaEmailHtml(code),
    })
    const next: MfaChallenge = {
      uid: targetUid,
      email: targetEmail,
      codeHash: hashMfaCode(code, targetUid),
      exp: Date.now() + MFA_CODE_TTL_MS,
      attempts: 0,
      lastSentAt: Date.now(),
      next: active?.next,
    }
    const response = NextResponse.json({ ok: true, sent: true })
    writeMfaCookie(response.cookies, request, 'challenge', encodeSigned(next), MFA_CODE_TTL_MS)
    writeMfaCookie(response.cookies, request, 'ok', '', 0)
    return response
  } catch (error) {
    console.error('[auth/mfa/resend]', error)
    return jsonError(clientSafeMessage(error, 'Could not resend the verification code.'), 502)
  }
}
