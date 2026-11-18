import { NextRequest, NextResponse } from 'next/server'

import { encodePasskeyChallenge, writePasskeyCookie } from '@/lib/auth/passkeys/passkeyChallenge'
import { PASSKEY_CHALLENGE_TTL_MS } from '@/lib/auth/passkeys/passkeyConfig'
import {
  isPasskeyAccount,
  isRelyingParty,
  passkeysOffResponse,
  passkeyUnavailable,
  requestRelyingParty,
  requirePasskeyAccount,
} from '@/lib/auth/passkeys/passkeyRoute'
import { beginPasskeyRegistration, PASSKEY_ENROL_REVERIFY_MESSAGE, passkeyEnrolAllowed } from '@/lib/auth/passkeys/passkeyService'
import { firestorePasskeyStore } from '@/lib/auth/passkeys/passkeyStore'
import { enforceRateLimit, enforceRateLimitKey, jsonError } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

/** Start adding a passkey: signed in, with a fresh second step (emailed code or passkey) for this account. */
export async function POST(request: NextRequest) {
  const off = passkeysOffResponse()
  if (off) return off
  const limited = enforceRateLimit(request, 'passkey-register-options', 20, 10 * 60 * 1000)
  if (limited) return limited
  const rp = requestRelyingParty(request)
  if (!isRelyingParty(rp)) return rp
  const account = await requirePasskeyAccount(request)
  if (!isPasskeyAccount(account)) return account
  const userLimited = enforceRateLimitKey('passkey-register-user', account.uid, 20, 10 * 60 * 1000)
  if (userLimited) return userLimited
  if (!passkeyEnrolAllowed(account.mfaOk, account.uid)) {
    return NextResponse.json(
      { error: PASSKEY_ENROL_REVERIFY_MESSAGE, code: 'passkey_reverify_required' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    )
  }
  try {
    const store = firestorePasskeyStore()
    const begun = await beginPasskeyRegistration({
      uid: account.uid,
      email: account.email || '',
      rp,
      existing: await store.listForUser(account.uid),
    })
    if (!begun.ok) return jsonError(begun.error, begun.status)
    const response = NextResponse.json({ options: begun.options }, { headers: { 'Cache-Control': 'no-store' } })
    writePasskeyCookie(response.cookies, request, encodePasskeyChallenge(begun.cookie), PASSKEY_CHALLENGE_TTL_MS)
    return response
  } catch (error) {
    return passkeyUnavailable('register-options', error)
  }
}
