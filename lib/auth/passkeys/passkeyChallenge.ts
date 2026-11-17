import { createHash, createHmac } from 'node:crypto'

import { decodeSigned, encodeSigned } from '@/lib/auth/mfa/mfaCookies'
import { cookieOptions, expireMfaCookieOptions, shouldSecureMfaCookies } from '@/lib/auth/mfa/mfaCookiePolicy'
import { mfaSigningSecret } from '@/lib/auth/mfa/mfaSigningSecret'

/**
 * The WebAuthn challenge of one passkey ceremony, held in a signed, httpOnly host cookie (so it is bound to the
 * browser that asked for it) and made single-use on the server: the verify routes consume
 * `passkeyChallengeId(challenge)` in Firestore before checking anything else (passkeyStore.ts). A challenge is only
 * ever the server's own random value; a ceremony of one kind never reads the other's cookie.
 */

export const PASSKEY_COOKIE_HOST = '__Host-pp_passkey'
export const PASSKEY_COOKIE_LEGACY = 'pp_passkey'

export type PasskeyCeremonyKind = 'passkey-register' | 'passkey-login'

export type PasskeyChallengeCookie = {
  kind: PasskeyCeremonyKind
  challenge: string
  rpID: string
  origin: string
  exp: number
  /** Enrolment only: the account the passkey is being added to. */
  uid?: string
  /** Sign-in only: the page the person returns to (`safePostMfaPath` again on use). */
  next?: string
  /** Sign-in only: the developer login, which accepts only the platform owner's passkey. */
  ownerOnly?: boolean
}

export function encodePasskeyChallenge(value: PasskeyChallengeCookie): string {
  return encodeSigned(value)
}

/** The cookie of the expected kind, unexpired; anything else (another kind, an MFA cookie, a forgery) is null. */
export function decodePasskeyChallenge(
  raw: string | null | undefined,
  kind: PasskeyCeremonyKind,
  nowMs = Date.now()
): PasskeyChallengeCookie | null {
  const value = decodeSigned<Partial<PasskeyChallengeCookie>>(raw)
  if (!value || value.kind !== kind) return null
  if (typeof value.challenge !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(value.challenge)) return null
  if (typeof value.rpID !== 'string' || !value.rpID) return null
  if (typeof value.origin !== 'string' || !value.origin) return null
  if (typeof value.exp !== 'number' || !(value.exp > nowMs)) return null
  if (kind === 'passkey-register' && (typeof value.uid !== 'string' || !value.uid)) return null
  return {
    kind,
    challenge: value.challenge,
    rpID: value.rpID,
    origin: value.origin,
    exp: value.exp,
    ...(typeof value.uid === 'string' && value.uid ? { uid: value.uid } : {}),
    ...(typeof value.next === 'string' ? { next: value.next } : {}),
    ...(value.ownerOnly === true ? { ownerOnly: true } : {}),
  }
}

/** The Firestore id that marks a challenge as used: a hash, so the stored id never reveals the challenge. */
export function passkeyChallengeId(challenge: string): string {
  return createHash('sha256').update(`passkey-challenge:${challenge}`).digest('hex')
}

/**
 * The WebAuthn user handle for an account: an HMAC of the uid, so the authenticator never stores the Firebase uid
 * itself, and the same account always gets the same handle (a second passkey on the same device replaces the first).
 */
export function passkeyUserHandle(uid: string, secret = mfaSigningSecret()): Uint8Array<ArrayBuffer> {
  const digest = createHmac('sha256', secret).update(`passkey-user:${uid}`).digest()
  const out = new Uint8Array(new ArrayBuffer(digest.length))
  out.set(digest)
  return out
}

export function passkeyUserHandleBase64Url(uid: string, secret = mfaSigningSecret()): string {
  return Buffer.from(passkeyUserHandle(uid, secret)).toString('base64url')
}

type HeaderReader = { get(name: string): string | null }
type CookieReader = { get(name: string): { value: string } | undefined }
type CookieSetter = { set: (name: string, value: string, options: ReturnType<typeof cookieOptions>) => void }

export function readPasskeyCookie(request: { cookies: CookieReader; nextUrl?: { protocol?: string }; headers: HeaderReader }): string | undefined {
  const secure = shouldSecureMfaCookies(request)
  return request.cookies.get(secure ? PASSKEY_COOKIE_HOST : PASSKEY_COOKIE_LEGACY)?.value
}

export function writePasskeyCookie(
  cookies: CookieSetter,
  request: { nextUrl?: { protocol?: string }; headers: HeaderReader },
  value: string,
  maxAgeMs: number
) {
  const secure = shouldSecureMfaCookies(request)
  cookies.set(secure ? PASSKEY_COOKIE_HOST : PASSKEY_COOKIE_LEGACY, value, cookieOptions(maxAgeMs, secure))
}

export function clearPasskeyCookie(cookies: CookieSetter, request: { nextUrl?: { protocol?: string }; headers: HeaderReader }) {
  const secure = shouldSecureMfaCookies(request)
  cookies.set(PASSKEY_COOKIE_HOST, '', expireMfaCookieOptions(true))
  cookies.set(PASSKEY_COOKIE_LEGACY, '', expireMfaCookieOptions(secure))
}
