'use strict'

/**
 * Rulebook 1.32.4 §16: the auth-claims sync (authClaims.js) with a fake Firestore store and a fake Auth. The claims
 * themselves are the rulebook's (`authClaimsForPerson`, lib/canonical/authClaims.test.ts).
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const canonical = require('./loadCanonical')
const { createAuthClaimsSync, storedOrganizationId } = require('./authClaims')

/** The packed rulebook runs in its own VM context: compare its arrays as JSON. */
const plain = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))

function world(seed = {}) {
  const docs = new Map(Object.entries(seed))
  const accounts = new Map([['u1', { uid: 'u1', customClaims: { other: true } }], ['u2', { uid: 'u2' }]])
  const calls = { set: [], revoke: [], marker: [] }
  const store = {
    async user(uid) {
      return docs.get(`users/${uid}`) ?? null
    },
    async memberships(uid) {
      const out = {}
      for (const [key, data] of docs) {
        const m = key.match(/^users\/([^/]+)\/orgMemberships\/([^/]+)$/)
        if (m && m[1] === uid) out[m[2]] = data
      }
      return out
    },
    async organizationsListing(uid) {
      const out = {}
      for (const [key, data] of docs) {
        const m = key.match(/^organizations\/([^/]+)$/)
        if (m && ((data.members && uid in data.members) || data.creatorUserId === uid)) out[m[1]] = data
      }
      return out
    },
    async organization(orgId) {
      return docs.get(`organizations/${orgId}`) ?? null
    },
    async writeMarker(uid, fields) {
      calls.marker.push({ uid, ...fields })
    },
  }
  const auth = {
    async getUser(uid) {
      if (!accounts.has(uid)) {
        const error = new Error('no user')
        error.code = 'auth/user-not-found'
        throw error
      }
      return accounts.get(uid)
    },
    async setCustomUserClaims(uid, claims) {
      calls.set.push({ uid, claims })
      accounts.set(uid, { ...accounts.get(uid), customClaims: claims })
    },
    async revokeRefreshTokens(uid) {
      calls.revoke.push(uid)
    },
  }
  let clock = 1000
  const sync = createAuthClaimsSync({ store, auth, canonical, logger: { warn() {}, error() {} }, now: () => (clock += 1) })
  return { docs, accounts, calls, sync }
}

test('1.32.4 auth claims sync: sets claims from the documents, keeps other claims, writes the marker', async () => {
  const w = world({
    'users/u1': { organizationId: 'A', role: 'admin', adminAccess: true },
    'organizations/A': { members: { u1: 'admin' }, creatorUserId: 'u1' },
    'organizations/B': { members: { u1: 'manager' } },
    'users/u1/orgMemberships/B': { permissions: { projects: true } },
  })
  const result = await w.sync.syncPerson('u1')
  assert.equal(result.changed, true)
  assert.equal(w.calls.set.length, 1)
  const claims = w.calls.set[0].claims
  assert.equal(claims.other, true, 'other custom claims are kept')
  assert.deepEqual(plain(claims.pp.o.a.slice(0, 2)), ['admin', 'admin'])
  assert.deepEqual(plain(claims.pp.o.b), ['manager', 'manager', 'c', 'P'])
  assert.deepEqual(plain(w.calls.marker), [{ uid: 'u1', v: claims.pp.s, omittedOrganizationIds: [] }])
  assert.deepEqual(w.calls.revoke, [])
})

test('1.32.4 auth claims sync: no change, no write; deactivation and removal revoke refresh tokens', async () => {
  const w = world({
    'users/u1': { organizationId: 'A', role: 'manager', manager: true },
    'organizations/A': { members: { u1: 'manager' } },
    'organizations/B': { members: { u1: 'member' } },
  })
  await w.sync.syncPerson('u1')
  const again = await w.sync.syncPerson('u1')
  assert.equal(again.changed, false)
  assert.equal(w.calls.set.length, 1)
  assert.equal(w.calls.marker.length, 1)
  // Removed from company B: claims change, refresh tokens revoked.
  const before = w.docs.get('organizations/B')
  w.docs.set('organizations/B', { members: {} })
  const report = await w.sync.syncOrganizationChange(before, w.docs.get('organizations/B'))
  assert.deepEqual(report.map((row) => [row.uid, row.changed, row.revoked]), [['u1', true, true]])
  assert.equal(w.accounts.get('u1').customClaims.pp.o.b, undefined)
  // Deactivated at home.
  w.docs.set('users/u1', { organizationId: 'A', role: 'manager', manager: true, isActive: false })
  const off = await w.sync.syncPerson('u1')
  assert.equal(off.revoked, true)
  assert.deepEqual(plain(w.calls.revoke), ['u1', 'u1'])
})

test('1.32.4 auth claims sync: a role change that keeps access does not revoke; reactivation does not revoke', async () => {
  const w = world({ 'users/u1': { organizationId: 'A', role: 'manager', manager: true }, 'organizations/A': { members: { u1: 'manager' } } })
  await w.sync.syncPerson('u1')
  w.docs.set('users/u1', { organizationId: 'A', role: 'admin' })
  const up = await w.sync.syncPerson('u1')
  assert.equal(up.changed, true)
  assert.equal(up.revoked, false)
  w.docs.set('users/u1', { organizationId: 'A', role: 'admin', isActive: false })
  assert.equal((await w.sync.syncPerson('u1')).revoked, true)
  w.docs.set('users/u1', { organizationId: 'A', role: 'admin' })
  assert.equal((await w.sync.syncPerson('u1')).revoked, false)
  assert.deepEqual(w.calls.revoke, ['u1'])
})

test('1.32.4 auth claims sync: placeholders without an Auth account and bad ids are skipped', async () => {
  const w = world({ 'users/placeholder-uuid': { organizationId: 'A' } })
  assert.deepEqual(await w.sync.syncPerson('placeholder-uuid'), { uid: 'placeholder-uuid', skipped: 'no-auth-user' })
  assert.deepEqual(await w.sync.syncPerson('a/b'), { uid: 'a/b', skipped: 'bad-uid' })
  assert.equal(w.calls.set.length, 0)
})

test('1.32.4 auth claims sync: an organisation write recomputes only the people whose entry or creator changed', async () => {
  const w = world({ 'organizations/A': { members: { u1: 'admin', u2: 'member' }, creatorUserId: 'u1' } })
  const before = { members: { u1: 'admin', u2: 'member' }, creatorUserId: 'u1' }
  assert.deepEqual(await w.sync.syncOrganizationChange(before, { ...before, billing: { accessOpen: false } }), [])
  const after = { members: { u1: 'admin', u2: 'manager', ghost: 'member' }, creatorUserId: 'u1' }
  w.docs.set('organizations/A', after)
  const report = await w.sync.syncOrganizationChange(before, after)
  assert.deepEqual(plain(report.map((row) => row.uid)), ['ghost', 'u2'])
  assert.equal(report[0].skipped, 'no-auth-user')
  assert.deepEqual(plain(w.accounts.get('u2').customClaims.pp.o.a), ['manager', 'manager', 'c'])
})

test('1.32.4 auth claims sync: the home organisation is read even when it does not list the person', async () => {
  const w = world({ 'users/u2': { organizationId: 'organizations/H', role: 'admin' }, 'organizations/H': { creatorUserId: 'someone' } })
  await w.sync.syncPerson('u2')
  assert.deepEqual(plain(w.accounts.get('u2').customClaims.pp.o.h), ['admin', '', 'c', 'h', 'E', 'H'])
  assert.equal(storedOrganizationId('organizations/H'), 'H')
  assert.equal(storedOrganizationId({ path: 'organizations/Q' }), 'Q')
})
