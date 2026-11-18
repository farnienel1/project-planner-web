/**
 * Owner report (17 Nov 2026), guardrail 7: the Daily Overview "Other" and "Site survey" rows were restyled to read
 * like a job's rows (shift and times, Type chip, hours bar and pill) instead of the stored slot word ("CUSTOM_HOURS").
 * UI only. These tests prove:
 *   1. every figure and count of the model is the one the model gave before the change (pinned from the builder on
 *      `main` before this change, run on the same fixture), and the place bookings still add nothing to the labour hours;
 *   2. the new rows carry the same words and hours as a job's row for the same booking, and a booking whose person
 *      has no name is listed as "Unknown person" like a job's row (owner answer 17 Nov; it was hidden);
 *   3. no raw slot enum ("CUSTOM_HOURS", "FULL_DAY", …) is ever text on Daily Overview — in any row the model gives
 *      the screen, or in the screen's source.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { dateFromDayKey } from '@/lib/ios-parity/londonTime'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import { buildDailyOverview, UNKNOWN_BOOKED_PERSON, type DailyOverviewModel } from './buildDailyOverview'

const ZONE = 'Europe/London'
const ORG = 'ORG-1'
const DAY_KEY = '2026-11-17' // a Tuesday

function person(id: string, firstName: string, surname: string, flags: Record<string, boolean>) {
  return {
    id,
    email: `${id}@site.test`,
    firstName,
    surname,
    organizationId: ORG,
    role: flags.adminAccess ? 'admin' : flags.operativeMode ? 'operative' : 'manager',
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    permissions: { operativeMode: false, manager: false, adminAccess: false, ...flags },
    policyAccepted: true,
  }
}

const policy = {
  ...DEFAULT_PAYROLL_POLICY,
  standardDayStart: '07:00',
  standardDayEnd: '16:00',
  unpaidBreakMinutes: 30,
  breakWindowStart: '12:00',
  breakWindowEnd: '12:30',
  weekdayOvertimeMultiplier: 1.5,
}

function fixture(withPlaces = true) {
  const day = dateFromDayKey(DAY_KEY)
  const users = [
    person('u-admin', 'Test', 'Admin', { adminAccess: true }),
    person('u-mgr', 'Max', 'Manager', { manager: true }),
    person('u-op', 'Olly', 'Operative', { operativeMode: true }),
  ]
  const project = { id: 'P1', jobNumber: 'C646', siteName: '1 Carnaby Street', jobType: 'CAT A', isLive: true, managerIds: ['u-mgr'] }
  const bookings = [
    { id: 'B1', operativeId: 'u-op', projectId: 'P1', date: day, timeSlot: 'CUSTOM_HOURS', workStartTime: '06:00', workEndTime: '17:30', status: 'Confirmed', bookedBy: 'a', createdAt: day, updatedAt: day },
  ]
  const onJob = [{ id: 'MJ', userId: 'u-mgr', date: day, timeSlot: 'FULL_DAY', locationType: 'project', locationId: 'P1' }]
  const places = [
    // The owner's row: Test Admin in the office, custom hours.
    { id: 'MO', userId: 'u-admin', date: day, timeSlot: 'CUSTOM_HOURS', workStartTime: '06:00', workEndTime: '17:30', locationType: 'office' },
    { id: 'MW', userId: 'u-mgr', date: day, timeSlot: 'FULL_DAY', locationType: 'working_from_home' },
    { id: 'MY', userId: 'u-mgr', date: day, timeSlot: 'CUSTOM', workStartTime: '17:00', workEndTime: '19:00', locationType: 'custom', customLocationName: 'Yard' },
    { id: 'MS', userId: 'u-admin', date: day, timeSlot: 'AM', locationType: 'site_survey' },
    // A booking whose person has no name: shown as "Unknown person" (owner answer 17 Nov; it used to be hidden).
    { id: 'MX', userId: 'u-nobody', date: day, timeSlot: 'FULL DAY', locationType: 'office' },
  ]
  return { day, users, project, bookings, managerSiteBookings: [...onJob, ...(withPlaces ? places : [])] }
}

function model(withPlaces = true): DailyOverviewModel {
  const f = fixture(withPlaces)
  return buildDailyOverview({
    day: f.day,
    today: f.day,
    projects: [f.project] as never,
    bookings: f.bookings as never,
    managerBookings: f.managerSiteBookings as never,
    holidays: [],
    users: f.users as never,
    userIdAliases: {},
    operatives: [],
    payrollPolicy: policy as never,
    timeZone: ZONE,
  })
}

/** Every figure and count Daily Overview shows (and the place lists the card counts from). */
function figures(m: DailyOverviewModel) {
  return {
    labourHours: m.labourHours,
    standardWorkedHours: m.standardWorkedHours,
    overtimeWorkedHours: m.overtimeWorkedHours,
    overtimeBreakHours: m.overtimeBreakHours,
    overtimeText: m.overtimeText,
    overtimeMultiplier: m.overtimeMultiplier,
    peopleCount: m.peopleCount,
    jobsCount: m.jobsCount,
    bookedPeopleCount: m.bookedPeopleCount,
    unbookedCount: m.unbookedCount,
    unbookedNames: m.unbookedNames,
    officeCount: m.officeCount,
    wfhCount: m.wfhCount,
    onSiteCount: m.onSiteCount,
    officeIds: m.officeBookings.map((b) => b.id),
    wfhIds: m.wfhBookings.map((b) => b.id),
    siteSurveyIds: m.siteSurveyBookings.map((b) => b.id),
    customGroups: m.customGroups.map((g) => [g.name, g.bookings.map((b) => b.id)]),
    projectCards: m.projectCards.map((c) => ({
      id: c.project.id,
      peopleCount: c.peopleCount,
      bookedHours: c.bookedHours,
      bookedText: c.bookedText,
      people: c.people.map((p) => [p.name, p.pillText, p.subtitle, p.cell.tone]),
    })),
    empty: m.empty,
  }
}

/**
 * The same fixture run through `buildDailyOverview` as it was on `main` before this change (ffe5e97f), with the
 * output pinned here. The change only adds `otherGroups` and `siteSurveyRows`, so every field below must not move.
 */
const BEFORE = {
  labourHours: 20.75,
  standardWorkedHours: 17,
  overtimeWorkedHours: 2.5,
  overtimeBreakHours: 0,
  overtimeText: '2.5h × 1.5 = 3.75h',
  overtimeMultiplier: 1.5,
  peopleCount: 4,
  jobsCount: 1,
  bookedPeopleCount: 4,
  unbookedCount: 0,
  unbookedNames: [] as string[],
  officeCount: 2,
  wfhCount: 1,
  onSiteCount: 2,
  officeIds: ['MO', 'MX'],
  wfhIds: ['MW'],
  siteSurveyIds: ['MS'],
  customGroups: [['Yard', ['MY']]],
  projectCards: [
    {
      id: 'P1',
      peopleCount: 2,
      bookedHours: 20.75,
      bookedText: '20.75h booked (incl. 2.5h OT × 1.5)',
      people: [
        ['Olly Operative', '12.25h', 'Custom 06:00–17:30', 'split'],
        ['Max Manager', '8.5h', 'Full day', 'standard'],
      ],
    },
  ],
  empty: false,
}

test('Daily Overview Other rows: every figure and count is unchanged', () => {
  assert.deepEqual(figures(model()), BEFORE)
})

test('Daily Overview Other rows: place bookings still add no labour hours', () => {
  const withPlaces = model(true)
  const without = model(false)
  assert.equal(withPlaces.labourHours, without.labourHours)
  assert.equal(withPlaces.standardWorkedHours, without.standardWorkedHours)
  assert.equal(withPlaces.overtimeWorkedHours, without.overtimeWorkedHours)
  assert.equal(withPlaces.onSiteCount, without.onSiteCount)
  assert.deepEqual(
    withPlaces.projectCards.map((c) => c.bookedHours),
    without.projectCards.map((c) => c.bookedHours)
  )
})

test('Daily Overview Other rows: grouped under their place, read like a job row', () => {
  const m = model()
  assert.deepEqual(
    m.otherGroups.map((g) => [g.name, g.rows.map((r) => r.booking.id)]),
    [
      // The nameless office booking is listed as "Unknown person", as a job's row is (owner answer 17 Nov).
      ['Office', ['MO', 'MX']],
      ['Working from home', ['MW']],
      ['Yard', ['MY']],
    ]
  )
  const office = m.otherGroups[0].rows[0]
  assert.equal(office.name, 'Test Admin')
  assert.deepEqual(office.bookingParts, [{ shift: 'Custom', times: '06:00–17:30' }])
  // The same booking on a job reads the same: Olly's 06:00–17:30 job row.
  const jobRow = m.projectCards[0].people[0]
  assert.equal(office.pillText, jobRow.pillText)
  assert.equal(office.cell.tone, jobRow.cell.tone)
  assert.deepEqual(office.bookingParts, jobRow.bookingParts)
  const unknown = m.otherGroups[0].rows[1]
  assert.equal(unknown.name, UNKNOWN_BOOKED_PERSON)
  assert.deepEqual(unknown.bookingParts, [{ shift: 'Full day', times: null }])
  assert.equal(unknown.pillText, '8.5h')
  assert.deepEqual(m.otherGroups[1].rows[0].bookingParts, [{ shift: 'Full day', times: null }])
  assert.equal(m.otherGroups[2].rows[0].cell.tone, 'otOnly')
  assert.deepEqual(m.siteSurveyRows.map((r) => [r.booking.id, r.bookingParts[0].shift, r.cell.tone]), [['MS', 'Morning (AM)', 'halfDay']])
})

/** A stored slot word or any SHOUTY_SNAKE enum: never shown to a person. */
const RAW_SLOT = /\b[A-Z]+_[A-Z_]+\b|\b(?:FULL DAY|CUSTOM HOURS|CUSTOM|FULL|AM|PM|EVENING|OVERTIME)\b(?! \d)/

test('Daily Overview: no raw slot enum is text in any row the screen renders', () => {
  const m = model()
  const rows = [...m.projectCards.flatMap((c) => c.people), ...m.otherGroups.flatMap((g) => g.rows), ...m.siteSurveyRows]
  assert.equal(rows.length, 7)
  for (const row of rows) {
    const shown = [row.name, row.pillText, ...row.bookingParts.flatMap((p) => [p.shift, p.times ?? ''])]
    for (const text of shown) {
      // "Morning (AM)" names AM in brackets after the word; anything else in capitals is a stored value.
      const stripped = text.replace(/\((AM|PM)\)/g, '')
      assert.ok(!RAW_SLOT.test(stripped), `raw slot text on Daily Overview: "${text}"`)
    }
  }
})

test('Daily Overview screen source never renders a stored slot directly', () => {
  const source = readFileSync(path.join(process.cwd(), 'components/daily-overview/DailyOverviewScreen.tsx'), 'utf8')
  // A JSX child that is a slot field ({b.timeSlot}, {row.timeSlotRaw}) prints the stored word. Leave rows go through
  // `leaveHalfDayLabel(row.timeSlot, …)`, which is a call, not a bare child.
  assert.doesNotMatch(source, /\{\s*[\w.?]+\.(timeSlot|timeSlotRaw|cellSlot)\s*\}/)
})

/**
 * Review of #387: an Other row reads exactly as a job's row for the same booking — overnight, a booking's own
 * overtime rate, a weekend window and a booking with no times — and still adds nothing to the day's labour hours.
 */
function pairModel(dayKeyText: string, booking: Record<string, unknown>, withOffice = true, extraPolicy: Record<string, unknown> = {}) {
  const day = dateFromDayKey(dayKeyText)
  const f = fixture(false)
  const onJob = { id: 'J', userId: 'u-mgr', date: day, locationType: 'project', locationId: 'P1', ...booking }
  const inOffice = { id: 'O', userId: 'u-admin', date: day, locationType: 'office', ...booking }
  return buildDailyOverview({
    day,
    today: day,
    projects: [f.project] as never,
    bookings: [],
    managerBookings: (withOffice ? [onJob, inOffice] : [onJob]) as never,
    holidays: [],
    users: f.users as never,
    userIdAliases: {},
    operatives: [],
    payrollPolicy: { ...policy, ...extraPolicy } as never,
    timeZone: ZONE,
  })
}

const PAIR_CASES: { label: string; dayKey: string; booking: Record<string, unknown>; policy?: Record<string, unknown> }[] = [
  { label: 'overnight 22:00–06:00', dayKey: DAY_KEY, booking: { timeSlot: 'CUSTOM_HOURS', workStartTime: '22:00', workEndTime: '06:00' } },
  { label: "the booking's own rate ×2", dayKey: DAY_KEY, booking: { timeSlot: 'CUSTOM_HOURS', workStartTime: '06:00', workEndTime: '17:30', otMultiplierOverride: 2 } },
  {
    label: 'a Saturday set window',
    dayKey: '2026-11-21',
    booking: { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '15:00' },
    policy: {
      saturday: { allHoursAtMultiplierMode: false, allHoursMultiplier: 2, definedWindowStart: '07:30', definedWindowEnd: '13:00', countsAsStandardHours: 8, outsideWindowMultiplier: 2 },
    },
  },
  { label: 'custom hours with no times', dayKey: DAY_KEY, booking: { timeSlot: 'CUSTOM_HOURS' } },
  { label: 'a full day with no times', dayKey: DAY_KEY, booking: { timeSlot: 'FULL_DAY' } },
]

for (const c of PAIR_CASES) {
  test(`Daily Overview Other row matches a job row: ${c.label}`, () => {
    const m = pairModel(c.dayKey, c.booking, true, c.policy)
    const jobRow = m.projectCards[0].people[0]
    const officeRow = m.otherGroups[0].rows[0]
    assert.equal(officeRow.booking.id, 'O')
    assert.equal(officeRow.pillText, jobRow.pillText)
    assert.equal(officeRow.cell.tone, jobRow.cell.tone)
    assert.equal(officeRow.cellPaidHours, jobRow.cellPaidHours)
    assert.equal(officeRow.cellOvertimeHours, jobRow.cellOvertimeHours)
    assert.deepEqual(officeRow.bookingParts, jobRow.bookingParts)
    for (const part of officeRow.bookingParts) assert.ok(!RAW_SLOT.test(part.shift), `raw slot word "${part.shift}"`)
    // The office booking is never counted in the day's labour figures.
    const jobOnly = pairModel(c.dayKey, c.booking, false, c.policy)
    assert.equal(m.labourHours, jobOnly.labourHours)
    assert.equal(m.standardWorkedHours, jobOnly.standardWorkedHours)
    assert.equal(m.overtimeWorkedHours, jobOnly.overtimeWorkedHours)
    assert.equal(m.overtimeText, jobOnly.overtimeText)
  })
}

test('Daily Overview Other rows: the cases above show what a job row shows', () => {
  const own = pairModel(DAY_KEY, PAIR_CASES[1].booking)
  // The booking's own ×2 is priced, not the organisation's ×1.5: 8.5h standard + 2.5h × 2 = 13.5h (×1.5 gives 12.25h).
  assert.equal(own.otherGroups[0].rows[0].pillText, '13.5h')
  assert.equal(own.otherGroups[0].rows[0].cell.tone, 'split')
  const overnight = pairModel(DAY_KEY, PAIR_CASES[0].booking)
  assert.deepEqual(overnight.otherGroups[0].rows[0].bookingParts, [{ shift: 'Custom', times: '22:00–06:00' }])
  const noTimes = pairModel(DAY_KEY, PAIR_CASES[3].booking)
  assert.deepEqual(noTimes.otherGroups[0].rows[0].bookingParts, [{ shift: 'Custom hours', times: null }])
})

test('Daily Overview Other groups: a custom place named like a fixed one keeps its own group', () => {
  const day = dateFromDayKey(DAY_KEY)
  const f = fixture(false)
  const m = buildDailyOverview({
    day,
    today: day,
    projects: [f.project] as never,
    bookings: [],
    managerBookings: [
      { id: 'A', userId: 'u-admin', date: day, timeSlot: 'FULL_DAY', locationType: 'office' },
      { id: 'B', userId: 'u-mgr', date: day, timeSlot: 'FULL_DAY', locationType: 'custom', customLocationName: 'Office' },
    ] as never,
    holidays: [],
    users: f.users as never,
    userIdAliases: {},
    operatives: [],
    payrollPolicy: policy as never,
    timeZone: ZONE,
  })
  const keys = m.otherGroups.map((g) => `${g.kind}:${g.name}`)
  assert.deepEqual(keys, ['office:Office', 'custom:Office'])
  assert.equal(new Set(keys).size, keys.length)
  // Every group shown has at least one row, so its label never stands alone or goes missing.
  assert.ok(m.otherGroups.every((g) => g.rows.length > 0))
})
