import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { encodeMfaOk, encodeSigned } from './mfaCookies.ts'
import { mfaCookieName, shouldSecureMfaCookies } from './mfaCookiePolicy.ts'
import { middleware } from '../../../middleware.ts'
import { GET as status } from '../../../app/api/auth/mfa/status/route.ts'
import { POST as start } from '../../../app/api/auth/mfa/start/route.ts'

/**
 * Review of #340 (critical): `/api/auth/mfa/start` issues a signed challenge cookie with a uid and an exp.
 * Copied into the ok cookie, it must never count as a passed 2FA check — on any path.
 */

const realFetch = globalThis.fetch
const realKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

afterEach(() => {
  globalThis.fetch = realFetch
  restoreEnv('NEXT_PUBLIC_FIREBASE_API_KEY', realKey)
})

function challengeCookie(uid = 'u1'): string {
  return encodeSigned({
    kind: 'challenge',
    uid,
    email: 'someone@example.com',
    codeHash: 'not-a-real-hash',
    exp: Date.now() + 10 * 60_000,
    attempts: 0,
    lastSentAt: Date.now(),
  })
}

function withOkCookie(url: string, value: string, init?: ConstructorParameters<typeof NextRequest>[1]): NextRequest {
  const request = new NextRequest(url, init)
  request.cookies.set(mfaCookieName('ok', shouldSecureMfaCookies(request)), value)
  return request
}

for (const path of ['/developer', '/developer/organisations', '/dashboard', '/dashboard/projects']) {
  test(`middleware: a challenge cookie in the ok slot does not open ${path}`, async () => {
    const response = await middleware(withOkCookie(`http://localhost${path}`, challengeCookie()))
    assert.equal(response.status, 307)
    assert.match(response.headers.get('location') || '', /mfa/i)
  })
}

test('middleware: an ok cookie with kind ok opens /developer', async () => {
  const response = await middleware(withOkCookie('http://localhost/developer', encodeMfaOk('u1', Date.now() + 60_000)))
  assert.equal(response.headers.get('location'), null)
})

test('status route: a challenge cookie in the ok slot is not "verified"', async () => {
  const response = await status(withOkCookie('http://localhost/api/auth/mfa/status', challengeCookie()))
  const body = (await response.json()) as { verified?: boolean }
  assert.equal(body.verified, false)
})

test('start route: a challenge cookie in the ok slot does not skip the code', async () => {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key'
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).includes('accounts:lookup')) {
      return new Response(JSON.stringify({ users: [{ localId: 'u1', email: 'someone@example.com', emailVerified: true }] }))
    }
    return new Response('{}', { status: 500 })
  }) as typeof fetch
  const response = await start(
    withOkCookie('http://localhost/api/auth/mfa/start', challengeCookie(), {
      method: 'POST',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: '{}',
    })
  )
  const body = (await response.json().catch(() => ({}))) as { skipped?: boolean; verified?: boolean }
  assert.notEqual(body.skipped, true)
  assert.notEqual(body.verified, true)
})
