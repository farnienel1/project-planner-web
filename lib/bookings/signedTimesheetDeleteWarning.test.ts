import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BOOKING_DELETE_SIGNED_TIMESHEET_WARNING } from '@/lib/canonical'
import type { User } from '@/types'
import {
  bookedPersonTimesheetUserIds,
  signedTimesheetCandidatesFromDocs,
  signedTimesheetDeleteWarningFromDocs,
  signedTimesheetWarningForBookings,
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

test('signedTimesheetCandidatesFromDocs: a sheet stored without userId is read through its document id', () => {
  const noUserId = {
    id: 'timesheet_U-SAM_1793404800',
    data: { weekStartKey: '2026-11-01', weekEndKey: '2026-11-15', managerSignedAt: '2026-11-16T09:00:00Z' },
  }
  assert.equal(signedTimesheetCandidatesFromDocs([noUserId], 'Europe/London').length, 1)
  assert.equal(signedTimesheetDeleteWarningFromDocs('2026-11-09', [noUserId], 'Europe/London'), BOOKING_DELETE_SIGNED_TIMESHEET_WARNING)
  // Not a timesheet document id: nothing.
  assert.equal(signedTimesheetCandidatesFromDocs([{ id: 'jobTypes', data: noUserId.data }], 'Europe/London').length, 0)
})

// Replace (rulebook 1.41.0 §5): the signed-timesheet warning reads the same people and sheets as the delete notice.
test('signedTimesheetWarningForBookings: a booking under an operatives row finds the sheet filed under a former id', async () => {
  const asked: string[][] = []
  const filedUnderFormerId = { ...signedByPerson, id: 'timesheet_invite-sam_1793404800', data: { ...signedByPerson.data, userId: 'invite-sam' } }
  const warning = await signedTimesheetWarningForBookings({
    bookings: [{ personId: 'OP-ROW-1', dayKey: '2026-11-09' }],
    users,
    operatives: [{ id: 'OP-ROW-1', email: 'sam@example.com' }],
    timeZone: 'Europe/London',
    loadDocs: async (ids) => {
      asked.push(ids)
      return ids.includes('invite-sam') ? [filedUnderFormerId] : []
    },
  })
  assert.equal(warning, BOOKING_DELETE_SIGNED_TIMESHEET_WARNING)
  assert.ok(asked[0].includes('U-SAM') && asked[0].includes('invite-sam') && asked[0].includes('OP-ROW-1'))
})

test('signedTimesheetWarningForBookings: a sheet stored without userId (named in its document id) still warns', async () => {
  const { userId: _unused, ...withoutUserId } = signedByPerson.data
  const warning = await signedTimesheetWarningForBookings({
    bookings: [{ personId: 'U-SAM', dayKey: '2026-11-09' }],
    users,
    operatives: [],
    timeZone: 'Europe/London',
    loadDocs: async () => [{ id: signedByPerson.id, data: withoutUserId }],
  })
  assert.equal(warning, BOOKING_DELETE_SIGNED_TIMESHEET_WARNING)
})

test('signedTimesheetWarningForBookings: unsigned or outside days, a failed read, or no day give no warning', async () => {
  const base = { users, operatives: [], timeZone: 'Europe/London' }
  assert.equal(await signedTimesheetWarningForBookings({ ...base, bookings: [{ personId: 'U-SAM', dayKey: '2026-11-20' }], loadDocs: async () => [signedByPerson, unsigned] }), null)
  assert.equal(
    await signedTimesheetWarningForBookings({ ...base, bookings: [{ personId: 'U-SAM', dayKey: '2026-11-09' }], loadDocs: async () => { throw new Error('permission-denied') } }),
    null
  )
  assert.equal(await signedTimesheetWarningForBookings({ ...base, bookings: [{ personId: 'U-SAM', dayKey: null }], loadDocs: async () => [signedByPerson] }), null)
})

test('signedTimesheetWarningForBookings: any one replaced booking on a signed day warns', async () => {
  const warning = await signedTimesheetWarningForBookings({
    bookings: [
      { personId: 'U-OTHER', dayKey: '2026-11-09' },
      { personId: 'U-SAM', dayKey: '2026-11-09' },
    ],
    users,
    operatives: [],
    timeZone: 'Europe/London',
    loadDocs: async (ids) => (ids.includes('U-SAM') ? [signedByPerson] : []),
  })
  assert.equal(warning, BOOKING_DELETE_SIGNED_TIMESHEET_WARNING)
})
