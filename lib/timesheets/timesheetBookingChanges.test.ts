import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Booking, Operative, Project, User } from '../../types/index.ts'
import { DEFAULT_MY_SCHEDULE, DEFAULT_PAYROLL_POLICY } from '../settings/organizationSettings.ts'
import { emptyTimesheetDraft, type TimesheetDraft } from './timesheetDraft.ts'
import { applyWeeklyReportOverride } from './weeklyReportOverride.ts'
import { collectTimesheetPayroll } from './timesheetPayrollCollector.ts'
import {
  clearSignedBookingsPending,
  draftBookingChanges,
  draftForFigures,
  draftSignedBookingRecord,
  periodBookingChanges,
  timesheetPersonIds,
} from './timesheetBookingChanges.ts'
import { draftFromFirestoreMap, draftToFirestoreMap, lateExtrasUnreadAfter, ownerLateExtrasError } from './timesheetStorage.ts'
import { signedTimesheetActions, timesheetEntryFingerprint } from '../canonical/index.ts'
import type { ManagerSiteBooking } from '../scheduling/managerSiteBookingUtils.ts'

// Rulebook 1.47.0 §8: a signed timesheet reopens when its bookings change (web wiring over the rulebook).

const person = {
  id: 'u1',
  email: 'ada@x.com',
  firstName: 'Ada',
  surname: 'Booked',
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
} as unknown as User
const manager = { ...person, id: 'mgr', email: 'mgr@x.com', firstName: 'Morgan', role: 'manager', permissions: { manager: true }, assignedManagerUserId: undefined } as unknown as User
const users = [person, manager]

const operative = {
  id: 'op1',
  firstName: 'Ada',
  lastName: 'Booked',
  email: 'ada@x.com',
  startDate: new Date(),
  hourlyRate: 0,
  dayRate: 200,
  skills: [],
  qualifications: [],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
} as Operative
const project = {
  id: 'proj1',
  jobNumber: 'J-1',
  siteName: 'Site One',
  startDate: new Date(),
  endDate: new Date(),
  jobType: 'CAT A',
  isLive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Project

const day = new Date('2026-09-16T08:00:00Z')
function booking(partial: Partial<Booking> = {}): Booking {
  return {
    id: 'b1',
    operativeId: 'op1',
    projectId: 'proj1',
    date: day,
    timeSlot: 'CUSTOM',
    workStartTime: '07:00',
    workEndTime: '16:00',
    bookedBy: 'Ada',
    status: 'Confirmed',
    createdAt: new Date('2026-09-10T08:00:00Z'),
    updatedAt: new Date('2026-09-10T08:00:00Z'),
    ...partial,
  } as Booking
}

const period = { start: new Date('2026-09-14T00:00:00Z'), end: new Date('2026-09-20T00:00:00Z') }
const collectorBase = {
  managerSiteBookings: [],
  operatives: [operative],
  projects: [project],
  smallWorks: [],
  payrollPolicy: DEFAULT_PAYROLL_POLICY,
  timeZone: 'Europe/London',
}
function linesFor(bookings: Booking[], managerSiteBookings: ManagerSiteBooking[] = [], options: Partial<Parameters<typeof collectTimesheetPayroll>[0]> = {}) {
  return collectTimesheetPayroll({ ...collectorBase, managerSiteBookings, user: person, bookings, periodStart: period.start, periodEnd: period.end, ...options }).lineItems
}
function recordOf(bookings: Booking[], managerSiteBookings: ManagerSiteBooking[] = []) {
  return draftSignedBookingRecord({ lines: linesFor(bookings, managerSiteBookings), bookings, managerSiteBookings, timeZone: 'Europe/London' })
}
function changes(draft: TimesheetDraft, bookings: Booking[], managerSiteBookings: ManagerSiteBooking[] = [], lines = linesFor(bookings, managerSiteBookings)) {
  return draftBookingChanges({
    draft,
    lines,
    bookings,
    managerSiteBookings,
    timeZone: 'Europe/London',
    personIds: timesheetPersonIds(person, users, [operative]),
    liveLoaded: true,
    selfSigned: false,
  })
}
function signedSheet(bookings: Booking[], managerSiteBookings: ManagerSiteBooking[] = []): TimesheetDraft {
  const signed: TimesheetDraft = {
    ...emptyTimesheetDraft(),
    operativeSignedAt: new Date('2026-09-18T09:00:00Z'),
    operativeSignedByName: 'Ada Booked',
    operativeSignedBookings: recordOf(bookings, managerSiteBookings),
    operativeSignedBookingsAt: new Date('2026-09-18T09:00:00Z'),
    operativeSignedBookingsSignedAt: new Date('2026-09-18T09:00:00Z'),
    managerSignedAt: new Date('2026-09-18T10:00:00Z'),
    managerSignedByName: 'Morgan',
    managerSignedByUserId: 'mgr',
  }
  return applyWeeklyReportOverride({
    ...collectorBase,
    draft: signed,
    user: person,
    users,
    weekStart: period.start,
    weekEnd: period.end,
    bookings,
    managerSiteBookings,
  })
}

test('1.47.0 web: a changed booking reopens a signed sheet for the person; re-signing then counter-signing rebuilds it', () => {
  const sheet = signedSheet([booking()])
  assert.ok(sheet.weeklyReportOverride?.lines.length)
  const unchanged = changes(sheet, [booking()])
  assert.equal(unchanged.changed, false)

  const moved = [booking({ workEndTime: '18:00', updatedAt: new Date('2026-09-19T08:00:00Z') })]
  const change = changes(sheet, moved)
  assert.equal(change.reopened, true)
  assert.equal(change.waitingFor, 'person')
  // Figures come from the live bookings while reopened.
  assert.equal(draftForFigures(sheet, change).weeklyReportOverride, null)

  // The person signs again (record of the live bookings): now waiting for the line manager.
  const resigned: TimesheetDraft = {
    ...sheet,
    operativeSignedAt: new Date('2026-09-19T09:00:00Z'),
    operativeSignedBookings: recordOf(moved),
    operativeSignedBookingsAt: new Date('2026-09-19T09:00:00Z'),
    operativeSignedBookingsSignedAt: new Date('2026-09-19T09:00:00Z'),
  }
  const afterResign = changes(resigned, moved)
  assert.equal(afterResign.waitingFor, 'lineManager')
  assert.equal(signedTimesheetActions(afterResign).mayExport, false)

  // The line manager counter-signs again: the snapshot is rebuilt from the live bookings.
  const countersigned = applyWeeklyReportOverride({
    ...collectorBase,
    draft: { ...resigned, managerSignedAt: new Date('2026-09-19T10:00:00Z') },
    rebuildSnapshot: true,
    user: person,
    users,
    weekStart: period.start,
    weekEnd: period.end,
    bookings: moved,
  })
  const done = changes(countersigned, moved)
  assert.equal(done.changed, false)
  // Without rebuildSnapshot the stored lines stay (1.43.0 rule, unchanged).
  const kept = applyWeeklyReportOverride({
    ...collectorBase,
    draft: resigned,
    user: person,
    users,
    weekStart: period.start,
    weekEnd: period.end,
    bookings: moved,
  })
  assert.deepEqual(kept.weeklyReportOverride?.lines, sheet.weeklyReportOverride?.lines)
})

test('1.47.0 web: an exported sheet is never rebuilt and reads as frozen', () => {
  const exported = { ...signedSheet([booking()]), exportedAt: new Date('2026-09-19T08:00:00Z') }
  const moved = [booking({ workEndTime: '18:00' })]
  const change = changes(exported, moved)
  assert.equal(change.exported, true)
  assert.equal(change.reopened, false)
  const rebuilt = applyWeeklyReportOverride({
    ...collectorBase,
    draft: exported,
    rebuildSnapshot: true,
    user: person,
    users,
    weekStart: period.start,
    weekEnd: period.end,
    bookings: moved,
  })
  assert.deepEqual(rebuilt.weeklyReportOverride?.lines, exported.weeklyReportOverride?.lines)
})

test('1.47.0 web: periodBookingChanges waits for the bookings and ignores unsigned sheets', () => {
  const catalogue = { ...collectorBase, users, bookings: [booking({ workEndTime: '18:00' })], liveLoaded: false }
  const sheet = signedSheet([booking()])
  assert.equal(periodBookingChanges(catalogue, person, sheet, period), null)
  assert.equal(periodBookingChanges({ ...catalogue, liveLoaded: true }, person, emptyTimesheetDraft(), period), null)
  assert.equal(periodBookingChanges({ ...catalogue, liveLoaded: true }, person, sheet, period)?.waitingFor, 'person')
})

test('1.47.0 web: operativeSignedBookings round-trips through storage; an older sheet reads null', () => {
  const sheet = signedSheet([booking()])
  const back = draftFromFirestoreMap(draftToFirestoreMap(sheet))
  assert.deepEqual(back.operativeSignedBookings, sheet.operativeSignedBookings)
  assert.equal(draftFromFirestoreMap({ operativeSignedAt: new Date() }).operativeSignedBookings, null)
})

test('1.47.0 / 1.54.0 web (review #325 blocker 1): switching Office off in schedule options does not reopen; deleting it does', () => {
  const office = {
    id: 'm1',
    userId: 'u1',
    date: day,
    timeSlot: 'CUSTOM',
    locationType: 'office',
    workStartTime: '07:00',
    workEndTime: '16:00',
    createdAt: new Date('2026-09-10T08:00:00Z'),
    updatedAt: new Date('2026-09-10T08:00:00Z'),
  } as ManagerSiteBooking
  const sheet = signedSheet([booking()], [office])
  assert.ok(sheet.operativeSignedBookings?.some((row) => row.collection === 'managerSiteBookings'))
  const officeOff = linesFor([booking()], [office], { scheduleOptions: { ...DEFAULT_MY_SCHEDULE, showOffice: false } })
  // 1.54.0 (owner decision 16 Nov): a switched-off option no longer takes the booking off the sheet — it is paid.
  assert.equal(officeOff.some((line) => line.id.startsWith('mgr-')), true, 'the collector keeps the office booking')
  assert.equal(changes(sheet, [booking()], [office], officeOff).changed, false)
  // A real delete (the document is gone) reopens.
  const deleted = changes(sheet, [booking()], [], linesFor([booking()], []))
  assert.equal(deleted.reopened, true)
  assert.deepEqual(deleted.removedBookingIds, ['m1'])
})

test('1.47.0 web (review #325 blocker 2): the person no longer matched to an old booking (email change, row unlinked) does not reopen', () => {
  const sheet = signedSheet([booking()])
  // The collector no longer finds the booking for the person (no operatives row on their email any more).
  const unlinked = linesFor([booking()], [], { operatives: [] })
  assert.equal(unlinked.length, 0)
  assert.equal(changes(sheet, [booking()], [], unlinked).changed, false)
  // The booking given to another operative: removed.
  assert.equal(changes(sheet, [booking({ operativeId: 'op2' })], [], unlinked).reopened, true)
})

test('1.47.0 web (second review 1): a booking rewritten from the operatives row to the users id is still theirs', () => {
  const sheet = signedSheet([booking()])
  assert.deepEqual(timesheetPersonIds(person, users, [operative]).sort(), ['op1', 'u1'])
  // The booking now stored under the person's users id: the collector still finds it, or not — either way no change.
  assert.equal(changes(sheet, [booking({ operativeId: 'u1' })], [], []).changed, false)
  assert.equal(changes(sheet, [booking({ operativeId: 'u1' })]).changed, false)
})

test('1.47.0 web (second review 4): a job change on a signed booking reopens', () => {
  const sheet = signedSheet([booking()])
  assert.equal(sheet.operativeSignedBookings?.[0].place, 'job|proj1')
  const moved = [booking({ projectId: 'proj2', updatedAt: new Date('2026-09-19T08:00:00Z') })]
  assert.equal(changes(sheet, moved, [], linesFor([booking()])).reopened, true)
})

test('1.47.0 web (second review 3): the record time is written as the server time, never this device clock', () => {
  const sheet = { ...signedSheet([booking()]), operativeSignedBookingsAt: null, operativeSignedBookingsAtPending: true }
  const map = draftToFirestoreMap(sheet)
  assert.equal('operativeSignedBookingsAt' in map, false)
  assert.ok(map.operativeSignedBookingsSignedAt)
  // While pending, the comparison falls back to the device signature less the window (conservative).
  const fresh = [booking(), booking({ id: 'b2', date: new Date('2026-09-17T08:00:00Z'), createdAt: new Date('2026-09-18T08:55:00Z'), updatedAt: new Date('2026-09-18T08:55:00Z') })]
  assert.deepEqual(changes(sheet, fresh).addedBookingIds, ['b2'])
})

test('1.47.0 web (third review 1): the pending server-time flag clears on the draft as it is now, for that signature only', () => {
  const signedAt = new Date('2026-09-18T09:00:00Z')
  const pending = { ...emptyTimesheetDraft(), operativeSignedBookingsSignedAt: signedAt, operativeSignedBookingsAtPending: true }
  // The draft changed during the save (a note typed): still the same signature — cleared.
  const edited = { ...pending, managerNote: 'typed during the save' }
  assert.equal(clearSignedBookingsPending(edited, signedAt).operativeSignedBookingsAtPending, false)
  assert.equal(clearSignedBookingsPending(edited, signedAt).managerNote, 'typed during the save')
  // A newer signature keeps its own flag.
  const newer = { ...pending, operativeSignedBookingsSignedAt: new Date('2026-09-18T09:05:00Z') }
  assert.equal(clearSignedBookingsPending(newer, signedAt).operativeSignedBookingsAtPending, true)
  // Nothing to clear: the same object back.
  assert.equal(clearSignedBookingsPending(edited, null), edited)
})

const lateExpense154 = {
  kind: 'expense' as const,
  id: 'L1',
  title: 'Parking',
  details: '',
  jobNumber: 'J-1',
  date: day,
  amount: 12,
  receiptName: null,
  evidence: [],
  managerDecision: 'pending' as const,
  managerRevisedAmount: null,
}

test('1.54.0 web: a late extra waits for the line manager, pays nothing, and joins the snapshot only once approved', () => {
  const sheet = signedSheet([booking()])
  const signedLines = sheet.weeklyReportOverride!.lines
  // Stored and read back: the reader gives the late decision (pending) and the stored row's fingerprint.
  const stored = draftToFirestoreMap({ ...sheet, lateExtras: [{ ...lateExpense154, managerDecision: 'approved' }] }) as Record<string, unknown>
  const storedLate = (stored.lateExtras as Record<string, unknown>[])[0]
  assert.equal('managerDecision' in storedLate, false, 'a late extra never stores a decision')
  assert.equal(storedLate.kind, 'expense')
  const loaded = draftFromFirestoreMap(stored)
  const late = loaded.lateExtras![0]
  assert.equal(late.managerDecision, 'pending')
  assert.ok(late.reviewFingerprint)
  const withLate: TimesheetDraft = { ...sheet, lateExtras: [late] }
  // Lists: with the line manager (no booking changed); nothing for the person to sign; export blocked.
  const change = changes(withLate, [booking()])
  assert.deepEqual([change.reopened, change.waitingFor, change.bookingsChanged], [true, 'lineManager', false])
  assert.equal(signedTimesheetActions(change).mayExport, false)
  // Figures stay the signed snapshot (late extras alone never discard it).
  assert.equal(draftForFigures(withLate, change), withLate)
  const base = { ...collectorBase, user: person, users, weekStart: period.start, weekEnd: period.end, bookings: [booking()], managerSiteBookings: [] }
  // A routine save before any decision: no late row in the snapshot.
  const saved = applyWeeklyReportOverride({ ...base, draft: withLate })
  assert.equal(saved.weeklyReportOverride?.expenses.length, 0)
  // The line manager approves it (✓ on screen): the approving save adds it to the money rows, marked `lateExtra`,
  // and the signed labour rows stay exactly as signed — even with the booking now running later.
  const approvedOnScreen: TimesheetDraft = { ...withLate, extraEntryReviews: {}, lateExtras: [{ ...late, managerDecision: 'approved' }] }
  const later = booking({ workEndTime: '19:00' })
  const approved = applyWeeklyReportOverride({ ...base, bookings: [later], draft: approvedOnScreen })
  assert.deepEqual(approved.weeklyReportOverride?.expenses.map((row) => [row.id, row.amount, row.lateExtra]), [['L1', 12, true]])
  assert.deepEqual(approved.weeklyReportOverride?.lines.map((line) => [line.id, line.amount]), signedLines.map((line) => [line.id, line.amount]))
  // The flag round-trips on the stored snapshot row.
  const back = draftFromFirestoreMap(draftToFirestoreMap(approved) as Record<string, unknown>)
  assert.equal(back.weeklyReportOverride?.expenses[0]?.lateExtra, true)
})

test('1.54.0 web: an inline "approved" on a late extra (the person\'s own copy) never reaches the snapshot without a reviewer', () => {
  const sheet = signedSheet([booking()])
  // The person's in-memory copy says approved, but the stored review map has nothing: a non-reviewer's override is
  // never written (rules), and the rule reads only the map — so the totals and the waiting state ignore it.
  const forged: TimesheetDraft = { ...sheet, extraEntryReviews: {}, lateExtras: [{ ...lateExpense154, amount: 1000, managerDecision: 'approved', reviewFingerprint: 'x' }] }
  const change = changes(forged, [booking()])
  assert.equal(change.waitingFor, 'lineManager')
})

const office154 = {
  id: 'm1',
  userId: 'u1',
  date: day,
  timeSlot: 'CUSTOM',
  locationType: 'office',
  workStartTime: '07:00',
  workEndTime: '16:00',
  createdAt: new Date('2026-09-10T08:00:00Z'),
  updatedAt: new Date('2026-09-10T08:00:00Z'),
} as ManagerSiteBooking

test('1.54.0 review of #337 (2): a sheet signed while Office was off is never "repaired" with the newly paid Office pay', () => {
  // Signed with only Office bookings while Office was switched off: the snapshot froze with no labour lines.
  const signed = signedSheet([], [office154])
  const frozen: TimesheetDraft = { ...signed, weeklyReportOverride: { ...signed.weeklyReportOverride!, lines: [] } }
  const base = { ...collectorBase, user: person, users, weekStart: period.start, weekEnd: period.end, bookings: [] as Booking[], managerSiteBookings: [office154] }
  const saved = applyWeeklyReportOverride({ ...base, draft: frozen })
  assert.equal(saved.weeklyReportOverride?.lines.length, 0, 'signed is final: no Office lines enter the snapshot')
  // And the change rule does not read it as a frozen-empty repair either: nothing changed.
  assert.equal(changes(frozen, [], [office154]).changed, false)
})


test('1.54.0 fourth review of #337 (5): a stale late extra leaves the figures at once; an exported sheet stays as signed', () => {
  const day = new Date('2026-11-12T10:00:00Z')
  const late = { kind: 'expense' as const, id: 'L1', title: 'Taxi', details: '', jobNumber: 'J', date: day, amount: 25, managerDecision: 'approved' as const }
  const stored = { kind: 'expense', id: 'L1', title: 'Taxi', details: '', jobNumber: 'J', date: day, amount: 25 }
  const signed: TimesheetDraft = {
    ...emptyTimesheetDraft(),
    managerSignedAt: day,
    lateExtras: [late],
    extraEntryReviews: {
      L1: { decision: 'approved', revisedAmount: null, reviewedAmount: 25, reviewedFingerprint: timesheetEntryFingerprint(stored, 'expense'), reviewedByUserId: 'lm', reviewedAtMs: 1, lateExtra: true },
    },
    weeklyReportOverride: {
      approvedAt: day, approvedByUserId: 'lm', approvedByName: 'Lou', selfSigned: false, lines: [], priceWork: [],
      expenses: [{ id: 'L1', title: 'Taxi', details: '', jobNumber: 'J', date: day, amount: 25, decision: 'approved', lateExtra: true }],
    },
  }
  const waiting = { reopened: true, bookingsChanged: false }
  assert.equal(draftForFigures(signed, waiting).weeklyReportOverride?.expenses.length, 1)
  // The person edits it to £900: the review is stale, so the old £25 row is no longer shown.
  const edited = { ...signed, lateExtras: [{ ...late, amount: 900 }] }
  assert.equal(draftForFigures(edited, waiting).weeklyReportOverride?.expenses.length, 0)
  assert.equal(draftForFigures({ ...edited, exportedAt: day, exportedAtStored: true }, null).weeklyReportOverride?.expenses.length, 1)
})

test('16 Nov scan: a stored late extra the reader skips (blank title, duplicate id) is written back unchanged, never dropped', () => {
  const sheet = signedSheet([booking()])
  const stored = draftToFirestoreMap({ ...sheet, lateExtras: [lateExpense154] }) as Record<string, unknown>
  const blank = { kind: 'expense', id: 'L2', title: '   ', details: 'from an older iPhone', jobNumber: 'J-1', amount: 30 }
  const duplicate = { kind: 'expense', id: 'l1', title: 'Second copy', jobNumber: 'J-1', amount: 5 }
  const raw = { ...stored, lateExtras: [...(stored.lateExtras as Record<string, unknown>[]), blank, duplicate] }
  const loaded = draftFromFirestoreMap(raw)
  assert.deepEqual(loaded.lateExtras!.map((entry) => entry.id), ['L1'], 'only the readable row is shown')
  assert.deepEqual(loaded.lateExtrasUnread, [blank, duplicate])
  // An unchanged save writes the kept rows back exactly as stored.
  const unchanged = draftToFirestoreMap(loaded) as Record<string, unknown>
  assert.deepEqual((unchanged.lateExtras as Record<string, unknown>[]).slice(1), [blank, duplicate])
  // Review of #347: the person deletes L1 — its hidden same-id copy goes with it; the blank row stays as stored.
  const unread = lateExtrasUnreadAfter(loaded.lateExtrasUnread, loaded.lateExtras, [])
  assert.deepEqual(unread, [blank])
  const saved = draftToFirestoreMap({ ...loaded, lateExtras: [], lateExtrasUnread: unread }) as Record<string, unknown>
  assert.deepEqual(saved.lateExtras, [blank])
  // Editing L1 (same id) keeps every kept row.
  assert.deepEqual(lateExtrasUnreadAfter(loaded.lateExtrasUnread, loaded.lateExtras, [{ ...loaded.lateExtras![0], amount: 13 }]), [blank, duplicate])
  // A sheet whose rows were all read carries no unread list.
  assert.equal(draftFromFirestoreMap(stored).lateExtrasUnread, undefined)
})

test('review of #347: an unchanged owner save passes the late-extras check even with kept rows (no evidence, same id)', () => {
  const sheet = signedSheet([booking()])
  const stored = draftToFirestoreMap({ ...sheet, lateExtras: [lateExpense154] }) as Record<string, unknown>
  const duplicate = { kind: 'expense', id: 'l1', title: 'Second copy', jobNumber: 'J-1', amount: 5 }
  const blank = { kind: 'expense', id: 'L2', title: '', amount: 30 }
  const loaded = draftFromFirestoreMap({ ...stored, lateExtras: [...(stored.lateExtras as Record<string, unknown>[]), duplicate, blank] })
  assert.equal(ownerLateExtrasError({ base: loaded, draft: loaded, organizationId: 'org', ownerUserIds: ['u1'] }), null)
  // A new expense of the person's own without evidence is still refused (the rule is unchanged for their edits).
  const added = { ...lateExpense154, id: 'L9', title: 'Taxi', evidence: [] }
  const withNew = { ...loaded, lateExtras: [...loaded.lateExtras!, { ...added, kind: 'expense' as const }] }
  assert.ok(ownerLateExtrasError({ base: loaded, draft: withNew, organizationId: 'org', ownerUserIds: ['u1'] }))
})

test('review of #347: the read row is the first titled row of an id (without case); a blank row before it is kept', () => {
  const sheet = signedSheet([booking()])
  const blank = { kind: 'expense', id: 'X1', title: '  ', amount: 30 }
  const real = { kind: 'expense', id: 'x1', title: 'Real', jobNumber: 'J-1', amount: 7, date: day }
  const loaded = draftFromFirestoreMap({ ...(draftToFirestoreMap(sheet) as Record<string, unknown>), lateExtras: [blank, real] })
  assert.deepEqual(loaded.lateExtras!.map((entry) => [entry.id, entry.title, entry.amount]), [['x1', 'Real', 7]])
  assert.deepEqual(loaded.lateExtrasUnread, [blank])
  const saved = (draftToFirestoreMap(loaded) as Record<string, unknown>).lateExtras as Record<string, unknown>[]
  assert.equal(saved.length, 2)
  // Second review of #347: every row stays in its stored slot, so the decision of "Real" does not change.
  assert.deepEqual(saved.map((row) => [row.id, row.title, row.amount]), [['X1', '  ', 30], ['x1', 'Real', 7]])
  const reloaded = draftFromFirestoreMap({ ...(draftToFirestoreMap(sheet) as Record<string, unknown>), lateExtras: saved })
  assert.deepEqual(reloaded.lateExtras!.map((entry) => [entry.id, entry.lateState]), loaded.lateExtras!.map((entry) => [entry.id, entry.lateState]))
  assert.deepEqual((draftToFirestoreMap(reloaded) as Record<string, unknown>).lateExtras, saved)
})

test('second review of #347: an unrelated save keeps the stored order of late extras and their decisions', () => {
  const sheet = signedSheet([booking()])
  const base = draftToFirestoreMap(sheet) as Record<string, unknown>
  const blank = { kind: 'expense', id: 'X1', title: ' ', amount: 30 }
  const real = { kind: 'expense', id: 'x1', title: 'Real', jobNumber: 'J-1', amount: 7, date: day }
  const other = { kind: 'expense', id: 'Y1', title: 'Other', jobNumber: 'J-2', amount: 4, date: day }
  const junk = { id: 'Z', title: 'No kind', amount: 2 }
  const stored = [blank, other, junk, real]
  const loaded = draftFromFirestoreMap({ ...base, lateExtras: stored })
  const states = loaded.lateExtras!.map((entry) => [entry.id, entry.lateState])
  // An unrelated change (the manager note) writes the list back in its stored order.
  const saved = (draftToFirestoreMap({ ...loaded, managerNote: 'note' }) as Record<string, unknown>).lateExtras as Record<string, unknown>[]
  assert.deepEqual(saved.map((row) => row.id), ['X1', 'Y1', 'Z', 'x1'])
  const reloaded = draftFromFirestoreMap({ ...base, lateExtras: saved })
  assert.deepEqual(reloaded.lateExtras!.map((entry) => [entry.id, entry.lateState]), states)
  // Editing a shown row keeps its slot; a new row is appended; a deleted shown row leaves its slot empty.
  const edited = loaded.lateExtras!.map((entry) => (entry.id === 'Y1' ? { ...entry, amount: 9 } : entry))
  const added = { ...loaded.lateExtras![0], id: 'N1', title: 'New' }
  const withNew = (draftToFirestoreMap({ ...loaded, lateExtras: [...edited, added] }) as Record<string, unknown>).lateExtras as Record<string, unknown>[]
  assert.deepEqual(withNew.map((row) => [row.id, row.amount]), [['X1', 30], ['Y1', 9], ['Z', 2], ['x1', 7], ['N1', 7]])
  const nextLate = loaded.lateExtras!.filter((entry) => entry.id !== 'Y1')
  const unread = lateExtrasUnreadAfter(loaded.lateExtrasUnread, loaded.lateExtras, nextLate)
  const deleted = (draftToFirestoreMap({ ...loaded, lateExtras: nextLate, lateExtrasUnread: unread }) as Record<string, unknown>).lateExtras as Record<string, unknown>[]
  assert.deepEqual(deleted.map((row) => row.id), ['X1', 'Z', 'x1'])
})

test('second review of #347: deleting a late extra drops only kept rows the reader could show', () => {
  const blank = { kind: 'expense', id: 'l1', title: '  ', amount: 30 }
  const padded = { kind: ' expense ', id: 'L1', title: 'Padded', amount: 3 }
  const noKind = { id: 'L1', title: 'No kind', amount: 4 }
  const numericId = { kind: 'expense', id: 5, title: 'Number', amount: 5 }
  const copy = { kind: 'priceWork', id: 'l1', title: 'Shown copy', amount: 6 }
  const unread = [blank, padded, noKind, numericId, copy]
  const kept = lateExtrasUnreadAfter(unread, [{ id: 'L1' }, { id: '5' }], [])
  assert.deepEqual(kept, [blank, padded, noKind, numericId])
})
