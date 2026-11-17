import { NextRequest, NextResponse } from 'next/server'

import { clearPasskeyCookie, decodePasskeyChallenge, readPasskeyCookie } from '@/lib/auth/passkeys/passkeyChallenge'
import {
  isPasskeyAccount,
  passkeysOffResponse,
  passkeyUnavailable,
  requirePasskeyAccount,
} from '@/lib/auth/passkeys/passkeyRoute'
import {
  finishPasskeyRegistration,
  PASSKEY_ENROL_REVERIFY_MESSAGE,
  passkeyEnrolAllowed,
  passkeyLabelFromUserAgent,
} from '@/lib/auth/passkeys/passkeyService'
import { firestorePasskeyStore } from '@/lib/auth/passkeys/passkeyStore'
import { sendPasskeyAddedNotice } from '@/lib/auth/passkeys/passkeyNotices'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { enforceRateLimit, jsonError, readJsonBody } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

type Body = { response?: unknown; label?: string }

export async function POST(request: NextRequest) {
  const off = passkeysOffResponse()
  if (off) return off
  const limited = enforceRateLimit(request, 'passkey-register-verify', 20, 10 * 60 * 1000)
  if (limited) return limited
  const account = await requirePasskeyAccount(request)
  if (!isPasskeyAccount(account)) return account
  if (!passkeyEnrolAllowed(account.mfaOk, account.uid)) {
    return NextResponse.json(
      { error: PASSKEY_ENROL_REVERIFY_MESSAGE, code: 'passkey_reverify_required' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    )
  }
  const body = await readJsonBody<Body>(request, 64 * 1024)
  if (!body.ok) return body.response
  const cookie = decodePasskeyChallenge(readPasskeyCookie(request), 'passkey-register')
  if (cookie && request.headers.get('origin') !== cookie.origin) return jsonError('Passkeys are not available on this address.', 403)
  try {
    const result = await finishPasskeyRegistration({
      uid: account.uid,
      cookie,
      response: body.value.response,
      label: passkeyLabelFromUserAgent(request.headers.get('user-agent'), body.value.label),
      store: firestorePasskeyStore(),
    })
    if (result.ok) {
      // Security notice to the account (best effort: logged, never blocks the passkey).
      await sendPasskeyAddedNotice({ email: account.email, label: result.passkey.label, idToken: bearerToken(request) })
    }
    const response = result.ok
      ? NextResponse.json({ ok: true, passkey: result.passkey }, { headers: { 'Cache-Control': 'no-store' } })
      : jsonError(result.error, result.status)
    clearPasskeyCookie(response.cookies, request)
    return response
  } catch (error) {
    return passkeyUnavailable('register-verify', error)
  }
}
