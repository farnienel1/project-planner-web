import assert from 'node:assert/strict'
import test from 'node:test'
import { loadRulebook } from '../data-cleanup/checks.mjs'
import { snapshotGapCounts } from './plan.mjs'

const rulebook = loadRulebook()
const tz = 'Europe/London'
const at = (iso) => ({ seconds: Date.parse(iso) / 1000, nanoseconds: 0 })
const fp = (id, day) => `${id}|${day}|FULL DAY||||0|`

function sheet({ id = 'timesheet_u1_1793491200', exported = false, lines, record = ['b1', 'b2'] } = {}) {
  return {
    id,
    data: {
      userId: 'u1',
      weekStart: at('2026-11-01T00:00:00Z'),
      weekEndKey: '2026-11-15',
      operativeSignedAt: at('2026-11-14T10:00:00Z'),
      operativeSignedBookings: record.map((b) => ({ bookingId: b, collection: 'bookings', fingerprint: fp(b, '2026-11-10'), personId: 'u1-copy', place: 'p1' })),
      operativeSignedBookingsSignedAt: at('2026-11-14T10:00:00Z'),
      operativeSignedBookingsAt: at('2026-11-14T10:00:01Z'),
      managerSignedAt: at('2026-11-14T11:00:00Z'),
      weeklyReportOverride: { approvedAt: at('2026-11-14T11:00:00Z'), lines: lines ?? [{ id: 'op-b2-normal', bookingId: 'b2', bookingFingerprint: fp('b2', '2026-11-10') }] },
      ...(exported ? { exportedAt: at('2026-11-15T09:00:00Z') } : {}),
    },
  }
}
const booking = (person = 'u1-copy', status = 'Confirmed') => ({ operativeId: person, projectId: 'p1', date: at('2026-11-10T00:00:00Z'), timeSlot: 'FULL DAY', status })
const users = [
  { id: 'u1', data: { email: 'f@x.com' } },
  { id: 'u1-copy', data: { email: 'F@x.com' } },
]
const base = (over = {}) => ({
  timeZone: tz,
  users,
  operatives: [],
  bookings: new Map([
    ['bookings|b1', booking()],
    ['bookings|b2', booking()],
  ]),
  tombstoned: new Set(),
  ...over,
})

test('a signed copy missing a live signed booking counts, split by exported', () => {
  assert.deepEqual(snapshotGapCounts(rulebook, base({ sheets: [sheet()] })), { sheetsChecked: 1, exported: 0, notExported: 1, emptySnapshotRepair: 0, noRecord: 0 })
  assert.equal(snapshotGapCounts(rulebook, base({ sheets: [sheet({ exported: true })] })).exported, 1)
})

test('not counted: deleted, tombstoned, cancelled, someone else, empty snapshot, no record, older version', () => {
  assert.equal(snapshotGapCounts(rulebook, base({ sheets: [sheet()], bookings: new Map([['bookings|b2', booking()]]) })).notExported, 0)
  assert.equal(snapshotGapCounts(rulebook, base({ sheets: [sheet()], tombstoned: new Set(['bookings|b1']) })).notExported, 0)
  assert.equal(snapshotGapCounts(rulebook, base({ sheets: [sheet()], bookings: new Map([['bookings|b1', booking('u1-copy', 'Cancelled')]]) })).notExported, 0)
  assert.equal(snapshotGapCounts(rulebook, base({ sheets: [sheet()], bookings: new Map([['bookings|b1', booking('someone')]]) })).notExported, 0)
  assert.equal(snapshotGapCounts(rulebook, base({ sheets: [sheet({ lines: [] })] })).emptySnapshotRepair, 1)
  assert.equal(snapshotGapCounts(rulebook, base({ sheets: [sheet({ record: [] })] })).noRecord, 1)
  // An older version is ignored; the latest (complete) one counts nothing.
  const complete = sheet({ id: 'timesheet_u1_1793491200_rev1', lines: [{ id: 'op-b1-normal', bookingId: 'b1', bookingFingerprint: fp('b1', '2026-11-10') }, { id: 'op-b2-normal', bookingId: 'b2', bookingFingerprint: fp('b2', '2026-11-10') }] })
  assert.deepEqual(snapshotGapCounts(rulebook, base({ sheets: [sheet(), complete] })), { sheetsChecked: 1, exported: 0, notExported: 0, emptySnapshotRepair: 0, noRecord: 0 })
})
