import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import {
  CLIENT_ERROR_DAY_MS,
  CLIENT_ERROR_MESSAGE_MAX,
  CLIENT_ERRORS_PER_DAY,
  clientErrorCreateFields,
  clientErrorDayIndex,
  clientErrorDocId,
  clientErrorGroups,
  clientErrorHashInput,
  clientErrorSignature,
  clientErrorThrottle,
  parseClientErrorDocument,
  sanitizeClientErrorRoute,
  sanitizeClientErrorText,
} from './clientErrors'

test('1.84.0 sanitiser: emails, URL queries, ids and tokens never reach a report', () => {
  const raw =
    'Failed for jane.doe+x@example.co.uk at https://app.example.com/dashboard/users/4f9c2a7b1e3d4c5f6a7b8c9d?token=abc#frag ' +
    'uid AbCdEf0123456789XyZ1 doc 123e4567-e89b-12d3-a456-426614174000 hex deadbeefdeadbeefdeadbeef order 1234567 ' +
    'jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig'
  const out = sanitizeClientErrorText(raw)
  assert.doesNotMatch(out, /@/)
  assert.doesNotMatch(out, /jane/)
  assert.doesNotMatch(out, /token=|#frag|\?/)
  assert.doesNotMatch(out, /AbCdEf0123456789XyZ1|123e4567|deadbeef|1234567|eyJ/)
  assert.match(out, /<email>/)
  assert.match(out, /https:\/\/app\.example\.com\/dashboard\/users\/:id/)
  assert.match(out, /<id>/)
})

test('1.84.0 sanitiser: ordinary words stay, whitespace collapses, length is capped', () => {
  assert.equal(sanitizeClientErrorText('  FirebaseError:   Missing or insufficient permissions.\n at x  '), 'FirebaseError: Missing or insufficient permissions. at x')
  assert.equal(sanitizeClientErrorText('permission-denied organizationId undefined'), 'permission-denied organizationId undefined')
  const long = sanitizeClientErrorText('x '.repeat(400))
  assert.ok(Array.from(long).length <= CLIENT_ERROR_MESSAGE_MAX)
  assert.equal(sanitizeClientErrorText(42), '')
  assert.equal(sanitizeClientErrorText(null), '')
})

test('1.84.0 route: path only, ids as :id, no query or host', () => {
  assert.equal(sanitizeClientErrorRoute('/dashboard/projects/AbCdEf0123456789XyZ1/schedule?week=2026-11-24#x'), '/dashboard/projects/:id/schedule')
  assert.equal(sanitizeClientErrorRoute('https://projectplanner.us/developer/users/jane@example.com'), '/developer/users/:id')
  assert.equal(sanitizeClientErrorRoute('/timesheets/123456/123e4567-e89b-12d3-a456-426614174000'), '/timesheets/:id/:id')
  assert.equal(sanitizeClientErrorRoute(''), '/')
  assert.equal(sanitizeClientErrorRoute(undefined), '/')
  assert.equal(sanitizeClientErrorRoute('Timesheets'), '/Timesheets')
})

test('1.84.0 create fields: exact keys, day index, 30-day expiry, unknown platform refused', () => {
  const nowMs = Date.UTC(2026, 10, 24, 13, 0, 0)
  const f = clientErrorCreateFields({ platform: 'web', source: 'window', message: 'Boom for a@b.co', route: '/a?b=c', build: '1.84.0', organizationId: 'org_1', nowMs })
  assert.ok(f)
  assert.deepEqual(Object.keys(f!).sort(), ['build', 'dayIndex', 'expireAtMs', 'message', 'organizationId', 'platform', 'route', 'source'])
  assert.equal(f!.dayIndex, Math.floor(nowMs / CLIENT_ERROR_DAY_MS))
  assert.equal(f!.expireAtMs - nowMs, 30 * CLIENT_ERROR_DAY_MS)
  assert.equal(f!.message, 'Boom for <email>')
  assert.equal(f!.route, '/a')
  assert.equal(clientErrorCreateFields({ platform: 'android' as never, source: 'window', message: 'x', route: '/', build: '', nowMs }), null)
  assert.equal(clientErrorCreateFields({ platform: 'ios', source: 'nope' as never, message: 'x', route: '/', build: '', nowMs }), null)
  assert.equal(clientErrorCreateFields({ platform: 'ios', source: 'caught', message: '   ', route: '/', build: '', nowMs }), null)
  // An organisation id that is not a plain id is left out rather than stored.
  assert.equal(clientErrorCreateFields({ platform: 'ios', source: 'caught', message: 'x', route: '/', build: '', organizationId: 'a/b', nowMs })!.organizationId, '')
})

test('1.84.0 document id: hash of uid|day plus a slot below 20 — matches what the security rules recompute', () => {
  const day = clientErrorDayIndex(Date.UTC(2026, 10, 24))
  const hex = createHash('sha256').update(clientErrorHashInput('uid-1', day)).digest('hex')
  assert.equal(clientErrorHashInput('uid-1', day), `uid-1|${day}`)
  assert.equal(clientErrorDocId(hex, 0), `${hex}_0`)
  assert.equal(clientErrorDocId(hex, 19), `${hex}_19`)
  assert.equal(clientErrorDocId(hex, 20), null)
  assert.equal(clientErrorDocId(hex.toUpperCase(), 1), null)
  assert.equal(clientErrorDocId('abc', 1), null)
})

test('1.84.0 throttle: once per session per error, at most 20 a day, a new day starts again', () => {
  let state = null as ReturnType<typeof clientErrorThrottle>['state'] | null
  const first = clientErrorThrottle(state, { dayIndex: 100, signature: 'a' })
  assert.equal(first.send, true)
  assert.equal(first.slot, 0)
  state = first.state
  assert.equal(clientErrorThrottle(state, { dayIndex: 100, signature: 'a' }).send, false)
  for (let i = 1; i < CLIENT_ERRORS_PER_DAY; i++) {
    const next = clientErrorThrottle(state, { dayIndex: 100, signature: `s${i}` })
    assert.equal(next.slot, i)
    state = next.state
  }
  assert.equal(clientErrorThrottle(state, { dayIndex: 100, signature: 'new' }).send, false)
  const tomorrow = clientErrorThrottle(state, { dayIndex: 101, signature: 'new' })
  assert.equal(tomorrow.send, true)
  assert.equal(tomorrow.slot, 0)
  assert.equal(clientErrorSignature({ platform: 'web', source: 'window', message: 'm', route: '/', build: '1' }).includes('m'), true)
})

test('1.84.0 reader and groups: count per message, route, build and platform; newest first; filters', () => {
  const rows = [
    parseClientErrorDocument('1', { platform: 'web', source: 'window', message: 'A', route: '/x', build: '1', organizationId: 'o1', createdAt: new Date(1000) }),
    parseClientErrorDocument('2', { platform: 'web', source: 'promise', message: 'A', route: '/x', build: '1', organizationId: 'o2', createdAt: { seconds: 3, nanoseconds: 0 } }),
    parseClientErrorDocument('3', { platform: 'ios', source: 'caught', message: 'B', route: '/y', build: '9', organizationId: '', createdAt: new Date(2000) }),
    parseClientErrorDocument('4', null),
  ]
  assert.equal(rows[3].message, '')
  const groups = clientErrorGroups(rows.slice(0, 3))
  assert.equal(groups.length, 2)
  assert.equal(groups[0].message, 'A')
  assert.equal(groups[0].count, 2)
  assert.equal(groups[0].lastMs, 3000)
  assert.deepEqual(groups[0].organizationIds, ['o1', 'o2'])
  assert.deepEqual(groups[0].sources, ['window', 'promise'])
  assert.equal(clientErrorGroups(rows.slice(0, 3), { platform: 'ios' }).length, 1)
  assert.equal(clientErrorGroups(rows.slice(0, 3), { organizationId: '' })[0].message, 'B')
  assert.equal(clientErrorGroups(rows.slice(0, 3), { organizationId: 'o2' })[0].count, 1)
})
