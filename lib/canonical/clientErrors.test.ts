import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import {
  CLIENT_ERROR_DAY_MS,
  CLIENT_ERROR_FIELDS,
  CLIENT_ERROR_KNOWN_MESSAGES,
  CLIENT_ERRORS_PER_DAY,
  clientErrorBuild,
  clientErrorCreateFields,
  clientErrorDayIndex,
  clientErrorDocId,
  clientErrorGroups,
  clientErrorHashInput,
  clientErrorKind,
  clientErrorMessageKey,
  clientErrorNextSlot,
  clientErrorRoute,
  clientErrorSignature,
  clientErrorThrottle,
  clientErrorWhere,
  parseClientErrorDocument,
  redactClientErrorTokens,
} from './clientErrors'

const H = 'a'.repeat(64)
const sha = (text: string) => createHash('sha256').update(text).digest('hex')

test('1.84.0 review: no message text is stored — only a known constant key, else "other", plus a hash', () => {
  const f = clientErrorCreateFields({
    platform: 'web',
    source: 'caught',
    name: 'Error',
    message: 'Order is locked by Jane Smith',
    messageHash: sha('Order is locked by Jane Smith'),
    route: '/dashboard',
    build: '1.84.0',
    nowMs: Date.UTC(2026, 10, 24),
  })!
  assert.deepEqual(Object.keys(f).sort(), [...CLIENT_ERROR_FIELDS.filter((k) => k !== 'createdAt' && k !== 'expireAt'), 'expireAtMs'].sort())
  assert.equal(f.messageKey, 'other')
  assert.doesNotMatch(JSON.stringify(f), /Jane|Smith|locked/)
  assert.equal(f.messageHash, sha('Order is locked by Jane Smith'))
  assert.equal(clientErrorMessageKey('Missing or insufficient permissions.'), 'firestore-permission-denied')
  assert.equal(clientErrorMessageKey('  This was deleted on another device.  '), 'edit-of-missing-document')
  assert.equal(clientErrorMessageKey('Missing or insufficient permissions. Jane'), 'other')
  for (const [key, text] of Object.entries(CLIENT_ERROR_KNOWN_MESSAGES)) {
    assert.match(key, /^[a-z0-9-]{1,40}$/)
    assert.doesNotMatch(text, /\$\{|@/)
  }
  assert.equal(clientErrorCreateFields({ platform: 'web', source: 'caught', messageHash: 'nope', route: '/', build: '', nowMs: 0 }), null)
})

test('1.84.0 kind: class and code only, never text', () => {
  assert.equal(clientErrorKind('FirebaseError', 'permission-denied'), 'FirebaseError permission-denied')
  assert.equal(clientErrorKind('TypeError'), 'TypeError')
  assert.equal(clientErrorKind('NSCocoaErrorDomain', 4), 'NSCocoaErrorDomain 4')
  assert.equal(clientErrorKind('Jane Smith said hi', 'x y'), 'Error')
  assert.equal(clientErrorKind('Error', 'a@b.co'), 'Error')
  assert.equal(clientErrorKind('FirebaseError', 'auth/network-request-failed'), 'FirebaseError auth/network-request-failed')
})

test('1.84.0 where: top app frame file and function, no line, arguments or query; libraries skipped', () => {
  const chrome = [
    'TypeError: Cannot read properties of undefined',
    '    at Object.render (https://x/_next/static/chunks/framework-abc.js:1:2)',
    '    at handleSave (https://projectplanner.us/_next/static/chunks/app/dashboard/page-3f2a.js?v=jane@x.co:12:34)',
  ].join('\n')
  assert.equal(clientErrorWhere({ stack: chrome }), 'page-3f2a.js handleSave')
  assert.equal(clientErrorWhere({ stack: 'save@https://x/_next/static/chunks/abc.js:3:4\nother@y:1:1' }), 'abc.js save')
  assert.equal(clientErrorWhere({ file: 'Project_Planner/MaterialsView.swift', function: 'saveMaterial(_:for:)' }), 'MaterialsView.swift saveMaterial')
  assert.equal(clientErrorWhere({ stack: 42 }), '')
  assert.equal(clientErrorWhere({ stack: '    at fn (https://x/chunks/Abcdefghijklmnopqrstu.js:1:1)' }), '*.js fn')
})

test('1.84.0 route: pattern only — URLs, hosts without scheme, queries, (default), %40, full-width @ and ids', () => {
  assert.equal(clientErrorRoute('/dashboard/projects/AbCdEf0123456789XyZ1/schedule?week=2026-11-24#x'), '/dashboard/projects/:id/schedule')
  assert.equal(clientErrorRoute('https://projectplanner.us/developer/users/jane@example.com'), '/developer/users/:id')
  assert.equal(clientErrorRoute('projectplanner.us/dashboard?token=1'), '/dashboard')
  assert.equal(clientErrorRoute('/databases/(default)/documents/users/x'), '/databases/:id/documents/users/x')
  assert.equal(clientErrorRoute('/users/jane%40example.com'), '/users/:id')
  assert.equal(clientErrorRoute('/users/jane＠example.com'), '/users/:id')
  assert.equal(clientErrorRoute('/people/JaneSmith/abcdefghijklmnopq'), '/people/:id/:id')
  assert.equal(clientErrorRoute('/timesheets/123456'), '/timesheets/:id')
  assert.equal(clientErrorRoute('/annual-leave'), '/annual-leave')
  assert.equal(clientErrorRoute(''), '/')
  assert.equal(clientErrorRoute(undefined), '/')
  for (const r of ['/a?b', 'x.y/z', '/%E0%A4%A', '/Ä']) assert.match(clientErrorRoute(r), /^\/[a-z0-9:/_-]*$/)
})

test('1.84.0 redaction: any 16+ letter / digit run, digits or not', () => {
  assert.equal(redactClientErrorTokens('abcdefghijklmnop and short'), '* and short')
  assert.equal(redactClientErrorTokens('A1b2C3d4E5f6G7h8'), '*')
  assert.equal(clientErrorBuild('1.84.0 (12) abcdefghijklmnopqrst'), '1.84.0 (12) *')
})

test('1.84.0 document id: hash of uid|day plus a slot below 20; the next slot after a collision', () => {
  const day = clientErrorDayIndex(Date.UTC(2026, 10, 24))
  const hex = sha(clientErrorHashInput('uid-1', day))
  assert.equal(clientErrorDocId(hex, 19), `${hex}_19`)
  assert.equal(clientErrorDocId(hex, 20), null)
  assert.equal(clientErrorDocId(hex.toUpperCase(), 1), null)
  assert.equal(clientErrorNextSlot(3), 4)
  assert.equal(clientErrorNextSlot(19), null)
})

test('1.84.0 throttle: once per session per error, at most 20 a day, a new day starts again', () => {
  let state = null as ReturnType<typeof clientErrorThrottle>['state'] | null
  const first = clientErrorThrottle(state, { dayIndex: 100, signature: 'a' })
  assert.equal(first.slot, 0)
  state = first.state
  assert.equal(clientErrorThrottle(state, { dayIndex: 100, signature: 'a' }).send, false)
  for (let i = 1; i < CLIENT_ERRORS_PER_DAY; i++) state = clientErrorThrottle(state, { dayIndex: 100, signature: `s${i}` }).state
  assert.equal(clientErrorThrottle(state, { dayIndex: 100, signature: 'new' }).send, false)
  assert.equal(clientErrorThrottle(state, { dayIndex: 101, signature: 'new' }).slot, 0)
  const sig = clientErrorSignature({ platform: 'web', source: 'window', kind: 'TypeError', where: 'a.js f', route: '/', build: '1', messageHash: H })
  assert.ok(sig.includes(H))
  assert.equal(clientErrorCreateFields({ platform: 'web', source: 'window', messageHash: H, route: '/', build: '', nowMs: 3 * CLIENT_ERROR_DAY_MS })!.dayIndex, 3)
})

test('1.84.0 groups: by platform, kind, where and message key / hash; newest first; filters', () => {
  const row = (id: string, o: Record<string, unknown>) =>
    parseClientErrorDocument(id, { platform: 'web', source: 'window', kind: 'TypeError', where: 'a.js f', route: '/x', build: '1', messageKey: 'other', messageHash: H, organizationId: 'o1', createdAt: new Date(1000), ...o })
  const rows = [
    row('1', {}),
    row('2', { organizationId: 'o2', route: '/y', createdAt: { seconds: 3, nanoseconds: 0 } }),
    row('3', { messageHash: 'b'.repeat(64) }),
    row('4', { platform: 'ios', messageKey: 'firestore-permission-denied', organizationId: '', createdAt: new Date(2000) }),
  ]
  const groups = clientErrorGroups(rows)
  assert.equal(groups.length, 3)
  assert.equal(groups[0].count, 2)
  assert.deepEqual(groups[0].routes, ['/x', '/y'])
  assert.equal(groups.find((g) => g.platform === 'ios')!.messageText, 'Missing or insufficient permissions.')
  assert.equal(clientErrorGroups(rows, { platform: 'ios' }).length, 1)
  assert.equal(clientErrorGroups(rows, { organizationId: '' }).length, 1)
  assert.equal(parseClientErrorDocument('x', null).messageKey, 'other')
})
