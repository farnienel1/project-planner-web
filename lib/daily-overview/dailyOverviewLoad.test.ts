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
  // 1.39.0 (owner answer 11 Nov): the job line reads the overtime as part of the booked hours; the figures are unchanged.
  assert.equal(wed.projectCards[0].bookedHours, 12.88)
  assert.equal(wed.projectCards[0].bookedText, '12.88h booked (incl. 3.25h OT × 1.5)')
  // Sunday with no saved rule: every hour at 2×, none standard.
  const sun = build('2026-10-25', '08:00', '12:00')
  assert.deepEqual([sun.standardWorkedHours, sun.overtimeWorkedHours, sun.overtimeMultiplier], [0, 4, 2])
  // Owner report (3 Nov): a Sunday showed its clock hours; it shows the pay rule's.
  assert.equal(sun.labourHours, 8)
  assert.equal(sun.projectCards[0].people[0].pillText, '8h')
  const empty = build('2026-10-22', '07:30', '16:00')
  assert.deepEqual([empty.standardWorkedHours, empty.overtimeWorkedHours, empty.overtimeMultiplier], [8, 0, 1.5])
  assert.equal(empty.projectCards[0].bookedText, '8h booked')
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

test('UI pack U1 / U2: each row carries its scheduling tile kind and its shift and times, from the pay rule only', async () => {
  const { buildDailyOverview } = await import('./buildDailyOverview.ts')
  const { dateFromDayKey } = await import('../ios-parity/londonTime.ts')
  const { bookingPayrollHours, bookingTimesParts, bookingTimesText } = await import('../scheduling/paidHours.ts')
  const { scheduleCellHours, scheduleCellKind } = await import('../canonical/index.ts')
  const booking = (id: string, day: Date, timeSlot: string, workStartTime?: string, workEndTime?: string, operativeId = 'op') =>
    ({ id, operativeId, projectId: 'P1', date: day, timeSlot, workStartTime, workEndTime, status: 'Confirmed', bookedBy: 'a', createdAt: day, updatedAt: day })
  const build = (dayKey: string, bookings: ReturnType<typeof booking>[]) => {
    const day = dateFromDayKey(dayKey)
    return buildDailyOverview({
      day,
      today: day,
      projects: [{ id: 'P1', jobNumber: 'J1', siteName: 'Site', jobType: 'CAT A' } as never],
      bookings: bookings as never,
      managerBookings: [],
      holidays: [],
      users: [],
      operatives: [],
    })
  }
  const wedDay = dateFromDayKey('2026-10-21')
  const wed = build('2026-10-21', [booking('B1', wedDay, 'CUSTOM_HOURS', '06:00', '17:45')])
  const row = wed.projectCards[0].people[0]
  // The same calls the scheduling week makes, on the same booking: no figure of its own.
  const expected = scheduleCellKind({ ...scheduleCellHours(bookingPayrollHours({ ...booking('B1', wedDay, 'CUSTOM_HOURS', '06:00', '17:45'), date: wedDay })), timeSlot: 'CUSTOM_HOURS' })
  assert.deepEqual(row.cell, expected)
  assert.equal(row.cell.tone, 'split')
  assert.equal(row.cell.standardHours, 8)
  assert.deepEqual(row.bookingParts, [{ shift: 'Custom', times: '06:00–17:45' }])
  // The figures the row already showed are unchanged.
  assert.equal(row.pillText, '12.88h')
  assert.equal(row.subtitle, 'Custom 06:00–17:45')
  const sunDay = dateFromDayKey('2026-10-25')
  assert.equal(build('2026-10-25', [booking('B2', sunDay, 'CUSTOM_HOURS', '08:00', '12:00')]).projectCards[0].people[0].cell.tone, 'otOnly')
  const thuDay = dateFromDayKey('2026-10-22')
  const thu = build('2026-10-22', [booking('B3', thuDay, 'FULL DAY')]).projectCards[0].people[0]
  assert.equal(thu.cell.tone, 'standard')
  assert.deepEqual(thu.bookingParts, [{ shift: thu.subtitle, times: null }])
  // One person with two bookings on the job: one row, the hours added up before the kind, both bookings listed.
  const twice = build('2026-10-22', [
    booking('B4', thuDay, 'CUSTOM_HOURS', '07:30', '12:00'),
    booking('B5', thuDay, 'CUSTOM_HOURS', '16:00', '18:00'),
  ]).projectCards[0].people
  assert.equal(twice.length, 1)
  assert.equal(twice[0].bookingParts.length, 2)
  assert.equal(twice[0].cellPaidHours, twice[0].hours)
  assert.equal(twice[0].cell.tone, 'split')
  // Same stored slot on every booking of the row: the slot still decides (AM + AM stays a half day).
  const halves = build('2026-10-22', [booking('B6', thuDay, 'AM'), booking('B7', thuDay, 'AM')]).projectCards[0].people
  assert.equal(halves.length, 1)
  assert.equal(halves[0].cell.tone, 'halfDay')
  // A booking line that reads the same is shown once, as the old subtitle did.
  assert.deepEqual(halves[0].bookingParts, [bookingTimesParts({ timeSlot: 'AM' })])
  assert.equal(halves[0].subtitle, bookingTimesText({ timeSlot: 'AM' }))
  const fullTwice = build('2026-10-22', [booking('B8', thuDay, 'FULL DAY'), booking('B9', thuDay, 'FULL DAY')]).projectCards[0].people[0]
  assert.equal(fullTwice.bookingParts.length, 1)
  // Different slots: the summed hours decide the kind.
  const mixed = build('2026-10-22', [booking('B10', thuDay, 'AM'), booking('B11', thuDay, 'CUSTOM_HOURS', '16:00', '18:00')]).projectCards[0].people[0]
  assert.equal(mixed.cellSlot, null)
  assert.deepEqual(mixed.cell, scheduleCellKind({ paidHours: mixed.cellPaidHours, overtimeHours: mixed.cellOvertimeHours }))
  assert.equal(mixed.bookingParts.length, 2)
  // `bookingTimesText` is the two parts joined, for every slot.
  for (const input of [
    { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '14:00' },
    { timeSlot: 'CUSTOM_HOURS' },
    { timeSlot: 'FULL DAY' },
    { timeSlot: 'AM' },
    { timeSlot: 'PM' },
    { timeSlot: undefined },
  ]) {
    const { shift, times } = bookingTimesParts(input)
    assert.equal(times ? `${shift} ${times}` : shift, bookingTimesText(input))
  }
})
