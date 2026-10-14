import { NextRequest, NextResponse } from 'next/server'
import { sendProjectPlannerEmail } from '@/lib/email/resendClient'
import {
  clientIp,
  clientSafeMessage,
  enforceRateLimit,
  isFirebaseUser,
  jsonError,
  readJsonBody,
  requireFirebaseUser,
} from '@/lib/security/apiGuard'
import { buildMfaEmailHtml, mfaEmailSubject } from '@/lib/auth/mfa/mfaEmail'
import { safePostMfaPath } from '@/lib/auth/mfa/mfaConstants'
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
  type MfaOk,
} from '@/lib/auth/mfa/mfaCookies'

export const runtime = 'nodejs'

type StartBody = { next?: string }

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'mfa-start', 20, 10 * 60 * 1000)
  if (limited) return limited

  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user

  const body = await readJsonBody<StartBody>(request)
  const nextPath = safePostMfaPath(body.ok ? body.value.next : '')
  const email = (user.email || '').trim().toLowerCase()
  if (!email) {
    return jsonError('This account has no email address, so a verification code cannot be sent. Sign in again.', 400)
  }

  const alreadyOk = decodeSigned<MfaOk>(readMfaCookie(request, 'ok'))
  if (alreadyOk && alreadyOk.uid === user.uid && alreadyOk.exp > Date.now()) {
    return NextResponse.json({
      ok: true,
      required: false,
      skipped: true,
      verified: true,
      next: nextPath,
    })
  }

  const existing = decodeSigned<MfaChallenge>(readMfaCookie(request, 'challenge'))
  if (existing && existing.uid === user.uid && existing.exp > Date.now() && Date.now() - existing.lastSentAt < MFA_RESEND_MS) {
    const retryAfterSec = Math.max(1, Math.ceil((MFA_RESEND_MS - (Date.now() - existing.lastSentAt)) / 1000))
    return NextResponse.json({
      ok: true,
      required: true,
      sent: true,
      retryAfterSec,
      next: existing.next || nextPath,
    })
  }

  const code = generateMfaCode()
  try {
    await sendProjectPlannerEmail({
      to: email,
      subject: mfaEmailSubject(),
      html: buildMfaEmailHtml(code),
    })
  } catch (error) {
    console.error('[auth/mfa/start]', clientIp(request), error)
    return jsonError(
      clientSafeMessage(error, 'Could not email a verification code. You have not been signed in. Try again.'),
      502
    )
  }

  const challenge: MfaChallenge = {
    uid: user.uid,
    email,
    codeHash: hashMfaCode(code, user.uid),
    exp: Date.now() + MFA_CODE_TTL_MS,
    attempts: 0,
    lastSentAt: Date.now(),
    next: nextPath,
  }
  const response = NextResponse.json({ ok: true, required: true, sent: true, next: nextPath })
  writeMfaCookie(response.cookies, request, 'challenge', encodeSigned(challenge), MFA_CODE_TTL_MS)
  writeMfaCookie(response.cookies, request, 'ok', '', 0)
  return response
}
