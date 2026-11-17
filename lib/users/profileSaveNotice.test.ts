import { test } from 'node:test'
import assert from 'node:assert/strict'
import { profileSavePendingMessage, profileSaveRefusedMessage, useProfileSaveNotice } from './profileSaveNotice.ts'

// Owner bug 17 Nov: the people list says when a profile save is still waiting for the server, or was refused.

test('pending, then saved: the notice shows, then clears', () => {
  const store = useProfileSaveNotice.getState()
  store.pending(1, 'Sam Smith')
  assert.equal(useProfileSaveNotice.getState().notice?.message, profileSavePendingMessage('Sam Smith'))
  store.settled(1, { status: 'saved' }, 'Sam Smith')
  assert.equal(useProfileSaveNotice.getState().notice, null)
})

test('pending, then refused: the notice says so and stays until dismissed', () => {
  const store = useProfileSaveNotice.getState()
  store.pending(2, 'Sam Smith')
  store.settled(2, { status: 'refused', message: 'Missing or insufficient permissions.' }, 'Sam Smith')
  const notice = useProfileSaveNotice.getState().notice
  assert.equal(notice?.status, 'refused')
  assert.equal(notice?.message, profileSaveRefusedMessage('Sam Smith', 'Missing or insufficient permissions.'))
  store.dismiss()
  assert.equal(useProfileSaveNotice.getState().notice, null)
})

test("an older save's confirmation never clears a newer save's notice", () => {
  const store = useProfileSaveNotice.getState()
  store.pending(3, 'A')
  store.pending(4, 'B')
  store.settled(3, { status: 'saved' }, 'A')
  assert.equal(useProfileSaveNotice.getState().notice?.saveId, 4)
  store.dismiss()
})
