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

const fakeFieldValue = { arrayRemove: (...values) => ({ arrayRemove: values }) }

test('a newly registered token is removed from every other account', async () => {
  const db = fakeDb({ ME: { pushTokens: ['tok'] }, OLD: { pushTokens: ['tok', 'x'] }, OTHER: { pushTokens: ['x'] } })
  const writes = await removeTokenFromOtherAccounts({ db, canonical, token: 'tok', ownerUid: 'ME', fieldValue: fakeFieldValue })
  assert.deepEqual(JSON.parse(JSON.stringify(writes)), [{ userId: 'OLD', remove: ['tok'] }])
  assert.equal(db.updates.length, 1)
  assert.equal(db.updates[0].path, 'users/OLD')
})

test('1.17.0: a placeholder users document never owns a token; real accounts keep it', async () => {
  const PLACEHOLDER = '463952DE-0375-435D-8AB3-67570C902C56'
  const REAL = ['8Qnz190EABWbS0t5Oaj0TZaOyfO2', 'Zk3pQ9aLmN0bVc7XyT2rS5uW1eF4', 'Hj6gR2tY8uI0oP4aS1dF3gH5jK7l']
  const docs = { [PLACEHOLDER]: { pushTokens: ['tok'] } }
  for (const id of REAL) docs[id] = { pushTokens: ['tok'] }
  const db = fakeDb(docs)
  const writes = await removeTokenFromOtherAccounts({ db, canonical, token: 'tok', ownerUid: PLACEHOLDER, fieldValue: fakeFieldValue })
  assert.deepEqual(JSON.parse(JSON.stringify(writes)), [{ userId: PLACEHOLDER, remove: ['tok'] }])
  assert.deepEqual(db.updates.map((u) => u.path), [`users/${PLACEHOLDER}`])
  // A real account registering the token takes it from the placeholder too.
  const db2 = fakeDb(docs)
  const writes2 = await removeTokenFromOtherAccounts({ db: db2, canonical, token: 'tok', ownerUid: REAL[0], fieldValue: fakeFieldValue })
  assert.deepEqual(JSON.parse(JSON.stringify(writes2)).map((w) => w.userId), [PLACEHOLDER, REAL[1], REAL[2]])
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
