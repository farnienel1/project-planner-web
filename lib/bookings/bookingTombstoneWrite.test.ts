import { test } from 'node:test'
import assert from 'node:assert/strict'
import { commitBookingDeleteTolerantly } from './bookingTombstoneWrite.ts'

const refused = () => Promise.reject(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }))
const yes = async () => true
const no = async () => false

test('commitBookingDeleteTolerantly: a normal delete commits', async () => {
  assert.equal(
    await commitBookingDeleteTolerantly({ commit: async () => {}, tombstoneExists: no, bookingExists: yes, deleteAlone: async () => {} }),
    'deleted'
  )
})

test('commitBookingDeleteTolerantly: a booking already deleted and tombstoned elsewhere is a no-op success', async () => {
  let alone = false
  const out = await commitBookingDeleteTolerantly({
    commit: refused,
    tombstoneExists: yes,
    bookingExists: no,
    deleteAlone: async () => {
      alone = true
    },
  })
  assert.equal(out, 'alreadyDeleted')
  assert.equal(alone, false)
})

test('commitBookingDeleteTolerantly: a tombstoned booking still present is deleted alone', async () => {
  let alone = false
  const out = await commitBookingDeleteTolerantly({
    commit: refused,
    tombstoneExists: yes,
    bookingExists: yes,
    deleteAlone: async () => {
      alone = true
    },
  })
  assert.equal(out, 'alreadyDeleted')
  assert.equal(alone, true)
})

test('commitBookingDeleteTolerantly: without a tombstone the refusal stands (never a delete without one)', async () => {
  let alone = false
  await assert.rejects(
    commitBookingDeleteTolerantly({
      commit: refused,
      tombstoneExists: no,
      bookingExists: yes,
      deleteAlone: async () => {
        alone = true
      },
    }),
    /insufficient permissions/
  )
  assert.equal(alone, false)
  await assert.rejects(
    commitBookingDeleteTolerantly({ commit: refused, tombstoneExists: refused, bookingExists: yes, deleteAlone: async () => {} }),
    /insufficient permissions/
  )
  await assert.rejects(
    commitBookingDeleteTolerantly({ commit: refused, tombstoneExists: yes, bookingExists: yes, deleteAlone: refused }),
    /insufficient permissions/
  )
})
