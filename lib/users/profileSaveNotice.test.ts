import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  profileSaveNoticeFor,
  profileSavePendingMessage,
  profileSaveRefusedMessage,
  profileSaveStepFailedMessage,
  profileSaveUnconfirmedMessage,
  useProfileSaveNotice,
  type ProfileSaveTarget,
} from './profileSaveNotice.ts'

// Owner bug 17 Nov: the people list says when a profile save is still waiting for the server, or was refused.

const target = (saveId: number, name = 'Sam Smith', organizationId = 'org-a', personId = 'u1'): ProfileSaveTarget => ({
  saveId,
  organizationId,
  personId,
  name,
})

test('pending, then saved: the notice shows, then clears', () => {
  const store = useProfileSaveNotice.getState()
  store.pending(target(1))
  assert.equal(useProfileSaveNotice.getState().notice?.message, profileSavePendingMessage('Sam Smith'))
  store.settled(target(1), { status: 'saved' })
  assert.equal(useProfileSaveNotice.getState().notice, null)
})

test('pending, then refused: the notice says so and stays until dismissed', () => {
  const store = useProfileSaveNotice.getState()
  store.pending(target(2))
  store.settled(target(2), { status: 'refused', message: 'Missing or insufficient permissions.' })
  const notice = useProfileSaveNotice.getState().notice
  assert.equal(notice?.status, 'refused')
  assert.equal(notice?.message, profileSaveRefusedMessage('Sam Smith', 'Missing or insufficient permissions.'))
  store.dismiss()
  assert.equal(useProfileSaveNotice.getState().notice, null)
})

test("an older save's confirmation never clears a newer save's notice", () => {
  const store = useProfileSaveNotice.getState()
  store.pending(target(3, 'A'))
  store.pending(target(4, 'B'))
  store.settled(target(3, 'A'), { status: 'saved' })
  assert.equal(useProfileSaveNotice.getState().notice?.saveId, 4)
  store.dismiss()
})

// Review of #371.

test('still waiting at the upper limit: the notice turns to "not confirmed" (red), and a late answer still settles it', () => {
  const store = useProfileSaveNotice.getState()
  store.pending(target(5))
  store.settled(target(5), { status: 'unconfirmed' })
  const notice = useProfileSaveNotice.getState().notice
  assert.equal(notice?.status, 'unconfirmed')
  assert.equal(notice?.message, profileSaveUnconfirmedMessage('Sam Smith'))
  assert.match(notice?.message ?? '', /Reload and check this person/)
  store.settled(target(5), { status: 'saved' })
  assert.equal(useProfileSaveNotice.getState().notice, null)
})

test('"not confirmed" never replaces a newer save\'s notice or a dismissed one', () => {
  const store = useProfileSaveNotice.getState()
  store.pending(target(6, 'A'))
  store.pending(target(7, 'B'))
  store.settled(target(6, 'A'), { status: 'unconfirmed' })
  assert.equal(useProfileSaveNotice.getState().notice?.saveId, 7)
  store.dismiss()
  store.settled(target(7, 'B'), { status: 'unconfirmed' })
  assert.equal(useProfileSaveNotice.getState().notice, null)
})

test('a failed follow-on step (active flag, job clean-up) is reported', () => {
  const store = useProfileSaveNotice.getState()
  const message = profileSaveStepFailedMessage('Sam Smith', 'removing them from their jobs', 'denied.')
  store.failed(target(8), message)
  assert.equal(useProfileSaveNotice.getState().notice?.status, 'failed')
  assert.equal(useProfileSaveNotice.getState().notice?.message, message)
  store.dismiss()
})

test('the notice belongs to its organisation and person, and is never shown in another organisation', () => {
  const store = useProfileSaveNotice.getState()
  store.pending(target(9, 'Sam Smith', 'org-a', 'u9'))
  const notice = useProfileSaveNotice.getState().notice
  assert.equal(notice?.organizationId, 'org-a')
  assert.equal(notice?.personId, 'u9')
  assert.equal(profileSaveNoticeFor(notice, 'org-a')?.saveId, 9)
  assert.equal(profileSaveNoticeFor(notice, 'org-b'), null)
  assert.equal(profileSaveNoticeFor(notice, null), null)
})

test('opening another organisation clears the notice; the same organisation keeps it', () => {
  const store = useProfileSaveNotice.getState()
  store.pending(target(10, 'Sam Smith', 'org-a'))
  store.keepOnlyOrganization('org-a')
  assert.equal(useProfileSaveNotice.getState().notice?.saveId, 10)
  store.keepOnlyOrganization('org-b')
  assert.equal(useProfileSaveNotice.getState().notice, null)
})
