import { afterEach, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { encodeMfaOk } from './mfaCookies.ts'
import { MFA_SESSION_COOKIE_LEGACY, mfaCookieName, shouldSecureMfaCookies } from './mfaCookiePolicy.ts'
import { proxy } from '../../../proxy.ts'
import { GET as status } from '../../../app/api/auth/mfa/status/route.ts'
import { POST as logout } from '../../../app/api/auth/mfa/logout/route.ts'

/**
 * Owner decision 17 Nov ("server-side session cookie before launch"): /dashboard and /developer open only with the
 * MFA ok cookie AND a Firebase session cookie, both naming the same uid. These tests run the real proxy and
 * routes. Session cookies here are the Auth emulator's unsigned (`alg: none`) cookies, accepted only while the
 * emulator switch is on; the signed path is covered in mfaSessionCookie.test.ts.
 */

const saved: Record<string, string | undefined> = {}
const ENV = ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_USE_EMULATORS', 'FIREBASE_AUTH_EMULATOR_HOST', 'NEXT_PUBLIC_FIREBASE_API_KEY']
const realFetch = globalThis.fetch

beforeEach(() => {
  for (const name of ENV) saved[name] = process.env[name]
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo-project'
  process.env.NEXT_PUBLIC_USE_EMULATORS = '1'
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key'
})

afterEach(() => {
  globalThis.fetch = realFetch
  for (const name of ENV) {
    if (saved[name] === undefined) delete process.env[name]
    else process.env[name] = saved[name]
  }
})

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
const nowS = () => Math.floor(Date.now() / 1000)

function emulatorSession(uid: string, overrides: Record<string, unknown> = {}): string {
  const claims = {
    iss: 'https://session.firebase.google.com/demo-project',
    aud: 'demo-project',
    sub: uid,
    iat: nowS() - 10,
    auth_time: nowS() - 20,
    exp: nowS() + 12 * 3600,
    ...overrides,
  }
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.`
}

function signedLooking(uid: string): string {
  const claims = { iss: 'https://session.firebase.google.com/demo-project', aud: 'demo-project', sub: uid, iat: nowS() - 10, auth_time: nowS() - 20, exp: nowS() + 3600 }
  return `${b64({ alg: 'RS256', kid: 'unseen-kid', typ: 'JWT' })}.${b64(claims)}.${Buffer.from('sig').toString('base64url')}`
}

function pageRequest(path: string, cookies: { ok?: string; session?: string }, init?: ConstructorParameters<typeof NextRequest>[1]) {
  const request = new NextRequest(`http://localhost${path}`, init)
  const secure = shouldSecureMfaCookies(request)
  if (cookies.ok) request.cookies.set(mfaCookieName('ok', secure), cookies.ok)
  if (cookies.session) request.cookies.set(mfaCookieName('session', secure), cookies.session)
  return request
}

const ok = (uid: string) => encodeMfaOk(uid, Date.now() + 60 * 60_000, Date.now())

function sessionCleared(response: Response): boolean {
  return (response.headers.getSetCookie?.() || []).some((line) => line.startsWith(`${MFA_SESSION_COOKIE_LEGACY}=;`))
}

for (const path of ['/dashboard', '/dashboard/projects', '/developer']) {
  test(`proxy: ok and session cookies of the same uid open ${path}`, async () => {
    const response = await proxy(pageRequest(path, { ok: ok('userA'), session: emulatorSession('userA') }))
    assert.equal(response.headers.get('location'), null)
    assert.notEqual(response.status, 503)
  })
}

test('proxy: an ok cookie for user A with user B\'s session goes to the code screen and clears the session', async () => {
  const response = await proxy(pageRequest('/dashboard', { ok: ok('userA'), session: emulatorSession('userB') }))
  assert.equal(response.status, 307)
  assert.match(response.headers.get('location') || '', /\/auth\/mfa/)
  assert.equal(sessionCleared(response), true)
})

test('proxy: a missing, expired or tampered session cookie goes to the code screen', async () => {
  for (const session of [undefined, emulatorSession('userA', { exp: nowS() - 5 }), emulatorSession('userA', { aud: 'other' }), 'garbage']) {
    const response = await proxy(pageRequest('/dashboard', { ok: ok('userA'), session }))
    assert.equal(response.status, 307, String(session))
    assert.match(response.headers.get('location') || '', /\/auth\/mfa/)
  }
})

test('proxy: an unsigned session cookie is refused when the emulator switch is off', async () => {
  delete process.env.NEXT_PUBLIC_USE_EMULATORS
  const response = await proxy(pageRequest('/dashboard', { ok: ok('userA'), session: emulatorSession('userA') }))
  assert.equal(response.status, 307)
})

test('proxy: Google keys unreachable is a 503 "try again", never a redirect to sign in', async () => {
  delete process.env.NEXT_PUBLIC_USE_EMULATORS
  globalThis.fetch = (async () => {
    throw new TypeError('fetch failed')
  }) as typeof fetch
  const response = await proxy(pageRequest('/dashboard', { ok: ok('userA'), session: signedLooking('userA') }))
  assert.equal(response.status, 503)
  assert.equal(response.headers.get('location'), null)
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('proxy: pages outside /dashboard and /developer are unaffected', async () => {
  const response = await proxy(pageRequest('/login', {}))
  assert.equal(response.headers.get('location'), null)
})

/** accounts:lookup verifies "token-<uid>"; createSessionCookie returns a fresh emulator cookie for that uid. */
function stubAuth(createStatus = 200, options: { googleError?: string; mintedAudience?: string } = {}) {
  const calls = { create: 0 }
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const { idToken } = JSON.parse(String(init?.body || '{}')) as { idToken?: string }
    const uid = idToken?.startsWith('token-') ? idToken.slice(6) : ''
    if (url.includes(':createSessionCookie')) {
      calls.create += 1
      if (createStatus !== 200) {
        const body = options.googleError ? { error: { code: createStatus, message: `${options.googleError} : details` } } : {}
        return new Response(JSON.stringify(body), { status: createStatus })
      }
      const overrides = options.mintedAudience ? { aud: options.mintedAudience } : {}
      return new Response(JSON.stringify({ sessionCookie: emulatorSession(uid, overrides) }))
    }
    if (url.includes('accounts:lookup')) {
      if (!uid) return new Response('{}', { status: 400 })
      return new Response(JSON.stringify({ users: [{ localId: uid, email: `${uid}@example.com`, emailVerified: true }] }))
    }
    return new Response('{}', { status: 500 })
  }) as typeof fetch
  return calls
}

function statusRequest(cookies: { ok?: string; session?: string }, token?: string) {
  return pageRequest('/api/auth/mfa/status', cookies, token ? { headers: { authorization: `Bearer ${token}` } } : undefined)
}

function setSessionValue(response: Response): string | null {
  const line = (response.headers.getSetCookie?.() || []).find((entry) => entry.startsWith(`${MFA_SESSION_COOKIE_LEGACY}=`))
  if (!line) return null
  return line.slice(MFA_SESSION_COOKIE_LEGACY.length + 1).split(';')[0]
}

test('status: verified mints an httpOnly session cookie for that uid, which then opens the dashboard', async () => {
  const calls = stubAuth()
  const response = await status(statusRequest({ ok: ok('userA') }, 'token-userA'))
  assert.equal(response.status, 200)
  assert.equal(((await response.json()) as { verified?: boolean }).verified, true)
  assert.equal(calls.create, 1)
  const line = (response.headers.getSetCookie?.() || []).find((entry) => entry.startsWith(`${MFA_SESSION_COOKIE_LEGACY}=`)) || ''
  assert.match(line, /HttpOnly/i)
  assert.match(line, /SameSite=lax/i)
  const minted = setSessionValue(response)
  assert.ok(minted)
  const page = await proxy(pageRequest('/dashboard', { ok: ok('userA'), session: decodeURIComponent(minted!) }))
  assert.equal(page.headers.get('location'), null)
})

test('status: a fresh session cookie for the same uid is kept (no new mint)', async () => {
  const calls = stubAuth()
  const response = await status(statusRequest({ ok: ok('userA'), session: emulatorSession('userA') }, 'token-userA'))
  assert.equal(((await response.json()) as { verified?: boolean }).verified, true)
  assert.equal(calls.create, 0)
  assert.equal(setSessionValue(response), null)
})

test('status: a session cookie for another uid is replaced by one for the signed-in uid', async () => {
  const calls = stubAuth()
  const response = await status(statusRequest({ ok: ok('userA'), session: emulatorSession('userB') }, 'token-userA'))
  assert.equal(((await response.json()) as { verified?: boolean }).verified, true)
  assert.equal(calls.create, 1)
  const minted = JSON.parse(Buffer.from(decodeURIComponent(setSessionValue(response) || '').split('.')[1], 'base64url').toString())
  assert.equal(minted.sub, 'userA')
})

test('status: a user switch (ok cookie of A, token of B) clears the session cookie', async () => {
  stubAuth()
  const response = await status(statusRequest({ ok: ok('userA'), session: emulatorSession('userA') }, 'token-userB'))
  assert.equal(((await response.json()) as { verified?: boolean }).verified, false)
  assert.equal(sessionCleared(response), true)
})

test('status: no ok cookie clears a leftover session cookie', async () => {
  stubAuth()
  const response = await status(statusRequest({ session: emulatorSession('userA') }, 'token-userA'))
  assert.equal(((await response.json()) as { verified?: boolean }).verified, false)
  assert.equal(sessionCleared(response), true)
})

for (const failure of [429, 500, 503]) {
  test(`status: minting fails (${failure}) answers 503 "try again", never "not verified"`, async () => {
    stubAuth(failure)
    const response = await status(statusRequest({ ok: ok('userA') }, 'token-userA'))
    assert.equal(response.status, 503)
    assert.equal(((await response.json()) as { error?: string }).error, 'unavailable')
  })
}

test('status: Firebase refuses the ID token at mint (400 INVALID_ID_TOKEN) → not verified, session cleared', async () => {
  stubAuth(400, { googleError: 'INVALID_ID_TOKEN' })
  const response = await status(statusRequest({ ok: ok('userA'), session: emulatorSession('userB') }, 'token-userA'))
  assert.equal(response.status, 200)
  assert.equal(((await response.json()) as { verified?: boolean }).verified, false)
  assert.equal(sessionCleared(response), true)
})

test('logout (sign-out, idle sign-out, user switch) expires the session cookie', async () => {
  const response = await logout(pageRequest('/api/auth/mfa/logout', { ok: ok('userA'), session: emulatorSession('userA') }, { method: 'POST' }))
  assert.equal(sessionCleared(response), true)
})

/** Review of #359, item 1: a minted cookie the proxy would refuse must never answer "verified". */
test('status: a freshly minted cookie that fails the proxy check is a setup error, not "verified" (no loop)', async () => {
  stubAuth(200, { mintedAudience: 'another-project' })
  const errors: unknown[][] = []
  const realError = console.error
  console.error = (...args: unknown[]) => errors.push(args)
  try {
    const response = await status(statusRequest({ ok: ok('userA') }, 'token-userA'))
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'setup', retry: false })
    assert.equal(setSessionValue(response), null)
    assert.ok(errors.some((args) => String(args[0]).includes('SETUP ERROR')))
  } finally {
    console.error = realError
  }
})

/** Review of #359, item 1: the emulator switch is the same for mint and verify. */
test('status: with the emulator switch off, nothing is minted against the emulator', async () => {
  delete process.env.NEXT_PUBLIC_USE_EMULATORS
  const calls = stubAuth()
  const realError = console.error
  console.error = () => {}
  try {
    // No service account in tests: the server cannot mint → a setup error, never a cookie the proxy refuses.
    const saved = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    const response = await status(statusRequest({ ok: ok('userA') }, 'token-userA'))
    if (saved !== undefined) process.env.FIREBASE_SERVICE_ACCOUNT_JSON = saved
    assert.equal(response.status, 503)
    assert.equal(((await response.json()) as { error?: string }).error, 'setup')
    assert.equal(calls.create, 0)
  } finally {
    console.error = realError
  }
})

/** Review of #359, item 2: Google 401 / 403 is a setup error with its own answer, not the "trying again" one. */
for (const failure of [401, 403]) {
  test(`status: createSessionCookie ${failure} is a setup error`, async () => {
    stubAuth(failure, { googleError: 'PERMISSION_DENIED' })
    const realError = console.error
    console.error = () => {}
    try {
      const response = await status(statusRequest({ ok: ok('userA') }, 'token-userA'))
      assert.equal(response.status, 503)
      assert.deepEqual(await response.json(), { error: 'setup', retry: false })
    } finally {
      console.error = realError
    }
  })
}
