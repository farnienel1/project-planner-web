import { NextRequest, NextResponse } from 'next/server'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { sendProjectPlannerEmail } from '@/lib/email/resendClient'
import { clientSafeMessage, enforceRateLimit, enforceRateLimitKey, isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { requireOwnerSession } from '@/lib/owner/requireOwner'
import { buildMfaEmailHtml, mfaEmailSubject } from '@/lib/auth/mfa/mfaEmail'
import {
  decodeMfaChallenge,
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

/**
 * POST /api/owner/reverify — owner console "enter a new code" step (PLAN A3, spec §1.3: a destructive action needs
 * the emailed code within the last 10 minutes). Only an owner who is already signed in with a valid MFA cookie may
 * ask. It emails a fresh code and stores a challenge cookie, but — unlike `/api/auth/mfa/start` — it never clears the
 * MFA "ok" cookie or the session cookie, so asking for a code never signs the owner out of the console. The code is
 * entered through the existing `/api/auth/mfa/verify`, which re-signs the ok cookie with a new `iat`.
 */
export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'owner-reverify', 10, 10 * 60 * 1000)
  if (limited) return limited
  const owner = await requireOwnerSession(request)
  if (!isFirebaseUser(owner)) return owner
  const perOwner = enforceRateLimitKey('owner-reverify:uid', owner.uid, 10, 10 * 60 * 1000)
  if (perOwner) return perOwner
  const email = (owner.email || '').trim().toLowerCase()
  if (!email) return jsonError('This account has no email address, so a code cannot be sent.', 400)

  const existing = decodeMfaChallenge(readMfaCookie(request, 'challenge'))
  if (existing && existing.uid === owner.uid && existing.exp > Date.now() && Date.now() - existing.lastSentAt < MFA_RESEND_MS) {
    const retryAfterSec = Math.max(1, Math.ceil((MFA_RESEND_MS - (Date.now() - existing.lastSentAt)) / 1000))
    return NextResponse.json({ ok: true, sent: true, retryAfterSec }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const code = generateMfaCode()
  try {
    await sendProjectPlannerEmail({ to: email, subject: mfaEmailSubject(), html: buildMfaEmailHtml(code), idToken: bearerToken(request) })
  } catch (error) {
    console.error('[owner/reverify]', error instanceof Error ? error.name : 'error')
    return jsonError(clientSafeMessage(error, 'Could not email a code. Nothing was changed. Try again.'), 502)
  }
  const challenge: MfaChallenge = {
    kind: 'challenge',
    uid: owner.uid,
    email,
    codeHash: hashMfaCode(code, owner.uid),
    exp: Date.now() + MFA_CODE_TTL_MS,
    attempts: 0,
    lastSentAt: Date.now(),
    next: '',
  }
  const response = NextResponse.json({ ok: true, sent: true }, { headers: { 'Cache-Control': 'no-store' } })
  writeMfaCookie(response.cookies, request, 'challenge', encodeSigned(challenge), MFA_CODE_TTL_MS)
  return response
}
