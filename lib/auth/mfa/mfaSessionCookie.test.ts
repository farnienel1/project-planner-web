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
import { googleErrorCode, mintFirebaseSessionCookie } from './mfaSessionCookieMint.ts'
import { adminGoogleAccessToken, GoogleAccessTokenError, privateKeyErrorName } from '../../owner/identityToolkitAdmin.ts'
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

test('proxy gate: both cookies for the same uid open the page; anything else goes to the code screen', () => {
  const ok = { uid: 'user-a' }
  const session = (uid: string): SessionCookieCheck => ({ status: 'ok', claims: { uid, exp: NOW + 3600_000, iat: NOW, authTime: NOW } })
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
  const session = (uid: string, exp: number): SessionCookieCheck => ({ status: 'ok', claims: { uid, exp, iat: NOW, authTime: NOW } })
  assert.equal(sessionCookiePlan('a', session('a', NOW + 2 * MFA_SESSION_REFRESH_BEFORE_MS), NOW), 'keep')
  assert.equal(sessionCookiePlan('a', session('a', NOW + MFA_SESSION_REFRESH_BEFORE_MS - 1), NOW), 'mint')
  assert.equal(sessionCookiePlan('a', session('b', NOW + 2 * MFA_SESSION_REFRESH_BEFORE_MS), NOW), 'mint')
  assert.equal(sessionCookiePlan('a', { status: 'missing' }, NOW), 'mint')
  assert.equal(sessionCookiePlan('a', { status: 'unavailable' }, NOW), 'mint')
})

function quietConsole() {
  const lines: string[] = []
  const realError = console.error
  const realWarn = console.warn
  console.error = (...args: unknown[]) => lines.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '))
  console.warn = console.error
  return {
    lines,
    restore() {
      console.error = realError
      console.warn = realWarn
    },
  }
}

const SECRET_TOKEN = 'id-token-SECRET-abc123'

function respondWith(status: number, body: object = {}) {
  return mintFirebaseSessionCookie(SECRET_TOKEN, {
    emulator: false,
    projectId: PROJECT,
    serviceAccountProject: PROJECT,
    accessToken: async () => ({ token: 'sa-token', projectId: PROJECT }),
    fetchImpl: (async () => new Response(JSON.stringify(body), { status })) as typeof fetch,
  })
}

test('mint: Firebase createSessionCookie with the service-account token, for the app project', async () => {
  let seen: { url: string; init: RequestInit } | null = null
  const ok = await mintFirebaseSessionCookie('id-token', {
    emulator: false,
    base: 'https://identitytoolkit.googleapis.com/v1',
    projectId: PROJECT,
    serviceAccountProject: PROJECT,
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
  assert.deepEqual(await mintFirebaseSessionCookie(''), { status: 'invalid' })
})

test('mint: a refused ID token (400 with an ID-token error) is invalid; 429 / 5xx are retry', async () => {
  const quiet = quietConsole()
  try {
    for (const code of ['INVALID_ID_TOKEN', 'TOKEN_EXPIRED', 'USER_DISABLED']) {
      assert.deepEqual(await respondWith(400, { error: { code: 400, message: `${code} : x` } }), { status: 'invalid' })
    }
    for (const status of [429, 500, 503]) assert.deepEqual(await respondWith(status), { status: 'unavailable' })
  } finally {
    quiet.restore()
  }
})

test('mint: 401 / 403 and another 400 are setup errors, logged with the status and Google code only', async () => {
  const quiet = quietConsole()
  try {
    assert.equal((await respondWith(401, { error: { message: 'UNAUTHENTICATED' } })).status, 'setup')
    assert.equal((await respondWith(403, { error: { message: 'PERMISSION_DENIED : no' } })).status, 'setup')
    assert.equal((await respondWith(400, { error: { message: 'INVALID_DURATION' } })).status, 'setup')
    const text = quiet.lines.join('\n')
    assert.match(text, /SETUP ERROR/)
    assert.match(text, /403/)
    assert.match(text, /PERMISSION_DENIED/)
    assert.doesNotMatch(text, /SECRET|sa-token/)
  } finally {
    quiet.restore()
  }
})

test('mint: a missing or unusable service account is a setup error; Google OAuth unreachable is retry', async () => {
  const quiet = quietConsole()
  try {
    const failingToken = (kind: 'setup' | 'unavailable') =>
      mintFirebaseSessionCookie(SECRET_TOKEN, {
        emulator: false,
        projectId: PROJECT,
        serviceAccountProject: null,
        accessToken: async () => {
          throw new GoogleAccessTokenError('x', kind, kind === 'setup' ? 400 : 503, kind === 'setup' ? 'invalid_grant' : null)
        },
      })
    assert.deepEqual(await failingToken('setup'), { status: 'setup', reason: 'service-account' })
    assert.deepEqual(await failingToken('unavailable'), { status: 'unavailable' })
    // A plain error (for example a missing account read by an older helper) is a setup error, never a retry loop.
    assert.equal(
      (
        await mintFirebaseSessionCookie(SECRET_TOKEN, {
          emulator: false,
          projectId: PROJECT,
          serviceAccountProject: null,
          accessToken: async () => {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set on the server.')
          },
        })
      ).status,
      'setup'
    )
    assert.deepEqual(
      await mintFirebaseSessionCookie(SECRET_TOKEN, {
        emulator: false,
        projectId: PROJECT,
        serviceAccountProject: PROJECT,
        accessToken: async () => ({ token: 't', projectId: PROJECT }),
        fetchImpl: (async () => {
          throw new Error('offline')
        }) as typeof fetch,
      }),
      { status: 'unavailable' }
    )
    assert.doesNotMatch(quiet.lines.join('\n'), /SECRET/)
  } finally {
    quiet.restore()
  }
})

test('mint: a service account from another project than the app is a setup error (never a cookie the proxy refuses)', async () => {
  const quiet = quietConsole()
  let called = false
  try {
    const result = await mintFirebaseSessionCookie(SECRET_TOKEN, {
      emulator: false,
      projectId: PROJECT,
      serviceAccountProject: 'other-project',
      accessToken: async () => {
        called = true
        return { token: 't', projectId: 'other-project' }
      },
    })
    assert.deepEqual(result, { status: 'setup', reason: 'project-mismatch' })
    assert.equal(called, false)
    assert.match(quiet.lines.join('\n'), /other-project/)
    assert.deepEqual(await mintFirebaseSessionCookie(SECRET_TOKEN, { emulator: true, projectId: '' }), {
      status: 'setup',
      reason: 'no-project',
    })
  } finally {
    quiet.restore()
  }
})

test('googleErrorCode: reads Google\'s code and nothing else', () => {
  assert.equal(googleErrorCode({ error: { message: 'INVALID_ID_TOKEN : Firebase ID token has expired' } }), 'INVALID_ID_TOKEN')
  assert.equal(googleErrorCode({ error: { message: 'PERMISSION_DENIED' } }), 'PERMISSION_DENIED')
  assert.equal(googleErrorCode({ error: { message: 'eyJhbGciOi.secret' } }), '')
  assert.equal(googleErrorCode(null), '')
})

test('session cookie: a cookie without auth_time is refused, as firebase-admin does', async () => {
  const claims = claimsFor('user-a') as Record<string, unknown>
  delete claims.auth_time
  assert.deepEqual(await verify(await signCookie(claims)), { status: 'invalid', reason: 'auth-time' })
  assert.deepEqual(await verify(await signCookie(claimsFor('user-a', { auth_time: NOW_S + 3600 }))), {
    status: 'invalid',
    reason: 'auth-time',
  })
})

/** Review of #359, item 3: a just-rotated key never clears a valid cookie. */
test('key fetcher: an unknown kid within a minute of a refresh is "try again", then picked up on the next refresh', async () => {
  let now = NOW
  let published: object[] = [{ ...signer.jwk, kid: 'k1' }]
  const counter = { calls: 0 }
  const fetcher = createSessionKeyFetcher({
    fetchImpl: (async () => {
      counter.calls += 1
      return new Response(JSON.stringify({ keys: published }), { status: 200 })
    }) as typeof fetch,
    now: () => now,
  })
  const check = async (raw: string) => verifyFirebaseSessionCookie(raw, { projectId: PROJECT, keys: fetcher, nowMs: NOW })
  assert.equal((await check(await signCookie(claimsFor('u')))).status, 'ok')
  // Google rotates: a cookie signed with the new key arrives 30 s after our fetch.
  published = [{ ...signer.jwk, kid: 'k1' }, { ...otherSigner.jwk, kid: 'k2' }]
  now = NOW + 30_000
  const rotated = await signCookie(claimsFor('u'), { kid: 'k2', key: otherSigner.privateKey })
  assert.deepEqual(await check(rotated), { status: 'unavailable' })
  assert.equal(counter.calls, 1)
  // A minute later the unseen kid forces a refetch and the cookie verifies.
  now = NOW + 61_000
  assert.equal((await check(rotated)).status, 'ok')
  assert.equal(counter.calls, 2)
})

/** Review of #359, item 5: a fetch that throws synchronously never leaves a stuck "failed" refresh behind. */
test('key fetcher: a synchronous throw from fetch does not wedge later refreshes', async () => {
  let now = NOW
  let throwNow = true
  const fetcher = createSessionKeyFetcher({
    fetchImpl: ((url: string) => {
      if (throwNow) throw new TypeError('sync failure')
      return Promise.resolve(new Response(JSON.stringify({ keys: [{ ...signer.jwk, kid: 'k1' }] }), { status: 200 }))
    }) as unknown as typeof fetch,
    now: () => now,
  })
  const raw = await signCookie(claimsFor('u'))
  assert.deepEqual(await verifyFirebaseSessionCookie(raw, { projectId: PROJECT, keys: fetcher, nowMs: NOW }), { status: 'unavailable' })
  throwNow = false
  now = NOW + 1_000
  assert.equal((await verifyFirebaseSessionCookie(raw, { projectId: PROJECT, keys: fetcher, nowMs: NOW })).status, 'ok')
})

/** Review of #359, item 5: concurrent lookups share one fetch. */
test('key fetcher: concurrent lookups share one refresh', async () => {
  const counter = { calls: 0 }
  const fetcher = createSessionKeyFetcher({ fetchImpl: jwksFetch([{ ...signer.jwk, kid: 'k1' }], counter), now: () => NOW })
  const raw = await signCookie(claimsFor('u'))
  const results = await Promise.all(
    [1, 2, 3].map(() => verifyFirebaseSessionCookie(raw, { projectId: PROJECT, keys: fetcher, nowMs: NOW }))
  )
  assert.deepEqual(results.map((result) => result.status), ['ok', 'ok', 'ok'])
  assert.equal(counter.calls, 1)
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

// Built from parts so secret scanners (gitleaks) don't read these fake test strings as a real key.
const FAKE_PEM_BEGIN = '-----BEGIN ' + 'PRIVATE KEY-----'
const FAKE_PEM_END = '-----END ' + 'PRIVATE KEY-----'

/** Review of #359 (re-review 1): the key fetch passes no options an edge runtime might reject. */
test('key fetcher: fetches the keys URL with no request options', async () => {
  const seen: unknown[][] = []
  const fetcher = createSessionKeyFetcher({
    fetchImpl: (async (...args: unknown[]) => {
      seen.push(args)
      return new Response(JSON.stringify({ keys: [{ ...signer.jwk, kid: 'k1' }] }), { status: 200 })
    }) as unknown as typeof fetch,
    now: () => NOW,
  })
  assert.equal((await verify(await signCookie(claimsFor('u')), fetcher)).status, 'ok')
  assert.equal(seen.length, 1)
  assert.equal(seen[0].length, 1)
})

/** Review of #359 (re-review 3): a useful label for an unusable private key, never key material. */
test('privateKeyErrorName: the error class and Node code only, never the message', () => {
  const error = Object.assign(new TypeError(`${FAKE_PEM_BEGIN}MIIEsecret`), { code: 'ERR_OSSL_UNSUPPORTED' })
  assert.equal(privateKeyErrorName(error), 'TypeError ERR_OSSL_UNSUPPORTED')
  assert.equal(privateKeyErrorName(new Error('MIIEsecret')), 'Error')
  assert.equal(privateKeyErrorName(Object.assign(new Error('x'), { code: 'MIIE secret value' })), 'Error')
  assert.equal(privateKeyErrorName('a string'), 'string')
  assert.doesNotMatch(privateKeyErrorName(error), /MIIE|BEGIN/)
})

test('service account with an unusable private key: a setup error naming the error class, not the key', async () => {
  const saved = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'sa@demo-project.iam.gserviceaccount.com',
    private_key: `${FAKE_PEM_BEGIN}\\nNOTAREALKEYsecretmaterial\\n${FAKE_PEM_END}`,
    project_id: PROJECT,
  })
  try {
    await assert.rejects(adminGoogleAccessToken(['scope']), (error) => {
      assert.ok(error instanceof GoogleAccessTokenError)
      assert.equal(error.kind, 'setup')
      assert.match(error.message, /could not be used \([A-Za-z]*Error( [A-Z0-9_]+)?\)\./)
      assert.doesNotMatch(error.message, /NOTAREALKEY|secretmaterial|BEGIN/)
      return true
    })
  } finally {
    if (saved === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = saved
  }
})
