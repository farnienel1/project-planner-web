import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest, NextResponse } from 'next/server'
import { PLATFORM_OWNER_EMAIL } from '../canonical/passwordPolicy.ts'
import { encodeSigned } from '../auth/mfa/mfaCookies.ts'
import { mfaCookieName, shouldSecureMfaCookies } from '../auth/mfa/mfaCookiePolicy.ts'
import { requireOwner } from './requireOwner.ts'

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

function signIn(user: { localId: string; email: string; emailVerified: boolean }) {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key'
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ users: [{ ...user, createdAt: '1000' }] }), { status: 200 })) as typeof fetch
}

function ownerRequest(cookieValue?: string): NextRequest {
  const request = new NextRequest('http://localhost/api/owner/mark-internal', {
    method: 'POST',
    headers: { authorization: 'Bearer token' },
  })
  if (cookieValue !== undefined) {
    request.cookies.set(mfaCookieName('ok', shouldSecureMfaCookies(request)), cookieValue)
  }
  return request
}

const owner = { localId: 'owner-uid', email: PLATFORM_OWNER_EMAIL, emailVerified: true }
const fresh = () => Date.now() + 60 * 60 * 1000

async function status(result: Awaited<ReturnType<typeof requireOwner>>): Promise<number | 'ok'> {
  return result instanceof NextResponse ? result.status : 'ok'
}

test('H1: the verified owner without an MFA cookie is refused by owner routes', async () => {
  signIn(owner)
  assert.equal(await status(await requireOwner(ownerRequest())), 403)
})

test('H1: an MFA cookie for another uid is refused', async () => {
  signIn(owner)
  const cookie = encodeSigned({ uid: 'someone-else', exp: fresh() })
  assert.equal(await status(await requireOwner(ownerRequest(cookie))), 403)
})

test('H1: an expired or tampered MFA cookie is refused', async () => {
  signIn(owner)
  const expired = encodeSigned({ uid: 'owner-uid', exp: Date.now() - 1 })
  assert.equal(await status(await requireOwner(ownerRequest(expired))), 403)
  const valid = encodeSigned({ uid: 'owner-uid', exp: fresh() })
  const [payload] = valid.split('.')
  assert.equal(await status(await requireOwner(ownerRequest(`${payload}.forged`))), 403)
})

test('H1: the verified owner with their own valid MFA cookie is allowed', async () => {
  signIn(owner)
  const cookie = encodeSigned({ uid: 'owner-uid', exp: fresh() })
  const result = await requireOwner(ownerRequest(cookie))
  assert.equal(await status(result), 'ok')
  assert.equal((result as { uid: string }).uid, 'owner-uid')
})

test('a non-owner with a valid MFA cookie is still refused', async () => {
  signIn({ localId: 'u2', email: 'someone@example.com', emailVerified: true })
  const cookie = encodeSigned({ uid: 'u2', exp: fresh() })
  assert.equal(await status(await requireOwner(ownerRequest(cookie))), 403)
})

test('the owner email unverified is still refused', async () => {
  signIn({ ...owner, emailVerified: false })
  const cookie = encodeSigned({ uid: 'owner-uid', exp: fresh() })
  assert.equal(await status(await requireOwner(ownerRequest(cookie))), 403)
})
