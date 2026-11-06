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

test('createWritePayload: a new manager site booking carries no deleteField (bug 6 Nov: admin booking themself)', async () => {
  const { deleteField, serverTimestamp } = await import('firebase/firestore')
  const { serializeManagerSiteBooking, serializeBooking } = await import('../ios-parity/converters.ts')
  const { createWritePayload } = await import('./partialWrite.ts')
  const isDelete = (v: unknown) => !!v && typeof v === 'object' && (v as { _methodName?: string })._methodName === 'deleteField'
  const now = new Date('2026-11-06T09:00:00Z')
  // A project booking for the admin themself: no custom place name, no clock times, no booking group.
  const managerPayload = serializeManagerSiteBooking({
    id: 'B33C0E70-8C0B-472D-8FC6-267002FAC471',
    userId: 'admin-1',
    date: now,
    timeSlot: 'FULL DAY',
    locationType: 'project',
    locationId: 'job-1',
    isBreakRemoved: false,
    createdAt: now,
    updatedAt: now,
    organizationId: 'org-1',
  } as Parameters<typeof serializeManagerSiteBooking>[0])
  assert.ok(Object.values(managerPayload).some(isDelete), 'the serializer marks empty fields for removal (edit path)')
  const create = createWritePayload({ ...managerPayload, updatedAt: serverTimestamp() })
  assert.equal(Object.values(create).some(isDelete), false)
  assert.equal('customLocationName' in create, false)
  assert.equal(create.locationId, 'job-1')
  assert.equal((create.updatedAt as { _methodName?: string })._methodName, 'serverTimestamp')
  // Labour booking creates use the same helper: removal markers left out, everything else kept.
  const labour = createWritePayload({ projectId: 'job-1', workStartTime: deleteField(), bookingGroupId: deleteField(), status: 'Confirmed' })
  assert.deepEqual(Object.keys(labour), ['projectId', 'status'])
  assert.ok(isDelete(deleteField()))
})
