/**
 * Rulebook 1.9.0 web wiring: live listeners, partial writes and the hunt fixes. Source checks where the code needs
 * Firebase; behaviour checks where it does not.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dayKey, londonMidnight } from '../ios-parity/londonTime.ts'
import { setActiveOrganizationTimeZone } from '../orgTime/activeOrganizationZone.ts'

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

test('H1: date helpers default to the open organisation zone, not always London', () => {
  const instant = new Date('2026-11-02T03:30:00Z') // 2 Nov in London, 1 Nov in New York
  try {
    setActiveOrganizationTimeZone('America/New_York')
    assert.equal(dayKey(instant), '2026-11-01')
    assert.equal(londonMidnight(instant).toISOString(), '2026-11-01T04:00:00.000Z')
    setActiveOrganizationTimeZone('Europe/London')
    assert.equal(dayKey(instant), '2026-11-02')
  } finally {
    setActiveOrganizationTimeZone(null)
  }
  for (const path of ['lib/stores/bookingStore.ts', 'lib/stores/managerScheduleStore.ts']) {
    assert.match(read(path), /organizationZoneOr\(\)/, path)
  }
  assert.match(read('lib/daily-overview/buildDailyOverview.ts'), /coversCalendarDay\(b\.date, day, zone\)/)
})

test('1.9.0 live: shared collections load through live listeners scoped to the open organisation', () => {
  for (const [path, collection] of [
    ['lib/stores/projectStore.ts', "'projects'"],
    ['lib/stores/projectStore.ts', "'smallWorks'"],
    ['lib/stores/projectStore.ts', "'clients'"],
    ['lib/stores/operativeStore.ts', "'operatives'"],
    ['lib/stores/operativeStore.ts', "'managers'"],
    ['lib/stores/holidayStore.ts', "'holidayBookings'"],
    ['lib/stores/taskStore.ts', "'tasks'"],
    ['lib/stores/subcontractorStore.ts', "'subcontractors'"],
    ['lib/stores/siteAuditStore.ts', "'siteAudits'"],
    ['lib/stores/wholesalerStore.ts', "'wholesalers'"],
    ['lib/stores/materialCatalogStore.ts', "'materialCatalogue'"],
  ] as const) {
    const source = read(path)
    assert.match(source, new RegExp(`subscribeOrgCollectionLoaded\\([^)]*${collection}`), `${path} ${collection}`)
    assert.match(source, /liveResultStillCurrent\(organizationId\)/, path)
  }
  const auth = read('lib/stores/authStore.ts')
  const adopts = auth.match(/adoptCurrentOrganization\(/g)?.length ?? 0
  const teardowns = auth.match(/unsubscribeOrgCollectionsOutside\(currentOrganizationId\(\)\)/g)?.length ?? 0
  assert.ok(adopts > 0 && teardowns === adopts, 'every organisation switch tears listeners down')
  assert.match(read('components/schedule/ScheduleScreen.tsx'), /if \(isPersonal && holidayOrgId\) void loadHolidayBookings\(holidayOrgId\)/)
  assert.match(read('app/dashboard/warnings/page.tsx'), /watchAcceptedBookingClashes\(orgId/)
  assert.match(read('app/dashboard/warnings/page.tsx'), /watchDismissedWarnings\(orgId/)
  assert.match(read('components/home/HomeScreen.tsx'), /watchResolvedWarningKeys\(orgId/)
  assert.match(read('components/timesheets/TimesheetPeriodPage.tsx'), /watchOrgDocument\(orgId, \['settings', docId\]/)
  assert.match(read('components/daily-overview/DailyOverviewScreen.tsx'), /watchSubcontractorBookings\(/)
})

test('1.9.0: job types recovered on load are shown, never written', () => {
  const source = read('lib/jobTypes/jobTypesStorage.ts')
  const recover = source.slice(source.indexOf('export async function recoverJobTypesFromWork'), source.indexOf('export async function saveJobTypes'))
  assert.doesNotMatch(recover, /persistJobTypes\(/)
})

test('1.9.0 edits of a record deleted elsewhere are refused, never re-created', () => {
  assert.match(read('lib/stores/projectStore.ts'), /missing: isNew \? 'create' : 'refuse'/)
  assert.match(read('lib/stores/taskStore.ts'), /missing: isNew \? 'create' : 'refuse'/)
  assert.match(read('lib/stores/operativeStore.ts'), /get\(\)\.operatives\.some\(\(row\) => row\.id === id\) \? 'refuse' : 'create'/)
})

test('M9: manager site booking edits are partial; creates carry write metadata', () => {
  const source = read('lib/stores/managerScheduleStore.ts')
  assert.match(source, /managerSiteBookingUpdateWriteFields,\s*\{ userId: auth\?\.currentUser\?\.uid \?\? null, missing: 'refuse' \}/)
  assert.match(source, /writeMetadataFields\(auth\?\.currentUser\?\.uid, 'web'\)/)
  assert.match(read('lib/stores/bookingStore.ts'), /writeMetadataFields\(auth\?\.currentUser\?\.uid, 'web'\)/)
})

test('M11 / L12: My Schedule and annual leave match the person by every id', () => {
  assert.match(read('app/dashboard/my-schedule/page.tsx'), /aliasIds: Array\.from\(samePersonIds\(user\.id, users, userIdAliases\)\)/)
  assert.match(read('components/annual-leave/AnnualLeaveScreen.tsx'), /leaveRecordsForAccount\(/)
})

test('L13: clash approvals are one batch', () => {
  const source = read('lib/warnings/acceptedClashStorage.ts')
  assert.match(source, /writeBatch\(db\)/)
  assert.doesNotMatch(source, /\bsetDoc\(|\bdeleteDoc\(/)
})

test('L14 / H2: annual leave writes check the organisation; timesheet saves diff the loaded copy', () => {
  const holiday = read('lib/stores/holidayStore.ts')
  assert.ok((holiday.match(/liveResultStillCurrent\(organizationId\)/g)?.length ?? 0) >= 5)
  const storage = read('lib/timesheets/timesheetStorage.ts')
  assert.match(storage, /timesheetChangedFields\(/)
  assert.match(storage, /const managerSigned = Boolean\(draftFromFirestoreMap\(stored/)
  assert.match(read('components/timesheets/TimesheetPeriodPage.tsx'), /base: baseDraft\.current/)
})

test('M6: accepting or refusing a leave cancellation notifies the requester', () => {
  for (const path of ['components/tasks/TasksScreen.tsx', 'components/annual-leave/OperativeAnnualLeaveManagement.tsx']) {
    assert.match(read(path), /cancellation: true/, path)
  }
})
