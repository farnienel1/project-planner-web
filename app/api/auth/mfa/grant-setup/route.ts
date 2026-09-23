import { NextRequest, NextResponse } from 'next/server'
import { isFirebaseUser, jsonError, requireFirebaseUser } from '@/lib/security/apiGuard'
import { cookieOptions, encodeSigned, MFA_CHALLENGE_COOKIE, MFA_OK_COOKIE, MFA_OK_TTL_MS, type MfaOk } from '@/lib/auth/mfa/mfaCookies'

export const runtime = 'nodejs'

/** First-time invite / owner-create only: allow the app without a 2FA code. */
export async function POST(request: NextRequest) {
  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user
  if (!user.uid) return jsonError('Sign in required', 401)
  const ok: MfaOk = { uid: user.uid, exp: Date.now() + MFA_OK_TTL_MS }
  const response = NextResponse.json({ ok: true, skipped: true })
  response.cookies.set(MFA_CHALLENGE_COOKIE, '', { ...cookieOptions(0), maxAge: 0 })
  response.cookies.set(MFA_OK_COOKIE, encodeSigned(ok), cookieOptions(MFA_OK_TTL_MS))
  return response
}
