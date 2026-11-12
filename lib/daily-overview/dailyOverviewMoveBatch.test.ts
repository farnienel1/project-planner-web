/**
 * Rulebook 1.39.0 (owner answer 11 Nov, item 4): moving a Daily Overview booking between `bookings` and
 * `managerSiteBookings` is one batch — the new booking, the old booking's delete and its tombstone — so a refused or
 * failed write leaves both bookings as they were. A source guard: the sheet never creates then deletes in two writes.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('1.39.0: the Daily Overview booking sheet moves a booking in one batch, never create-then-delete', () => {
  const sheet = read('../../components/daily-overview/DailyOverviewBookingSheet.tsx')
  assert.doesNotMatch(sheet, /deleteManagerSiteBooking\(/)
  assert.doesNotMatch(sheet, /deleteBooking\(/)
  assert.doesNotMatch(sheet, /\bcreateBooking\(/)
  assert.doesNotMatch(sheet, /\bsaveManagerSiteBooking\(/)
  assert.match(sheet, /moveManagerSiteBookingIntoBookings\(/)
  assert.match(sheet, /moveBookingIntoManagerSchedule\(/)
})

test('1.39.0: each move writes the create, the delete and its tombstone in a single batch commit', () => {
  for (const [path, name] of [
    ['../stores/bookingStore.ts', 'moveManagerSiteBookingIntoBookings: async'],
    ['../stores/managerScheduleStore.ts', 'moveBookingIntoManagerSchedule: async'],
  ] as const) {
    const source = read(path)
    const start = source.indexOf(name)
    assert.ok(start > 0, `${name} exists`)
    const body = source.slice(start, source.indexOf('\n  },\n', start))
    assert.match(body, /writeBatch\(firestore\)/)
    assert.match(body, /batch\.set\(/)
    assert.match(body, /addBookingDeleteWithTombstone\(firestore, batch,/)
    assert.equal(body.match(/batch\.commit\(\)/g)?.length, 1)
    assert.doesNotMatch(body, /setDoc\(|deleteDoc\(|deleteBookingWithTombstone\(/)
  }
})
