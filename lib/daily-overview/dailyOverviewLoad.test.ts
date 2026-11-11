import assert from 'node:assert/strict'
import test from 'node:test'
import { dailyOverviewMayPublish } from './buildDailyOverview.ts'

test('an empty booking read still in flight is not an unbooked team', () => {
  assert.equal(
    dailyOverviewMayPublish({
      bookingsLoading: true,
      bookingCount: 0,
      managerLoading: true,
      managerBookingCount: 0,
    }),
    false
  )
  assert.equal(
    dailyOverviewMayPublish({
      bookingsLoading: false,
      bookingCount: 4,
      managerLoading: true,
      managerBookingCount: 0,
    }),
    false
  )
})

test('a finished empty read can publish, and rows already on screen can publish', () => {
  assert.equal(
    dailyOverviewMayPublish({
      bookingsLoading: false,
      bookingCount: 0,
      managerLoading: false,
      managerBookingCount: 0,
    }),
    true
  )
  assert.equal(
    dailyOverviewMayPublish({
      bookingsLoading: false,
      bookingCount: 2,
      managerLoading: false,
      managerBookingCount: 1,
    }),
    true
  )
})

test('a booking saved under an invite placeholder still shows on Daily Overview after sign-up', async () => {
  const { buildDailyOverview, UNKNOWN_BOOKED_PERSON } = await import('./buildDailyOverview.ts')
  const { dateFromDayKey } = await import('../ios-parity/londonTime.ts')
  const day = dateFromDayKey('2026-10-27')
  const placeholder = 'A1B2C3D4-0000-4000-8000-000000000001'
  const user = {
    id: 'authUidAfterSignUp',
    email: 'pat@site.test',
    firstName: 'Pat',
    surname: 'Invited',
    organizationId: 'ORG',
    role: 'operative',
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    permissions: { operativeMode: true, manager: false, adminAccess: false },
    policyAccepted: true,
    formerUserIds: [placeholder],
  }
  const booking = (operativeId: string, status = 'Confirmed') => ({
    id: `B-${operativeId}`,
    operativeId,
    projectId: 'P1',
    date: day,
    timeSlot: 'FULL DAY',
    status,
    bookedBy: 'admin@site.test',
    createdAt: day,
    updatedAt: day,
  })
  const project = { id: 'P1', jobNumber: 'J1', siteName: 'Site', jobType: 'CAT A' }
  const build = (users: unknown[], bookings: unknown[]) =>
    buildDailyOverview({
      day,
      today: day,
      projects: [project as never],
      bookings: bookings as never,
      managerBookings: [],
      holidays: [],
      users: users as never,
      operatives: [],
    })

  const linked = build([user], [booking(placeholder)])
  assert.deepEqual(linked.projectCards[0].people.map((row) => row.name), ['Pat Invited'])
  assert.deepEqual(linked.unbookedNames, [])

  // A booking whose person matches nobody is still listed, never silently dropped.
  const orphan = build([], [booking('NOBODY-ID')])
  assert.deepEqual(orphan.projectCards[0].people.map((row) => row.name), [UNKNOWN_BOOKED_PERSON])

  // A completed booking was worked, so the person is not unbooked.
  const completed = build([{ ...user, formerUserIds: [] }], [booking('authUidAfterSignUp', 'Completed')])
  assert.deepEqual(completed.unbookedNames, [])
})

test('the Standard and Overtime tiles split the hours worked; overtime is not always 0', async () => {
  const { buildDailyOverview } = await import('./buildDailyOverview.ts')
  const { dateFromDayKey } = await import('../ios-parity/londonTime.ts')
  const build = (dayKey: string, workStartTime: string, workEndTime: string) => {
    const day = dateFromDayKey(dayKey)
    return buildDailyOverview({
      day,
      today: day,
      projects: [{ id: 'P1', jobNumber: 'J1', siteName: 'Site', jobType: 'CAT A' } as never],
      bookings: [
        { id: 'B1', operativeId: 'op', projectId: 'P1', date: day, timeSlot: 'CUSTOM_HOURS', workStartTime, workEndTime, status: 'Confirmed', bookedBy: 'a', createdAt: day, updatedAt: day },
      ] as never,
      managerBookings: [],
      holidays: [],
      users: [],
      operatives: [],
    })
  }
  // Wed 21 Oct 2026 on Raccord MEP: 06:00–17:45 custom hours showed 11.25h with Overtime 0.
  const wed = build('2026-10-21', '06:00', '17:45')
  // 1.20.2: the day's hours are the pay rule's — 8h standard + 3.25h × 1.5 = 12.875h; the row pill shows the sum.
  assert.deepEqual([wed.labourHours, wed.standardWorkedHours, wed.overtimeWorkedHours, wed.overtimeMultiplier], [12.875, 8, 3.25, 1.5])
  assert.equal(wed.projectCards[0].people[0].pillText, '12.88h')
  assert.equal(wed.projectCards[0].people[0].subtitle, 'Custom 06:00–17:45')
  // Sunday with no saved rule: every hour at 2×, none standard.
  const sun = build('2026-10-25', '08:00', '12:00')
  assert.deepEqual([sun.standardWorkedHours, sun.overtimeWorkedHours, sun.overtimeMultiplier], [0, 4, 2])
  // Owner report (3 Nov): a Sunday showed its clock hours; it shows the pay rule's.
  assert.equal(sun.labourHours, 8)
  assert.equal(sun.projectCards[0].people[0].pillText, '8h')
  const empty = build('2026-10-22', '07:30', '16:00')
  assert.deepEqual([empty.standardWorkedHours, empty.overtimeWorkedHours, empty.overtimeMultiplier], [8, 0, 1.5])
})

test('1.20.3: Daily Overview shows hours at the multiplier as clock hours with the break off as plain hours', async () => {
  const { buildDailyOverview } = await import('./buildDailyOverview.ts')
  const { dateFromDayKey } = await import('../ios-parity/londonTime.ts')
  const { DEFAULT_PAYROLL_POLICY } = await import('../settings/organizationSettings.ts')
  const day = dateFromDayKey('2026-11-08')
  const payrollPolicy = {
    ...DEFAULT_PAYROLL_POLICY,
    sunday: { ...DEFAULT_PAYROLL_POLICY.sunday, allHoursAtMultiplierMode: true, allHoursMultiplier: 2, sameAsSaturday: false, breakPaid: false },
  }
  const model = buildDailyOverview({
    day,
    today: day,
    projects: [{ id: 'P1', jobNumber: 'J1', siteName: 'Site', jobType: 'CAT A' } as never],
    bookings: [
      { id: 'B1', operativeId: 'op', projectId: 'P1', date: day, timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '14:00', status: 'Confirmed', bookedBy: 'a', createdAt: day, updatedAt: day },
    ] as never,
    managerBookings: [],
    holidays: [],
    users: [],
    operatives: [],
    payrollPolicy,
  })
  // Pay total unchanged: 6.5 × 2 − 0.5 = 12.5h. The tile shows 6.5 (clock) × 2 and the 0.5h break, never 6.25.
  assert.deepEqual(
    [model.labourHours, model.standardWorkedHours, model.overtimeWorkedHours, model.overtimeBreakHours, model.overtimeMultiplier],
    [12.5, 0, 6.5, 0.5, 2]
  )
  assert.equal(model.overtimeText, '6.5h × 2 − 0.5h break = 12.5h')
  assert.equal(model.projectCards[0].people[0].pillText, '12.5h')
})
