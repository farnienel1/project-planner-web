import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { NextRequest } from 'next/server'
import { PLATFORM_OWNER_EMAIL } from '../canonical/passwordPolicy.ts'
import { encodeMfaOk } from '../auth/mfa/mfaCookies.ts'
import { mfaCookieName, shouldSecureMfaCookies } from '../auth/mfa/mfaCookiePolicy.ts'
import { POST } from '../../app/api/owner/delete-unfinished-user/route.ts'

const ENV_NAMES = ['NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'GOOGLE_APPLICATION_CREDENTIALS'] as const
const realEnv = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]))
const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
  for (const name of ENV_NAMES) {
    const value = realEnv[name]
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const serviceAccount = JSON.stringify({
  client_email: 'console-test@demo.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  project_id: 'demo',
})

type Call = { method: string; url: string; auth: string }

/**
 * Firestore REST, Identity Toolkit and Google OAuth double that follows the live rules: the owner's own ID token
 * may read `users/{uid}` and `organizations/{id}` but is refused the `users/{uid}/orgMemberships` list (rules
 * allow that list only to the uid itself). Only the server key (service account) can list memberships.
 */
function stubBackend(options: {
  serverKey: boolean
  userFields: Record<string, unknown>
  orgFields?: Record<string, unknown>
  memberships?: number
  authCreatedAtMs?: number | null
  auditOk?: boolean
}) {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key'
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo'
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (options.serverKey) process.env.FIREBASE_SERVICE_ACCOUNT_JSON = serviceAccount
  else delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  const calls: Call[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method || 'GET').toUpperCase()
    const headers = (init?.headers || {}) as Record<string, string>
    const auth = headers.Authorization || headers.authorization || ''
    calls.push({ method, url, auth })
    const admin = auth === 'Bearer admin-token'
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'admin-token' }))
    }
    if (url.includes('accounts:lookup?key=')) {
      return new Response(
        JSON.stringify({ users: [{ localId: 'owner-uid', email: PLATFORM_OWNER_EMAIL, emailVerified: true, createdAt: '1000' }] })
      )
    }
    if (url.includes('accounts:lookup')) {
      if (!admin) return new Response('{}', { status: 403 })
      const created = options.authCreatedAtMs
      return new Response(JSON.stringify(created === null ? {} : { users: [{ localId: 'victim', createdAt: String(created ?? Date.parse('2024-01-01')) }] }))
    }
    if (url.includes('/adminAuditLog')) return new Response('{}', { status: options.auditOk === false ? 403 : 200 })
    if (url.includes('/orgMemberships')) {
      if (!admin) return new Response('{"error":{"status":"PERMISSION_DENIED"}}', { status: 403 })
      const documents = Array.from({ length: options.memberships ?? 0 }, (_, i) => ({
        name: `projects/demo/databases/(default)/documents/users/victim/orgMemberships/org-${i}`,
        fields: {},
      }))
      return new Response(JSON.stringify({ documents }))
    }
    if (url.includes('/documents/users/victim') && method === 'GET') {
      return new Response(JSON.stringify({ fields: options.userFields }))
    }
    if (url.includes('/documents/organizations/org-1')) {
      return options.orgFields
        ? new Response(JSON.stringify({ fields: options.orgFields }))
        : new Response('{}', { status: 404 })
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
  req.cookies.set(mfaCookieName('ok', shouldSecureMfaCookies(req)), encodeMfaOk('owner-uid', Date.now() + 60_000))
  return req
}

const abandonedUser = {
  email: { stringValue: 'gone@example.com' },
  passwordSet: { booleanValue: false },
  organizationId: { stringValue: 'org-1' },
}

const deleted = (calls: Call[]) => calls.some((call) => call.method === 'DELETE')

test('review #340: without the server key the route refuses clearly and deletes nothing', async () => {
  const calls = stubBackend({ serverKey: false, userFields: abandonedUser })
  const response = await POST(request())
  assert.equal(response.status, 501)
  const body = (await response.json()) as { error?: string }
  assert.match(body.error || '', /server key/i)
  assert.equal(deleted(calls), false)
  assert.equal(calls.some((call) => call.url.includes('/adminAuditLog')), false)
})

test('review #340: memberships are read with the server key, never the owner token the rules refuse', async () => {
  const calls = stubBackend({ serverKey: true, userFields: abandonedUser })
  const response = await POST(request())
  assert.equal(response.status, 200)
  const membershipReads = calls.filter((call) => call.url.includes('/orgMemberships'))
  assert.ok(membershipReads.length > 0)
  assert.ok(membershipReads.every((call) => call.auth === 'Bearer admin-token'))
})

test('H2: the audit entry is written before the delete', async () => {
  const calls = stubBackend({ serverKey: true, userFields: abandonedUser })
  const response = await POST(request())
  assert.equal(response.status, 200)
  const audit = calls.findIndex((call) => call.url.includes('/adminAuditLog'))
  const del = calls.findIndex((call) => call.method === 'DELETE')
  assert.ok(audit >= 0 && del > audit, 'audit write must come before the delete')
})

test('H2: when the audit entry cannot be written nothing is deleted', async () => {
  const calls = stubBackend({ serverKey: true, userFields: abandonedUser, auditOk: false })
  const response = await POST(request())
  assert.equal(response.status, 502)
  assert.equal(deleted(calls), false)
})

test('H2: a person with a membership is refused and nothing is deleted', async () => {
  const calls = stubBackend({ serverKey: true, userFields: abandonedUser, memberships: 1 })
  const response = await POST(request())
  assert.equal(response.status, 409)
  assert.equal(deleted(calls), false)
})

test('H2: a live person (real company) is refused and nothing is deleted', async () => {
  const calls = stubBackend({
    serverKey: true,
    userFields: { ...abandonedUser, passwordSet: { booleanValue: true } },
    orgFields: { name: { stringValue: 'Acme Electrical' } },
  })
  const response = await POST(request())
  assert.equal(response.status, 409)
  assert.equal(deleted(calls), false)
})

test('review #340: an organisation stored as a reference is read, not treated as missing', async () => {
  const calls = stubBackend({
    serverKey: true,
    userFields: {
      ...abandonedUser,
      organizationId: { referenceValue: 'projects/demo/databases/(default)/documents/organizations/org-1' },
    },
    orgFields: { name: { stringValue: 'Acme Electrical' } },
  })
  const response = await POST(request())
  assert.equal(response.status, 409)
  assert.equal(deleted(calls), false)
})

test('review #340: a password-set account younger than 12 months by Firebase Auth is refused', async () => {
  const calls = stubBackend({
    serverKey: true,
    userFields: {
      ...abandonedUser,
      passwordSet: { booleanValue: true },
      createdAt: { timestampValue: '2020-01-01T00:00:00Z' },
    },
    authCreatedAtMs: Date.now() - 24 * 60 * 60 * 1000,
  })
  const response = await POST(request())
  assert.equal(response.status, 409)
  assert.equal(deleted(calls), false)
})

test('PLAN A4: the delete is recorded as requested, then completed, with one requestId', async () => {
  const calls = stubBackend({ serverKey: true, userFields: abandonedUser })
  const bodies: string[] = []
  const inner = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('/adminAuditLog')) bodies.push(String(init?.body || ''))
    return inner(input, init)
  }) as typeof fetch
  const response = await POST(request())
  assert.equal(response.status, 200)
  assert.equal(bodies.length, 2)
  const [requested, completed] = bodies.map((body) => JSON.parse(body).fields)
  assert.equal(requested.phase.stringValue, 'requested')
  assert.equal(completed.phase.stringValue, 'completed')
  assert.equal(requested.requestId.stringValue, completed.requestId.stringValue)
  // The email is masked in the stored entry.
  assert.match(requested.before.stringValue, /g•••@example\.com/)
  assert.ok(calls.some((call) => call.method === 'DELETE'))
})
