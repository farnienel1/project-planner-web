import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { PLATFORM_OWNER_EMAIL } from '../canonical/passwordPolicy.ts'
import { encodeSigned } from '../auth/mfa/mfaCookies.ts'
import { mfaCookieName, shouldSecureMfaCookies } from '../auth/mfa/mfaCookiePolicy.ts'
import { POST } from '../../app/api/owner/delete-unfinished-user/route.ts'

const realFetch = globalThis.fetch
const realKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
const realProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

afterEach(() => {
  globalThis.fetch = realFetch
  restoreEnv('NEXT_PUBLIC_FIREBASE_API_KEY', realKey)
  restoreEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', realProject)
})

type Call = { method: string; url: string }

/** Firestore REST + accounts:lookup double. `auditOk` decides whether the adminAuditLog write succeeds. */
function stubBackend(options: { userFields: Record<string, unknown>; orgFields?: Record<string, unknown>; auditOk: boolean }) {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key'
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo'
  const calls: Call[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method || 'GET').toUpperCase()
    calls.push({ method, url })
    if (url.includes('accounts:lookup')) {
      return new Response(
        JSON.stringify({ users: [{ localId: 'owner-uid', email: PLATFORM_OWNER_EMAIL, emailVerified: true, createdAt: '1000' }] })
      )
    }
    if (url.includes('/adminAuditLog')) return new Response('{}', { status: options.auditOk ? 200 : 403 })
    if (url.includes('/orgMemberships')) return new Response(JSON.stringify({ documents: [] }))
    if (url.includes('/documents/users/victim') && method === 'GET') {
      return new Response(JSON.stringify({ fields: options.userFields }))
    }
    if (url.includes('/documents/organizations/org-1')) {
      return options.orgFields ? new Response(JSON.stringify({ fields: options.orgFields })) : new Response('{}', { status: 404 })
    }
    if (method === 'DELETE') return new Response('{}')
    return new Response('{}', { status: 404 })
  }) as typeof fetch
  return calls
}

function request(): NextRequest {
  const req = new NextRequest('http://localhost/api/owner/delete-unfinished-user', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify({ uid: 'victim' }),
  })
  req.cookies.set(
    mfaCookieName('ok', shouldSecureMfaCookies(req)),
    encodeSigned({ uid: 'owner-uid', exp: Date.now() + 60_000 })
  )
  return req
}

const abandonedUser = {
  email: { stringValue: 'gone@example.com' },
  passwordSet: { booleanValue: false },
  organizationId: { stringValue: 'org-1' },
}

test('H2: the audit entry is written before the delete', async () => {
  const calls = stubBackend({ userFields: abandonedUser, auditOk: true })
  const response = await POST(request())
  assert.equal(response.status, 200)
  const audit = calls.findIndex((call) => call.url.includes('/adminAuditLog'))
  const del = calls.findIndex((call) => call.method === 'DELETE')
  assert.ok(audit >= 0 && del > audit, 'audit write must come before the delete')
})

test('H2: when the audit entry cannot be written nothing is deleted', async () => {
  const calls = stubBackend({ userFields: abandonedUser, auditOk: false })
  const response = await POST(request())
  assert.equal(response.status, 502)
  assert.equal(calls.some((call) => call.method === 'DELETE'), false)
})

test('H2: a live person (real company) is refused and nothing is deleted', async () => {
  const calls = stubBackend({
    userFields: { ...abandonedUser, passwordSet: { booleanValue: true } },
    orgFields: { name: { stringValue: 'Acme Electrical' } },
    auditOk: true,
  })
  const response = await POST(request())
  assert.equal(response.status, 409)
  assert.equal(calls.some((call) => call.method === 'DELETE'), false)
})
