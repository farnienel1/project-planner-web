import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { encodeMfaOk, encodeSigned, mfaOkBelongsTo } from './mfaCookies.ts'
import { mfaCookieName, shouldSecureMfaCookies } from './mfaCookiePolicy.ts'
import { GET as status } from '../../../app/api/auth/mfa/status/route.ts'

/**
 * The status route reports "verified" only when the 2-step ok cookie belongs to the person signed in now:
 * the cookie's signed uid must equal the uid of the caller's verified Firebase ID token.
 */

const realFetch = globalThis.fetch
const realKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
const realProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const realEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS
const realAuthHost = process.env.FIREBASE_AUTH_EMULATOR_HOST

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

afterEach(() => {
  globalThis.fetch = realFetch
  restore('NEXT_PUBLIC_FIREBASE_PROJECT_ID', realProject)
  restore('NEXT_PUBLIC_USE_EMULATORS', realEmulators)
  restore('FIREBASE_AUTH_EMULATOR_HOST', realAuthHost)
  if (realKey === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  else process.env.NEXT_PUBLIC_FIREBASE_API_KEY = realKey
})

/** Token "token-<uid>" verifies as that uid; anything else is refused. */
function stubAccountsLookup(failure?: 'network' | 500 | 503 | 429) {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key'
  // The session cookie is minted against the (stubbed) Auth emulator, so no service account is needed here.
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo-project'
  process.env.NEXT_PUBLIC_USE_EMULATORS = '1'
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes(':createSessionCookie')) {
      const { idToken } = JSON.parse(String(init?.body || '{}')) as { idToken?: string }
      // An Auth-emulator style (unsigned) session cookie for that uid, which the proxy's check accepts here.
      const uid = idToken?.startsWith('token-') ? idToken.slice(6) : ''
      const now = Math.floor(Date.now() / 1000)
      const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
      const claims = { iss: 'https://session.firebase.google.com/demo-project', aud: 'demo-project', sub: uid, iat: now, auth_time: now, exp: now + 3600 }
      return new Response(JSON.stringify({ sessionCookie: `${part({ alg: 'none' })}.${part(claims)}.` }))
    }
    if (String(input).includes('accounts:lookup')) {
      if (failure === 'network') throw new TypeError('fetch failed')
      if (typeof failure === 'number') return new Response('{}', { status: failure })
      const { idToken } = JSON.parse(String(init?.body || '{}')) as { idToken?: string }
      const uid = idToken?.startsWith('token-') ? idToken.slice(6) : ''
      if (!uid) return new Response('{}', { status: 400 })
      return new Response(JSON.stringify({ users: [{ localId: uid, email: `${uid}@example.com`, emailVerified: true }] }))
    }
    return new Response('{}', { status: 500 })
  }) as typeof fetch
}

async function statusResponse(cookie: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = {}
  if (token) headers.authorization = `Bearer ${token}`
  const request = new NextRequest('http://localhost/api/auth/mfa/status', { headers })
  request.cookies.set(mfaCookieName('ok', shouldSecureMfaCookies(request)), cookie)
  return status(request)
}

async function statusWith(cookie: string, token?: string): Promise<{ verified?: boolean }> {
  const response = await statusResponse(cookie, token)
  assert.equal(response.status, 200)
  return (await response.json()) as { verified?: boolean }
}

const later = () => Date.now() + 60 * 60_000

test('status: ok cookie of user A with the ID token of user B is not verified', async () => {
  stubAccountsLookup()
  const body = await statusWith(encodeMfaOk('userA', later(), Date.now()), 'token-userB')
  assert.equal(body.verified, false)
})

test('status: ok cookie and ID token of the same user is verified (and mints the session cookie)', async () => {
  stubAccountsLookup()
  const body = await statusWith(encodeMfaOk('userA', later(), Date.now()), 'token-userA')
  assert.equal(body.verified, true)
})

test('status: a valid ok cookie with no ID token is not verified', async () => {
  stubAccountsLookup()
  const body = await statusWith(encodeMfaOk('userA', later()))
  assert.equal(body.verified, false)
})

test('status: a valid ok cookie with an invalid ID token is not verified', async () => {
  stubAccountsLookup()
  const body = await statusWith(encodeMfaOk('userA', later()), 'garbage')
  assert.equal(body.verified, false)
})

test('status: an old ok cookie without a user id is not verified', async () => {
  stubAccountsLookup()
  const body = await statusWith(encodeSigned({ kind: 'ok', exp: later() }), 'token-userA')
  assert.equal(body.verified, false)
})

test('status: an old ok cookie signed before the purpose field is not verified', async () => {
  stubAccountsLookup()
  const body = await statusWith(encodeSigned({ uid: 'userA', exp: later() }), 'token-userA')
  assert.equal(body.verified, false)
})

test('status: an expired ok cookie of the same user is not verified', async () => {
  stubAccountsLookup()
  const body = await statusWith(encodeMfaOk('userA', Date.now() - 1_000), 'token-userA')
  assert.equal(body.verified, false)
})

test('mfaOkBelongsTo: only the same uid matches', () => {
  const ok = { kind: 'ok' as const, uid: 'userA', exp: later() }
  assert.equal(mfaOkBelongsTo(ok, 'userA'), true)
  assert.equal(mfaOkBelongsTo(ok, 'userB'), false)
  assert.equal(mfaOkBelongsTo(ok, 'usera'), false)
  assert.equal(mfaOkBelongsTo(ok, ''), false)
  assert.equal(mfaOkBelongsTo(ok, null), false)
  assert.equal(mfaOkBelongsTo(null, 'userA'), false)
})

for (const failure of ['network', 500, 503, 429] as const) {
  test(`status: a valid ok cookie whose token lookup fails (${failure}) answers 503, not "not verified"`, async () => {
    stubAccountsLookup(failure)
    const response = await statusResponse(encodeMfaOk('userA', later()), 'token-userA')
    assert.equal(response.status, 503)
    const body = (await response.json()) as { verified?: boolean; error?: string }
    assert.equal(body.verified, undefined)
    assert.equal(body.error, 'unavailable')
  })
}

test('status: a token Auth refuses (400) is "not verified", not 503', async () => {
  stubAccountsLookup()
  const body = await statusWith(encodeMfaOk('userA', later()), 'not-a-token')
  assert.equal(body.verified, false)
})

test('status: no ok cookie never looks the token up and is "not verified" even when Auth is down', async () => {
  stubAccountsLookup(503)
  const request = new NextRequest('http://localhost/api/auth/mfa/status', { headers: { authorization: 'Bearer token-userA' } })
  const response = await status(request)
  assert.equal(response.status, 200)
  assert.equal(((await response.json()) as { verified?: boolean }).verified, false)
})
