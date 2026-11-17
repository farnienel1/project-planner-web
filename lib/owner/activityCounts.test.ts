/**
 * Owner console activity counts (Overview "Bookings made" and the Platform scoreboard): read from the records, never
 * from product events; a count that cannot be read is null ("—"), never 0.
 */
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { PLATFORM_OWNER_EMAIL } from '../canonical/passwordPolicy.ts'
import { encodeMfaOk } from '../auth/mfa/mfaCookies.ts'
import { mfaCookieName, shouldSecureMfaCookies } from '../auth/mfa/mfaCookiePolicy.ts'
import { installFakeFirestore } from './fakeFirestoreRest.ts'
import { resetRateLimitForTests } from '../security/rateLimit.ts'
import { restTimeRange } from './firestoreRest.ts'
import {
  ACTIVITY_METRICS,
  PREVIOUS_RANGE_ID,
  activityOrganisationIds,
  activityRanges,
  countActivity,
} from './activityCounts.ts'
import { activityCell } from './activityDisplay.ts'
import { PLATFORM_OWNER_SENTINEL_ORG } from '../platform/owner.ts'
import { GET as activityGET } from '../../app/api/owner/activity/route.ts'

const realFetch = globalThis.fetch
const ENV = ['NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'] as const
const realEnv = Object.fromEntries(ENV.map((name) => [name, process.env[name]]))
afterEach(() => {
  resetRateLimitForTests()
  globalThis.fetch = realFetch
  for (const name of ENV) {
    if (realEnv[name] === undefined) delete process.env[name]
    else process.env[name] = realEnv[name]
  }
})

test('every console column plus the selected period comparison range is counted', () => {
  const now = new Date('2026-11-17T12:00:00Z')
  const ranges = activityRanges('week', now)
  assert.deepEqual(ranges.map((range) => range.id), ['today', 'week', 'month', 'year', 'to_date', PREVIOUS_RANGE_ID])
  const week = ranges.find((range) => range.id === 'week')!
  assert.equal(week.start.toISOString(), '2026-11-16T00:00:00.000Z')
  assert.equal(week.end.toISOString(), now.toISOString())
  const previous = ranges.find((range) => range.id === PREVIOUS_RANGE_ID)!
  assert.equal(previous.start.toISOString(), '2026-11-09T00:00:00.000Z')
})

test('bookings count labour, manager schedule and subcontractor bookings; tasks are dated by completedAt', () => {
  const bookings = ACTIVITY_METRICS.find((metric) => metric.id === 'bookings')!
  assert.deepEqual(bookings.collections, ['bookings', 'managerSiteBookings', 'subcontractorBookings'])
  assert.equal(bookings.field, 'createdAt')
  assert.equal(ACTIVITY_METRICS.find((metric) => metric.id === 'tasksCompleted')!.field, 'completedAt')
})

test('counts are summed across organisations and collections', async () => {
  const ranges = [{ id: 'month', start: new Date(0), end: new Date(1) }]
  const result = await countActivity({
    organizationIds: ['a', 'b'],
    ranges,
    count: async (orgId, collectionId) => (collectionId === 'bookings' ? (orgId === 'a' ? 3 : 4) : collectionId === 'managerSiteBookings' ? 1 : 0),
  })
  assert.equal(result.values.bookings.month, 9)
  assert.equal(result.values.projects.month, 0)
  assert.deepEqual(result.failedOrganisations, [])
})

test('a count that cannot be read makes that figure null (shown as —), never 0, and names the organisation', async () => {
  const ranges = [{ id: 'today', start: new Date(0), end: new Date(1) }, { id: 'month', start: new Date(0), end: new Date(2) }]
  const result = await countActivity({
    organizationIds: ['good', 'bad'],
    ranges,
    count: async (orgId, collectionId, _field, _start, end) => {
      if (orgId === 'bad' && collectionId === 'subcontractorBookings' && end.getTime() === 2) throw new Error('Count refused (403)')
      return 2
    },
  })
  assert.equal(result.values.bookings.month, null)
  assert.equal(result.values.bookings.today, 12)
  assert.equal(result.values.projects.month, 4)
  assert.deepEqual(result.failedOrganisations, ['bad'])
})

test('the platform-owner sentinel is never counted; test organisations only with "Include test data"', () => {
  const orgs = [{ id: 'real' }, { id: 'demo', isTest: true }, { id: 'staff', isInternal: true }, { id: PLATFORM_OWNER_SENTINEL_ORG }]
  assert.deepEqual(activityOrganisationIds(orgs, false), ['real'])
  assert.deepEqual(activityOrganisationIds(orgs, true), ['demo', 'real', 'staff'])
})

test('the screen reads a missing or failed figure as null, never 0', () => {
  assert.equal(activityCell(null, 'bookings', 'month'), null)
  const view = { values: { bookings: { month: 0, week: null } }, failedOrganisations: [] }
  assert.equal(activityCell(view, 'bookings', 'month'), 0)
  assert.equal(activityCell(view, 'bookings', 'week'), null)
  assert.equal(activityCell(view, 'projects', 'month'), null)
})

test('the range filter is a single-field Timestamp range (no composite index)', () => {
  const filter = restTimeRange('createdAt', new Date('2026-11-01T00:00:00Z'), new Date('2026-11-17T00:00:00Z')) as {
    compositeFilter: { filters: { fieldFilter: { field: { fieldPath: string }; op: string; value: { timestampValue: string } } }[] }
  }
  assert.deepEqual(
    filter.compositeFilter.filters.map((row) => [row.fieldFilter.field.fieldPath, row.fieldFilter.op, row.fieldFilter.value.timestampValue]),
    [
      ['createdAt', 'GREATER_THAN_OR_EQUAL', '2026-11-01T00:00:00.000Z'],
      ['createdAt', 'LESS_THAN_OR_EQUAL', '2026-11-17T00:00:00.000Z'],
    ]
  )
})

// MARK: - The route, against the fake Firestore REST backend

const owner = { localId: 'owner-uid', email: PLATFORM_OWNER_EMAIL, emailVerified: true }

function get(path: string, ip: string): NextRequest {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key'
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo'
  const request = new NextRequest(`http://localhost${path}`, { headers: { 'x-forwarded-for': ip, authorization: 'Bearer token' } })
  request.cookies.set(mfaCookieName('ok', shouldSecureMfaCookies(request)), encodeMfaOk('owner-uid', Date.now() + 60_000, Date.now()))
  return request
}

function recent(daysAgo: number): Date {
  return new Date(Date.now() - daysAgo * 86_400_000)
}

const collections = {
  organizations: [
    { id: 'org-a', data: { name: 'A Ltd' } },
    { id: 'org-test', data: { name: 'Demo', isTest: true } },
  ],
  'organizations/org-a/bookings': [
    { id: 'b1', data: { createdAt: recent(0) } },
    { id: 'b2', data: { createdAt: recent(400) } },
    // An older record with no createdAt is not invented into a period.
    { id: 'b3', data: {} },
  ],
  'organizations/org-a/managerSiteBookings': [{ id: 'm1', data: { createdAt: recent(0) } }],
  'organizations/org-a/projects': [{ id: 'p1', data: { createdAt: recent(0) } }],
  'organizations/org-a/smallWorks': [{ id: 's1', data: { createdAt: recent(0) } }],
  'organizations/org-a/tasks': [
    { id: 't1', data: { completedAt: recent(0), status: 'Completed' } },
    { id: 't2', data: { status: 'To Do' } },
  ],
  'organizations/org-test/bookings': [{ id: 'tb', data: { createdAt: recent(0) } }],
}

test('route: bookings made today is the bookings created today (was always 0 from schedule_edited events)', async () => {
  installFakeFirestore(collections, owner)
  const response = await activityGET(get('/api/owner/activity?period=today', '198.51.100.20'))
  assert.equal(response.status, 200)
  const body = (await response.json()) as { values: Record<string, Record<string, number | null>>; failedOrganisations: string[] }
  assert.equal(body.values.bookings.today, 2)
  assert.equal(body.values.bookings.to_date, 3)
  assert.equal(body.values.projects.today, 1)
  assert.equal(body.values.smallWorks.today, 1)
  assert.equal(body.values.tasksCompleted.today, 1)
  assert.deepEqual(body.failedOrganisations, [])
  const withTest = (await (await activityGET(get('/api/owner/activity?period=today&includeTestData=1', '198.51.100.21'))).json()) as {
    values: Record<string, Record<string, number | null>>
  }
  assert.equal(withTest.values.bookings.today, 3)
})

test('route: a refused read is a 502, never zero figures; an unknown period is 400', async () => {
  installFakeFirestore(collections, owner, { refuse: true })
  assert.equal((await activityGET(get('/api/owner/activity?period=today', '198.51.100.22'))).status, 502)
  installFakeFirestore(collections, owner)
  assert.equal((await activityGET(get('/api/owner/activity?period=decade', '198.51.100.23'))).status, 400)
})

test('route: signed out is 401 and reads nothing', async () => {
  const backend = installFakeFirestore(collections, owner)
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key'
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo'
  const response = await activityGET(new NextRequest('http://localhost/api/owner/activity?period=today', { headers: { 'x-forwarded-for': '198.51.100.24' } }))
  assert.equal(response.status, 401)
  assert.equal(backend.calls.filter((call) => call.url.includes('/documents')).length, 0)
})
