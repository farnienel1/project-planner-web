import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Booking, Operative, Project, User } from '../../types/index.ts'
import { DEFAULT_INVOICING, DEFAULT_PAYROLL_POLICY } from '../settings/organizationSettings.ts'
import { emptyTimesheetDraft, type TimesheetDraft } from './timesheetDraft.ts'
import { applyWeeklyReportOverride } from './weeklyReportOverride.ts'
import { collectTimesheetPayroll } from './timesheetPayrollCollector.ts'
import { draftForFiguresWithRebuild, draftSignedBookingRecord } from './timesheetBookingChanges.ts'
import {
  draftsForMembers,
  payRunKey,
  payRunsStartDayKey,
  recentPayRuns,
  timesheetMemberIds,
  timesheetOwnerResolver,
  timesheetQueueRows,
} from './timesheetQueue.ts'
import { mineChangedPeriodStarts, mineSheetRows } from './mineChanged.ts'
import { snapshotRepairCandidates } from './snapshotAutoRepair.ts'
import { listSelectablePayPeriods, organizationCreatedAt, payRunListStartDayKey } from './paymentRunCopy.ts'
import { earlierVersionCards } from './timesheetRevisionCopy.ts'
import { isUnresolvedTimesheetPerson, unresolvedTimesheetPerson } from './timesheetStorage.ts'
import { timesheetVersionsForPeriod } from '../canonical/index.ts'

const tz = 'Europe/London'
const person = {
  id: 'u1',
  email: 'farnie@x.com',
  firstName: 'Farnie',
  surname: 'Nel',
  organizationId: 'org',
  role: 'operative',
  passwordSet: true,
  policyAccepted: true,
  permissions: { operativeMode: true },
  isSuperAdmin: false,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  dayRate: 200,
  employmentType: 'self_employed',
  assignedManagerUserId: 'mgr',
  formerUserIds: ['old-invite'],
} as unknown as User
const copy = { ...person, id: 'u1-copy', formerUserIds: [] } as unknown as User
const manager = { ...person, id: 'mgr', email: 'mgr@x.com', firstName: 'Morgan', role: 'manager', permissions: { manager: true }, assignedManagerUserId: undefined, formerUserIds: [] } as unknown as User
const other = { ...person, id: 'u2', email: 'bo@x.com', firstName: 'Bo', formerUserIds: [] } as unknown as User
const users = [person, copy, manager, other]

const operative = { id: 'op1', firstName: 'Farnie', lastName: 'Nel', email: 'farnie@x.com', dayRate: 200, isActive: true, skills: [], qualifications: [], createdAt: new Date(), updatedAt: new Date() } as unknown as Operative
const project = { id: 'proj1', jobNumber: 'J-1', siteName: 'Site One', jobType: 'CAT A', isLive: true, startDate: new Date(), endDate: new Date(), createdAt: new Date(), updatedAt: new Date() } as unknown as Project

const run1 = { start: new Date('2026-11-01T00:00:00Z'), end: new Date('2026-11-15T00:00:00Z') }
const run2 = { start: new Date('2026-11-16T00:00:00Z'), end: new Date('2026-11-30T00:00:00Z') }

function booking(partial: Partial<Booking> = {}): Booking {
  return {
    id: 'b1',
    operativeId: 'u1',
    projectId: 'proj1',
    date: new Date('2026-11-10T00:00:00Z'),
    timeSlot: 'CUSTOM',
    workStartTime: '07:00',
    workEndTime: '16:00',
    bookedBy: 'Morgan',
    status: 'Confirmed',
    createdAt: new Date('2026-11-09T08:00:00Z'),
    updatedAt: new Date('2026-11-09T08:00:00Z'),
    ...partial,
  } as Booking
}
const collectorBase = { managerSiteBookings: [], operatives: [operative], projects: [project], smallWorks: [], payrollPolicy: DEFAULT_PAYROLL_POLICY, timeZone: tz }
const linesFor = (bookings: Booking[], period = run1) =>
  collectTimesheetPayroll({ ...collectorBase, user: person, bookings, periodStart: period.start, periodEnd: period.end }).lineItems

function signedOff(bookings: Booking[], period = run1): TimesheetDraft {
  return applyWeeklyReportOverride({
    ...collectorBase,
    draft: {
      ...emptyTimesheetDraft(),
      operativeSignedAt: new Date('2026-11-14T09:00:00Z'),
      operativeSignedByName: 'Farnie Nel',
      operativeSignedBookings: draftSignedBookingRecord({ lines: linesFor(bookings, period), bookings, managerSiteBookings: [], timeZone: tz }),
      operativeSignedBookingsAt: new Date('2026-11-14T09:00:00Z'),
      operativeSignedBookingsSignedAt: new Date('2026-11-14T09:00:00Z'),
      managerSignedAt: new Date('2026-11-14T10:00:00Z'),
      managerSignedByName: 'Morgan',
      managerSignedByUserId: 'mgr',
    },
    user: person,
    users,
    weekStart: period.start,
    weekEnd: period.end,
    bookings,
  })
}
/** The 1.43.0 bug: a counter-signature frozen before the bookings loaded — a snapshot with no labour lines (£195 price work). */
function frozenEmpty(): TimesheetDraft {
  const sheet = signedOff([])
  return { ...sheet, priceWorkEntries: [], weeklyReportOverride: { ...sheet.weeklyReportOverride!, lines: [], approvedAt: new Date('2026-11-14T10:00:00Z') } }
}

test('item 1: recent pay runs are the current one and the five before it, newest first, in the organisation zone', () => {
  const runs = recentPayRuns(DEFAULT_INVOICING, new Date('2026-11-17T12:00:00Z'), tz)
  assert.equal(runs.length, 6)
  assert.equal(payRunKey(runs[0], tz), '2026-11-16|2026-11-30')
  assert.equal(payRunKey(runs[1], tz), '2026-11-01|2026-11-15')
  assert.equal(payRunsStartDayKey(runs, tz), '2026-09-01')
})

test('item 1: a signed, unexported sheet of an earlier pay run stays on Signed off, with its own run; exported ones leave', () => {
  const groups = [[person], [other]]
  const runs = [run2, run1]
  const signed = signedOff([booking()])
  const draftsByRun = new Map([
    [payRunKey(run1, tz), new Map([['u1', signed]])],
    [payRunKey(run2, tz), new Map([['u2', signedOff([booking({ id: 'b2', operativeId: 'u2', date: new Date('2026-11-18T00:00:00Z') })], run2)]])],
  ])
  const rows = timesheetQueueRows({ runs, groupsFor: () => groups, draftsFor: (run) => draftsByRun.get(payRunKey(run, tz)), bucket: 'signed', users, timeZone: tz })
  assert.deepEqual(rows.map((row) => [row.member.id, payRunKey(row.period, tz)]), [
    ['u2', '2026-11-16|2026-11-30'],
    ['u1', '2026-11-01|2026-11-15'],
  ])
  assert.notEqual(rows[0].key, rows[1].key)
  // Exported: gone from Signed off.
  draftsByRun.get(payRunKey(run1, tz))!.set('u1', { ...signed, exportedAt: new Date('2026-11-16T09:00:00Z') })
  const after = timesheetQueueRows({ runs, groupsFor: () => groups, draftsFor: (run) => draftsByRun.get(payRunKey(run, tz)), bucket: 'signed', users, timeZone: tz })
  assert.deepEqual(after.map((row) => row.member.id), ['u2'])
})

test('item 1 (guardrail 1): a sheet filed under a former invite id or a same-email document is the person’s', () => {
  const ids = timesheetMemberIds(person, users).map((id) => id.toLowerCase())
  assert.ok(ids.includes('old-invite') && ids.includes('u1-copy'))
  const sheet = signedOff([booking()])
  const mapped = draftsForMembers([[person]], new Map([['OLD-INVITE', sheet]]), users)
  assert.equal(mapped.get('u1'), sheet)
  // Another listed member's own sheet is never borrowed.
  const both = draftsForMembers([[person, copy]], new Map([['u1-copy', sheet]]), users)
  assert.equal(both.get('u1-copy'), sheet)
  assert.equal(both.has('u1'), false)
  const owner = timesheetOwnerResolver([person, other], users)
  assert.equal(owner('Old-Invite')?.id, 'u1')
  assert.equal(owner('u2')?.id, 'u2')
  assert.equal(owner('nobody'), null)
})

test('item 1 (guardrail 3): an exported sheet of nobody in the organisation is listed as "Unknown person · <hint>"', () => {
  const unknown = unresolvedTimesheetPerson('6a9632ba-0000-4000-8000-000000000000', 'org')
  assert.equal(`${unknown.firstName} ${unknown.surname}`, 'Unknown person · 6A9632BA')
  assert.equal(isUnresolvedTimesheetPerson(unknown), true)
  assert.equal(isUnresolvedTimesheetPerson(person), false)
})

test('item 2: the person’s own triangle — a booking change on a signed, unexported sheet; nothing while unchanged', () => {
  const signed = signedOff([booking()])
  const rows = mineSheetRows([{ weekStart: run1.start, endDayKey: '2026-11-15', draft: signed }], DEFAULT_INVOICING, new Date('2026-11-17T12:00:00Z'), tz)
  assert.equal(rows.length, 1)
  const catalogue = (bookings: Booking[], liveLoaded = true) => ({ ...collectorBase, users, bookings, liveLoaded })
  const base = { rows, subject: person, timeZone: tz, documentIdOf: () => null }
  assert.deepEqual(mineChangedPeriodStarts({ ...base, catalogue: catalogue([booking()]) }), [])
  const moved = [booking({ workEndTime: '18:00', updatedAt: new Date('2026-11-16T08:00:00Z') })]
  assert.deepEqual(mineChangedPeriodStarts({ ...base, catalogue: catalogue(moved) }), ['2026-11-01'])
  // Bookings not loaded yet: never read as changed.
  assert.deepEqual(mineChangedPeriodStarts({ ...base, catalogue: catalogue(moved, false) }), [])
  // An unsigned draft never needs the person.
  assert.equal(mineSheetRows([{ weekStart: run1.start, draft: emptyTimesheetDraft() }], DEFAULT_INVOICING, new Date(), tz).length, 0)
})

test('item 4: a snapshot frozen empty shows the live bookings’ figures; a good snapshot keeps its own', () => {
  const live = linesFor([booking()])
  const broken = frozenEmpty()
  const figures = draftForFiguresWithRebuild(broken, null, live)
  assert.equal(figures.beingRebuilt, true)
  assert.equal(figures.draft.weeklyReportOverride, null)
  const good = signedOff([booking()])
  const kept = draftForFiguresWithRebuild(good, null, live)
  assert.equal(kept.beingRebuilt, false)
  assert.equal(kept.draft.weeklyReportOverride, good.weeklyReportOverride)
  // Exported: never rebuilt.
  assert.equal(draftForFiguresWithRebuild({ ...broken, exportedAt: new Date() }, null, live).beingRebuilt, false)
  // A booking written after the approval does not make an empty snapshot broken (never re-priced).
  const late = linesFor([booking({ createdAt: new Date('2026-11-15T08:00:00Z'), updatedAt: new Date('2026-11-15T08:00:00Z') })])
  assert.equal(draftForFiguresWithRebuild(broken, null, late).beingRebuilt, false)
})

test('item 5: background repair picks broken, unexported sheets the viewer reviews, once per session', () => {
  const live = linesFor([booking()])
  const sheets = [
    { member: person, period: run1, draft: frozenEmpty(), documentId: 'timesheet_u1_1793491200' },
    { member: person, period: run1, draft: signedOff([booking()]), documentId: 'timesheet_u1_good' },
    { member: person, period: run1, draft: { ...frozenEmpty(), exportedAt: new Date() }, documentId: 'timesheet_u1_exported' },
    { member: person, period: run1, draft: frozenEmpty(), documentId: null },
  ]
  const pick = (viewer: User, tried = new Set<string>()) =>
    snapshotRepairCandidates({ organizationId: 'org', sheets, viewer, users, liveLinesFor: () => live, tried }).map((row) => row.documentId)
  assert.deepEqual(pick(manager), ['timesheet_u1_1793491200'])
  // Not their report: nothing (the rules would refuse the write).
  assert.deepEqual(pick(other), [])
  // Nobody repairs their own sheet here.
  assert.deepEqual(pick(person), [])
  assert.deepEqual(pick(manager, new Set(['org|timesheet_u1_1793491200'])), [])
})

test('item 6: past pay runs start at the organisation’s creation day; runs with a stored sheet always stay', () => {
  assert.equal(organizationCreatedAt({ createdAt: { seconds: Date.parse('2025-09-12T10:00:00Z') / 1000 } })?.toISOString(), '2025-09-12T10:00:00.000Z')
  assert.equal(organizationCreatedAt({}), null)
  const from = payRunListStartDayKey({ createdAt: new Date('2025-09-12T10:00:00Z'), timeZone: tz })
  assert.equal(from, '2025-09-12')
  assert.equal(payRunListStartDayKey({ createdAt: null, storedDayKeys: ['2026-01-16', '2025-11-01'], timeZone: tz }), '2025-11-01')
  assert.equal(payRunListStartDayKey({ createdAt: new Date(0), timeZone: tz }), null)
  const now = new Date('2026-11-17T12:00:00Z')
  const all = listSelectablePayPeriods(DEFAULT_INVOICING, now, 120, tz)
  const bounded = listSelectablePayPeriods(DEFAULT_INVOICING, now, 120, tz, [], from)
  assert.ok(all.some((period) => period.end.getTime() < Date.parse('2025-09-01T00:00:00Z')))
  assert.ok(bounded.every((period) => period.end.getTime() >= Date.parse('2025-09-11T00:00:00Z')))
  assert.ok(bounded.some((period) => payRunKey(period, tz) === '2025-09-01|2025-09-15'))
  // A run with a stored sheet before the creation day is never hidden.
  const old = { start: new Date('2024-03-01T00:00:00Z'), end: new Date('2024-03-15T00:00:00Z') }
  const withOld = listSelectablePayPeriods(DEFAULT_INVOICING, now, 120, tz, [old], from)
  assert.ok(withOld.some((period) => payRunKey(period, tz) === '2024-03-01|2024-03-15'))
})

test('item 3: earlier versions as cards — label, signed by whom, total and what the next version changed', () => {
  const original = signedOff([booking()])
  const stored = (draft: TimesheetDraft, extra: Record<string, unknown> = {}) => ({
    userId: 'u1',
    operativeSignedByName: draft.operativeSignedByName,
    managerSignedByName: draft.managerSignedByName,
    managerSignedAt: draft.managerSignedAt,
    operativeSignedBookings: draft.operativeSignedBookings,
    weeklyReportOverride: draft.weeklyReportOverride,
    exportedAt: new Date('2026-11-16T09:00:00Z'),
    ...extra,
  })
  const revised = signedOff([booking(), booking({ id: 'b2', date: new Date('2026-11-11T00:00:00Z') }), booking({ id: 'b3', date: new Date('2026-11-12T00:00:00Z') })])
  const chain = timesheetVersionsForPeriod([
    { documentId: 'timesheet_u1_1793491200', data: stored(original) },
    { documentId: 'timesheet_u1_1793491200_rev1', data: stored(revised, { exportedAt: null }) },
  ])[0]
  const cards = earlierVersionCards({ chain, latestTotal: 600, currency: 'GBP' })
  assert.equal(cards.length, 1)
  assert.equal(cards[0].label, 'Original')
  assert.equal(cards[0].nextLabel, 'REV 1')
  assert.equal(cards[0].personName, 'Farnie Nel')
  assert.equal(cards[0].lineManagerName, 'Morgan')
  assert.equal(cards[0].signedAtMs, Date.parse('2026-11-14T10:00:00Z'))
  assert.match(cards[0].changeText, /^\+2 bookings · \+£/)
  assert.equal(earlierVersionCards({ chain: chain.slice(0, 1), latestTotal: 0, currency: 'GBP' }).length, 0)
})
