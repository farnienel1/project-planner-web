/**
 * Mass-assignment audit 17 Nov (owner approved): API routes read only the keys they declare, and take names, the
 * organisation and the owner check from stored documents and the verified token — never from the request body.
 */
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { PLATFORM_OWNER_EMAIL } from '../canonical/passwordPolicy.ts'
import { POST as supportLoginEmail } from '../../app/api/support/login-email/route.ts'
import { POST as orgAdditionEmail } from '../../app/api/invites/send-org-addition-email/route.ts'
import { POST as grantSetup } from '../../app/api/auth/mfa/grant-setup/route.ts'

const ORG = '11111111-2222-4333-8444-555555555555'
const OTHER_ORG = '99999999-2222-4333-8444-555555555555'
const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

type Call = { method: string; url: string; body: string }

/** A fetch stub: accounts:lookup answers `auth`; a Firestore document GET answers `docs[path]` (as REST fields). */
function stub(auth: Record<string, unknown>, docs: Record<string, Record<string, unknown>>): Call[] {
  const calls: Call[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method || 'GET').toUpperCase()
    calls.push({ method, url, body: typeof init?.body === 'string' ? init.body : '' })
    if (url.includes('accounts:lookup')) return new Response(JSON.stringify({ users: [auth] }))
    const at = url.indexOf('/documents/')
    if (at >= 0 && method === 'GET') {
      const path = decodeURIComponent(url.slice(at + '/documents/'.length).split('?')[0])
      const data = docs[path]
      if (!data) return new Response('{}', { status: 404 })
      const fields: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') fields[key] = { stringValue: value }
        else if (typeof value === 'boolean') fields[key] = { booleanValue: value }
        else if (value && typeof value === 'object') {
          const inner: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(value)) inner[k] = { stringValue: String(v) }
          fields[key] = { mapValue: { fields: inner } }
        }
      }
      return new Response(JSON.stringify({ name: path, fields }))
    }
    return new Response(JSON.stringify({ ok: true, name: 'created' }))
  }) as typeof fetch
  return calls
}

function post(path: string, body: unknown): NextRequest {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key'
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo'
  process.env.EMAIL_SERVER_KEY = 'server-key'
  const text = JSON.stringify(body)
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer token',
      'content-type': 'application/json',
      'content-length': String(text.length),
      'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 250)}`,
    },
    body: text,
  })
}

const ADMIN = { localId: 'admin-1', email: 'admin@example.com', emailVerified: true, createdAt: '1000' }

test('support login-email refuses a person who is not in the caller\'s organisation and stores and sends nothing', async () => {
  const calls = stub(ADMIN, {
    [`organizations/${ORG}`]: { name: 'Acme', members: { 'admin-1': 'admin' } },
    'users/stranger': { email: 's@x.com', organizationId: OTHER_ORG },
  })
  const response = await supportLoginEmail(
    post('/api/support/login-email', { orgId: ORG, targetUid: 'stranger', suggestedEmail: 'new@x.com', orgName: 'Fake Org', role: 'admin' })
  )
  assert.equal(response.status, 404)
  assert.equal(calls.some((call) => call.method === 'POST' && call.url.includes('supportRequests')), false)
  assert.equal(calls.some((call) => call.url.includes('cloudfunctions') || call.url.includes('sendEmail')), false)
})

test('support login-email: a bad targetUid is refused before any read; a member of the organisation is accepted', async () => {
  const docs = {
    [`organizations/${ORG}`]: { name: 'Acme', members: { 'admin-1': 'admin' } },
    'users/member-1': { email: 'old@x.com', organizationId: ORG, firstName: 'Mo' },
  }
  stub(ADMIN, docs)
  const bad = await supportLoginEmail(post('/api/support/login-email', { orgId: ORG, targetUid: '../users/x', suggestedEmail: 'new@x.com' }))
  assert.equal(bad.status, 400)
  const calls = stub(ADMIN, docs)
  const ok = await supportLoginEmail(
    post('/api/support/login-email', { orgId: ORG, targetUid: 'member-1', suggestedEmail: 'new@x.com', orgName: 'Fake Org', targetName: 'Fake' })
  )
  assert.equal(ok.status, 200)
  const email = calls.find((call) => call.method === 'POST' && !call.url.includes('supportRequests') && !call.url.includes('accounts:lookup'))
  assert.ok(email, 'the support email was sent')
  assert.match(email!.body, /Acme/)
  assert.doesNotMatch(email!.body, /Fake Org/)
})

test('org addition email uses the stored organisation name, never the request\'s', async () => {
  const calls = stub(ADMIN, { [`organizations/${ORG}`]: { name: 'Acme Electrical', members: { 'admin-1': 'admin' } } })
  const response = await orgAdditionEmail(
    post('/api/invites/send-org-addition-email', { organizationId: ORG, organizationName: 'PayPal Security', firstName: 'Kim', to: 'kim@x.com', isSuperAdmin: true })
  )
  assert.equal(response.status, 200)
  const email = calls.find((call) => call.method === 'POST' && !call.url.includes('accounts:lookup'))
  assert.ok(email)
  assert.match(email!.body, /Acme Electrical/)
  assert.doesNotMatch(email!.body, /PayPal/)
})

test('grant-setup treats the owner email as the platform owner only when it is verified', async () => {
  // A brand-new account on the owner's email that has NOT verified it: no other skip path applies, so 403.
  const fresh = String(Date.now() - 60_000)
  stub({ localId: 'owner-uid', email: PLATFORM_OWNER_EMAIL, emailVerified: false, createdAt: fresh }, {
    'users/owner-uid': { accountConfirmed: true },
  })
  const unverified = await grantSetup(post('/api/auth/mfa/grant-setup', {}))
  assert.equal(unverified.status, 403)
})
