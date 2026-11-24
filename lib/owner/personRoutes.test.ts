/**
 * Owner console PR 5 route tests: change name, sign out everywhere, reveal email, the fresh-code step and the hardened
 * change-email. A fetch double plays Firebase Auth, Firestore REST, Identity Toolkit and Google OAuth; it records
 * every call so the order (audit before the change) and the exact writes are checked.
 */
import { afterEach, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { NextRequest } from 'next/server'
import { PLATFORM_OWNER_EMAIL } from '../canonical/passwordPolicy.ts'
import { decodeMfaChallenge, encodeMfaOk } from '../auth/mfa/mfaCookies.ts'
import { mfaCookieName, shouldSecureMfaCookies } from '../auth/mfa/mfaCookiePolicy.ts'
import { toRestFields } from '../../scripts/owner-console-seed/restValues.mjs'
import { clearOwnerDirectoryCache } from './directoryServer.ts'
import { OWNER_MFA_REVERIFY_CODE } from './requireOwner.ts'
import { POST as changeName } from '../../app/api/owner/actions/change-name/route.ts'
import { POST as revokeSessions } from '../../app/api/owner/actions/revoke-sessions/route.ts'
import { POST as revealEmail } from '../../app/api/owner/people/[uid]/reveal-email/route.ts'
import { GET as personGet } from '../../app/api/owner/people/[uid]/route.ts'
import { POST as changeEmail } from '../../app/api/owner/change-email/route.ts'
import { POST as reverify } from '../../app/api/owner/reverify/route.ts'

const ENV = ['NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'GOOGLE_APPLICATION_CREDENTIALS', 'EMAIL_SERVER_KEY', 'EMAIL_FUNCTION_URL'] as const
const realEnv = Object.fromEntries(ENV.map((name) => [name, process.env[name]]))
const realFetch = globalThis.fetch
beforeEach(() => clearOwnerDirectoryCache())
afterEach(() => {
  globalThis.fetch = realFetch
  for (const name of ENV) {
    if (realEnv[name] === undefined) delete process.env[name]
    else process.env[name] = realEnv[name]
  }
})

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const SERVICE_ACCOUNT = JSON.stringify({
  client_email: 'console-test@demo.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  project_id: 'demo',
})

type Call = { method: string; url: string; auth: string; body: string }
type Docs = Record<string, Record<string, unknown>>

const BASE_DOCS: Docs = {
  'organizations/org-a': { name: 'Acme', members: { 'sam-uid': 'operative' } },
  'users/sam-uid': {
    email: 'sam@acme.co',
    firstName: 'Sam',
    surname: 'Lee',
    lastName: 'Lee',
    name: 'Sam Lee',
    displayName: 'Sam Lee',
    organizationId: 'org-a',
    passwordSet: true,
    isActive: true,
    role: 'operative',
    operativeMode: true,
    dayRate: 250,
  },
  'organizations/org-a/operatives/op-1': { email: 'SAM@acme.co', firstName: 'Sam', lastName: 'Lee', name: 'Sam Lee', dayRate: 250 },
  'organizations/org-a/managers/m-1': { email: 'someone@acme.co', firstName: 'Jo', lastName: 'Bloggs', name: 'Jo Bloggs' },
  'users/owner-uid': { email: PLATFORM_OWNER_EMAIL, firstName: 'Owner', surname: 'P', passwordSet: true, isActive: true },
}

function stub(options: { serverKey?: boolean; auditOk?: boolean; commitOk?: boolean; commitStatus?: number; commitText?: string; docs?: Docs } = {}) {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key'
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo'
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (options.serverKey) process.env.FIREBASE_SERVICE_ACCOUNT_JSON = SERVICE_ACCOUNT
  else delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  const docs = options.docs || BASE_DOCS
  const calls: Call[] = []
  const docName = (path: string) => `projects/demo/databases/(default)/documents/${path}`
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method || 'GET').toUpperCase()
    const headers = (init?.headers || {}) as Record<string, string>
    const auth = headers.Authorization || headers.authorization || ''
    calls.push({ method, url, auth, body: typeof init?.body === 'string' ? init.body : '' })
    if (url.startsWith('https://oauth2.googleapis.com/token')) return new Response(JSON.stringify({ access_token: 'admin-token' }))
    if (url.includes('accounts:lookup?key=')) {
      return new Response(JSON.stringify({ users: [{ localId: 'owner-uid', email: PLATFORM_OWNER_EMAIL, emailVerified: true, createdAt: '1000' }] }))
    }
    if (url.includes('accounts:lookup')) {
      return new Response(JSON.stringify({ users: [{ localId: 'sam-uid', email: 'sam@acme.co', createdAt: '1000', lastLoginAt: '2000' }] }))
    }
    if (url.includes('accounts:revokeRefreshTokens')) return new Response('{}')
    if (url.includes('/adminAuditLog') && method === 'POST') return new Response('{}', { status: options.auditOk === false ? 403 : 200 })
    if (url.includes(':runQuery')) return new Response('[]')
    if (url.endsWith(':commit')) {
      if (options.commitStatus) return new Response(options.commitText || '{}', { status: options.commitStatus })
      return new Response('{}', { status: options.commitOk === false ? 403 : 200 })
    }
    if (url.includes('/orgMemberships')) return new Response(JSON.stringify({ documents: [] }))
    if (url.startsWith('https://email.test/')) return new Response(JSON.stringify({ ok: true, id: 'm1' }))
    const marker = '/documents/'
    const path = decodeURIComponent(url.slice(url.indexOf(marker) + marker.length).split('?')[0])
    if (method === 'GET') {
      if (docs[path]) return new Response(JSON.stringify({ name: docName(path), fields: toRestFields(docs[path]), updateTime: `2026-11-23T10:00:00.${path.length}Z` }))
      const children = Object.keys(docs).filter((key) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/'))
      if (children.length || ['users', 'organizations'].includes(path) || /\/(operatives|managers|memberNames)$/.test(path)) {
        return new Response(JSON.stringify({ documents: children.map((key) => ({ name: docName(key), fields: toRestFields(docs[key]), updateTime: `2026-11-23T10:00:00.${key.length}Z` })) }))
      }
      return new Response('{}', { status: 404 })
    }
    return new Response('{}', { status: 404 })
  }) as typeof fetch
  return calls
}

let ipCounter = 1
function req(path: string, body: unknown, options: { fresh?: boolean; mfa?: boolean; method?: string } = {}): NextRequest {
  const text = body === undefined ? undefined : JSON.stringify(body)
  const request = new NextRequest(`http://localhost${path}`, {
    method: options.method || 'POST',
    headers: {
      authorization: 'Bearer token',
      'content-type': 'application/json',
      ...(text ? { 'content-length': String(text.length) } : {}),
      'x-forwarded-for': `198.51.100.${(ipCounter++ % 250) + 1}`,
    },
    body: text,
  })
  if (options.mfa !== false) {
    const iat = options.fresh === false ? Date.now() - 20 * 60 * 1000 : Date.now()
    request.cookies.set(mfaCookieName('ok', shouldSecureMfaCookies(request)), encodeMfaOk('owner-uid', Date.now() + 60 * 60 * 1000, iat))
  }
  return request
}

const params = (uid: string) => ({ params: Promise.resolve({ uid }) })
const auditIndex = (calls: Call[]) => calls.findIndex((call) => call.url.includes('/adminAuditLog') && call.method === 'POST')
const commitIndex = (calls: Call[]) => calls.findIndex((call) => call.url.endsWith(':commit'))

const NAME_BODY = { uid: 'sam-uid', firstName: 'Samuel', surname: 'Lee', reason: 'Name spelt wrong (ticket 12)' }

test('change name: without the MFA cookie it is refused and nothing is written', async () => {
  const calls = stub()
  const response = await changeName(req('/api/owner/actions/change-name', NAME_BODY, { mfa: false }))
  assert.equal(response.status, 403)
  assert.equal(commitIndex(calls), -1)
})

test('change name: an old code is refused with the re-verify code; the dry run still works', async () => {
  const calls = stub()
  const refused = await changeName(req('/api/owner/actions/change-name', NAME_BODY, { fresh: false }))
  assert.equal(refused.status, 403)
  assert.equal(((await refused.json()) as { code?: string }).code, OWNER_MFA_REVERIFY_CODE)
  const preview = await changeName(req('/api/owner/actions/change-name', { ...NAME_BODY, preview: true }, { fresh: false }))
  assert.equal(preview.status, 200)
  const data = (await preview.json()) as { users: { id: string }[]; rows: { id: string }[] }
  assert.deepEqual(data.users.map((row) => row.id), ['sam-uid'])
  assert.deepEqual(data.rows.map((row) => row.id), ['op-1'])
  assert.equal(commitIndex(calls), -1)
  assert.equal(auditIndex(calls), -1)
})

test('change name: a reason is required', async () => {
  stub()
  const response = await changeName(req('/api/owner/actions/change-name', { ...NAME_BODY, reason: 'x' }))
  assert.equal(response.status, 400)
})

test('change name: audit is written before the one atomic commit, which holds only name fields', async () => {
  const calls = stub()
  const response = await changeName(req('/api/owner/actions/change-name', NAME_BODY))
  assert.equal(response.status, 200)
  assert.ok(auditIndex(calls) >= 0 && commitIndex(calls) > auditIndex(calls))
  const commit = JSON.parse(calls[commitIndex(calls)].body) as { writes: { update: { name: string; fields: Record<string, unknown> }; currentDocument: unknown }[] }
  assert.deepEqual(commit.writes.map((write) => write.update.name.split('/documents/')[1]).sort(), ['organizations/org-a/operatives/op-1', 'users/sam-uid'])
  for (const write of commit.writes) {
    assert.ok((write.currentDocument as { updateTime?: string }).updateTime, 'precondition: the read updateTime')
    for (const key of Object.keys(write.update.fields)) {
      assert.ok(['firstName', 'surname', 'lastName', 'name', 'displayName', 'updatedBy', 'updatedFrom'].includes(key), key)
    }
  }
  const audits = calls.filter((call) => call.url.includes('/adminAuditLog') && call.method === 'POST')
  assert.equal(audits.length, 2)
  assert.match(audits[0].body, /"requested"/)
  assert.match(audits[1].body, /"completed"/)
})

test('change name: when the audit entry cannot be written nothing is changed', async () => {
  const calls = stub({ auditOk: false })
  const response = await changeName(req('/api/owner/actions/change-name', NAME_BODY))
  assert.equal(response.status, 502)
  assert.equal(commitIndex(calls), -1)
})

test('change name: a refused commit is recorded as failed', async () => {
  const calls = stub({ commitOk: false })
  const response = await changeName(req('/api/owner/actions/change-name', NAME_BODY))
  assert.equal(response.status, 502)
  const audits = calls.filter((call) => call.url.includes('/adminAuditLog') && call.method === 'POST')
  assert.match(audits[audits.length - 1].body, /"failed"/)
})

test('change name: the owner account is never changed here', async () => {
  const calls = stub()
  const response = await changeName(req('/api/owner/actions/change-name', { ...NAME_BODY, uid: 'owner-uid' }))
  assert.equal(response.status, 400)
  assert.equal(commitIndex(calls), -1)
})

test('sign out everywhere: without the server key it says so and changes nothing', async () => {
  const calls = stub({ serverKey: false })
  const response = await revokeSessions(req('/api/owner/actions/revoke-sessions', { uid: 'sam-uid', reason: 'Lost phone' }))
  assert.equal(response.status, 501)
  assert.match(((await response.json()) as { error: string }).error, /server key/)
  assert.equal(calls.some((call) => call.url.includes('revokeRefreshTokens')), false)
})

test('sign out everywhere: needs a fresh code, then audits before it revokes', async () => {
  let calls = stub({ serverKey: true })
  const stale = await revokeSessions(req('/api/owner/actions/revoke-sessions', { uid: 'sam-uid', reason: 'Lost phone' }, { fresh: false }))
  assert.equal(stale.status, 403)
  assert.equal(calls.some((call) => call.url.includes('revokeRefreshTokens')), false)
  calls = stub({ serverKey: true })
  const response = await revokeSessions(req('/api/owner/actions/revoke-sessions', { uid: 'sam-uid', reason: 'Lost phone' }))
  assert.equal(response.status, 200)
  const revoke = calls.findIndex((call) => call.url.includes('revokeRefreshTokens'))
  assert.ok(auditIndex(calls) >= 0 && revoke > auditIndex(calls))
  assert.equal(calls[revoke].auth, 'Bearer admin-token')
})

test('sign out everywhere: never the owner', async () => {
  const calls = stub({ serverKey: true })
  const response = await revokeSessions(req('/api/owner/actions/revoke-sessions', { uid: 'owner-uid', reason: 'test run' }))
  assert.equal(response.status, 400)
  assert.equal(calls.some((call) => call.url.includes('revokeRefreshTokens')), false)
})

test('reveal email: audited first; no audit, no email', async () => {
  let calls = stub()
  const ok = await revealEmail(req('/api/owner/people/sam-uid/reveal-email', {}), params('sam-uid'))
  assert.equal(ok.status, 200)
  assert.deepEqual(((await ok.json()) as { emails: string[] }).emails, ['sam@acme.co'])
  assert.ok(auditIndex(calls) >= 0)
  calls = stub({ auditOk: false })
  const refused = await revealEmail(req('/api/owner/people/sam-uid/reveal-email', {}), params('sam-uid'))
  assert.equal(refused.status, 502)
  assert.equal(JSON.stringify(await refused.json()).includes('sam@acme.co'), false)
})

test('person page: masked email, no pay; 404 for an unknown id; 401 signed out', async () => {
  stub()
  const response = await personGet(req('/api/owner/people/sam-uid', undefined, { method: 'GET' }), params('sam-uid'))
  assert.equal(response.status, 200)
  const text = JSON.stringify(await response.json())
  assert.equal(text.toLowerCase().includes('sam@acme.co'), false, 'no full email, not even the search key')
  assert.equal(/dayRate|hourlyRate|payBasis/.test(text), false)
  assert.match(text, /"level":"operative"/)
  const missing = await personGet(req('/api/owner/people/nobody', undefined, { method: 'GET' }), params('nobody'))
  assert.equal(missing.status, 404)
  const signedOut = new NextRequest('http://localhost/api/owner/people/sam-uid', { headers: { 'x-forwarded-for': '203.0.113.9' } })
  assert.equal((await personGet(signedOut, params('sam-uid'))).status, 401)
})

test('change email: an old code is refused; the two emails must match; the dry run writes nothing', async () => {
  const calls = stub({ serverKey: true })
  const body = { uid: 'sam-uid', newEmail: 'new@acme.co', confirmEmail: 'new@acme.co', reason: 'Typo in email' }
  const stale = await changeEmail(req('/api/owner/change-email', body, { fresh: false }))
  assert.equal(stale.status, 403)
  const mismatch = await changeEmail(req('/api/owner/change-email', { ...body, confirmEmail: 'other@acme.co' }))
  assert.equal(mismatch.status, 400)
  const preview = await changeEmail(req('/api/owner/change-email', { ...body, preview: true }, { fresh: false }))
  assert.equal(preview.status, 200)
  assert.equal(((await preview.json()) as { preview?: boolean }).preview, true)
  assert.equal(auditIndex(calls), -1)
  assert.equal(calls.some((call) => call.method === 'PATCH' || call.url.includes('accounts:update')), false)
})

test('re-verify: an owner session gets a new challenge without losing the ok or session cookie', async () => {
  const calls = stub()
  process.env.EMAIL_SERVER_KEY = 'test-server-key'
  process.env.EMAIL_FUNCTION_URL = 'https://email.test/send'
  const response = await reverify(req('/api/owner/reverify', {}, { fresh: false }))
  assert.equal(response.status, 200)
  assert.ok(calls.some((call) => call.url === 'https://email.test/send'))
  const cookies = response.cookies.getAll()
  const challenge = cookies.find((entry) => entry.name.endsWith('pp_mfa_challenge') && entry.value)
  assert.equal(decodeMfaChallenge(challenge?.value)?.uid, 'owner-uid')
  assert.equal(cookies.some((entry) => entry.name.endsWith('pp_mfa_ok')), false)
  assert.equal(cookies.some((entry) => entry.name.endsWith('pp_session')), false)
})

test('re-verify: when the code cannot be emailed no cookie is touched', async () => {
  stub()
  delete process.env.EMAIL_SERVER_KEY
  const response = await reverify(req('/api/owner/reverify', {}, { fresh: false }))
  assert.equal(response.status, 502)
  assert.equal(response.cookies.getAll().length, 0)
})

test('re-verify: refused to anyone without the owner MFA cookie', async () => {
  stub()
  const response = await reverify(req('/api/owner/reverify', {}, { mfa: false }))
  assert.equal(response.status, 403)
})

test('review of #434: change name refuses an anonymised deleted profile', async () => {
  const calls = stub({
    docs: { ...BASE_DOCS, 'users/gone-uid': { email: '', firstName: 'Deleted', surname: 'user', organizationId: 'org-a', passwordSet: true, isActive: true } },
  })
  const response = await changeName(req('/api/owner/actions/change-name', { ...NAME_BODY, uid: 'gone-uid' }))
  assert.equal(response.status, 409)
  assert.equal(commitIndex(calls), -1)
  assert.equal(auditIndex(calls), -1)
})

test('review of #434: a stored same-email id whose email changed is not renamed', async () => {
  const calls = stub({
    docs: {
      ...BASE_DOCS,
      'users/sam-uid': { ...BASE_DOCS['users/sam-uid'], sameEmailUserIds: ['moved-uid'] },
      'users/moved-uid': { email: 'moved@elsewhere.co', firstName: 'Moe', surname: 'Ved', organizationId: 'org-a', passwordSet: true, isActive: true },
    },
  })
  const response = await changeName(req('/api/owner/actions/change-name', NAME_BODY))
  assert.equal(response.status, 200)
  const commit = JSON.parse(calls[commitIndex(calls)].body) as { writes: { update: { name: string } }[] }
  assert.equal(commit.writes.some((write) => write.update.name.endsWith('/users/moved-uid')), false)
})

test('review of #434: the commit carries each read updateTime; a change made meanwhile is refused (409)', async () => {
  let calls = stub()
  const ok = await changeName(req('/api/owner/actions/change-name', NAME_BODY))
  assert.equal(ok.status, 200)
  const commit = JSON.parse(calls[commitIndex(calls)].body) as { writes: { currentDocument: { updateTime?: string } }[] }
  for (const write of commit.writes) assert.match(write.currentDocument.updateTime || '', /^2026-11-23T10:00:00\./)
  calls = stub({ commitStatus: 400, commitText: '{"error":{"status":"FAILED_PRECONDITION"}}' })
  const stale = await changeName(req('/api/owner/actions/change-name', NAME_BODY))
  assert.equal(stale.status, 409)
  assert.match(((await stale.json()) as { error: string }).error, /changed this record/i)
  const audits = calls.filter((call) => call.url.includes('/adminAuditLog') && call.method === 'POST')
  assert.match(audits[audits.length - 1].body, /"failed"/)
})
