'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const canonical = require('./loadCanonical')
const { removeTokenFromOtherAccounts } = require('./pushTokenOwner')

function fakeDb(docs) {
  const updates = []
  return {
    updates,
    collection: () => ({
      where: (field, op, value) => ({
        get: async () => ({
          docs: Object.entries(docs)
            .filter(([, data]) => op === 'array-contains' && (data[field] || []).includes(value))
            .map(([id, data]) => ({ id, data: () => data })),
        }),
      }),
    }),
    doc: (path) => path,
    batch: () => ({
      update: (path, fields) => updates.push({ path, fields }),
      commit: async () => undefined,
    }),
  }
}

test('a newly registered token is removed from every other account', async () => {
  const db = fakeDb({ ME: { pushTokens: ['tok'] }, OLD: { pushTokens: ['tok', 'x'] }, OTHER: { pushTokens: ['x'] } })
  const writes = await removeTokenFromOtherAccounts({ db, canonical, token: 'tok', ownerUid: 'ME' })
  assert.deepEqual(JSON.parse(JSON.stringify(writes)), [{ userId: 'OLD', remove: ['tok'] }])
  assert.equal(db.updates.length, 1)
  assert.equal(db.updates[0].path, 'users/OLD')
})

test('nothing is written when only the owner holds the token', async () => {
  const db = fakeDb({ ME: { pushTokens: ['tok'] } })
  assert.equal((await removeTokenFromOtherAccounts({ db, canonical, token: "tok", ownerUid: "ME" })).length, 0)
  assert.equal(db.updates.length, 0)
})

test('the push payload and actor-token skip come from the packed rulebook', () => {
  assert.deepEqual([...canonical.pushTokensExcludingActor(["a", "b"], ["b"])], ["a"])
  const payload = canonical.pushPayloadFields({ notificationId: 'N', type: 'booking_created', userId: 'U', organizationId: 'O', dayKey: '2026-11-03' })
  assert.deepEqual([...Object.keys(payload)], ['notificationId', 'type', 'dayKey', 'userId', 'organizationId'])
})
