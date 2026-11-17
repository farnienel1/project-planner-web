import assert from 'node:assert/strict'
import test from 'node:test'
import { loadRulebook } from '../data-cleanup/checks.mjs'
import { emptySnapshotRows } from './plan.mjs'

const rulebook = loadRulebook()
const tz = 'Europe/London'
const at = (iso) => ({ seconds: Date.parse(iso) / 1000, nanoseconds: 0 })

function sheet({ id = 'timesheet_u1_1793491200', exported = false, lines = [] } = {}) {
  return {
    id,
    data: {
      userId: 'u1',
      weekStart: at('2026-11-01T00:00:00Z'),
      weekEndKey: '2026-11-15',
      operativeSignedAt: at('2026-11-14T10:00:00Z'),
      managerSignedAt: at('2026-11-14T11:00:00Z'),
      weeklyReportOverride: { approvedAt: at('2026-11-14T11:00:00Z'), lines, priceWork: [{ id: 'pw', amount: 195 }] },
      ...(exported ? { exportedAt: at('2026-11-15T09:00:00Z') } : {}),
    },
  }
}
const labour = (id, { person = 'u1', written = '2026-11-09T09:00:00Z', status = 'Confirmed', day = '2026-11-10' } = {}) => ({
  collection: 'bookings',
  id,
  data: { operativeId: person, projectId: 'p1', date: at(`${day}T00:00:00Z`), timeSlot: 'FULL DAY', status, createdAt: at(written), updatedAt: at(written) },
})
const users = [
  { id: 'u1', data: { email: 'farnie@x.com', firstName: 'Farnie', surname: 'Nel', formerUserIds: ['old-invite'] } },
  { id: 'u1-copy', data: { email: 'FARNIE@x.com' } },
]
const input = (over = {}) => ({ timeZone: tz, users, operatives: [], sheets: [sheet()], bookings: [labour('b1')], ...over })

test('lists an unexported signed sheet whose snapshot was frozen with no labour (owner: Farnie 1–15 Nov)', () => {
  const rows = emptySnapshotRows(rulebook, input())
  assert.equal(rows.length, 1)
  assert.deepEqual(
    { documentId: rows[0].documentId, name: rows[0].name, start: rows[0].startDayKey, end: rows[0].endDayKey, bookings: rows[0].bookings },
    { documentId: 'timesheet_u1_1793491200', name: 'Farnie Nel', start: '2026-11-01', end: '2026-11-15', bookings: 1 }
  )
})

test('bookings under every id the person goes by count (former invite id, same-email document)', () => {
  assert.equal(emptySnapshotRows(rulebook, input({ bookings: [labour('b1', { person: 'OLD-INVITE' })] })).length, 1)
  assert.equal(emptySnapshotRows(rulebook, input({ bookings: [labour('b1', { person: 'u1-copy' })] })).length, 1)
  assert.equal(emptySnapshotRows(rulebook, input({ bookings: [labour('b1', { person: 'someone-else' })] })).length, 0)
})

test('not listed: exported, a snapshot with labour lines, bookings written after approval, outside the run, cancelled, older version', () => {
  assert.equal(emptySnapshotRows(rulebook, input({ sheets: [sheet({ exported: true })] })).length, 0)
  assert.equal(emptySnapshotRows(rulebook, input({ sheets: [sheet({ lines: [{ id: 'op-b1-normal', bookingId: 'b1' }] })] })).length, 0)
  assert.equal(emptySnapshotRows(rulebook, input({ bookings: [labour('b1', { written: '2026-11-14T12:00:00Z' })] })).length, 0)
  assert.equal(emptySnapshotRows(rulebook, input({ bookings: [labour('b1', { day: '2026-11-20' })] })).length, 0)
  assert.equal(emptySnapshotRows(rulebook, input({ bookings: [labour('b1', { status: 'Cancelled' })] })).length, 0)
  const rebuilt = sheet({ id: 'timesheet_u1_1793491200_rev1', lines: [{ id: 'op-b1-normal', bookingId: 'b1' }] })
  assert.equal(emptySnapshotRows(rulebook, input({ sheets: [sheet(), rebuilt] })).length, 0)
})
