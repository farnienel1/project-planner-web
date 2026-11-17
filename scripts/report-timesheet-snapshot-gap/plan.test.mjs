import assert from 'node:assert/strict'
import test from 'node:test'
import { loadRulebook } from '../data-cleanup/checks.mjs'
import { snapshotGapCounts } from './plan.mjs'

const rulebook = loadRulebook()
const tz = 'Europe/London'
const at = (iso) => ({ seconds: Date.parse(iso) / 1000, nanoseconds: 0 })
const fp = (id, day) => rulebook.overtimeBookingFingerprint({ id, personId: '', dayKey: day, timeSlot: 'FULL DAY', isBreakRemoved: false, otMultiplierOverride: null })

function sheet({ id = 'timesheet_u1_1793491200', exported = false, lines, record = ['b1', 'b2'] } = {}) {
  return {
    id,
    data: {
      userId: 'u1',
      weekStart: at('2026-11-01T00:00:00Z'),
      weekEndKey: '2026-11-15',
      operativeSignedAt: at('2026-11-14T10:00:00Z'),
      operativeSignedBookings: record.map((b) => ({ bookingId: b, collection: 'bookings', fingerprint: fp(b, '2026-11-10'), personId: 'u1-copy', place: 'job|p1' })),
      operativeSignedBookingsSignedAt: at('2026-11-14T10:00:00Z'),
      operativeSignedBookingsAt: at('2026-11-14T10:00:01Z'),
      managerSignedAt: at('2026-11-14T11:00:00Z'),
      weeklyReportOverride: { approvedAt: at('2026-11-14T11:00:00Z'), lines: lines ?? [{ id: 'op-b2-normal', bookingId: 'b2', bookingFingerprint: fp('b2', '2026-11-10') }] },
      ...(exported ? { exportedAt: at('2026-11-15T09:00:00Z') } : {}),
    },
  }
}
const booking = (person = 'u1-copy', status = 'Confirmed', written = '2026-11-09T09:00:00Z') => ({ operativeId: person, projectId: 'p1', date: at('2026-11-10T00:00:00Z'), timeSlot: 'FULL DAY', status, createdAt: at(written), updatedAt: at(written) })
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
  assert.deepEqual(snapshotGapCounts(rulebook, base({ sheets: [sheet()] })), { sheetsChecked: 1, exported: 0, notExported: 1, gapOnly: 1, otherChange: 0, emptySnapshotRepair: 0, noRecord: 0 })
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
  assert.deepEqual(snapshotGapCounts(rulebook, base({ sheets: [sheet(), complete] })), { sheetsChecked: 1, exported: 0, notExported: 0, gapOnly: 0, otherChange: 0, emptySnapshotRepair: 0, noRecord: 0 })
})

test('empty signed copies: only the rule repair predicate counts as repaired on open', () => {
  // Unexported, bookings written before approval: repaired when a reviewer opens it.
  assert.equal(snapshotGapCounts(rulebook, base({ sheets: [sheet({ lines: [] })] })).emptySnapshotRepair, 1)
  // Exported: never repaired, so the gap rule reads it ("Revision due").
  const exported = snapshotGapCounts(rulebook, base({ sheets: [sheet({ lines: [], exported: true })] }))
  assert.equal(exported.emptySnapshotRepair, 0)
  assert.equal(exported.exported, 1)
  // Bookings all written after approval: not repaired, and already flagged before 1.57.0 (added after signing).
  const late = new Map([
    ['bookings|b1', booking('u1-copy', 'Confirmed', '2026-11-14T12:00:00Z')],
    ['bookings|b2', booking('u1-copy', 'Confirmed', '2026-11-14T12:00:00Z')],
  ])
  const after = snapshotGapCounts(rulebook, base({ sheets: [sheet({ lines: [] })], bookings: late }))
  assert.equal(after.emptySnapshotRepair, 0)
  assert.equal(after.notExported, 0)
  assert.equal(after.otherChange, 1)
})

test('a signed line with only an op-<id>-normal id names its booking, as the rule reads it', () => {
  const lines = [{ id: 'op-b1-normal' }, { id: 'op-b2-normal' }]
  assert.deepEqual(snapshotGapCounts(rulebook, base({ sheets: [sheet({ lines })] })), { sheetsChecked: 1, exported: 0, notExported: 0, gapOnly: 0, otherChange: 0, emptySnapshotRepair: 0, noRecord: 0 })
})

test('the 1.47.0 rule sees changes and removals of signed bookings (documents passed), so the split columns are its own answer', () => {
  // b1 is the gap; b2 (on the signed copy) changed its slot after signing: a real change, so the gap is not gap-only.
  const changed = new Map([
    ['bookings|b1', booking()],
    ['bookings|b2', { ...booking(), timeSlot: 'AM' }],
  ])
  const counts = snapshotGapCounts(rulebook, base({ sheets: [sheet()], bookings: changed }))
  assert.equal(counts.notExported, 1)
  assert.equal(counts.gapOnly, 0)
  // b2 deleted (no document): removed, a 1.47.0 change.
  const removed = snapshotGapCounts(rulebook, base({ sheets: [sheet()], bookings: new Map([['bookings|b1', booking()]]) }))
  assert.equal(removed.otherChange + removed.notExported, 1)
  assert.equal(removed.gapOnly, 0)
})
