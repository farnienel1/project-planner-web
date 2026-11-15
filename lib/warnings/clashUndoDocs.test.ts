import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLASH_UNDO_LOAD_ERROR, loadClashUndoDocs } from './clashUndoDocs.ts'

test('1.53.0 undo: a failed load of the approval documents stops the undo (never "no documents")', async () => {
  const ok = await loadClashUndoDocs({ acceptedClashes: async () => [{ id: 'A|B' }], resolutions: async () => [{ id: 'A|B' }] })
  assert.deepEqual(ok, { acceptedClashes: [{ id: 'A|B' }], resolutions: [{ id: 'A|B' }] })
  let deletes = 0
  const undo = async () => {
    await loadClashUndoDocs({ acceptedClashes: async () => [], resolutions: async () => Promise.reject(new Error('permission-denied')) })
    deletes += 1 // the delete batch would run here
  }
  await assert.rejects(undo, { message: CLASH_UNDO_LOAD_ERROR })
  assert.equal(deletes, 0)
  await assert.rejects(loadClashUndoDocs({ acceptedClashes: async () => Promise.reject(new Error('offline')), resolutions: async () => [] }), {
    message: CLASH_UNDO_LOAD_ERROR,
  })
})
