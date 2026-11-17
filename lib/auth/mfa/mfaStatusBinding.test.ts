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

afterEach(() => {
  globalThis.fetch = realFetch
  if (realKey === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  else process.env.NEXT_PUBLIC_FIREBASE_API_KEY = realKey
})

/** Token "token-<uid>" verifies as that uid; anything else is refused. */
function stubAccountsLookup() {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key'
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('accounts:lookup')) {
      const { idToken } = JSON.parse(String(init?.body || '{}')) as { idToken?: string }
      const uid = idToken?.startsWith('token-') ? idToken.slice(6) : ''
      if (!uid) return new Response('{}', { status: 400 })
      return new Response(JSON.stringify({ users: [{ localId: uid, email: `${uid}@example.com`, emailVerified: true }] }))
    }
    return new Response('{}', { status: 500 })
  }) as typeof fetch
}

async function statusWith(cookie: string, token?: string): Promise<{ verified?: boolean }> {
  const headers: Record<string, string> = {}
  if (token) headers.authorization = `Bearer ${token}`
  const request = new NextRequest('http://localhost/api/auth/mfa/status', { headers })
  request.cookies.set(mfaCookieName('ok', shouldSecureMfaCookies(request)), cookie)
  const response = await status(request)
  return (await response.json()) as { verified?: boolean }
}

const later = () => Date.now() + 60 * 60_000

test('status: ok cookie of user A with the ID token of user B is not verified', async () => {
  stubAccountsLookup()
  const body = await statusWith(encodeMfaOk('userA', later(), Date.now()), 'token-userB')
  assert.equal(body.verified, false)
})

test('status: ok cookie and ID token of the same user is verified', async () => {
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
