'use strict'

/**
 * The organisation eraser against the Firestore emulator (rulebook 1.15.0 §20). Not part of CI or `npm test`: it
 * needs a running emulator.
 *
 * Run:
 *   firebase emulators:start --only firestore          # or: java -jar cloud-firestore-emulator-*.jar --port 8080
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node --test functions/organizationEraser.emulator.test.js
 *
 * Storage and Auth are stubbed (recorded calls). The admin SDK store (`createAdminEraserStore`) is the real one, so
 * the queries, the collection-group membership query and `recursiveDelete` run against the emulator.
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')
const canonical = require('./loadCanonical')
const { createAdminEraserStore, eraseDueOrganizations } = require('./organizationEraser')

const HOST = process.env.FIRESTORE_EMULATOR_HOST
const PROJECT = 'demo-eraser-115'
const DAY = 86400000

test('eraser on the emulator: switch off changes nothing; on erases only org A; a second run does nothing', { skip: !HOST && 'FIRESTORE_EMULATOR_HOST is not set' }, async () => {
  const app = initializeApp({ projectId: PROJECT }, `eraser-${Date.now()}`)
  const db = getFirestore(app)
  await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' })

  const now = Date.now()
  const seed = {
    'organizations/ORG-A': {
      name: 'Alpha Ltd',
      creatorUserId: 'ONLY-A',
      members: { 'ONLY-A': 'admin', BOTH: 'manager' },
      deletion: { status: 'scheduled', requestedAt: Timestamp.fromMillis(now - 61 * DAY), requestedBy: 'ONLY-A', eraseAfter: Timestamp.fromMillis(now - DAY), restoreBy: 'super_admin' },
    },
    'organizations/ORG-A/clients/c1': { name: 'A client' },
    'organizations/ORG-A/bookings/b1': { operativeId: 'ONLY-A' },
    'organizations/ORG-A/userEmails/only-a@x.com': { userId: 'ONLY-A' },
    'organizations/ORG-A/userEmails/both@x.com': { userId: 'BOTH' },
    'organizations/ORG-B': { name: 'Beta Ltd', creatorUserId: 'ONLY-B', members: { 'ONLY-B': 'admin', BOTH: 'operative' } },
    'organizations/ORG-B/clients/c1': { name: 'B client' },
    'organizations/ORG-B/userEmails/both@x.com': { userId: 'BOTH' },
    'users/ONLY-A': { email: 'only-a@x.com', organizationId: 'ORG-A' },
    'users/ONLY-A/private/taxIds': { utrNumber: '123' },
    'users/ONLY-A/orgMemberships/ORG-A': { organizationId: 'ORG-A', role: 'admin' },
    'users/BOTH': { email: 'both@x.com', organizationId: 'ORG-A' },
    'users/BOTH/orgMemberships/ORG-A': { organizationId: 'ORG-A', role: 'manager' },
    'users/BOTH/orgMemberships/ORG-B': { organizationId: 'ORG-B', role: 'operative' },
    'users/ONLY-B': { email: 'only-b@x.com', organizationId: 'ORG-B' },
    'users/ONLY-B/orgMemberships/ORG-B': { organizationId: 'ORG-B', role: 'admin' },
    'invitations/inv-a': { organizationId: 'ORG-A', email: 'new-a@x.com' },
    'invitations/inv-b': { organizationId: 'ORG-B', email: 'new-b@x.com' },
  }
  for (const [path, data] of Object.entries(seed)) await db.doc(path).set(data)

  async function snapshot() {
    const out = {}
    for (const path of [...Object.keys(seed), 'erasedOrganizations/ORG-A']) {
      const doc = await db.doc(path).get()
      if (doc.exists) out[path] = JSON.stringify(doc.data())
    }
    return out
  }
  const storageCalls = []
  const authCalls = []
  const deps = {
    canonical,
    store: createAdminEraserStore(db),
    deleteStoragePrefix: async (prefix) => {
      storageCalls.push(prefix)
    },
    deleteAuthUser: async (uid) => {
      authCalls.push(uid)
    },
    logger: { info() {}, warn() {} },
  }

  // Switch missing, then explicitly false: a dry run that reports org A only and changes nothing.
  const before = await snapshot()
  for (const value of [undefined, false]) {
    if (value !== undefined) await db.doc('platformConfig/app').set({ organizationErasureEnabled: value })
    const report = await eraseDueOrganizations(deps)
    assert.deepEqual(report.map((row) => [row.orgId, row.name, row.dryRun]), [['ORG-A', 'Alpha Ltd', true]])
    assert.deepEqual(report[0].counts, { usersDeleted: 1, usersKept: 1, memberships: 2, invitations: 1 })
    assert.deepEqual(await snapshot(), before)
    assert.deepEqual(storageCalls, [])
    assert.deepEqual(authCalls, [])
  }

  // Switch on: org A goes, org B and the shared person's B side stay.
  await db.doc('platformConfig/app').set({ organizationErasureEnabled: true })
  const report = await eraseDueOrganizations(deps)
  assert.deepEqual(report.map((row) => [row.orgId, row.dryRun]), [['ORG-A', false]])
  const after = await snapshot()
  const gone = Object.keys(before).filter((path) => !(path in after))
  assert.deepEqual(gone.sort(), [
    'invitations/inv-a',
    'organizations/ORG-A',
    'organizations/ORG-A/bookings/b1',
    'organizations/ORG-A/clients/c1',
    'organizations/ORG-A/userEmails/both@x.com',
    'organizations/ORG-A/userEmails/only-a@x.com',
    'users/BOTH/orgMemberships/ORG-A',
    'users/ONLY-A',
    'users/ONLY-A/orgMemberships/ORG-A',
    'users/ONLY-A/private/taxIds',
  ])
  for (const path of Object.keys(before)) {
    if (path in after) assert.equal(after[path], before[path], `${path} untouched`)
  }
  const audit = (await db.doc('erasedOrganizations/ORG-A').get()).data()
  assert.equal(audit.name, 'Alpha Ltd')
  assert.equal(audit.status, 'erased')
  assert.deepEqual(Object.keys(audit).sort(), ['erasedAt', 'name', 'status'])
  assert.deepEqual(storageCalls, ['organizations/ORG-A/'])
  assert.deepEqual(authCalls, ['ONLY-A'])

  // A second run finds nothing due and changes nothing.
  const settled = await snapshot()
  assert.deepEqual(await eraseDueOrganizations(deps), [])
  assert.deepEqual(await snapshot(), settled)
  assert.equal(authCalls.length, 1)
})
