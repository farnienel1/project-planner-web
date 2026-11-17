import { NextRequest, NextResponse } from 'next/server'

import { readMfaCookie } from '@/lib/auth/mfa/mfaCookiePolicy'
import { verifySignedMfaOk } from '@/lib/auth/mfa/mfaCookieVerify'
import { passkeyRelyingParty, passkeysEnabled, type PasskeyRelyingParty } from '@/lib/auth/passkeys/passkeyConfig'
import { isFirebaseUser, jsonError, requireFirebaseUser, type FirebaseAuthUser } from '@/lib/security/apiGuard'

/** Every passkey route answers 404 while the switch is off, so nothing about passkeys is reachable. */
export function passkeysOffResponse(): NextResponse | null {
  return passkeysEnabled() ? null : jsonError('Not found', 404)
}

/** The relying party for this request's Origin header, or a 403 when that origin may not use passkeys. */
export function requestRelyingParty(request: NextRequest): PasskeyRelyingParty | NextResponse {
  const rp = passkeyRelyingParty(request.headers.get('origin'))
  return rp || jsonError('Passkeys are not available on this address.', 403)
}

export function isRelyingParty(value: PasskeyRelyingParty | NextResponse): value is PasskeyRelyingParty {
  return !(value instanceof NextResponse)
}

export type PasskeyAccountSession = FirebaseAuthUser & { mfaOk: { uid: string; exp: number; iat?: number } }

/**
 * A signed-in account managing its own passkeys: a valid Firebase ID token AND the MFA pass of that same uid
 * (the same pair the owner console requires). Without both, 401 / 403.
 */
export async function requirePasskeyAccount(request: NextRequest): Promise<PasskeyAccountSession | NextResponse> {
  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user
  const ok = await verifySignedMfaOk(readMfaCookie(request, 'ok'))
  if (!ok || ok.uid !== user.uid) {
    return jsonError('Two-factor verification is required. Sign in again and enter the emailed code.', 403)
  }
  return { ...user, mfaOk: ok }
}

export function isPasskeyAccount(value: PasskeyAccountSession | NextResponse): value is PasskeyAccountSession {
  return !(value instanceof NextResponse)
}

export function passkeyUnavailable(where: string, error: unknown): NextResponse {
  console.error(`[auth/passkey/${where}] unavailable`, error instanceof Error ? error.message.slice(0, 200) : String(error))
  return jsonError('Passkeys are unavailable right now. Sign in with your email and password, or try again shortly.', 503)
}
