/**
 * Scan 16 Nov: the booking flows check clashes against both booking collections (rulebook §5 `bookingRequestClashIds`,
 * "labour or manager schedule", under every id the person goes by), and Daily Overview never guesses a person.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (file: string) => readFileSync(file, 'utf8')

test('Book labour checks every person through clashRowsFor (both collections), with no own clash lists', () => {
  const source = read('components/book-labour/BookLabourFlowScreen.tsx')
  assert.match(source, /leaveCheck\s*\.clashRowsFor\(/)
  assert.doesNotMatch(source, /function managerClashLines|function operativeClashLines|function clashIdsOnDay/)
  assert.doesNotMatch(source, /managerSiteBookings\.filter\(\(booking\) => booking\.userId === userId\)/)
})

test('clashRowsFor reads labour and manager schedule bookings under personIdSet', () => {
  const source = read('components/scheduling/useLeaveConflictCheck.ts')
  assert.match(source, /personIdSet\(\{ id, email: person\.email \?\? null \}, users\)/)
  assert.match(source, /const userIds = new Set\(accountIds\.map/)
})

test('My Schedule self-booking passes the viewer\'s labour bookings to bookingRequestClashIds', () => {
  const source = read('components/schedule/MyScheduleSelfBookingScreen.tsx')
  assert.match(source, /\(labourClashBookings \?\? assignedBookings\)\.filter/)
  assert.match(source, /id: `o:\$\{row\.id\}`/)
  const page = read('app/dashboard/my-schedule/page.tsx')
  assert.match(page, /workStartTime: booking\.workStartTime \?\? null/)
  // Review L4: Completed labour bookings occupy their day and are in the clash input.
  assert.match(page, /filter\(\(booking\) => bookingOccupiesDay\(booking\.status\)\)/)
  assert.match(page, /labourClashBookings=\{labourClashBookings\}/)
})

test('Daily Overview resolves the booked account through the rulebook and refuses Other without one', () => {
  const build = read('lib/daily-overview/buildDailyOverview.ts')
  assert.match(build, /bookingRowUser\(b\.operativeId\)/)
  assert.match(build, /const bookingRowUser = bookingRowUserResolver\(/)
  assert.doesNotMatch(build, /row\.email\.trim\(\)\.toLowerCase\(\) === op\.email/)
  const sheet = read('components/daily-overview/DailyOverviewBookingSheet.tsx')
  assert.doesNotMatch(sheet, /entry\.email\.trim\(\)\.toLowerCase\(\) === op\.email/)
  const other = sheet.slice(sheet.indexOf('const saveToOther'))
  assert.ok(other.indexOf('if (!resolvedUserId)') < other.indexOf('leaveConfirmed()'), 'refused before any check or write')
})
