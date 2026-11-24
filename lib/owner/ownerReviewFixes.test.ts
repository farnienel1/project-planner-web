/** Review of #348: the small fixes (grant-setup is never "fresh"; the owner sentinel organisation is never marked). */
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { PLATFORM_OWNER_EMAIL } from '../canonical/passwordPolicy.ts'
import { decodeMfaOk, encodeMfaOk } from '../auth/mfa/mfaCookies.ts'
import { mfaCookieName, shouldSecureMfaCookies } from '../auth/mfa/mfaCookiePolicy.ts'
import { installFakeFirestore } from './fakeFirestoreRest.ts'
import { POST as grantSetup } from '../../app/api/auth/mfa/grant-setup/route.ts'
import { POST as markInternal } from '../../app/api/owner/mark-internal/route.ts'
import { POST as changeEmail } from '../../app/api/owner/change-email/route.ts'
import { generateKeyPairSync } from 'node:crypto'

const ENV = ['NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'FIREBASE_SERVICE_ACCOUNT_JSON'] as const
const realEnv = Object.fromEntries(ENV.map((name) => [name, process.env[name]]))
const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
  for (const name of ENV) {
    if (realEnv[name] === undefined) delete process.env[name]
    else process.env[name] = realEnv[name]
  }
})

function post(path: string, body: unknown, withMfa = false): NextRequest {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key'
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo'
  const text = JSON.stringify(body)
  const request = new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json', 'content-length': String(text.length), 'x-forwarded-for': `192.0.2.${Math.floor(Math.random() * 250)}` },
    body: text,
  })
  if (withMfa) request.cookies.set(mfaCookieName('ok', shouldSecureMfaCookies(request)), encodeMfaOk('owner-uid', Date.now() + 60_000, Date.now()))
  return request
}

test('a granted 2FA skip writes an ok cookie with no iat, so it is never fresh', async () => {
  // A just-created owner account (C1: under 24 hours) is the case grant-setup allows.
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('accounts:lookup')) {
      return new Response(JSON.stringify({ users: [{ localId: 'owner-uid', email: PLATFORM_OWNER_EMAIL, emailVerified: true, createdAt: String(Date.now() - 60_000) }] }))
    }
    return new Response('{}', { status: 404 })
  }) as typeof fetch
  const response = await grantSetup(post('/api/auth/mfa/grant-setup', {}))
  assert.equal(response.status, 200)
  const cookie = response.cookies.getAll().find((entry) => entry.name.endsWith('pp_mfa_ok') && entry.value)
  const ok = decodeMfaOk(cookie?.value)
  assert.ok(ok)
  assert.equal('iat' in (ok || {}), false)
})

test('mark-internal refuses the platform-owner sentinel organisation and writes nothing', async () => {
  const backend = installFakeFirestore({}, { localId: 'owner-uid', email: PLATFORM_OWNER_EMAIL, emailVerified: true })
  const response = await markInternal(post('/api/owner/mark-internal', { orgId: 'platform-owner', isInternal: true }, true))
  assert.equal(response.status, 400)
  assert.equal(backend.auditWrites.length, 0)
  assert.equal(backend.calls.filter((call) => call.method === 'PATCH').length, 0)
})

test('re-review of #348: change-email answers a clear 503 when the user record cannot be read, and writes nothing', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'console-test@demo.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    project_id: 'demo',
  })
  const calls: { method: string; url: string }[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ method: (init?.method || 'GET').toUpperCase(), url })
    if (url.includes('accounts:lookup')) {
      return new Response(JSON.stringify({ users: [{ localId: 'owner-uid', email: PLATFORM_OWNER_EMAIL, emailVerified: true, createdAt: '1000' }] }))
    }
    return new Response('{"error":{"status":"UNAVAILABLE"}}', { status: 500 })
  }) as typeof fetch
  const response = await changeEmail(post('/api/owner/change-email', { uid: 'u1', newEmail: 'new@example.com', confirmEmail: 'new@example.com', reason: 'typo' }, true))
  assert.equal(response.status, 503)
  assert.match(((await response.json()) as { error: string }).error, /nothing was changed/)
  assert.equal(calls.some((call) => call.url.includes('/adminAuditLog') || call.method === 'PATCH'), false)
})
