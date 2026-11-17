import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createSessionKeyFetcher,
  mfaPageGateDecision,
  MFA_SESSION_REFRESH_BEFORE_MS,
  sessionCookieAllowsUnsigned,
  sessionCookiePlan,
  verifyFirebaseSessionCookie,
  type SessionCookieCheck,
  type SessionKeyFetcher,
} from './mfaSessionCookie.ts'
import { mintFirebaseSessionCookie } from './mfaSessionCookieMint.ts'
import { clearMfaCookies, clearSessionCookie, MFA_SESSION_COOKIE_HOST, MFA_SESSION_COOKIE_LEGACY, mfaCookieNames } from './mfaCookiePolicy.ts'

const PROJECT = 'demo-project'
const NOW = Date.UTC(2026, 10, 17, 9, 0, 0)
const NOW_S = Math.floor(NOW / 1000)

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  return Buffer.from(bytes).toString('base64url')
}

async function keyPair() {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  )
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  return { privateKey: pair.privateKey, jwk }
}

let signer: Awaited<ReturnType<typeof keyPair>>
let otherSigner: Awaited<ReturnType<typeof keyPair>>
test.before(async () => {
  signer = await keyPair()
  otherSigner = await keyPair()
})

async function signCookie(
  claims: Record<string, unknown>,
  options: { kid?: string; key?: CryptoKey; alg?: string } = {}
): Promise<string> {
  const header = b64url(JSON.stringify({ alg: options.alg ?? 'RS256', kid: options.kid ?? 'k1', typ: 'JWT' }))
  const payload = b64url(JSON.stringify(claims))
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', options.key ?? signer.privateKey, new TextEncoder().encode(`${header}.${payload}`))
  return `${header}.${payload}.${b64url(new Uint8Array(sig))}`
}

function claimsFor(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    iss: `https://session.firebase.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: uid,
    iat: NOW_S - 60,
    auth_time: NOW_S - 120,
    exp: NOW_S + 12 * 3600,
    ...overrides,
  }
}

function jwksFetch(keys: object[], counter?: { calls: number }, status = 200): typeof fetch {
  return (async () => {
    if (counter) counter.calls += 1
    return new Response(JSON.stringify({ keys }), { status, headers: { 'cache-control': 'public, max-age=3600' } })
  }) as typeof fetch
}

function fetcherWith(keys: object[] = [{ ...signer.jwk, kid: 'k1' }]): SessionKeyFetcher {
  return createSessionKeyFetcher({ fetchImpl: jwksFetch(keys), now: () => NOW })
}

async function verify(raw: string | null, keys: SessionKeyFetcher = fetcherWith(), extra: { allowUnsigned?: boolean } = {}) {
  return verifyFirebaseSessionCookie(raw, { projectId: PROJECT, keys, nowMs: NOW, ...extra })
}

test('session cookie: a cookie signed by a published key, for this project, verifies with its uid', async () => {
  const result = await verify(await signCookie(claimsFor('user-a')))
  assert.equal(result.status, 'ok')
  assert.equal(result.status === 'ok' && result.claims.uid, 'user-a')
  assert.equal(result.status === 'ok' && result.claims.exp, (NOW_S + 12 * 3600) * 1000)
})

test('session cookie: missing, malformed and expired cookies are refused', async () => {
  assert.equal((await verify(null)).status, 'missing')
  assert.equal((await verify('')).status, 'missing')
  assert.equal((await verify('not-a-jwt')).status, 'invalid')
  const expired = await verify(await signCookie(claimsFor('user-a', { exp: NOW_S - 1 })))
  assert.deepEqual(expired, { status: 'invalid', reason: 'expired' })
})

test('session cookie: tampering with the payload or the signature is refused', async () => {
  const raw = await signCookie(claimsFor('user-a'))
  const [header, , sig] = raw.split('.')
  const forged = `${header}.${b64url(JSON.stringify(claimsFor('user-b')))}.${sig}`
  assert.deepEqual(await verify(forged), { status: 'invalid', reason: 'signature' })
  const flipped = sig.slice(0, -2) + (sig.endsWith('AA') ? 'BB' : 'AA')
  assert.equal((await verify(`${raw.split('.')[0]}.${raw.split('.')[1]}.${flipped}`)).status, 'invalid')
  // Signed by a key Google does not publish (same kid), so the signature check fails.
  const wrongKey = await signCookie(claimsFor('user-a'), { key: otherSigner.privateKey })
  assert.deepEqual(await verify(wrongKey), { status: 'invalid', reason: 'signature' })
})

test('session cookie: wrong issuer, audience, subject or algorithm is refused', async () => {
  assert.deepEqual(await verify(await signCookie(claimsFor('u', { iss: 'https://securetoken.google.com/demo-project' }))), {
    status: 'invalid',
    reason: 'issuer',
  })
  assert.deepEqual(await verify(await signCookie(claimsFor('u', { aud: 'other-project' }))), { status: 'invalid', reason: 'audience' })
  assert.deepEqual(await verify(await signCookie(claimsFor('', {}))), { status: 'invalid', reason: 'subject' })
  assert.deepEqual(await verify(await signCookie(claimsFor('u', { iat: NOW_S + 3600 }))), { status: 'invalid', reason: 'issued-at' })
  assert.deepEqual(await verify(await signCookie(claimsFor('u'), { alg: 'HS256' })), { status: 'invalid', reason: 'algorithm' })
})

test('session cookie: an unknown key id is refused once the keys are fresh', async () => {
  assert.deepEqual(await verify(await signCookie(claimsFor('u'), { kid: 'nope' })), { status: 'invalid', reason: 'key-id' })
})

test('session cookie: alg none (Auth emulator) is accepted only when the emulator switch allows it', async () => {
  const unsigned = `${b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${b64url(JSON.stringify(claimsFor('user-a')))}.`
  assert.deepEqual(await verify(unsigned), { status: 'invalid', reason: 'unsigned' })
  assert.equal((await verify(unsigned, fetcherWith(), { allowUnsigned: true })).status, 'ok')
  assert.equal(sessionCookieAllowsUnsigned({}), false)
  assert.equal(sessionCookieAllowsUnsigned({ FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' }), false)
  assert.equal(sessionCookieAllowsUnsigned({ NEXT_PUBLIC_USE_EMULATORS: '1', FIREBASE_AUTH_EMULATOR_HOST: 'evil.example:9099' }), false)
  assert.equal(sessionCookieAllowsUnsigned({ NEXT_PUBLIC_USE_EMULATORS: '1', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' }), true)
})

test('key fetcher: a network failure with no keys is "unavailable", never "invalid"', async () => {
  const failing = createSessionKeyFetcher({
    fetchImpl: (async () => {
      throw new Error('offline')
    }) as typeof fetch,
    now: () => NOW,
  })
  assert.deepEqual(await verify(await signCookie(claimsFor('u')), failing), { status: 'unavailable' })
  const google500 = createSessionKeyFetcher({ fetchImpl: jwksFetch([], undefined, 500), now: () => NOW })
  assert.deepEqual(await verify(await signCookie(claimsFor('u')), google500), { status: 'unavailable' })
})

test('key fetcher: keys are cached, and stale keys still verify when a refresh fails', async () => {
  let now = NOW
  let fail = false
  const counter = { calls: 0 }
  const fetcher = createSessionKeyFetcher({
    fetchImpl: (async (...args: Parameters<typeof fetch>) => {
      if (fail) throw new Error('offline')
      return jwksFetch([{ ...signer.jwk, kid: 'k1' }], counter)(...args)
    }) as typeof fetch,
    now: () => now,
  })
  const raw = await signCookie(claimsFor('u'))
  assert.equal((await verifyFirebaseSessionCookie(raw, { projectId: PROJECT, keys: fetcher, nowMs: NOW })).status, 'ok')
  assert.equal((await verifyFirebaseSessionCookie(raw, { projectId: PROJECT, keys: fetcher, nowMs: NOW })).status, 'ok')
  assert.equal(counter.calls, 1)
  now = NOW + 2 * 3600 * 1000
  fail = true
  assert.equal((await verifyFirebaseSessionCookie(raw, { projectId: PROJECT, keys: fetcher, nowMs: NOW })).status, 'ok')
})

test('middleware gate: both cookies for the same uid open the page; anything else goes to the code screen', () => {
  const ok = { uid: 'user-a' }
  const session = (uid: string): SessionCookieCheck => ({ status: 'ok', claims: { uid, exp: NOW + 3600_000, iat: NOW, authTime: null } })
  assert.deepEqual(mfaPageGateDecision(ok, session('user-a')), { action: 'allow' })
  // A cookie for user A while another user's session is in the browser: refused, and the session cookie cleared.
  assert.deepEqual(mfaPageGateDecision(ok, session('user-b')), { action: 'verify', clearSession: true })
  assert.deepEqual(mfaPageGateDecision(ok, { status: 'missing' }), { action: 'verify', clearSession: false })
  assert.deepEqual(mfaPageGateDecision(ok, { status: 'invalid', reason: 'expired' }), { action: 'verify', clearSession: true })
  assert.deepEqual(mfaPageGateDecision(null, session('user-a')), { action: 'verify', clearSession: true })
  // Keys unreachable: try again, never a sign-out.
  assert.deepEqual(mfaPageGateDecision(ok, { status: 'unavailable' }), { action: 'retry' })
})

test('status plan: keep a fresh session for the same uid, otherwise mint', () => {
  const session = (uid: string, exp: number): SessionCookieCheck => ({ status: 'ok', claims: { uid, exp, iat: NOW, authTime: null } })
  assert.equal(sessionCookiePlan('a', session('a', NOW + 2 * MFA_SESSION_REFRESH_BEFORE_MS), NOW), 'keep')
  assert.equal(sessionCookiePlan('a', session('a', NOW + MFA_SESSION_REFRESH_BEFORE_MS - 1), NOW), 'mint')
  assert.equal(sessionCookiePlan('a', session('b', NOW + 2 * MFA_SESSION_REFRESH_BEFORE_MS), NOW), 'mint')
  assert.equal(sessionCookiePlan('a', { status: 'missing' }, NOW), 'mint')
  assert.equal(sessionCookiePlan('a', { status: 'unavailable' }, NOW), 'mint')
})

test('mint: Firebase createSessionCookie with the service-account token; 400 is invalid, the rest is retry', async () => {
  let seen: { url: string; init: RequestInit } | null = null
  const ok = await mintFirebaseSessionCookie('id-token', {
    emulator: false,
    base: 'https://identitytoolkit.googleapis.com/v1',
    accessToken: async () => ({ token: 'sa-token', projectId: PROJECT }),
    fetchImpl: (async (url: string, init: RequestInit) => {
      seen = { url, init }
      return new Response(JSON.stringify({ sessionCookie: 'cookie-jwt' }), { status: 200 })
    }) as unknown as typeof fetch,
  })
  assert.deepEqual(ok, { status: 'ok', cookie: 'cookie-jwt', maxAgeMs: 12 * 3600 * 1000 })
  assert.equal(seen!.url, `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}:createSessionCookie`)
  assert.equal((seen!.init.headers as Record<string, string>).Authorization, 'Bearer sa-token')
  assert.deepEqual(JSON.parse(String(seen!.init.body)), { idToken: 'id-token', validDuration: '43200' })

  const respond = (status: number) =>
    mintFirebaseSessionCookie('id-token', {
      emulator: false,
      accessToken: async () => ({ token: 't', projectId: PROJECT }),
      fetchImpl: (async () => new Response('{}', { status })) as typeof fetch,
    })
  assert.deepEqual(await respond(400), { status: 'invalid' })
  for (const status of [401, 403, 429, 500, 503]) assert.deepEqual(await respond(status), { status: 'unavailable' })
  assert.deepEqual(
    await mintFirebaseSessionCookie('id-token', {
      emulator: false,
      accessToken: async () => {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set')
      },
    }),
    { status: 'unavailable' }
  )
  assert.deepEqual(
    await mintFirebaseSessionCookie('id-token', {
      emulator: false,
      accessToken: async () => ({ token: 't', projectId: PROJECT }),
      fetchImpl: (async () => {
        throw new Error('offline')
      }) as typeof fetch,
    }),
    { status: 'unavailable' }
  )
  assert.deepEqual(await mintFirebaseSessionCookie(''), { status: 'invalid' })
})

test('mint: against the Auth emulator it uses the emulator owner token, never the service account', async () => {
  let auth = ''
  const result = await mintFirebaseSessionCookie('id-token', {
    emulator: true,
    projectId: PROJECT,
    base: 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1',
    accessToken: async () => {
      throw new Error('must not be called')
    },
    fetchImpl: (async (_url: string, init: RequestInit) => {
      auth = (init.headers as Record<string, string>).Authorization
      return new Response(JSON.stringify({ sessionCookie: 'c' }), { status: 200 })
    }) as unknown as typeof fetch,
  })
  assert.equal(result.status, 'ok')
  assert.equal(auth, 'Bearer owner')
})

test('cookies: sign-out (clearMfaCookies) and an MFA reset (clearSessionCookie) expire both session cookie names', () => {
  assert.equal(mfaCookieNames(true).session, MFA_SESSION_COOKIE_HOST)
  assert.equal(mfaCookieNames(false).session, MFA_SESSION_COOKIE_LEGACY)
  for (const clear of [
    (setter: Parameters<typeof clearMfaCookies>[0]) => clearMfaCookies(setter),
    (setter: Parameters<typeof clearSessionCookie>[0]) => clearSessionCookie(setter),
  ]) {
    const set: Array<{ name: string; maxAge: number; httpOnly: boolean }> = []
    clear({ set: (name, _value, options) => set.push({ name, maxAge: options.maxAge, httpOnly: options.httpOnly }) })
    for (const name of [MFA_SESSION_COOKIE_HOST, MFA_SESSION_COOKIE_LEGACY]) {
      const row = set.find((entry) => entry.name === name)
      assert.ok(row, `${name} expired`)
      assert.equal(row!.maxAge, 0)
      assert.equal(row!.httpOnly, true)
    }
  }
})
