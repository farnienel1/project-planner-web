import { generateKeyPairSync, createVerify } from 'node:crypto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'

import { decodeMfaOk, encodeMfaOk } from '../mfa/mfaCookies.ts'
import { passkeyRelyingParty, passkeysEnabled, PASSKEY_ENROL_FRESH_MS } from './passkeyConfig.ts'
import {
  decodePasskeyChallenge,
  encodePasskeyChallenge,
  passkeyUserHandleBase64Url,
  type PasskeyChallengeCookie,
} from './passkeyChallenge.ts'
import {
  beginPasskeyLogin,
  beginPasskeyRegistration,
  finishPasskeyLogin,
  finishPasskeyRegistration,
  passkeyEnrolAllowed,
  passkeyExpectedUserHandle,
  passkeyLabelFromUserAgent,
  passkeyStaleAfterPasswordChange,
  PASSKEYS_REMOVED_AFTER_PASSWORD_MESSAGE,
  pruneStalePasskeys,
} from './passkeyService.ts'
import { sendPasskeyAddedNotice, sendPasskeysRemovedNotice } from './passkeyNotices.ts'
import { padToMinimumDuration } from './passkeyRoute.ts'
import { buildPasskeyAddedEmail, buildPasskeysRemovedEmail, PASSKEY_ADDED_EMAIL_SUBJECT } from '../../email/passkeyNoticeEmail.ts'
import type { AuthAccount, NewPasskey, PasskeyAuthAccounts, PasskeyStore, StoredPasskey } from './passkeyStore.ts'
import { newSoftAuthenticator, softAssertion, softRegistration } from './testAuthenticator.ts'
import { adminSignCustomToken, FIREBASE_CUSTOM_TOKEN_AUDIENCE } from '../../owner/identityToolkitAdmin.ts'
import { PLATFORM_OWNER_EMAIL } from '../../canonical/passwordPolicy.ts'

const RP = { rpID: 'projectplanner.us', origin: 'https://www.projectplanner.us' }
const UID = 'user-abc123'

class MemoryStore implements PasskeyStore {
  rows = new Map<string, StoredPasskey>()
  used = new Set<string>()
  version = 0
  forceConflict = false
  async consumeChallenge(id: string) {
    if (this.used.has(id)) return 'used' as const
    this.used.add(id)
    return 'consumed' as const
  }
  async get(id: string) {
    const row = this.rows.get(id)
    return row ? { ...row } : null
  }
  async listForUser(uid: string) {
    return [...this.rows.values()].filter((row) => row.uid === uid).map((row) => ({ ...row }))
  }
  async create(passkey: NewPasskey) {
    if (this.rows.has(passkey.id)) return 'exists' as const
    this.rows.set(passkey.id, { ...passkey, lastUsedAtMs: null, updateTime: String(++this.version) })
    return 'created' as const
  }
  async recordUse(passkey: StoredPasskey, use: { counter: number; lastUsedAtMs: number }) {
    const live = this.rows.get(passkey.id)
    if (!live || live.updateTime !== passkey.updateTime || this.forceConflict) return 'conflict' as const
    this.rows.set(passkey.id, { ...live, counter: use.counter, lastUsedAtMs: use.lastUsedAtMs, updateTime: String(++this.version) })
    return 'ok' as const
  }
  failDelete = false
  async delete(id: string) {
    if (this.failDelete) throw new Error('Firestore unavailable')
    return this.rows.delete(id)
  }
  async deleteAllForUser(uid: string) {
    let removed = 0
    for (const row of await this.listForUser(uid)) if (this.rows.delete(row.id)) removed += 1
    return removed
  }
}

function auth(accounts: Record<string, Partial<AuthAccount>> = { [UID]: {} }): PasskeyAuthAccounts & { minted: string[] } {
  const minted: string[] = []
  return {
    minted,
    async lookup(uid) {
      const row = accounts[uid]
      if (!row) return { exists: false, disabled: false, email: null, emailVerified: false }
      return { exists: true, disabled: false, email: 'person@example.com', emailVerified: true, ...row }
    },
    async customToken(uid) {
      minted.push(uid)
      return `token-for-${uid}`
    },
  }
}

async function enrol(store: MemoryStore, uid = UID, counterStart = 0) {
  const device = newSoftAuthenticator(counterStart)
  const begun = await beginPasskeyRegistration({ uid, email: 'person@example.com', rp: RP, existing: [] })
  assert.ok(begun.ok)
  const response = softRegistration(device, {
    challenge: begun.options.challenge,
    origin: RP.origin,
    rpID: RP.rpID,
    userHandle: begun.options.user.id,
  })
  const finished = await finishPasskeyRegistration({ uid, cookie: begun.cookie, response, label: 'Mac', store })
  assert.ok(finished.ok, finished.ok ? '' : finished.error)
  return device
}

async function loginCookie(extra: Partial<PasskeyChallengeCookie> = {}) {
  const begun = await beginPasskeyLogin({ rp: RP, next: '/dashboard' })
  return { ...begun.cookie, ...extra }
}

test('switch: off unless NEXT_PUBLIC_PASSKEYS_ENABLED is exactly true or 1', () => {
  assert.equal(passkeysEnabled({}), false)
  assert.equal(passkeysEnabled({ NEXT_PUBLIC_PASSKEYS_ENABLED: 'false' }), false)
  assert.equal(passkeysEnabled({ NEXT_PUBLIC_PASSKEYS_ENABLED: 'yes' }), false)
  assert.equal(passkeysEnabled({ NEXT_PUBLIC_PASSKEYS_ENABLED: 'true' }), true)
  assert.equal(passkeysEnabled({ NEXT_PUBLIC_PASSKEYS_ENABLED: '1' }), true)
})

test('relying party: production origins only; localhost outside production; previews and look-alikes never', () => {
  const prod = { NODE_ENV: 'production' }
  assert.deepEqual(passkeyRelyingParty('https://www.projectplanner.us', prod), RP)
  assert.deepEqual(passkeyRelyingParty('https://projectplanner.us', prod), { rpID: 'projectplanner.us', origin: 'https://projectplanner.us' })
  assert.equal(passkeyRelyingParty('http://www.projectplanner.us', prod), null)
  assert.equal(passkeyRelyingParty('https://deploy-preview-1--project-planner.netlify.app', prod), null)
  assert.equal(passkeyRelyingParty('https://projectplanner.us.evil.com', prod), null)
  assert.equal(passkeyRelyingParty('https://evilprojectplanner.us', prod), null)
  assert.equal(passkeyRelyingParty('http://localhost:3000', prod), null)
  assert.deepEqual(passkeyRelyingParty('http://localhost:3000', { NODE_ENV: 'development' }), { rpID: 'localhost', origin: 'http://localhost:3000' })
  assert.equal(passkeyRelyingParty(null, prod), null)
  // A configured list replaces the defaults and must still sit under the rp id.
  const env = { NODE_ENV: 'production', PASSKEYS_ALLOWED_ORIGINS: 'https://app.projectplanner.us, https://other.example' }
  assert.deepEqual(passkeyRelyingParty('https://app.projectplanner.us', env), { rpID: 'projectplanner.us', origin: 'https://app.projectplanner.us' })
  assert.equal(passkeyRelyingParty('https://www.projectplanner.us', env), null)
  assert.equal(passkeyRelyingParty('https://other.example', env), null)
})

test('challenge cookie: kinds never cross, and an MFA ok cookie is never a passkey cookie (or the reverse)', async () => {
  const cookie = await loginCookie()
  const raw = encodePasskeyChallenge(cookie)
  assert.ok(decodePasskeyChallenge(raw, 'passkey-login'))
  assert.equal(decodePasskeyChallenge(raw, 'passkey-register'), null)
  assert.equal(decodeMfaOk(raw), null)
  assert.equal(decodePasskeyChallenge(encodeMfaOk(UID, Date.now() + 60_000, Date.now()), 'passkey-login'), null)
  assert.equal(decodePasskeyChallenge(`${raw.split('.')[0]}.forged`, 'passkey-login'), null)
  assert.equal(decodePasskeyChallenge(raw, 'passkey-login', cookie.exp + 1), null)
})

test('enrolment needs this account\'s MFA pass with a real second step in the last 30 minutes', () => {
  const now = 1_800_000_000_000
  assert.equal(passkeyEnrolAllowed({ uid: UID, iat: now - 60_000 }, UID, now), true)
  assert.equal(passkeyEnrolAllowed({ uid: UID, iat: now - PASSKEY_ENROL_FRESH_MS - 1 }, UID, now), false)
  assert.equal(passkeyEnrolAllowed({ uid: UID }, UID, now), false, 'the setup grant (no iat) never enrols')
  assert.equal(passkeyEnrolAllowed({ uid: 'someone-else', iat: now }, UID, now), false)
  assert.equal(passkeyEnrolAllowed(null, UID, now), false)
})

test('registration: stores the public key under the account; the challenge is single-use', async () => {
  const store = new MemoryStore()
  const device = newSoftAuthenticator()
  const begun = await beginPasskeyRegistration({ uid: UID, email: 'person@example.com', rp: RP, existing: [] })
  assert.ok(begun.ok)
  assert.equal(begun.options.user.id, passkeyUserHandleBase64Url(UID))
  assert.equal(begun.options.authenticatorSelection?.userVerification, 'required')
  const response = softRegistration(device, { challenge: begun.options.challenge, origin: RP.origin, rpID: RP.rpID, userHandle: begun.options.user.id })
  const first = await finishPasskeyRegistration({ uid: UID, cookie: begun.cookie, response, label: 'Mac', store })
  assert.ok(first.ok)
  const saved = [...store.rows.values()]
  assert.equal(saved.length, 1)
  assert.equal(saved[0].uid, UID)
  assert.equal(saved[0].rpId, RP.rpID)
  const replay = await finishPasskeyRegistration({ uid: UID, cookie: begun.cookie, response, label: 'Mac', store })
  assert.equal(replay.ok, false)
})

test('registration refused: another account\'s challenge, no user verification, wrong origin, expired', async () => {
  const store = new MemoryStore()
  const begun = await beginPasskeyRegistration({ uid: UID, email: 'p@example.com', rp: RP, existing: [] })
  assert.ok(begun.ok)
  const device = newSoftAuthenticator()
  const good = softRegistration(device, { challenge: begun.options.challenge, origin: RP.origin, rpID: RP.rpID, userHandle: begun.options.user.id })
  const otherUser = await finishPasskeyRegistration({ uid: 'intruder', cookie: begun.cookie, response: good, label: '', store })
  assert.deepEqual([otherUser.ok, otherUser.ok ? 0 : otherUser.status], [false, 403])

  const b2 = await beginPasskeyRegistration({ uid: UID, email: 'p@example.com', rp: RP, existing: [] })
  assert.ok(b2.ok)
  const noUv = softRegistration(newSoftAuthenticator(), { challenge: b2.options.challenge, origin: RP.origin, rpID: RP.rpID, userHandle: b2.options.user.id, userVerified: false })
  assert.equal((await finishPasskeyRegistration({ uid: UID, cookie: b2.cookie, response: noUv, label: '', store })).ok, false)

  const b3 = await beginPasskeyRegistration({ uid: UID, email: 'p@example.com', rp: RP, existing: [] })
  assert.ok(b3.ok)
  const wrongOrigin = softRegistration(newSoftAuthenticator(), { challenge: b3.options.challenge, origin: 'https://evil.example', rpID: RP.rpID, userHandle: b3.options.user.id })
  assert.equal((await finishPasskeyRegistration({ uid: UID, cookie: b3.cookie, response: wrongOrigin, label: '', store })).ok, false)

  const b4 = await beginPasskeyRegistration({ uid: UID, email: 'p@example.com', rp: RP, existing: [] })
  assert.ok(b4.ok)
  const late = softRegistration(newSoftAuthenticator(), { challenge: b4.options.challenge, origin: RP.origin, rpID: RP.rpID, userHandle: b4.options.user.id })
  assert.equal((await finishPasskeyRegistration({ uid: UID, cookie: b4.cookie, response: late, label: '', store, nowMs: b4.cookie.exp + 1 })).ok, false)
  assert.equal(store.rows.size, 0)
})

test('sign-in: a valid assertion mints a custom token for the passkey\'s own account and records the counter', async () => {
  const store = new MemoryStore()
  const device = await enrol(store)
  const cookie = await loginCookie()
  const accounts = auth()
  const result = await finishPasskeyLogin({ cookie, response: softAssertion(device, { challenge: cookie.challenge, origin: RP.origin, rpID: RP.rpID }), store, auth: accounts })
  assert.ok(result.ok, result.ok ? '' : result.reason)
  assert.equal(result.uid, UID)
  assert.equal(result.customToken, `token-for-${UID}`)
  assert.equal(result.next, '/dashboard')
  assert.deepEqual(accounts.minted, [UID])
  const row = [...store.rows.values()][0]
  assert.equal(row.counter, device.counter)
  assert.ok(row.lastUsedAtMs)
})

test('sign-in: a replayed challenge is refused even with a fresh valid signature', async () => {
  const store = new MemoryStore()
  const device = await enrol(store)
  const cookie = await loginCookie()
  const accounts = auth()
  assert.ok((await finishPasskeyLogin({ cookie, response: softAssertion(device, { challenge: cookie.challenge, origin: RP.origin, rpID: RP.rpID }), store, auth: accounts })).ok)
  const again = await finishPasskeyLogin({ cookie, response: softAssertion(device, { challenge: cookie.challenge, origin: RP.origin, rpID: RP.rpID }), store, auth: accounts })
  assert.equal(again.ok, false)
  assert.equal(again.ok ? '' : again.reason, 'challenge-replayed')
  assert.deepEqual(accounts.minted, [UID])
})

test('sign-in: a counter that goes backwards (a cloned authenticator) is refused', async () => {
  const store = new MemoryStore()
  const device = await enrol(store, UID, 10)
  const ok = await loginCookie()
  assert.ok((await finishPasskeyLogin({ cookie: ok, response: softAssertion(device, { challenge: ok.challenge, origin: RP.origin, rpID: RP.rpID, counter: 20 }), store, auth: auth() })).ok)
  const back = await loginCookie()
  const result = await finishPasskeyLogin({ cookie: back, response: softAssertion(device, { challenge: back.challenge, origin: RP.origin, rpID: RP.rpID, counter: 15 }), store, auth: auth() })
  assert.equal(result.ok, false)
  assert.equal(result.ok ? '' : result.reason, 'counter-regression')
  const same = await loginCookie()
  assert.equal((await finishPasskeyLogin({ cookie: same, response: softAssertion(device, { challenge: same.challenge, origin: RP.origin, rpID: RP.rpID, counter: 20 }), store, auth: auth() })).ok, false)
})

test('sign-in refused: wrong origin, wrong challenge, no user verification, unknown passkey, other user handle', async () => {
  const store = new MemoryStore()
  const device = await enrol(store)
  const reasons: string[] = []
  const attempt = async (make: (cookie: PasskeyChallengeCookie) => unknown) => {
    const cookie = await loginCookie()
    const result = await finishPasskeyLogin({ cookie, response: make(cookie), store, auth: auth() })
    assert.equal(result.ok, false)
    reasons.push(result.ok ? '' : result.reason)
  }
  await attempt((c) => softAssertion(device, { challenge: c.challenge, origin: 'https://evil.example', rpID: RP.rpID }))
  await attempt(() => softAssertion(device, { challenge: 'AAAAAAAAAAAAAAAAAAAAAAAA', origin: RP.origin, rpID: RP.rpID }))
  await attempt((c) => softAssertion(device, { challenge: c.challenge, origin: RP.origin, rpID: RP.rpID, userVerified: false }))
  await attempt((c) => softAssertion(newSoftAuthenticator(), { challenge: c.challenge, origin: RP.origin, rpID: RP.rpID }))
  await attempt((c) => softAssertion(device, { challenge: c.challenge, origin: RP.origin, rpID: RP.rpID, userHandle: passkeyUserHandleBase64Url('someone-else') }))
  await attempt((c) => softAssertion(device, { challenge: c.challenge, origin: RP.origin, rpID: 'evil.example' }))
  assert.deepEqual(reasons, ['verify-error', 'verify-error', 'verify-error', 'unknown-credential', 'user-handle-mismatch', 'verify-error'])
})

test('sign-in refused: a disabled (deactivated) or deleted Firebase account, with no token minted', async () => {
  const store = new MemoryStore()
  const device = await enrol(store)
  const disabled = auth({ [UID]: { disabled: true } })
  const c1 = await loginCookie()
  const r1 = await finishPasskeyLogin({ cookie: c1, response: softAssertion(device, { challenge: c1.challenge, origin: RP.origin, rpID: RP.rpID }), store, auth: disabled })
  assert.deepEqual([r1.ok, r1.ok ? 0 : r1.status, r1.ok ? '' : r1.reason], [false, 403, 'account-disabled'])
  assert.deepEqual(disabled.minted, [])
  const gone = auth({})
  const c2 = await loginCookie()
  const r2 = await finishPasskeyLogin({ cookie: c2, response: softAssertion(device, { challenge: c2.challenge, origin: RP.origin, rpID: RP.rpID }), store, auth: gone })
  assert.equal(r2.ok ? '' : r2.reason, 'account-missing')
  assert.deepEqual(gone.minted, [])
})

test('sign-in refused: no or expired challenge cookie, a racing second use (conflict)', async () => {
  const store = new MemoryStore()
  const device = await enrol(store)
  const c = await loginCookie()
  const response = softAssertion(device, { challenge: c.challenge, origin: RP.origin, rpID: RP.rpID })
  assert.equal((await finishPasskeyLogin({ cookie: null, response, store, auth: auth() })).ok, false)
  assert.equal((await finishPasskeyLogin({ cookie: c, response, store, auth: auth(), nowMs: c.exp + 1 })).ok, false)
  store.forceConflict = true
  const c2 = await loginCookie()
  const raced = await finishPasskeyLogin({ cookie: c2, response: softAssertion(device, { challenge: c2.challenge, origin: RP.origin, rpID: RP.rpID }), store, auth: auth() })
  assert.equal(raced.ok ? '' : raced.reason, 'record-conflict')
})

test('developer login: only the verified platform owner\'s own passkey', async () => {
  const store = new MemoryStore()
  const device = await enrol(store)
  const begun = await beginPasskeyLogin({ rp: RP, next: '/developer', ownerOnly: true })
  const notOwner = await finishPasskeyLogin({ cookie: begun.cookie, response: softAssertion(device, { challenge: begun.cookie.challenge, origin: RP.origin, rpID: RP.rpID }), store, auth: auth() })
  assert.equal(notOwner.ok ? '' : notOwner.reason, 'not-owner')
  const b2 = await beginPasskeyLogin({ rp: RP, next: '/developer', ownerOnly: true })
  const unverified = await finishPasskeyLogin({ cookie: b2.cookie, response: softAssertion(device, { challenge: b2.cookie.challenge, origin: RP.origin, rpID: RP.rpID }), store, auth: auth({ [UID]: { email: PLATFORM_OWNER_EMAIL, emailVerified: false } }) })
  assert.equal(unverified.ok ? '' : unverified.reason, 'not-owner')
  const b3 = await beginPasskeyLogin({ rp: RP, next: '/developer', ownerOnly: true })
  const owner = await finishPasskeyLogin({ cookie: b3.cookie, response: softAssertion(device, { challenge: b3.cookie.challenge, origin: RP.origin, rpID: RP.rpID }), store, auth: auth({ [UID]: { email: PLATFORM_OWNER_EMAIL } }) })
  assert.ok(owner.ok)
  assert.equal(owner.next, '/developer')
})

test('sign-in next path is limited to the app\'s own pages', async () => {
  const begun = await beginPasskeyLogin({ rp: RP, next: 'https://evil.example/steal' })
  assert.equal(begun.cookie.next, '/dashboard')
})

test('registration limit and labels', async () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ id: `id-${i}-aaaaaaaaaaaaaaa`, uid: UID } as StoredPasskey))
  const begun = await beginPasskeyRegistration({ uid: UID, email: 'p@example.com', rp: RP, existing: many })
  assert.equal(begun.ok, false)
  assert.equal(passkeyLabelFromUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'), 'Mac')
  assert.equal(passkeyLabelFromUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'Windows')
  assert.equal(passkeyLabelFromUserAgent('x', '  Work\u0000 laptop  '), 'Work laptop')
})

test('custom token: RS256 with the service account, Firebase audience, the uid, at most an hour', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const previous = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'sa@demo.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  })
  try {
    const token = adminSignCustomToken(UID, { nowSec: 1000, ttlSeconds: 99999 })
    const [h, p, s] = token.split('.')
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString())
    assert.equal(JSON.parse(Buffer.from(h, 'base64url').toString()).alg, 'RS256')
    assert.equal(payload.uid, UID)
    assert.equal(payload.aud, FIREBASE_CUSTOM_TOKEN_AUDIENCE)
    assert.equal(payload.iss, 'sa@demo.iam.gserviceaccount.com')
    assert.equal(payload.exp - payload.iat, 3600)
    assert.equal(payload.claims, undefined)
    const verifier = createVerify('RSA-SHA256')
    verifier.update(`${h}.${p}`)
    assert.ok(verifier.verify(publicKey, Buffer.from(s, 'base64url')))
  } finally {
    if (previous === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = previous
  }
})

test('switch off: every passkey route answers 404 and sets no cookie', async () => {
  const previous = process.env.NEXT_PUBLIC_PASSKEYS_ENABLED
  delete process.env.NEXT_PUBLIC_PASSKEYS_ENABLED
  try {
    const routes = await Promise.all([
      import('../../../app/api/auth/passkey/login/options/route.ts'),
      import('../../../app/api/auth/passkey/login/verify/route.ts'),
      import('../../../app/api/auth/passkey/register/options/route.ts'),
      import('../../../app/api/auth/passkey/register/verify/route.ts'),
      import('../../../app/api/auth/passkey/credentials/route.ts'),
      import('../../../app/api/auth/passkey/password-changed/route.ts'),
    ])
    const req = () =>
      new NextRequest('https://www.projectplanner.us/api/auth/passkey/x', {
        method: 'POST',
        headers: { origin: RP.origin, 'content-type': 'application/json' },
        body: '{}',
      })
    const handlers = [routes[0].POST, routes[1].POST, routes[2].POST, routes[3].POST, routes[4].GET, routes[4].DELETE, routes[5].POST]
    for (const handler of handlers) {
      const response = await handler(req())
      assert.equal(response.status, 404)
      assert.equal(response.headers.get('set-cookie'), null)
    }
  } finally {
    if (previous !== undefined) process.env.NEXT_PUBLIC_PASSKEYS_ENABLED = previous
  }
})

test('user handle: stored at registration and compared at sign-in, so rotating MFA_SIGNING_SECRET keeps passkeys working', async () => {
  const previous = process.env.MFA_SIGNING_SECRET
  const store = new MemoryStore()
  try {
    process.env.MFA_SIGNING_SECRET = 'secret-before-rotation'
    const begun = await beginPasskeyRegistration({ uid: UID, email: 'p@example.com', rp: RP, existing: [] })
    assert.ok(begun.ok)
    const device = newSoftAuthenticator()
    const response = softRegistration(device, { challenge: begun.options.challenge, origin: RP.origin, rpID: RP.rpID, userHandle: begun.options.user.id })
    assert.ok((await finishPasskeyRegistration({ uid: UID, cookie: begun.cookie, response, label: 'Mac', store })).ok)
    assert.equal([...store.rows.values()][0].userHandle, begun.options.user.id)

    process.env.MFA_SIGNING_SECRET = 'secret-after-rotation'
    assert.notEqual(passkeyUserHandleBase64Url(UID), begun.options.user.id)
    const cookie = await loginCookie()
    const result = await finishPasskeyLogin({ cookie, response: softAssertion(device, { challenge: cookie.challenge, origin: RP.origin, rpID: RP.rpID }), store, auth: auth() })
    assert.ok(result.ok, result.ok ? '' : result.reason)
  } finally {
    if (previous === undefined) delete process.env.MFA_SIGNING_SECRET
    else process.env.MFA_SIGNING_SECRET = previous
  }
})

test('user handle: a passkey stored before the handle was saved falls back to the HMAC of the uid', async () => {
  const store = new MemoryStore()
  const device = await enrol(store)
  const row = [...store.rows.values()][0]
  store.rows.set(row.id, { ...row, userHandle: '' })
  assert.equal(passkeyExpectedUserHandle({ uid: UID, userHandle: '' }), passkeyUserHandleBase64Url(UID))
  const cookie = await loginCookie()
  assert.ok((await finishPasskeyLogin({ cookie, response: softAssertion(device, { challenge: cookie.challenge, origin: RP.origin, rpID: RP.rpID }), store, auth: auth() })).ok)
  const other = await loginCookie()
  const wrong = await finishPasskeyLogin({
    cookie: other,
    response: softAssertion(device, { challenge: other.challenge, origin: RP.origin, rpID: RP.rpID, userHandle: passkeyUserHandleBase64Url('someone-else') }),
    store,
    auth: auth(),
  })
  assert.equal(wrong.ok ? '' : wrong.reason, 'user-handle-mismatch')
})

test('password reset or change: a passkey made before it is refused at sign-in and removed; one made after works', async () => {
  const store = new MemoryStore()
  const device = await enrol(store)
  const created = [...store.rows.values()][0].createdAtMs as number
  const before = await loginCookie()
  const okBefore = await finishPasskeyLogin({
    cookie: before,
    response: softAssertion(device, { challenge: before.challenge, origin: RP.origin, rpID: RP.rpID }),
    store,
    auth: auth({ [UID]: { passwordUpdatedAtMs: created - 60_000 } }),
  })
  assert.ok(okBefore.ok, 'a password set before the passkey changes nothing')

  const after = await loginCookie()
  const accounts = auth({ [UID]: { passwordUpdatedAtMs: created + 60_000 } })
  const stale = await finishPasskeyLogin({ cookie: after, response: softAssertion(device, { challenge: after.challenge, origin: RP.origin, rpID: RP.rpID }), store, auth: accounts })
  assert.equal(stale.ok ? '' : stale.reason, 'stale-after-password-change')
  assert.equal(stale.ok ? '' : stale.error, PASSKEYS_REMOVED_AFTER_PASSWORD_MESSAGE)
  assert.deepEqual(accounts.minted, [], 'no token after a password change')
  assert.equal(store.rows.size, 0, 'the stale passkey is removed')

  assert.equal(passkeyStaleAfterPasswordChange({ createdAtMs: 1000 }, { passwordUpdatedAtMs: null }), false)
  assert.equal(passkeyStaleAfterPasswordChange({ createdAtMs: null }, { passwordUpdatedAtMs: 5 }), true)
  assert.equal(passkeyStaleAfterPasswordChange({ createdAtMs: 10 }, { passwordUpdatedAtMs: 5 }), false)
})

test('pruneStalePasskeys removes only passkeys older than the last password change (all of them for a deleted account)', async () => {
  const store = new MemoryStore()
  const base = { uid: UID, publicKey: 'pk', counter: 0, transports: [], label: '', backedUp: false, deviceType: 'singleDevice', rpId: RP.rpID, userHandle: '' }
  await store.create({ ...base, id: 'old-passkey-aaaaaaaaaaaa', createdAtMs: 1_000 })
  await store.create({ ...base, id: 'new-passkey-aaaaaaaaaaaa', createdAtMs: 9_000 })
  await store.create({ ...base, uid: 'other', id: 'other-passkey-aaaaaaaaaa', createdAtMs: 1_000 })
  assert.equal(await pruneStalePasskeys({ uid: UID, store, auth: auth({ [UID]: { passwordUpdatedAtMs: 5_000 } }) }), 1)
  assert.deepEqual([...store.rows.keys()].sort(), ['new-passkey-aaaaaaaaaaaa', 'other-passkey-aaaaaaaaaa'])
  assert.equal(await pruneStalePasskeys({ uid: UID, store, auth: auth({ [UID]: { passwordUpdatedAtMs: null } }) }), 0)
  assert.equal(await pruneStalePasskeys({ uid: UID, store, auth: auth({}) }), 1, 'a deleted account keeps none')
  assert.equal(await pruneStalePasskeys({ uid: 'nobody', store, auth: auth({}) }), 0)
})

test('notice emails: added (who, when, device, what to do) and removed; a failed send never throws', async () => {
  const added = buildPasskeyAddedEmail({ email: 'pat@example.com', label: 'Work <laptop>', atMs: Date.UTC(2026, 10, 17, 9, 5), appBaseUrl: 'https://www.projectplanner.us/' })
  assert.equal(added.subject, PASSKEY_ADDED_EMAIL_SUBJECT)
  assert.match(added.html, /pat@example\.com/)
  assert.match(added.html, /Work &lt;laptop&gt;/)
  assert.match(added.text, /17 Nov 2026, 09:05 \(Europe\/London\)/)
  assert.match(added.text, /If this wasn't you, remove it in Settings → Sign-in & password/)
  assert.match(added.text, /change your password/)
  assert.match(added.html, /https:\/\/www\.projectplanner\.us\/dashboard\/settings\/password/)

  const removed = buildPasskeysRemovedEmail({ email: 'pat@example.com', count: 2, atMs: Date.UTC(2026, 10, 17), appBaseUrl: 'https://www.projectplanner.us' })
  assert.match(removed.text, /2 passkeys were removed/)
  assert.match(removed.text, /Your passkeys were removed — add them again after signing in/)

  const sent: { to: string; subject: string }[] = []
  const ok = await sendPasskeyAddedNotice({ email: 'pat@example.com', label: 'Mac' }, (async (params: { to: string; subject: string }) => {
    sent.push(params)
    return { id: 'x' }
  }) as never)
  assert.equal(ok, true)
  assert.deepEqual(sent.map((row) => row.subject), [PASSKEY_ADDED_EMAIL_SUBJECT])
  const failed = await sendPasskeyAddedNotice({ email: 'pat@example.com', label: 'Mac' }, (async () => {
    throw new Error('EMAIL_SERVER_KEY is not set')
  }) as never)
  assert.equal(failed, false)
  assert.equal(await sendPasskeyAddedNotice({ email: '', label: 'Mac' }, (async () => assert.fail('no email, no send')) as never), false)
  assert.equal(await sendPasskeysRemovedNotice({ email: 'pat@example.com', count: 0 }, (async () => assert.fail('nothing removed, no send')) as never), false)
})

test('dedupe: two prunes racing remove each passkey once, so only one "passkeys removed" email goes out', async () => {
  const store = new MemoryStore()
  const base = { uid: UID, publicKey: 'pk', counter: 0, transports: [], label: '', backedUp: false, deviceType: 'singleDevice', rpId: RP.rpID, userHandle: '' }
  await store.create({ ...base, id: 'old-passkey-1-aaaaaaaaaa', createdAtMs: 1_000 })
  await store.create({ ...base, id: 'old-passkey-2-aaaaaaaaaa', createdAtMs: 2_000 })
  const accounts = auth({ [UID]: { passwordUpdatedAtMs: 5_000 } })
  const [first, second] = await Promise.all([
    pruneStalePasskeys({ uid: UID, store, auth: accounts }),
    pruneStalePasskeys({ uid: UID, store, auth: accounts }),
  ])
  assert.equal(first + second, 2, 'each passkey is counted by the one request that removed it')
  assert.equal(await pruneStalePasskeys({ uid: UID, store, auth: accounts }), 0)
})

test('a refused stale passkey still reads "removed because your password changed" when the delete fails', async () => {
  const store = new MemoryStore()
  const device = await enrol(store)
  const created = [...store.rows.values()][0].createdAtMs as number
  store.failDelete = true
  const cookie = await loginCookie()
  const result = await finishPasskeyLogin({
    cookie,
    response: softAssertion(device, { challenge: cookie.challenge, origin: RP.origin, rpID: RP.rpID }),
    store,
    auth: auth({ [UID]: { passwordUpdatedAtMs: created + 1 } }),
  })
  assert.equal(result.ok, false)
  assert.equal(result.ok ? '' : result.error, PASSKEYS_REMOVED_AFTER_PASSWORD_MESSAGE)
  assert.equal(result.ok ? -1 : result.removed, 0)
})

test('padToMinimumDuration waits out the rest of the minimum, never more', async () => {
  let now = 1_000
  const started = Date.now()
  await padToMinimumDuration(started, 60)
  assert.ok(Date.now() - started >= 55)
  const t = Date.now()
  await padToMinimumDuration(0, 1500, () => (now += 5_000))
  assert.ok(Date.now() - t < 50, 'already past the minimum: no wait')
})
