/**
 * Route tests (spec §6.3.3) for the PR 1 read routes: signed out 401, non-owner 403, owner without MFA 403, bad input
 * 400, rate limit 429, and success figures equal to the hand-worked seed fixtures.
 */
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { NextRequest } from 'next/server'
import { PLATFORM_OWNER_EMAIL } from '../canonical/passwordPolicy.ts'
import { encodeMfaOk } from '../auth/mfa/mfaCookies.ts'
import { mfaCookieName, shouldSecureMfaCookies } from '../auth/mfa/mfaCookiePolicy.ts'
import { buildOwnerConsoleSeed } from '../../scripts/owner-console-seed/seedData.mjs'
import { installFakeFirestore } from './fakeFirestoreRest.ts'
import { GET as orgsGET } from '../../app/api/owner/directory/orgs/route.ts'
import { GET as peopleGET } from '../../app/api/owner/directory/people/route.ts'
import { GET as searchGET } from '../../app/api/owner/search/route.ts'
import { GET as countsGET } from '../../app/api/owner/counts/route.ts'

const expected = JSON.parse(readFileSync(new URL('../../scripts/owner-console-seed/expected.json', import.meta.url), 'utf8'))
const seed = buildOwnerConsoleSeed()
const collections = { organizations: seed.orgs, users: seed.users, invitations: seed.invitations }

const ENV = ['NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'] as const
const realEnv = Object.fromEntries(ENV.map((name) => [name, process.env[name]]))
const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
  for (const name of ENV) {
    if (realEnv[name] === undefined) delete process.env[name]
    else process.env[name] = realEnv[name]
  }
})

const owner = { localId: 'owner-uid', email: PLATFORM_OWNER_EMAIL, emailVerified: true }
const superAdmin = { localId: 'su-large', email: 'superadmin@large.example', emailVerified: true }

let ipCounter = 0
function get(path: string, options: { token?: boolean; mfaUid?: string | null; ip?: string } = {}): NextRequest {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key'
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo'
  ipCounter += 1
  const headers: Record<string, string> = { 'x-forwarded-for': options.ip || `198.51.100.${ipCounter % 250}` }
  if (options.token !== false) headers.authorization = 'Bearer token'
  const request = new NextRequest(`http://localhost${path}`, { headers })
  const mfaUid = options.mfaUid === undefined ? 'owner-uid' : options.mfaUid
  if (mfaUid) request.cookies.set(mfaCookieName('ok', shouldSecureMfaCookies(request)), encodeMfaOk(mfaUid, Date.now() + 60_000, Date.now()))
  return request
}

const routes = [
  ['orgs', orgsGET, '/api/owner/directory/orgs'],
  ['people', peopleGET, '/api/owner/directory/people'],
  ['search', searchGET, '/api/owner/search?q=large'],
  ['counts', countsGET, '/api/owner/counts'],
] as const

for (const [name, handler, path] of routes) {
  test(`${name}: signed out is 401 and reads nothing`, async () => {
    const backend = installFakeFirestore(collections, owner)
    const response = await handler(get(path, { token: false }))
    assert.equal(response.status, 401)
    assert.equal(backend.calls.filter((call) => call.url.includes('/documents')).length, 0)
  })

  test(`${name}: an org Super Admin (with their own MFA cookie) is 403 and reads nothing`, async () => {
    const backend = installFakeFirestore(collections, superAdmin)
    const response = await handler(get(path, { mfaUid: 'su-large' }))
    assert.equal(response.status, 403)
    assert.equal(backend.calls.filter((call) => call.url.includes('/documents')).length, 0)
  })

  test(`${name}: the owner without the MFA cookie is 403`, async () => {
    installFakeFirestore(collections, owner)
    assert.equal((await handler(get(path, { mfaUid: null }))).status, 403)
  })

  test(`${name}: a refused read is a clear 502, never empty figures`, async () => {
    installFakeFirestore(collections, owner, { refuse: true })
    const response = await handler(get(path))
    assert.equal(response.status, 502)
    assert.match(((await response.json()) as { error: string }).error, /Could not read/)
  })
}

test('rate limit: the 121st directory read in a minute from one address is 429', async () => {
  installFakeFirestore(collections, owner)
  let last = 0
  for (let i = 0; i < 121; i += 1) last = (await orgsGET(get('/api/owner/directory/orgs?limit=1', { ip: '203.0.113.200' }))).status
  assert.equal(last, 429)
})

test('bad input: a 201-character search is 400; unknown filters and sorts read as the defaults', async () => {
  installFakeFirestore(collections, owner)
  assert.equal((await peopleGET(get(`/api/owner/directory/people?q=${'x'.repeat(201)}`))).status, 400)
  const response = await orgsGET(get('/api/owner/directory/orgs?filter=nonsense&sort=evil&limit=-5'))
  assert.equal(response.status, 200)
  const body = (await response.json()) as { total: number }
  assert.equal(body.total, expected.organisations.rowsWithoutTest)
})

test('orgs: totals with and without test data, and every filter, equal the fixtures', async () => {
  installFakeFirestore(collections, owner)
  const total = async (query: string) => ((await (await orgsGET(get(`/api/owner/directory/orgs?${query}`))).json()) as { total: number }).total
  assert.equal(await total('includeTestData=1'), expected.organisations.rows)
  assert.equal(await total(''), expected.organisations.rowsWithoutTest)
  assert.equal(await total('filter=scheduled'), expected.organisations.scheduled)
  assert.equal(await total('filter=lapsed'), expected.organisations.lapsed)
  assert.equal(await total('filter=test'), expected.organisations.test)
})

test('people: paging returns every person once; no full email leaves the server', async () => {
  installFakeFirestore(collections, owner)
  const ids: string[] = []
  let cursor = ''
  for (let i = 0; i < 10; i += 1) {
    const response = await peopleGET(get(`/api/owner/directory/people?includeTestData=1&limit=50${cursor ? `&cursor=${cursor}` : ''}`))
    const body = (await response.json()) as { rows: { id: string }[]; nextCursor: string | null; total: number }
    assert.equal(body.total, expected.people.rows)
    // Masked as a•••@large.example: never two or more characters of the address before the @.
    assert.equal(/[a-z0-9.]{2,}@/i.test(JSON.stringify(body)), false)
    ids.push(...body.rows.map((row) => row.id))
    if (!body.nextCursor) break
    cursor = body.nextCursor
  }
  assert.equal(ids.length, expected.people.rows)
  assert.equal(new Set(ids).size, ids.length)
})

test('search: one character returns nothing without reading; an email finds the person', async () => {
  const backend = installFakeFirestore(collections, owner)
  const short = (await (await searchGET(get('/api/owner/search?q=d'))).json()) as { people: unknown[] }
  assert.deepEqual(short.people, [])
  assert.equal(backend.calls.filter((call) => call.url.includes('/documents')).length, 0)
  const found = (await (await searchGET(get('/api/owner/search?q=dee%40dual'))).json()) as { people: { id: string }[] }
  assert.deepEqual(found.people.map((row) => row.id), ['dual-1'])
})

test('counts: aggregation results equal the fixtures, with and without test data', async () => {
  const backend = installFakeFirestore(collections, owner)
  const withTest = (await (await countsGET(get('/api/owner/counts?includeTestData=1'))).json()) as Record<string, number>
  const without = (await (await countsGET(get('/api/owner/counts'))).json()) as Record<string, number>
  const e = expected.counts
  assert.equal(withTest.organisations, e.organisations)
  assert.equal(without.organisations, e.organisationsWithoutTest)
  assert.equal(withTest.accounts, e.accounts)
  assert.equal(without.accounts, e.accountsWithoutTest)
  assert.equal(withTest.scheduledForDeletion, e.scheduledForDeletion)
  assert.equal(withTest.inactiveAccounts, e.inactiveAccounts)
  assert.equal(withTest.pendingInvitations, e.pendingInvitations)
  // Counts never list a collection: every Firestore call is an aggregation, a flag query or one document read.
  const listed = backend.calls.filter((call) => call.method === 'GET' && /\/documents\/(users|organizations)(\?|$)/.test(call.url))
  assert.equal(listed.length, 0)
})
