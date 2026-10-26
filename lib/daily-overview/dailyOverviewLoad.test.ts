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
