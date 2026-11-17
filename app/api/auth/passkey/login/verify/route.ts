import { NextRequest, NextResponse } from 'next/server'

import { clearSessionCookie } from '@/lib/auth/mfa/mfaCookiePolicy'
import { encodeMfaOk, MFA_OK_TTL_MS, writeMfaCookie } from '@/lib/auth/mfa/mfaCookies'
import { clearPasskeyCookie, decodePasskeyChallenge, readPasskeyCookie } from '@/lib/auth/passkeys/passkeyChallenge'
import { passkeysOffResponse, passkeyUnavailable } from '@/lib/auth/passkeys/passkeyRoute'
import { finishPasskeyLogin, PASSKEY_LOGIN_FAILED_MESSAGE } from '@/lib/auth/passkeys/passkeyService'
import { firebasePasskeyAuthAccounts, firestorePasskeyStore } from '@/lib/auth/passkeys/passkeyStore'
import { clientIp, enforceRateLimit, jsonError, readJsonBody } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

type Body = { response?: unknown }

/**
 * Finish a passkey sign-in. On success: a Firebase custom token for the passkey's account, and the same MFA "ok"
 * cookie an accepted emailed code sets (with `iat`, a fresh second step). The browser signs in with the token and the
 * existing /api/auth/mfa/status call then mints the session cookie for that same uid; any older session cookie is
 * cleared here so it can never stand for another account.
 */
export async function POST(request: NextRequest) {
  const off = passkeysOffResponse()
  if (off) return off
  const limited = enforceRateLimit(request, 'passkey-login-verify', 30, 10 * 60 * 1000)
  if (limited) return limited
  const body = await readJsonBody<Body>(request, 64 * 1024)
  if (!body.ok) return body.response
  const cookie = decodePasskeyChallenge(readPasskeyCookie(request), 'passkey-login')
  if (cookie && request.headers.get('origin') !== cookie.origin) return jsonError(PASSKEY_LOGIN_FAILED_MESSAGE, 403)
  try {
    const result = await finishPasskeyLogin({
      cookie,
      response: body.value.response,
      store: firestorePasskeyStore(),
      auth: firebasePasskeyAuthAccounts(),
    })
    if (!result.ok) {
      console.warn('[auth/passkey/login] refused', { reason: result.reason, ip: clientIp(request) })
      const response = jsonError(result.error, result.status)
      clearPasskeyCookie(response.cookies, request)
      return response
    }
    const now = Date.now()
    const response = NextResponse.json(
      { ok: true, customToken: result.customToken, next: result.next },
      { headers: { 'Cache-Control': 'no-store' } }
    )
    clearPasskeyCookie(response.cookies, request)
    writeMfaCookie(response.cookies, request, 'challenge', '', 0)
    clearSessionCookie(response.cookies, request)
    writeMfaCookie(response.cookies, request, 'ok', encodeMfaOk(result.uid, now + MFA_OK_TTL_MS, now), MFA_OK_TTL_MS)
    return response
  } catch (error) {
    return passkeyUnavailable('login-verify', error)
  }
}
