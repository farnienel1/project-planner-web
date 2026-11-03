import { test } from 'node:test'
import assert from 'node:assert/strict'
import { documentWriteFields } from '../canonical/peopleDocuments.ts'
import { bookingUpdateWriteFields } from '../canonical/index.ts'
import { changeBase } from './partialWrite.ts'

test('changeBase: the editor\'s loaded copy is the base, so a field changed elsewhere is not written back', () => {
  // The editor opened the job with the old description and changed only the site name. Meanwhile iOS changed
  // the description on the server.
  const opened = { siteName: 'Old site', description: 'Old notes', isLive: true, updatedAt: 'x' }
  const stored = { siteName: 'Old site', description: 'New notes from iOS', isLive: false }
  const next = { siteName: 'New site', description: 'Old notes', isLive: true }
  const write = documentWriteFields(changeBase(opened, stored), next)
  assert.deepEqual(write.set, { siteName: 'New site' })
  assert.deepEqual(write.remove, [])
  // Without a base, the server copy is the base and the stale description and flag would be written.
  const legacy = documentWriteFields(changeBase(null, stored), next)
  assert.deepEqual(Object.keys(legacy.set).sort(), ['description', 'isLive', 'siteName'])
})

test('changeBase: a booking edit writes only the fields the edit changed', () => {
  const opened = { operativeId: 'op1', projectId: 'p1', timeSlot: 'FULL DAY', notes: 'old', status: 'Confirmed' }
  const stored = { ...opened, notes: 'changed on iOS' }
  const next = { ...opened, status: 'Cancelled' }
  const write = bookingUpdateWriteFields(changeBase(opened, stored), next)
  assert.equal(write.set.status, 'Cancelled')
  assert.equal('notes' in write.set, false)
})
