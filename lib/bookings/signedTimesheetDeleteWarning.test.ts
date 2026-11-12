import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BOOKING_DELETE_SIGNED_TIMESHEET_WARNING } from '@/lib/canonical'
import type { User } from '@/types'
import {
  bookedPersonTimesheetUserIds,
  signedTimesheetCandidatesFromDocs,
  signedTimesheetDeleteWarningFromDocs,
} from './signedTimesheetDeleteWarning.ts'

const user = (fields: Partial<User> & { id: string }) =>
  ({ firstName: 'A', surname: 'B', email: '', isActive: true, passwordSet: true, permissions: {}, ...fields }) as unknown as User

const sam = user({ id: 'U-SAM', email: 'sam@example.com', formerUserIds: ['invite-sam'] })
const other = user({ id: 'U-OTHER', email: 'other@example.com' })
const users = [sam, other]

test('bookedPersonTimesheetUserIds: a booking under the users id gives every id the person goes by', () => {
  const ids = bookedPersonTimesheetUserIds('U-SAM', users, [])
  assert.ok(ids.includes('U-SAM'))
  assert.ok(ids.includes('invite-sam'))
  assert.ok(!ids.includes('U-OTHER'))
})

test('bookedPersonTimesheetUserIds: an operatives row on the email, a former id and another letter case resolve to the account', () => {
  const operatives = [{ id: 'OP-ROW-1', email: 'SAM@example.com' }]
  assert.ok(bookedPersonTimesheetUserIds('OP-ROW-1', users, operatives).includes('U-SAM'))
  assert.ok(bookedPersonTimesheetUserIds('invite-sam', users, []).includes('U-SAM'))
  assert.ok(bookedPersonTimesheetUserIds('u-sam', users, []).includes('U-SAM'))
})

test('bookedPersonTimesheetUserIds: no account on the roster keeps the stored id; blank gives none', () => {
  assert.deepEqual(bookedPersonTimesheetUserIds('CATALOGUE-ONLY', users, []), ['CATALOGUE-ONLY'])
  assert.deepEqual(bookedPersonTimesheetUserIds('  ', users, []), [])
  assert.deepEqual(bookedPersonTimesheetUserIds(null, users, []), [])
})

const signedByPerson = {
  id: 'timesheet_U-SAM_1793404800',
  data: {
    userId: 'U-SAM',
    weekStartKey: '2026-11-01',
    weekEndKey: '2026-11-15',
    operativeSignedAt: '2026-11-15T17:00:00Z',
    operativeSignedByName: 'Sam B',
  },
}
const unsigned = { id: 'timesheet_U-SAM_1794614400', data: { userId: 'U-SAM', weekStartKey: '2026-11-16', weekEndKey: '2026-11-30' } }
const notATimesheet = { id: 'jobTypes', data: { userId: 'U-SAM', weekStartKey: '2026-11-01', weekEndKey: '2026-11-15' } }

test('signedTimesheetCandidatesFromDocs: only timesheet documents, with their pay run', () => {
  const rows = signedTimesheetCandidatesFromDocs([signedByPerson, unsigned, notATimesheet], 'Europe/London')
  assert.equal(rows.length, 2)
  assert.equal(rows[0].startDayKey, '2026-11-01')
  assert.equal(rows[0].endDayKey, '2026-11-15')
})

test('signedTimesheetDeleteWarningFromDocs: warns on a signed day, never on an unsigned or outside day', () => {
  const docs = [signedByPerson, unsigned]
  assert.equal(signedTimesheetDeleteWarningFromDocs('2026-11-09', docs, 'Europe/London'), BOOKING_DELETE_SIGNED_TIMESHEET_WARNING)
  assert.equal(signedTimesheetDeleteWarningFromDocs('2026-11-20', docs, 'Europe/London'), null)
  assert.equal(signedTimesheetDeleteWarningFromDocs('2026-10-31', docs, 'Europe/London'), null)
  assert.equal(signedTimesheetDeleteWarningFromDocs('2026-11-09', [], 'Europe/London'), null)
})

test('signedTimesheetDeleteWarningFromDocs: an exported sheet warns too', () => {
  const exported = { id: 'timesheet_U-SAM_x', data: { userId: 'U-SAM', weekStartKey: '2026-11-01', weekEndKey: '2026-11-15', exportedAt: '2026-11-16T09:00:00Z' } }
  assert.equal(signedTimesheetDeleteWarningFromDocs('2026-11-02', [exported], 'Europe/London'), BOOKING_DELETE_SIGNED_TIMESHEET_WARNING)
})
