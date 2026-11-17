/**
 * Passkeys (web, behind NEXT_PUBLIC_PASSKEYS_ENABLED): the server-only collections against the Firestore emulator
 * and the current firestore.rules.
 *
 * 1. No client — signed out, an ordinary member, the platform owner, the passkey's own account — can read, list or
 *    write `webauthnCredentials` or `webauthnUsedChallenges` (no rule matches them, so they are denied by default).
 * 2. The real REST store works on the emulator: create, read with its update time, list by uid, a conditional
 *    counter update (a stale one is a conflict), single-use challenges, delete.
 * 3. The real routes end to end: enrol (signed in + fresh MFA pass), sign in (custom token + MFA ok cookie), replay
 *    refused, a disabled account refused with no cookie. Only Identity Toolkit `accounts:lookup` is answered locally.
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { NextRequest } from 'next/server'

import { PLATFORM_OWNER_EMAIL } from '../lib/canonical/passwordPolicy.ts'
import { decodeMfaOk, encodeMfaOk } from '../lib/auth/mfa/mfaCookies.ts'
import { mfaCookieName } from '../lib/auth/mfa/mfaCookiePolicy.ts'
import { PASSKEY_COOKIE_LEGACY } from '../lib/auth/passkeys/passkeyChallenge.ts'
import {
  firestorePasskeyStore,
  PASSKEY_COLLECTION,
  PASSKEY_USED_CHALLENGES_COLLECTION,
  passkeyDocumentId,
} from '../lib/auth/passkeys/passkeyStore.ts'
import { newSoftAuthenticator, softAssertion, softRegistration } from '../lib/auth/passkeys/testAuthenticator.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(process.env.RULES_PATH || path.join(root, 'firestore.rules'), 'utf8')
const PROJECT = 'demo-passkeys'
const PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8080)
const ORIGIN = 'http://localhost:3000'
const USER = 'pk-user'
const DISABLED = 'pk-disabled'

let env: RulesTestEnvironment
/** Auth `passwordUpdatedAt` the mocked accounts:lookup reports, per uid. */
const passwordUpdatedAt: Record<string, number> = {}
const realFetch = globalThis.fetch
const base = () => `http://127.0.0.1:${PORT}/v1/projects/${PROJECT}/databases/(default)/documents`
const store = () => firestorePasskeyStore({ bearer: async () => 'owner', base: base() })

function emulatorToken(uid: string, claims: Record<string, unknown> = {}): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  return `${part({ alg: 'none', typ: 'JWT' })}.${part({
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    iat: now,
    exp: now + 3600,
    auth_time: now,
    sub: uid,
    user_id: uid,
    firebase: { sign_in_provider: 'password', identities: {} },
    ...claims,
  })}.`
}

test.before(async () => {
  env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { rules, host: '127.0.0.1', port: PORT } })
  await env.clearFirestore()
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key'
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = PROJECT
  process.env.NEXT_PUBLIC_USE_EMULATORS = '1'
  process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${PORT}`
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
  process.env.NEXT_PUBLIC_PASSKEYS_ENABLED = 'true'
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('accounts:lookup')) {
      const body = JSON.parse(String(init?.body || '{}')) as { idToken?: string; localId?: string[]; email?: string[] }
      const uid =
        body.localId?.[0] ||
        (body.email?.[0] ? body.email[0].replace(/@example\.com$/, '') : '') ||
        (body.idToken ? JSON.parse(Buffer.from(body.idToken.split('.')[1], 'base64url').toString()).user_id : '')
      if (uid !== USER && uid !== DISABLED) return new Response(JSON.stringify({ users: [] }))
      return new Response(
        JSON.stringify({
          users: [
            {
              localId: uid,
              email: `${uid}@example.com`,
              emailVerified: true,
              disabled: uid === DISABLED,
              createdAt: '1000',
              ...(passwordUpdatedAt[uid] ? { passwordUpdatedAt: passwordUpdatedAt[uid] } : {}),
            },
          ],
        })
      )
    }
    return realFetch(input, init)
  }) as typeof fetch
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, PASSKEY_COLLECTION, 'c_seeded-credential-0000'), { uid: 'seeded-user', publicKey: 'x', counter: 0 })
    await setDoc(doc(db, PASSKEY_USED_CHALLENGES_COLLECTION, 'seeded'), { usedAt: new Date() })
  })
})

test.after(async () => {
  globalThis.fetch = realFetch
  await env.cleanup()
})

test('clients never read, list or write passkey documents (signed out, member, owner, the passkey\'s own account)', async () => {
  const contexts = [
    env.unauthenticatedContext(),
    env.authenticatedContext('member-1', { email: 'member@example.com', email_verified: true }),
    env.authenticatedContext('owner-1', { email: PLATFORM_OWNER_EMAIL, email_verified: true }),
    env.authenticatedContext(USER, { email: `${USER}@example.com`, email_verified: true }),
  ]
  for (const ctx of contexts) {
    const db = ctx.firestore()
    await assertFails(getDoc(doc(db, PASSKEY_COLLECTION, 'c_seeded-credential-0000')))
    await assertFails(getDocs(collection(db, PASSKEY_COLLECTION)))
    await assertFails(setDoc(doc(db, PASSKEY_COLLECTION, 'c_forged-credential-00000'), { uid: USER, publicKey: 'evil', counter: 0 }))
    await assertFails(deleteDoc(doc(db, PASSKEY_COLLECTION, 'c_seeded-credential-0000')))
    await assertFails(getDoc(doc(db, PASSKEY_USED_CHALLENGES_COLLECTION, 'seeded')))
    await assertFails(setDoc(doc(db, PASSKEY_USED_CHALLENGES_COLLECTION, 'new'), { usedAt: new Date() }))
  }
})

test('REST store on the emulator: create, get, list, conditional counter, single-use challenge, delete', async () => {
  const s = store()
  const id = 'store-test-credential-abcdef'
  assert.equal(
    await s.create({ id, uid: 'store-user', publicKey: 'pk', counter: 1, transports: ['internal'], label: 'Mac', createdAtMs: Date.now(), backedUp: true, deviceType: 'multiDevice', rpId: 'localhost', userHandle: 'h1' }),
    'created'
  )
  assert.equal(
    await s.create({ id, uid: 'someone-else', publicKey: 'pk2', counter: 0, transports: [], label: '', createdAtMs: Date.now(), backedUp: false, deviceType: 'singleDevice', rpId: 'localhost', userHandle: 'h2' }),
    'exists'
  )
  const row = await s.get(id)
  assert.equal(row?.uid, 'store-user')
  assert.deepEqual(row?.transports, ['internal'])
  assert.ok(row?.updateTime)
  assert.equal((await s.listForUser('store-user')).length, 1)
  assert.equal(await s.recordUse(row!, { counter: 5, lastUsedAtMs: Date.now() }), 'ok')
  assert.equal(await s.recordUse(row!, { counter: 6, lastUsedAtMs: Date.now() }), 'conflict', 'a stale read never records a use')
  assert.equal((await s.get(id))?.counter, 5)
  assert.equal(await s.consumeChallenge('challenge-hash-1', Date.now() + 60_000), 'consumed')
  assert.equal(await s.consumeChallenge('challenge-hash-1', Date.now() + 60_000), 'used')
  assert.equal(await s.deleteAllForUser('store-user'), 1)
  assert.equal(await s.get(id), null)
  assert.ok(passkeyDocumentId('__x__').startsWith('c_'))
})

function cookieValue(response: Response, name: string): string {
  const all = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() || []
  const match = all.map((line) => line.split(';')[0]).find((pair) => pair.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : ''
}

function routeRequest(
  url: string,
  init: { method?: string; body?: unknown; uid?: string; cookies?: Record<string, string> } = {}
): NextRequest {
  const text = init.body === undefined ? '' : JSON.stringify(init.body)
  const headers: Record<string, string> = { origin: ORIGIN, 'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 250)}` }
  if (text) {
    headers['content-type'] = 'application/json'
    headers['content-length'] = String(text.length)
  }
  if (init.uid) headers.authorization = `Bearer ${emulatorToken(init.uid)}`
  const req = new NextRequest(`http://localhost:3000${url}`, { method: init.method || 'POST', headers, ...(text ? { body: text } : {}) })
  for (const [name, value] of Object.entries(init.cookies || {})) req.cookies.set(name, value)
  return req
}

test('routes end to end: enrol, sign in (custom token + MFA ok cookie), replay refused, disabled account refused', async () => {
  const regOptions = await import('../app/api/auth/passkey/register/options/route.ts')
  const regVerify = await import('../app/api/auth/passkey/register/verify/route.ts')
  const loginOptions = await import('../app/api/auth/passkey/login/options/route.ts')
  const loginVerify = await import('../app/api/auth/passkey/login/verify/route.ts')
  const credentials = await import('../app/api/auth/passkey/credentials/route.ts')
  const okCookieName = mfaCookieName('ok', false)

  // Without a fresh second step, enrolment is refused.
  const stale = await regOptions.POST(routeRequest('/api/auth/passkey/register/options', { uid: USER, body: {}, cookies: { [okCookieName]: encodeMfaOk(USER, Date.now() + 60_000) } }))
  assert.equal(stale.status, 403)

  for (const uid of [USER, DISABLED]) {
    const mfa = { [okCookieName]: encodeMfaOk(uid, Date.now() + 60_000, Date.now()) }
    const optionsResponse = await regOptions.POST(routeRequest('/api/auth/passkey/register/options', { uid, body: {}, cookies: mfa }))
    assert.equal(optionsResponse.status, 200, await optionsResponse.clone().text())
    const { options } = (await optionsResponse.json()) as { options: { challenge: string; rp: { id: string }; user: { id: string } } }
    assert.equal(options.rp.id, 'localhost')
    const device = newSoftAuthenticator()
    ;(globalThis as Record<string, unknown>)[`device-${uid}`] = device
    const attestation = softRegistration(device, { challenge: options.challenge, origin: ORIGIN, rpID: 'localhost', userHandle: options.user.id })
    const verifyResponse = await regVerify.POST(
      routeRequest('/api/auth/passkey/register/verify', {
        uid,
        body: { response: attestation, label: 'Test laptop' },
        cookies: { ...mfa, [PASSKEY_COOKIE_LEGACY]: cookieValue(optionsResponse, PASSKEY_COOKIE_LEGACY) },
      })
    )
    assert.equal(verifyResponse.status, 200, await verifyResponse.clone().text())
  }

  const listed = await credentials.GET(routeRequest('/api/auth/passkey/credentials', { method: 'GET', uid: USER, cookies: { [okCookieName]: encodeMfaOk(USER, Date.now() + 60_000) } }))
  const rows = ((await listed.json()) as { passkeys: { label: string }[] }).passkeys
  assert.deepEqual(rows.map((row) => row.label), ['Test laptop'], 'only the caller\'s own passkeys are listed')

  const signIn = async (uid: string) => {
    const optionsResponse = await loginOptions.POST(routeRequest('/api/auth/passkey/login/options', { body: { next: '/dashboard' } }))
    const { options } = (await optionsResponse.json()) as { options: { challenge: string } }
    const device = (globalThis as Record<string, unknown>)[`device-${uid}`] as ReturnType<typeof newSoftAuthenticator>
    const assertion = softAssertion(device, { challenge: options.challenge, origin: ORIGIN, rpID: 'localhost' })
    const cookies = { [PASSKEY_COOKIE_LEGACY]: cookieValue(optionsResponse, PASSKEY_COOKIE_LEGACY) }
    const first = await loginVerify.POST(routeRequest('/api/auth/passkey/login/verify', { body: { response: assertion }, cookies }))
    const replay = await loginVerify.POST(routeRequest('/api/auth/passkey/login/verify', { body: { response: assertion }, cookies }))
    return { first, replay }
  }

  const ok = await signIn(USER)
  assert.equal(ok.first.status, 200, await ok.first.clone().text())
  const body = (await ok.first.json()) as { customToken: string; next: string }
  assert.equal(body.next, '/dashboard')
  assert.equal(JSON.parse(Buffer.from(body.customToken.split('.')[1], 'base64url').toString()).uid, USER)
  const pass = decodeMfaOk(cookieValue(ok.first, okCookieName))
  assert.equal(pass?.uid, USER)
  assert.ok(typeof pass?.iat === 'number', 'a passkey is a fresh second step')
  assert.equal(ok.replay.status, 400)
  assert.equal(cookieValue(ok.replay, okCookieName), '')

  const disabled = await signIn(DISABLED)
  assert.equal(disabled.first.status, 403)
  assert.equal(cookieValue(disabled.first, okCookieName), '', 'a disabled account never gets the MFA pass')

  // The user handle given at registration is stored with the passkey.
  const stored = await store().listForUser(USER)
  assert.equal(stored.length, 1)
  assert.match(stored[0].userHandle, /^[A-Za-z0-9_-]{20,}$/)

  // A password reset (signed out, the email from the reset link) removes the passkeys made before it.
  const reset = await import('../app/api/auth/passkey/password-changed/route.ts')
  const settle = async (check: () => Promise<boolean>) => {
    for (let i = 0; i < 40 && !(await check()); i += 1) await new Promise((resolve) => setTimeout(resolve, 100))
  }
  const untouched = await reset.POST(routeRequest('/api/auth/passkey/password-changed', { body: { email: `${USER}@example.com` } }))
  assert.equal(untouched.status, 200)
  await new Promise((resolve) => setTimeout(resolve, 500))
  assert.equal((await store().listForUser(USER)).length, 1, 'no password change yet: nothing removed')
  passwordUpdatedAt[USER] = Date.now() + 1000
  const timed = async (email: string) => {
    const started = Date.now()
    const response = await reset.POST(routeRequest('/api/auth/passkey/password-changed', { body: { email } }))
    return { body: await response.json(), ms: Date.now() - started }
  }
  const unknown = await timed('nobody@example.com')
  const real = await timed(`${USER}@example.com`)
  assert.deepEqual(unknown.body, { ok: true }, 'never says whether the email has an account')
  assert.deepEqual(real.body, { ok: true })
  assert.ok(unknown.ms >= 1450 && real.ms >= 1450, `both answers take the fixed minimum (${unknown.ms} / ${real.ms} ms)`)
  assert.ok(Math.abs(unknown.ms - real.ms) < 400, 'the lookup and removal run after the answer')
  await settle(async () => (await store().listForUser(USER)).length === 0)
  assert.equal((await store().listForUser(USER)).length, 0, 'the passkey made before the reset is gone')
  // Per-email limit: the same address cannot be hammered from many IPs.
  let limitedStatus = 0
  for (let i = 0; i < 6 && limitedStatus !== 429; i += 1) {
    const response = await reset.POST(routeRequest('/api/auth/passkey/password-changed', { body: { email: 'hammered@example.com' } }))
    limitedStatus = response.status
  }
  assert.equal(limitedStatus, 429)
  const after = await signIn(USER)
  assert.equal(after.first.status, 401)
  assert.equal(cookieValue(after.first, okCookieName), '')

  // A password change (signed in) reports how many were removed.
  passwordUpdatedAt[DISABLED] = Date.now() + 1000
  const changed = await reset.POST(routeRequest('/api/auth/passkey/password-changed', { uid: DISABLED, body: {} }))
  assert.deepEqual(await changed.json(), { ok: true, removed: 1 })
})
