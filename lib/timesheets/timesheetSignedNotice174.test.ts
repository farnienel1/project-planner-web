import { test } from 'node:test'
import assert from 'node:assert/strict'
import { notifyTimesheetSignedByManager } from './timesheetNotifications.ts'
import type { User } from '../../types/index.ts'

const person = { id: 'op1', firstName: 'Sam', surname: 'Op', email: 'sam@test.com', organizationId: 'org', isActive: true, passwordSet: true, assignedManagerUserIds: ['lm1'] } as unknown as User
const lm = { id: 'lm1', firstName: 'Pat', surname: 'Lee', email: 'pat@test.com', organizationId: 'org', isActive: true, passwordSet: true, manager: true, role: 'manager' } as unknown as User

async function rows(changedByReviewer: boolean) {
  const saved: Array<Record<string, unknown>> = []
  await notifyTimesheetSignedByManager({
    organizationId: 'org', subjectUser: person, signedByName: 'Pat Lee', signedByUserId: 'lm1', users: [person, lm],
    weekStart: new Date('2026-11-01T00:00:00Z'), weekEnd: new Date('2026-11-15T00:00:00Z'), timeZone: 'Europe/London',
    signedAt: new Date('2026-11-20T09:00:00Z'), changedByReviewer, save: async (input) => { saved.push(input as never) },
  })
  return saved.filter((row) => row.type === 'timesheet_signed_by_manager')
}

test('1.74.0: the counter-sign notice to the person uses the "updated" wording when the line manager changed the sheet', async () => {
  const plain = await rows(false)
  assert.equal(plain.length, 1)
  assert.equal(plain[0].title, 'Timesheet signed')
  const changed = await rows(true)
  assert.equal(changed.length, 1)
  assert.equal(changed[0].title, 'Your timesheet was updated and signed off')
  assert.equal(changed[0].message, 'Pat Lee changed your timesheet and signed it off. Open it to check the changes. Next: generate your invoice.')
  // Same type, id and deep link: it opens the person's timesheet for that pay run.
  assert.equal(changed[0].id, plain[0].id)
  assert.equal(changed[0].deepLinkUserId, 'op1')
})
