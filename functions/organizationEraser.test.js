'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const canonical = require('./loadCanonical')
const { eraseDueOrganizations } = require('./organizationEraser')

const DAY = 86400000
const NOW = Date.UTC(2027, 0, 10)

function fakeWorld() {
  const docs = new Map([
    ['organizations/DUE', { name: 'Due Ltd', members: { SOLE: 'admin', BOTH: 'manager' }, deletion: { status: 'scheduled', requestedAt: new Date(NOW - 61 * DAY), eraseAfter: new Date(NOW - DAY), restoreBy: 'super_admin' } }],
    ['organizations/DUE/clients/c1', { name: 'Client' }],
    ['organizations/DUE/userEmails/sole@x.com', { userId: 'SOLE' }],
    ['organizations/LATER', { name: 'Later Ltd', deletion: { status: 'scheduled', requestedAt: new Date(NOW - 10 * DAY), eraseAfter: new Date(NOW + 50 * DAY) } }],
    ['organizations/LIVE', { name: 'Live Ltd' }],
    ['users/SOLE', { email: 'sole@x.com', organizationId: 'DUE' }],
    ['users/SOLE/private/taxIds', { utrNumber: '1' }],
    ['users/SOLE/orgMemberships/DUE', { organizationId: 'DUE' }],
    ['users/BOTH', { email: 'both@x.com', organizationId: 'DUE' }],
    ['users/BOTH/orgMemberships/DUE', { organizationId: 'DUE' }],
    ['users/BOTH/orgMemberships/LIVE', { organizationId: 'LIVE' }],
    ['users/OWNER', { email: 'info@projectplanner.us', organizationId: 'DUE' }],
    ['invitations/inv1', { organizationId: 'DUE', email: 'new@x.com' }],
    ['invitations/inv2', { organizationId: 'LIVE', email: 'other@x.com' }],
  ])
  const storage = new Set(['organizations/DUE/branding/logo.png', 'organizations/LIVE/branding/logo.png'])
  const authDeleted = []
  const under = (path) => [...docs.keys()].filter((key) => key === path || key.startsWith(`${path}/`))
  const store = {
    switchOn: true,
    async erasureEnabled() {
      return this.switchOn
    },
    async scheduledOrganizations() {
      return [...docs.entries()]
        .filter(([key, data]) => /^organizations\/[^/]+$/.test(key) && data.deletion && data.deletion.status === 'scheduled')
        .map(([key, data]) => ({ id: key.split('/')[1], data: { id: key.split('/')[1], ...data } }))
    },
    async usersOfOrganization(orgId) {
      return [...docs.entries()]
        .filter(([key, data]) => /^users\/[^/]+$/.test(key) && data.organizationId === orgId)
        .map(([key, data]) => ({ id: key.split('/')[1], data }))
    },
    async membershipsOfOrganization(orgId) {
      return [...docs.entries()]
        .filter(([key, data]) => /^users\/[^/]+\/orgMemberships\/[^/]+$/.test(key) && data.organizationId === orgId)
        .map(([key]) => ({ uid: key.split('/')[1], path: key }))
    },
    async membershipOrgIds(uid) {
      return [...docs.keys()].filter((key) => key.startsWith(`users/${uid}/orgMemberships/`)).map((key) => key.split('/')[3])
    },
    async invitationsOfOrganization(orgId) {
      return [...docs.entries()].filter(([key, data]) => key.startsWith('invitations/') && data.organizationId === orgId).map(([key]) => key)
    },
    async deleteDocument(path) {
      docs.delete(path)
    },
    async deleteRecursive(path) {
      for (const key of under(path)) docs.delete(key)
    },
    async setDocument(path, fields) {
      docs.set(path, { ...(docs.get(path) || {}), ...fields })
    },
  }
  const deps = {
    canonical,
    store,
    now: NOW,
    deleteStoragePrefix: async (prefix) => {
      for (const file of [...storage]) if (file.startsWith(prefix)) storage.delete(file)
    },
    deleteAuthUser: async (uid) => {
      authDeleted.push(uid)
    },
  }
  return { docs, storage, authDeleted, deps }
}

test('eraser: a dry run lists the work and changes nothing', async () => {
  const world = fakeWorld()
  const before = JSON.stringify([...world.docs.entries()])
  const report = await eraseDueOrganizations({ ...world.deps, dryRun: true })
  assert.deepEqual(report.map((row) => row.orgId), ['DUE'])
  assert.ok(report[0].actions.includes('delete organizations/DUE (recursive)'))
  assert.ok(report[0].actions.includes('delete auth SOLE'))
  assert.ok(!report[0].actions.includes('delete auth OWNER'))
  assert.ok(!report[0].actions.some((row) => row.includes('users/BOTH ')))
  assert.equal(JSON.stringify([...world.docs.entries()]), before)
  assert.equal(world.authDeleted.length, 0)
})

test('eraser: erases only the due organisation, keeps people who belong elsewhere, writes the audit row; idempotent', async () => {
  const world = fakeWorld()
  await eraseDueOrganizations(world.deps)
  const keys = [...world.docs.keys()]
  assert.ok(!keys.some((key) => key.startsWith('organizations/DUE')))
  assert.ok(keys.includes('organizations/LATER'))
  assert.ok(keys.includes('organizations/LIVE'))
  assert.ok(!keys.includes('users/SOLE'))
  assert.ok(!keys.includes('users/SOLE/private/taxIds'))
  assert.ok(keys.includes('users/BOTH'))
  assert.ok(!keys.includes('users/BOTH/orgMemberships/DUE'))
  assert.ok(keys.includes('users/BOTH/orgMemberships/LIVE'))
  assert.ok(!keys.includes('invitations/inv1'))
  assert.ok(keys.includes('invitations/inv2'))
  assert.deepEqual([...world.storage], ['organizations/LIVE/branding/logo.png'])
  assert.deepEqual(world.authDeleted, ['SOLE'])
  const audit = world.docs.get('erasedOrganizations/DUE')
  assert.equal(audit.name, 'Due Ltd')
  assert.equal(audit.status, 'erased')
  assert.deepEqual(Object.keys(audit).sort(), ['erasedAt', 'name', 'status'])
  // A second run finds nothing due and changes nothing.
  const again = await eraseDueOrganizations(world.deps)
  assert.deepEqual(again, [])
})

test('eraser: with the kill switch off (or unreadable) every run is a dry run that only reports', async () => {
  for (const setSwitch of [(store) => { store.switchOn = false }, (store) => { store.erasureEnabled = async () => { throw new Error('denied') } }, (store) => { delete store.erasureEnabled }]) {
    const world = fakeWorld()
    setSwitch(world.deps.store)
    const before = JSON.stringify([...world.docs.entries()])
    const logs = []
    const report = await eraseDueOrganizations({ ...world.deps, logger: { info: (...args) => logs.push(args), warn() {} } })
    assert.equal(report.length, 1)
    assert.equal(report[0].dryRun, true)
    assert.deepEqual(report[0].counts, { usersDeleted: 2, usersKept: 1, memberships: 2, invitations: 1 })
    assert.equal(JSON.stringify([...world.docs.entries()]), before)
    assert.equal(world.authDeleted.length, 0)
    assert.equal(world.storage.size, 2)
    assert.ok(logs.some(([message, meta]) => /dry run/.test(message) && meta.orgId === 'DUE' && meta.name === 'Due Ltd'))
  }
})
