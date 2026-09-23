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
import { isPlatformOwnerEmail } from '@/lib/platform/owner'
import { buildMfaEmailHtml, mfaEmailSubject } from '@/lib/auth/mfa/mfaEmail'
import {
  cookieOptions,
  decodeSigned,
  encodeSigned,
  generateMfaCode,
  hashMfaCode,
  MFA_CHALLENGE_COOKIE,
  MFA_CODE_TTL_MS,
  MFA_OK_COOKIE,
  MFA_RESEND_MS,
  readOwnUserFlags,
  type MfaChallenge,
} from '@/lib/auth/mfa/mfaCookies'

export const runtime = 'nodejs'

type StartBody = { next?: string }

async function sendCode(email: string, uid: string, nextPath: string | undefined, lastSentAt?: number) {
  if (lastSentAt && Date.now() - lastSentAt < MFA_RESEND_MS) {
    const retryAfterSec = Math.ceil((MFA_RESEND_MS - (Date.now() - lastSentAt)) / 1000)
    return { error: jsonError('Please wait a moment before requesting another code.', 429, retryAfterSec) }
  }
  const code = generateMfaCode()
  await sendProjectPlannerEmail({
    to: email,
    subject: mfaEmailSubject(),
    html: buildMfaEmailHtml(code),
  })
  const challenge: MfaChallenge = {
    uid,
    email,
    codeHash: hashMfaCode(code, uid),
    exp: Date.now() + MFA_CODE_TTL_MS,
    attempts: 0,
    lastSentAt: Date.now(),
    next: nextPath,
  }
  const response = NextResponse.json({ ok: true, required: true, sent: true })
  response.cookies.set(MFA_CHALLENGE_COOKIE, encodeSigned(challenge), cookieOptions(MFA_CODE_TTL_MS))
  response.cookies.delete(MFA_OK_COOKIE)
  return { response }
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'mfa-start', 8, 10 * 60 * 1000)
  if (limited) return limited

  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user

  const body = await readJsonBody<StartBody>(request)
  const nextPath = body.ok ? body.value.next : ''

  const flags = await readOwnUserFlags(
    (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim(),
    user.uid
  )
  if (flags && flags.passwordSet === false && !isPlatformOwnerEmail(user.email)) {
    const response = NextResponse.json({ ok: true, required: false, skipped: true, reason: 'invite_setup' })
    response.cookies.delete(MFA_CHALLENGE_COOKIE)
    return response
  }

  const email = (user.email || flags?.email || '').trim().toLowerCase()
  if (!email) {
    return jsonError('This account has no email address, so a verification code cannot be sent. Sign in again.', 400)
  }

  const existing = decodeSigned<MfaChallenge>(request.cookies.get(MFA_CHALLENGE_COOKIE)?.value)
  try {
    const sent = await sendCode(email, user.uid, typeof nextPath === 'string' ? nextPath : '', existing?.uid === user.uid ? existing.lastSentAt : undefined)
    if ('error' in sent && sent.error) return sent.error
    return sent.response
  } catch (error) {
    console.error('[auth/mfa/start]', clientIp(request), error)
    return jsonError(
      clientSafeMessage(error, 'Could not email a verification code. You have not been signed in. Try again.'),
      502
    )
  }
}
