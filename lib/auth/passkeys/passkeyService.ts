import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server'

import { safePostMfaPath, type PostAuthPath } from '@/lib/auth/mfa/mfaConstants'
import {
  PASSKEY_CHALLENGE_TTL_MS,
  PASSKEY_ENROL_FRESH_MS,
  PASSKEY_MAX_PER_USER,
  PASSKEY_PROMPT_TIMEOUT_MS,
  PASSKEY_RP_NAME,
  type PasskeyRelyingParty,
} from '@/lib/auth/passkeys/passkeyConfig'
import {
  passkeyChallengeId,
  passkeyUserHandle,
  passkeyUserHandleBase64Url,
  type PasskeyChallengeCookie,
} from '@/lib/auth/passkeys/passkeyChallenge'
import {
  isPasskeyCredentialId,
  type AuthAccount,
  type PasskeyAuthAccounts,
  type PasskeyStore,
  type StoredPasskey,
} from '@/lib/auth/passkeys/passkeyStore'
import { isVerifiedPlatformOwner } from '@/lib/canonical/passwordPolicy'

/**
 * Passkey ceremonies, independent of HTTP so they can be tested with a fake store and a software authenticator.
 * The routes in app/api/auth/passkey/* only read the request, call these, and write cookies.
 *
 * A passkey counts as the second step of sign-in (possession of the device plus its biometric or PIN —
 * `userVerification: 'required'` on both ceremonies), so a successful sign-in sets the same MFA "ok" cookie the
 * emailed code sets; the existing status route then mints the Firebase session cookie, and every gate after
 * sign-in (deactivated, lapsed subscription, company deletion, the platform-owner checks) runs exactly as today.
 */

export const PASSKEY_LOGIN_FAILED_MESSAGE =
  'That passkey could not be used to sign in. Sign in with your email and password instead.'
export const PASSKEY_EXPIRED_MESSAGE = 'The passkey request expired. Try again.'
export const PASSKEY_ENROL_REVERIFY_MESSAGE =
  'For your security, adding a passkey needs a recent sign-in. Sign out, sign back in with your emailed code, then add the passkey within 30 minutes.'
export const PASSKEY_LIMIT_MESSAGE = `You can save up to ${PASSKEY_MAX_PER_USER} passkeys. Remove one first.`
export const PASSKEY_OWNER_ONLY_MESSAGE =
  'This login is only for the Project Planner owner. Organisation accounts use the main Sign in page.'

export type PasskeySummary = {
  id: string
  label: string
  createdAtMs: number | null
  lastUsedAtMs: number | null
  backedUp: boolean
}

export function passkeySummary(row: StoredPasskey): PasskeySummary {
  return { id: row.id, label: row.label, createdAtMs: row.createdAtMs, lastUsedAtMs: row.lastUsedAtMs, backedUp: row.backedUp }
}

/**
 * Enrolment needs the MFA pass of this same account with a real second step (`iat`: an emailed code or a passkey,
 * never the first-sign-in setup grant) within PASSKEY_ENROL_FRESH_MS.
 */
export function passkeyEnrolAllowed(
  mfaOk: { uid: string; iat?: number } | null | undefined,
  uid: string,
  nowMs = Date.now()
): boolean {
  if (!mfaOk || !uid || mfaOk.uid !== uid) return false
  if (typeof mfaOk.iat !== 'number' || !Number.isFinite(mfaOk.iat)) return false
  if (mfaOk.iat > nowMs + 60_000) return false
  return nowMs - mfaOk.iat <= PASSKEY_ENROL_FRESH_MS
}

/** A short, non-identifying name for the device from the browser's user agent ("Mac", "Windows", …). */
export function passkeyLabelFromUserAgent(userAgent: string | null | undefined, typed?: string | null): string {
  const clean = (typed || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60)
  if (clean) return clean
  const ua = userAgent || ''
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Windows/.test(ua)) return 'Windows'
  if (/CrOS/.test(ua)) return 'Chromebook'
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Passkey'
}

export const PASSKEYS_REMOVED_AFTER_PASSWORD_MESSAGE =
  'Your passkeys were removed because your password was changed. Sign in with your email and password, then add them again in Settings → Sign-in & password.'

/**
 * The user handle a passkey must present: the one stored with it at registration, else (passkeys saved before it
 * was stored) the HMAC of the uid under the current signing secret.
 */
export function passkeyExpectedUserHandle(row: Pick<StoredPasskey, 'uid' | 'userHandle'>): string {
  return row.userHandle || passkeyUserHandleBase64Url(row.uid)
}

/**
 * A passkey added before the account's password was last set (a reset or a change) no longer counts: whoever
 * changes the password takes away every passkey made before it. The authoritative check runs at every sign-in
 * from Firebase Auth's own `passwordUpdatedAt`, so it holds even if the browser never reports the change.
 * A passkey with no stored creation time is stale once any password time is known.
 */
export function passkeyStaleAfterPasswordChange(
  row: Pick<StoredPasskey, 'createdAtMs'>,
  account: Pick<AuthAccount, 'passwordUpdatedAtMs'>
): boolean {
  const changed = account.passwordUpdatedAtMs
  if (typeof changed !== 'number' || !Number.isFinite(changed) || changed <= 0) return false
  if (typeof row.createdAtMs !== 'number' || !Number.isFinite(row.createdAtMs)) return true
  return row.createdAtMs < changed
}

/** Removes the account's passkeys made before its password was last set; returns how many were removed. */
export async function pruneStalePasskeys(input: { uid: string; store: PasskeyStore; auth: PasskeyAuthAccounts }): Promise<number> {
  const rows = await input.store.listForUser(input.uid)
  if (!rows.length) return 0
  const account = await input.auth.lookup(input.uid)
  const stale = account.exists ? rows.filter((row) => passkeyStaleAfterPasswordChange(row, account)) : rows
  let removed = 0
  for (const row of stale) if (await input.store.delete(row.id)) removed += 1
  return removed
}

export async function beginPasskeyRegistration(input: {
  uid: string
  email: string
  rp: PasskeyRelyingParty
  existing: StoredPasskey[]
  nowMs?: number
}): Promise<
  | { ok: true; options: PublicKeyCredentialCreationOptionsJSON; cookie: PasskeyChallengeCookie }
  | { ok: false; status: number; error: string }
> {
  const nowMs = input.nowMs ?? Date.now()
  if (input.existing.length >= PASSKEY_MAX_PER_USER) return { ok: false, status: 409, error: PASSKEY_LIMIT_MESSAGE }
  const userName = input.email || 'Project Planner account'
  const options = await generateRegistrationOptions({
    rpName: PASSKEY_RP_NAME,
    rpID: input.rp.rpID,
    userName,
    userDisplayName: userName,
    userID: passkeyUserHandle(input.uid),
    timeout: PASSKEY_PROMPT_TIMEOUT_MS,
    attestationType: 'none',
    excludeCredentials: input.existing.map((row) => ({ id: row.id, transports: row.transports })),
    authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
  })
  return {
    ok: true,
    options,
    cookie: {
      kind: 'passkey-register',
      challenge: options.challenge,
      rpID: input.rp.rpID,
      origin: input.rp.origin,
      uid: input.uid,
      userHandle: options.user.id,
      exp: nowMs + PASSKEY_CHALLENGE_TTL_MS,
    },
  }
}

export async function finishPasskeyRegistration(input: {
  uid: string
  cookie: PasskeyChallengeCookie | null
  response: unknown
  label: string
  store: PasskeyStore
  nowMs?: number
}): Promise<{ ok: true; passkey: PasskeySummary } | { ok: false; status: number; error: string }> {
  const nowMs = input.nowMs ?? Date.now()
  const cookie = input.cookie
  if (!cookie || cookie.kind !== 'passkey-register' || cookie.exp <= nowMs) return { ok: false, status: 400, error: PASSKEY_EXPIRED_MESSAGE }
  if (cookie.uid !== input.uid) return { ok: false, status: 403, error: 'This passkey request belongs to another account. Try again.' }
  if ((await input.store.consumeChallenge(passkeyChallengeId(cookie.challenge), cookie.exp)) === 'used') {
    return { ok: false, status: 400, error: PASSKEY_EXPIRED_MESSAGE }
  }
  const response = input.response as RegistrationResponseJSON
  if (!response || typeof response !== 'object' || !isPasskeyCredentialId(response.id)) {
    return { ok: false, status: 400, error: 'The passkey could not be read. Try again.' }
  }
  let verification
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: cookie.challenge,
      expectedOrigin: cookie.origin,
      expectedRPID: cookie.rpID,
      requireUserVerification: true,
    })
  } catch {
    return { ok: false, status: 400, error: 'The passkey could not be checked. Try again.' }
  }
  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false, status: 400, error: 'The passkey could not be checked. Try again.' }
  }
  const info = verification.registrationInfo
  const existing = await input.store.listForUser(input.uid)
  if (existing.length >= PASSKEY_MAX_PER_USER) return { ok: false, status: 409, error: PASSKEY_LIMIT_MESSAGE }
  const row = {
    id: info.credential.id,
    uid: input.uid,
    publicKey: Buffer.from(info.credential.publicKey).toString('base64url'),
    counter: info.credential.counter,
    transports: (info.credential.transports || []).filter((value) => typeof value === 'string').slice(0, 8),
    label: input.label,
    createdAtMs: nowMs,
    backedUp: info.credentialBackedUp,
    deviceType: info.credentialDeviceType,
    rpId: cookie.rpID,
    userHandle: cookie.userHandle || passkeyUserHandleBase64Url(input.uid),
  }
  if (!isPasskeyCredentialId(row.id)) return { ok: false, status: 400, error: 'The passkey could not be read. Try again.' }
  if ((await input.store.create(row)) === 'exists') {
    return { ok: false, status: 409, error: 'This passkey is already saved.' }
  }
  return { ok: true, passkey: { id: row.id, label: row.label, createdAtMs: nowMs, lastUsedAtMs: null, backedUp: row.backedUp } }
}

export async function beginPasskeyLogin(input: {
  rp: PasskeyRelyingParty
  next?: string | null
  ownerOnly?: boolean
  nowMs?: number
}): Promise<{ options: PublicKeyCredentialRequestOptionsJSON; cookie: PasskeyChallengeCookie }> {
  const nowMs = input.nowMs ?? Date.now()
  const options = await generateAuthenticationOptions({
    rpID: input.rp.rpID,
    timeout: PASSKEY_PROMPT_TIMEOUT_MS,
    userVerification: 'required',
    allowCredentials: [],
  })
  const ownerOnly = input.ownerOnly === true
  return {
    options,
    cookie: {
      kind: 'passkey-login',
      challenge: options.challenge,
      rpID: input.rp.rpID,
      origin: input.rp.origin,
      exp: nowMs + PASSKEY_CHALLENGE_TTL_MS,
      next: safePostMfaPath(input.next, ownerOnly ? '/developer' : '/dashboard'),
      ...(ownerOnly ? { ownerOnly: true } : {}),
    },
  }
}

export type PasskeyLoginResult =
  | { ok: true; uid: string; customToken: string; next: PostAuthPath }
  | { ok: false; status: number; error: string; reason: string; uid?: string; removed?: number }

function refuse(status: number, reason: string, error = PASSKEY_LOGIN_FAILED_MESSAGE, uid?: string, removed?: number): PasskeyLoginResult {
  const base = { ok: false as const, status, error, reason }
  return uid ? { ...base, uid, ...(typeof removed === 'number' ? { removed } : {}) } : base
}

/**
 * Checks a sign-in assertion. Order matters: the challenge is consumed first (so a failed or replayed attempt can
 * never be retried with the same challenge), then the stored passkey, its user handle, the signature with user
 * verification and the counter, then the Firebase Auth account (it must still exist and not be disabled), and only
 * then is the counter recorded — conditionally, so two sign-ins racing with one assertion cannot both pass — and a
 * custom token minted for that uid. Every refusal to the browser reads the same; `reason` is for the server log.
 */
export async function finishPasskeyLogin(input: {
  cookie: PasskeyChallengeCookie | null
  response: unknown
  store: PasskeyStore
  auth: PasskeyAuthAccounts
  nowMs?: number
}): Promise<PasskeyLoginResult> {
  const nowMs = input.nowMs ?? Date.now()
  const cookie = input.cookie
  if (!cookie || cookie.kind !== 'passkey-login' || cookie.exp <= nowMs) return refuse(400, 'challenge-missing', PASSKEY_EXPIRED_MESSAGE)
  if ((await input.store.consumeChallenge(passkeyChallengeId(cookie.challenge), cookie.exp)) === 'used') {
    return refuse(400, 'challenge-replayed', PASSKEY_EXPIRED_MESSAGE)
  }
  const response = input.response as AuthenticationResponseJSON
  if (!response || typeof response !== 'object' || !isPasskeyCredentialId(response.id) || response.id !== response.rawId) {
    return refuse(400, 'malformed')
  }
  const stored = await input.store.get(response.id)
  if (!stored) return refuse(401, 'unknown-credential')
  if (stored.rpId && stored.rpId !== cookie.rpID) return refuse(401, 'rp-mismatch')
  const handle = response.response?.userHandle
  if (handle && handle !== passkeyExpectedUserHandle(stored)) return refuse(401, 'user-handle-mismatch')

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: cookie.challenge,
      expectedOrigin: cookie.origin,
      expectedRPID: cookie.rpID,
      requireUserVerification: true,
      credential: {
        id: stored.id,
        publicKey: new Uint8Array(Buffer.from(stored.publicKey, 'base64url')),
        counter: stored.counter,
        transports: stored.transports as never,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return refuse(401, /counter/i.test(message) ? 'counter-regression' : 'verify-error')
  }
  if (!verification.verified || !verification.authenticationInfo.userVerified) return refuse(401, 'not-verified')

  const account = await input.auth.lookup(stored.uid)
  if (!account.exists) return refuse(401, 'account-missing')
  if (account.disabled) return refuse(403, 'account-disabled', 'This account has been disabled. Contact your administrator.')
  if (passkeyStaleAfterPasswordChange(stored, account)) {
    // The password was reset or changed after this passkey was added: it no longer counts (and is removed now).
    // A failed delete never changes the answer: the passkey is refused either way (and pruned again later).
    const removed = await input.store.delete(stored.id).then((done) => (done ? 1 : 0), () => 0)
    return refuse(401, 'stale-after-password-change', PASSKEYS_REMOVED_AFTER_PASSWORD_MESSAGE, stored.uid, removed)
  }
  if (cookie.ownerOnly && !isVerifiedPlatformOwner({ email: account.email, emailVerified: account.emailVerified })) {
    return refuse(403, 'not-owner', PASSKEY_OWNER_ONLY_MESSAGE)
  }

  const recorded = await input.store.recordUse(stored, { counter: verification.authenticationInfo.newCounter, lastUsedAtMs: nowMs })
  if (recorded === 'conflict') return refuse(409, 'record-conflict')

  const customToken = await input.auth.customToken(stored.uid)
  return { ok: true, uid: stored.uid, customToken, next: safePostMfaPath(cookie.next, cookie.ownerOnly ? '/developer' : '/dashboard') }
}
