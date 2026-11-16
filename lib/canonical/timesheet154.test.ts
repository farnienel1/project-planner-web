import assert from 'node:assert/strict'
import test from 'node:test'
import * as R from './index'

// Rulebook 1.54.0 §8 (owner decisions 16 Nov): late extras (price work and expenses after the line manager signs), the
// "Your signed timesheet has changed" notice and Data health "Timesheets half signed".

const SIGNED = new Date('2026-11-12T10:00:00Z')
const COUNTER = new Date('2026-11-12T11:00:00Z')

// Rulebook 1.54.0 §8 (owner decision 16 Nov, redesigned after two reviews of #337): late extras. The signed entries
// never change after the line manager signs; added price work / expenses go in `lateExtras` and pay only once a
// reviewer approves them in the review map (`lateExtra: true`, with the entry's fingerprint).

const LM = 'lm-1'
const lateExpense = (id: string, amount: number, extra: Record<string, unknown> = {}) => ({
  kind: 'expense',
  id,
  title: `Late ${id}`,
  details: '',
  jobNumber: 'J-7',
  date: SIGNED,
  amount,
  ...extra,
})
const fpOf = (row: Record<string, unknown>) => R.timesheetEntryFingerprint(row, row.kind === 'priceWork' ? 'priceWork' : 'expense')
const lateReview = (row: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  decision: 'approved',
  revisedAmount: null,
  reviewedAmount: row.amount,
  reviewedFingerprint: fpOf(row),
  reviewedByUserId: LM,
  reviewedAtMs: 1,
  lateExtra: true,
  ...extra,
})
const signedExpense = { id: 'E1', title: 'Parking', details: '', jobNumber: 'J-1', date: SIGNED, amount: 100 }
// A sheet the line manager counter-signed, its £100 expense approved in the review map and in the snapshot.
const counterSignedSheet = (extra: Record<string, unknown> = {}) => ({
  operativeSignedAt: SIGNED,
  managerSignedAt: COUNTER,
  approvedAt: COUNTER,
  expenseEntries: [signedExpense],
  priceWorkEntries: [],
  extraEntryReviews: { E1: { decision: 'approved', revisedAmount: null, reviewedAmount: 100, reviewedFingerprint: R.timesheetEntryFingerprint(signedExpense, 'expense'), reviewedByUserId: LM, reviewedAtMs: 1 } },
  weeklyReportOverride: { approvedAt: COUNTER, lines: [], priceWork: [], expenses: [{ id: 'E1', title: 'Parking', amount: 100, decision: 'approved' }] },
  ...extra,
})
const invoiceTotal = (sheet: Record<string, unknown>) =>
  R.timesheetTotals({ sheet, payrollLines: [], extrasMode: 'decided' }).total

test('1.54.0 late extras: an added expense pays nothing until the line manager approves it, then exactly the approved amount', () => {
  const late = lateExpense('L1', 250)
  const added = counterSignedSheet({ lateExtras: [late] })
  // Not approved yet: pending, in no money figure, and the sheet waits for the line manager.
  assert.equal(R.timesheetLateExtraDecision(added, late).state, 'pending')
  assert.equal(invoiceTotal(added), 100)
  const summary = R.timesheetLateExtrasSummary(added)
  assert.deepEqual([summary.pending, summary.waitingForLineManager], [1, true])
  // No snapshot (live path): still nothing until approved.
  const live = { ...added, weeklyReportOverride: null }
  assert.equal(invoiceTotal(live), 100)
  // Approved by the line manager in the review map: it pays, live path and (once the approving save wrote it) snapshot.
  const approved = { ...live, extraEntryReviews: { ...(live.extraEntryReviews as object), L1: lateReview(late) } }
  assert.equal(R.timesheetLateExtraDecision(approved, late).paid, 250)
  assert.equal(invoiceTotal(approved), 350)
  const rows = R.timesheetLateExtrasSnapshotRows(approved)
  assert.deepEqual(rows.expenses.map((row) => [row.id, row.amount, row.lateExtra]), [['L1', 250, true]])
  const snapshotted = {
    ...approved,
    weeklyReportOverride: { approvedAt: COUNTER, lines: [], priceWork: [], expenses: [{ id: 'E1', title: 'Parking', amount: 100, decision: 'approved' }, ...rows.expenses] },
  }
  assert.equal(invoiceTotal(snapshotted), 350)
  assert.equal(R.timesheetLateExtrasSummary(snapshotted).waitingForLineManager, false)
  // Declined: 0, not waiting.
  const declined = { ...live, extraEntryReviews: { ...(live.extraEntryReviews as object), L1: lateReview(late, { decision: 'declined' }) } }
  assert.equal(invoiceTotal(declined), 100)
  assert.equal(R.timesheetLateExtrasSummary(declined).waitingForLineManager, false)
  // Edited by the line manager: the revised amount.
  const edited = { ...live, extraEntryReviews: { ...(live.extraEntryReviews as object), L1: lateReview(late, { decision: 'edited', revisedAmount: 120 }) } }
  assert.equal(invoiceTotal(edited), 220)
})

test('1.54.0 review of #337 attack 1: the person raises an approved £100 expense to £1,000 after the counter-signature — impossible or pays nothing', () => {
  // The signed entries cannot change (firestore.rules: list equality after managerSignedAt; tests/firestore.rules.test.ts).
  // Even on a sheet with NO snapshot, the most the person can do is add a late extra, which pays nothing unapproved.
  for (const snapshot of [true, false]) {
    const base = counterSignedSheet(snapshot ? {} : { weeklyReportOverride: null })
    const forged = { ...base, lateExtras: [lateExpense('L-raise', 1000)] }
    assert.equal(invoiceTotal(forged), 100, snapshot ? 'with snapshot' : 'without snapshot')
  }
  // A late extra copying the signed entry's id (to borrow its review) is ignored — never paid twice.
  const copy = { ...counterSignedSheet({ weeklyReportOverride: null }), lateExtras: [{ ...signedExpense, kind: 'expense', amount: 1000 }] }
  assert.equal(R.timesheetLateExtraDecision(copy, (copy.lateExtras as Record<string, unknown>[])[0]).state, 'ignored')
  assert.equal(invoiceTotal(copy), 100)
  const exact = { ...counterSignedSheet({ weeklyReportOverride: null }), lateExtras: [{ ...signedExpense, kind: 'expense' }] }
  assert.equal(invoiceTotal(exact), 100)
})

test('1.54.0 review of #337 attack 2: inline decisions and forged review shapes never pay a late extra', () => {
  const late = lateExpense('L2', 900, { managerDecision: 'approved', managerRevisedAmount: 900, reviewFingerprint: 'forged' })
  const sheet = counterSignedSheet({ weeklyReportOverride: null, lateExtras: [late] })
  assert.equal(R.timesheetLateExtraDecision(sheet, late).state, 'pending')
  assert.equal(invoiceTotal(sheet), 100)
  // A review without `lateExtra` (an ordinary entry review left in the map) never counts for a late extra.
  const ordinary = { ...sheet, extraEntryReviews: { ...(sheet.extraEntryReviews as object), L2: lateReview(late, { lateExtra: false }) } }
  assert.equal(R.timesheetLateExtraDecision(ordinary, late).reason, 'not-late-review')
  // Nor one without a fingerprint, nor one for an earlier version of the entry (edited after approval → stale).
  const noFp = { ...sheet, extraEntryReviews: { ...(sheet.extraEntryReviews as object), L2: lateReview(late, { reviewedFingerprint: null }) } }
  assert.equal(invoiceTotal(noFp), 100)
  const approvedAt250 = lateExpense('L2', 250)
  const raised = {
    ...sheet,
    lateExtras: [lateExpense('L2', 900)],
    extraEntryReviews: { ...(sheet.extraEntryReviews as object), L2: lateReview(approvedAt250) },
  }
  assert.equal(R.timesheetLateExtraDecision(raised, (raised.lateExtras as Record<string, unknown>[])[0]).reason, 'stale-review')
  assert.equal(invoiceTotal(raised), 100)
  // A duplicate id inside lateExtras pays once.
  const twice = { ...sheet, lateExtras: [approvedAt250, approvedAt250], extraEntryReviews: { ...(sheet.extraEntryReviews as object), L2: lateReview(approvedAt250) } }
  assert.equal(invoiceTotal(twice), 350)
  // A row with no kind is ignored.
  assert.equal(R.timesheetLateExtraDecision(sheet, { ...late, kind: 'bonus' }).state, 'ignored')
})

test('1.54.0 review of #337 attack 3: clearing the person\'s own signature so a reviewer save drops the snapshot pays no more', () => {
  // The person clears operativeSignedAt (allowed: an owner field) — the web reviewer save then writes no snapshot
  // (`applyWeeklyReportOverride` while not fully approved). The live path still pays the signed entries by their
  // decisions and late extras only when approved.
  const cleared = counterSignedSheet({ operativeSignedAt: null, weeklyReportOverride: null, lateExtras: [lateExpense('L3', 5000)] })
  assert.equal(invoiceTotal(cleared), 100)
})

test('1.54.0 late extras: the add control — after the line manager signs, until exported; never for a self-signed sheet', () => {
  assert.deepEqual(R.timesheetOwnerCanAddLateExtras({}), { allowed: false, message: null })
  assert.deepEqual(R.timesheetOwnerCanAddLateExtras({ managerSignedAt: COUNTER }), { allowed: true, message: null })
  assert.deepEqual(R.timesheetOwnerCanAddLateExtras({ managerSignedAt: COUNTER, exportedAt: COUNTER }), {
    allowed: false,
    message: R.TIMESHEET_EXPORTED_EXTRAS_MESSAGE,
  })
  // The stored field the rules test decides, whatever the lists read.
  assert.equal(R.timesheetOwnerCanAddLateExtras({ managerSignedAt: COUNTER, exportedAtStored: true }).allowed, false)
  assert.equal(R.timesheetOwnerCanAddLateExtras({ managerSignedAt: COUNTER }, { selfSigned: true }).allowed, false)
  // The signed entries stay closed once the line manager signed (1.43.0, restored).
  assert.deepEqual(R.timesheetOwnerCanAddExtras({ managerSignedAt: COUNTER }), { allowed: false, message: R.TIMESHEET_SIGNED_OFF_EXTRAS_MESSAGE })
})

test('1.54.0 late extras: lists treat a waiting late extra as with the line manager; exported sheets and old sheets unchanged', () => {
  const noBookingChange = {
    changed: false,
    exported: false,
    reopened: false,
    waitingFor: null,
    basis: 'none' as const,
    changedBookingIds: [],
    addedBookingIds: [],
    removedBookingIds: [],
    message: null,
    reviewerMessage: null,
  }
  const waiting = R.timesheetChangesWithLateExtras(noBookingChange, { waitingForLineManager: true })!
  assert.deepEqual([waiting.reopened, waiting.waitingFor, waiting.bookingsChanged, waiting.message], [true, 'lineManager', false, null])
  assert.equal(waiting.reviewerMessage, R.TIMESHEET_LATE_EXTRAS_REVIEWER_MESSAGE)
  assert.equal(R.signedTimesheetActions(waiting).mayExport, false)
  assert.equal(R.timesheetListBucket(R.parseTimesheetStatusFields({ operativeSignedAt: SIGNED, operativeSignedByName: 'Ada', managerSignedAt: COUNTER, managerSignedByName: 'Lou' }), true, waiting), 'awaiting')
  // A booking change wins (the person signs again first).
  const bookings = R.timesheetChangesWithLateExtras({ ...noBookingChange, changed: true, reopened: true, waitingFor: 'person' }, { waitingForLineManager: true })!
  assert.deepEqual([bookings.waitingFor, bookings.bookingsChanged], ['person', true])
  // Nothing waiting: the booking answer as it was.
  assert.equal(R.timesheetChangesWithLateExtras(null, { waitingForLineManager: false }), null)
  assert.equal(R.timesheetChangesWithLateExtras(noBookingChange, { waitingForLineManager: false })!.reopened, false)
  // Exported: never waiting.
  const exported = counterSignedSheet({ exportedAt: COUNTER, lateExtras: [lateExpense('L4', 10)] })
  assert.equal(R.timesheetLateExtrasSummary(exported).waitingForLineManager, false)
  // Guardrail 3: a sheet signed before 1.54.0 (no lateExtras) reads exactly as before — no triangle, no re-pricing.
  const old = counterSignedSheet()
  assert.deepEqual(R.timesheetLateExtrasSummary(old), { pending: 0, approved: 0, declined: 0, snapshotInStep: true, exported: false, waitingForLineManager: false })
  assert.equal(invoiceTotal(old), 100)
  // A snapshot whose late rows no longer match the approved ones waits for the reviewer's next save.
  const stale = counterSignedSheet({
    lateExtras: [lateExpense('L5', 40)],
    extraEntryReviews: { L5: lateReview(lateExpense('L5', 40)) },
    weeklyReportOverride: { approvedAt: COUNTER, lines: [], priceWork: [], expenses: [] },
  })
  assert.equal(R.timesheetLateExtrasSummary(stale).snapshotInStep, false)
})

test('1.54.0 late extras: the reviewer\'s review write carries lateExtra and needs the fingerprint', () => {
  const late = lateExpense('L6', 30)
  const fields = R.timesheetEntryReviewWriteFields({
    stored: {},
    entries: [{ ...late, managerDecision: 'approved', reviewFingerprint: fpOf(late), lateExtra: true } as never],
    reviewedByUserId: LM,
    reviewedAtMs: 5,
  })
  assert.equal((fields['extraEntryReviews.L6'] as Record<string, unknown>).lateExtra, true)
  // Without a fingerprint nothing is written for a late extra.
  assert.deepEqual(
    R.timesheetEntryReviewWriteFields({ stored: {}, entries: [{ ...late, managerDecision: 'approved', lateExtra: true } as never], reviewedByUserId: LM, reviewedAtMs: 5 }),
    {}
  )
  // The reader keeps the entries in stored order with their late decision (never an inline one).
  const parsed = R.parseTimesheetLateExtras('timesheet_u_1', {
    userId: 'u',
    managerSignedAt: COUNTER,
    lateExtras: [{ ...late, managerDecision: 'approved' }, { kind: 'priceWork', id: 'P9', title: 'Extra', jobNumber: 'J', startDate: SIGNED, amount: 5 }],
  })
  assert.deepEqual(parsed.map((row) => [row.id, row.kind, row.managerDecision]), [['L6', 'expense', 'pending'], ['P9', 'priceWork', 'pending']])
})

const PERSON = 'person-1'
const doc = (extra: Record<string, unknown> = {}) => ({
  bookingId: 'B1',
  collection: 'bookings',
  dayKey: '2026-11-10',
  timeSlot: 'CUSTOM_HOURS',
  workStartTime: '07:00',
  workEndTime: '16:00',
  isBreakRemoved: false,
  otMultiplierOverride: null,
  status: 'Confirmed',
  personId: PERSON,
  projectId: 'j1',
  ...extra,
})
const FP_B1 = R.overtimeBookingFingerprint({
  id: 'B1',
  personId: '',
  dayKey: '2026-11-10',
  timeSlot: 'CUSTOM_HOURS',
  workStartTime: '07:00',
  workEndTime: '16:00',
  isBreakRemoved: false,
  otMultiplierOverride: null,
  status: 'Confirmed',
} as never)
const sheet = (extra: Record<string, unknown> = {}) => ({
  userId: PERSON,
  operativeSignedAt: SIGNED,
  operativeSignedBookings: [{ bookingId: 'B1', collection: 'bookings', fingerprint: FP_B1, personId: PERSON, place: 'job|j1' }],
  operativeSignedBookingsSignedAt: SIGNED,
  ...extra,
})
const notice = (input: Partial<Parameters<typeof R.timesheetBookingChangeNotice>[0]>) =>
  R.timesheetBookingChangeNotice({
    sheet: sheet(),
    periodStartDayKey: '2026-11-01',
    periodEndDayKey: '2026-11-15',
    before: doc(),
    after: doc({ workEndTime: '18:00' }),
    personIds: [PERSON],
    person: { id: PERSON, employmentType: 'self_employed', isActive: true },
    timeZone: 'Europe/London',
    ...input,
  })

test('1.54.0 timesheetBookingChangeNotice: a signed booking changed, deleted or cancelled tells the person', () => {
  assert.deepEqual(notice({}), { notify: true, reason: 'signed-booking-changed' })
  assert.equal(notice({ after: null }).notify, true)
  assert.equal(notice({ after: doc({ status: 'Cancelled' }) }).notify, true)
  assert.equal(notice({ after: doc({ projectId: 'j2' }) }).notify, true)
  // Moved out of the period: still the signed booking.
  assert.equal(notice({ after: doc({ dayKey: '2026-11-20' }) }).notify, true)
})

test('1.54.0 review of #337 (3): the notice follows the app — no fingerprint (pre-1.46) or no place (pre-1.47) never notifies a time or job change', () => {
  const pre146 = sheet({ operativeSignedBookings: [{ bookingId: 'B1', collection: 'bookings', fingerprint: '', personId: PERSON, place: 'job|j1' }] })
  assert.equal(notice({ sheet: pre146 }).notify, false)
  assert.equal(notice({ sheet: pre146, after: null }).notify, true)
  assert.equal(notice({ sheet: pre146, after: doc({ status: 'Cancelled' }) }).notify, true)
  const pre147 = { userId: PERSON, operativeSignedAt: SIGNED, managerSignedAt: COUNTER, weeklyReportOverride: { lines: [{ id: 'op-B1-normal', bookingId: 'B1', bookingFingerprint: FP_B1 }] } }
  assert.equal(notice({ sheet: pre147, after: doc({ projectId: 'j2' }) }).notify, false)
  assert.equal(notice({ sheet: pre147 }).notify, true)
  // The same booking write, read by the app's rule (`signedTimesheetBookingChanges`): the same answers.
  const appSays = (signedSheet: Record<string, unknown>, after: ReturnType<typeof doc>) =>
    R.signedTimesheetBookingChanges({
      sheet: signedSheet,
      liveLines: [{ id: 'op-B1-normal', bookingId: 'B1', bookingCollection: 'bookings', bookingFingerprint: R.overtimeBookingFingerprint({ ...after, id: 'B1', personId: '' } as never) }],
      liveLoaded: true,
      liveBookings: [after],
      personIds: [PERSON],
    }).reopened
  assert.equal(appSays(pre146, doc({ workEndTime: '18:00' })), false)
  assert.equal(appSays(pre147, doc({ projectId: 'j2' })), false)
  assert.equal(appSays(sheet(), doc({ workEndTime: '18:00' })), true)
})

test('1.54.0 timesheetBookingChangeNotice: a new booking on the sheet is an addition', () => {
  assert.deepEqual(notice({ before: null, after: doc({ bookingId: 'B2' }) }), { notify: true, reason: 'booking-added' })
})

test('1.54.0 timesheetBookingChangeNotice: never for a write the rule ignores, an exported or unsigned sheet, another person, a PAYE day or an unsigned booking', () => {
  assert.equal(notice({ after: doc({ status: 'Tentative' }) }).reason, 'no-change')
  assert.equal(notice({ after: doc({ notes: 'x' } as never) }).reason, 'no-change')
  assert.equal(notice({ sheet: sheet({ exportedAt: COUNTER }) }).reason, 'exported')
  assert.equal(notice({ sheet: { userId: PERSON } }).reason, 'not-signed')
  assert.equal(notice({ personIds: ['someone-else'] }).reason, 'not-this-person')
  assert.equal(notice({ before: doc({ dayKey: '2026-11-20' }), after: doc({ dayKey: '2026-11-21' }) }).reason, 'outside-period')
  assert.equal(notice({ person: { id: PERSON, employmentType: 'paye', isActive: true } }).reason, 'paye-day')
  // On the sheet's days but not signed, written now: the app reads it as added (1.47.0), so the notice does too.
  assert.equal(notice({ before: doc({ bookingId: 'B7' }), after: doc({ bookingId: 'B7', workEndTime: '18:00' }) }).reason, 'booking-added')
  // Signed, and the write leaves it as signed (only a write the rule reads differently): no notice.
  assert.equal(notice({ before: doc({ workEndTime: '18:00' }), after: doc() }).notify, false)
  // Signed before 1.47.0 (neither a record nor a snapshot): never on a guess.
  assert.equal(notice({ sheet: { userId: PERSON, operativeSignedAt: SIGNED } }).reason, 'nothing-signed-to-compare')
  // The snapshot's lines count as signed bookings too (a line with no fingerprint: only a delete reopens).
  const snapshotOnly = { userId: PERSON, operativeSignedAt: SIGNED, managerSignedAt: COUNTER, weeklyReportOverride: { lines: [{ id: 'op-B1-normal', bookingId: 'B1' }] } }
  assert.equal(notice({ sheet: snapshotOnly }).notify, false)
  assert.equal(notice({ sheet: snapshotOnly, after: null }).notify, true)
})

test('1.54.0 timesheetBookingsChangedRecipients and notice id: the person, never the actor; one id per sheet per signature', () => {
  assert.deepEqual(R.timesheetBookingsChangedRecipients(PERSON, 'lm-1', [{ id: PERSON, isActive: true } as never]), [PERSON])
  assert.deepEqual(R.timesheetBookingsChangedRecipients(PERSON, PERSON, [{ id: PERSON, isActive: true } as never]), [])
  const id = R.timesheetBookingsChangedNoticeId('timesheet_person-1_1762300800', sheet())
  assert.match(id ?? '', /^[0-9a-f-]{36}$/i)
  assert.equal(R.timesheetBookingsChangedNoticeId('timesheet_person-1_1762300800', sheet()), id)
  assert.notEqual(R.timesheetBookingsChangedNoticeId('timesheet_person-1_1762300800', sheet({ operativeSignedAt: new Date('2026-11-14T10:00:00Z') })), id)
  assert.equal(R.timesheetBookingsChangedNoticeId('timesheet_person-1_1762300800', { userId: PERSON }), null)
})

test('1.54.0 timesheet_bookings_changed: known type, push, timesheet sign-off toggle, opens My Timesheets, written by the server', () => {
  assert.equal(R.TIMESHEET_BOOKINGS_CHANGED_NOTICE_TYPE, 'timesheet_bookings_changed')
  assert.ok(R.KNOWN_NOTIFICATION_TYPES.includes('timesheet_bookings_changed'))
  assert.ok(R.devicePushNotificationTypes().includes('timesheet_bookings_changed'))
  assert.equal(R.notificationDeliversDevicePush('timesheet_bookings_changed'), true)
  assert.deepEqual(R.notificationDestination({ type: 'timesheet_bookings_changed', dayKey: '2026-11-01', deepLinkUserId: PERSON, role: 'operative' } as never), {
    kind: 'timesheetMine',
    userId: PERSON,
    dayKey: '2026-11-01',
  })
  const row = R.notificationCatalogRow('timesheet_bookings_changed')
  assert.deepEqual(row?.writtenBy, ['function'])
  assert.equal(row?.recipients, 'timesheetBookingsChangedRecipients')
  assert.equal(R.notificationRelatedIdFor('timesheet_bookings_changed', 'x'), null)
})

// Annual leave report ------------------------------------------------------------------------------------------------

test('1.54.0 annualLeaveReportYearMonths: the report counts the same leave year as the balance on the page', () => {
  // Reviewer's case (web PR #335): a person with an April–March leave year in a January–December company.
  const records = [
    { id: 'H1', userId: 'u1', startDayKey: '2026-02-02', timeSlot: 'FULL DAY', status: 'approved' },
    { id: 'H2', userId: 'u1', startDayKey: '2026-05-04', timeSlot: 'FULL DAY', status: 'approved' },
    { id: 'H3', userId: 'u1', startDayKey: '2026-11-02', timeSlot: 'FULL DAY', status: 'approved' },
  ]
  const year = { annualLeaveEnabled: true, startMonth: 4, endMonth: 3, orgStartMonth: 1, orgEndMonth: 12, onDayKey: '2026-11-16', timeZone: 'Europe/London' }
  const months = R.annualLeaveReportYearMonths(year)
  assert.deepEqual(months, { startMonth: 4, endMonth: 3 })
  const report = R.leaveReportRows({ records, personIds: ['u1'], onDayKey: '2026-11-16', startMonth: months.startMonth, timeZone: 'Europe/London' })
  const balance = R.annualLeaveBalance({
    ...year,
    bookings: records.map((row) => ({ startDayKey: row.startDayKey, timeSlot: row.timeSlot, status: row.status })),
  })
  assert.equal(report.startDayKey, '2026-04-01')
  assert.equal(balance.taken, 2)
  assert.equal(report.totalDays, balance.taken)
  // Without an allowance the balance (and so the report) is the organisation's year: all three days.
  const noAllowance = { ...year, annualLeaveEnabled: false }
  const orgMonths = R.annualLeaveReportYearMonths(noAllowance)
  assert.deepEqual(orgMonths, { startMonth: 1, endMonth: 12 })
  const orgReport = R.leaveReportRows({ records, personIds: ['u1'], onDayKey: '2026-11-16', startMonth: orgMonths.startMonth, timeZone: 'Europe/London' })
  const orgBalance = R.annualLeaveBalance({ ...noAllowance, bookings: records.map((row) => ({ startDayKey: row.startDayKey, timeSlot: row.timeSlot, status: row.status })) })
  assert.equal(orgReport.totalDays, 3)
  assert.equal(orgReport.totalDays, orgBalance.taken)
})

// Data health --------------------------------------------------------------------------------------------------------

test('1.54.0 timesheetsHalfSigned: the line manager signed, the person\'s signature is missing, not exported', () => {
  const rows = R.timesheetsHalfSigned([
    { id: 'timesheet_a_2', data: { userId: 'a', weekStartKey: '2026-10-16', weekEndKey: '2026-10-31', managerSignedAt: COUNTER, managerSignedByName: 'Lou' } },
    { id: 'timesheet_b_1', data: { weekStartKey: '2026-10-01', weekEndKey: '2026-10-15', approvedAt: COUNTER.getTime() } },
    { id: 'timesheet_c_1', data: { userId: 'c', operativeSignedAt: SIGNED, managerSignedAt: COUNTER } },
    { id: 'timesheet_d_1', data: { userId: 'd', managerSignedAt: COUNTER, exportedAt: COUNTER } },
    { id: 'timesheet_e_1', data: { userId: 'e' } },
    { id: 'variations_x', data: { managerSignedAt: COUNTER } },
    null,
  ])
  assert.deepEqual(
    rows.map((row) => [row.sheetId, row.userId, row.startDayKey, row.managerSignedByName]),
    [
      ['timesheet_b_1', 'b', '2026-10-01', ''],
      ['timesheet_a_2', 'a', '2026-10-16', 'Lou'],
    ]
  )
  // These are exactly the sheets `timesheetListBucket` reads as `unsigned` though the line manager signed.
  assert.equal(R.timesheetListBucket(R.parseTimesheetStatusFields({ managerSignedAt: COUNTER }), true), 'unsigned')
})

test('1.54.0 review of #337 (2): a newly paid Office / WFH / Site survey / custom booking never repairs a signed snapshot', () => {
  const sheet = { weeklyReportOverride: { lines: [], approvedAt: COUNTER }, managerSignedAt: COUNTER }
  const office = { isPayeDay: false, bookingCreatedAt: SIGNED, bookingUpdatedAt: SIGNED, scheduleOptionPlace: true }
  assert.equal(R.timesheetSnapshotNeedsRebuild(sheet, [office]), false)
  // A job booking that was there when it was signed still repairs a snapshot frozen empty (1.43.0).
  assert.equal(R.timesheetSnapshotNeedsRebuild(sheet, [office, { ...office, scheduleOptionPlace: false }]), true)
})

test('1.54.0 review of #337 (5): "exported" is the stored field the rules test', () => {
  assert.equal(R.timesheetExportedFieldSet(Date.parse('2026-11-12T10:00:00Z')), true)
  assert.equal(R.timesheetExportedFieldSet({ seconds: 1, nanoseconds: 0 }), true)
  assert.equal(R.timesheetExportedFieldSet(new Date(0)), true)
  assert.equal(R.timesheetExportedFieldSet(null), false)
  // An app's in-memory date text counts too (stricter than the rules, never looser); junk does not.
  assert.equal(R.timesheetExportedFieldSet('2026-11-12'), true)
  assert.equal(R.timesheetExportedFieldSet(''), false)
  assert.equal(R.timesheetExportedFieldSet('soon'), false)
})

// Third independent review of #337, finding 1: a late extra whose id is a signed entry's in another letter case must
// never be offered for review, and its review must never land on (and replace) the signed entry's. The £1000 case: a
// signed £1000 expense `E1` the line manager declined in the review map; the person adds late `e1`.
test('1.54.0 third review of #337 (1): a late extra colliding with a signed entry (another letter case) never overwrites its review', () => {
  const signed1000 = { id: 'E1', title: 'Hotel', details: '', jobNumber: 'J-1', date: SIGNED, amount: 1000 }
  const declinedReview = {
    decision: 'declined',
    revisedAmount: null,
    reviewedAmount: 1000,
    reviewedFingerprint: R.timesheetEntryFingerprint(signed1000, 'expense'),
    reviewedByUserId: LM,
    reviewedAtMs: 1,
  }
  const late = lateExpense('e1', 40)
  const sheet = {
    operativeSignedAt: SIGNED,
    managerSignedAt: COUNTER,
    approvedAt: COUNTER,
    expenseEntries: [signed1000],
    priceWorkEntries: [],
    extraEntryReviews: { E1: declinedReview },
    lateExtras: [late],
  }
  assert.equal(invoiceTotal(sheet), 0)
  // Ignored for pay and flagged for the screens: never offered for review.
  const parsed = R.parseTimesheetLateExtras('timesheet_u_1', { userId: 'u', ...sheet })
  assert.deepEqual(parsed.map((row) => [row.id, row.lateDecision.state, row.lateDecision.reason]), [['e1', 'ignored', 'id-taken']])
  assert.equal(R.timesheetLateExtraReviewable(parsed[0].lateDecision), false)
  assert.equal(R.timesheetLateExtraLabel(parsed[0].lateDecision), R.TIMESHEET_LATE_EXTRA_ID_TAKEN_LABEL)
  // The reviewer's save (signed entries + the late extra, approved) never writes the late review under E1's key.
  const write = R.timesheetEntryReviewWriteFields({
    stored: R.parseTimesheetEntryReviews(sheet),
    entries: [
      { ...signed1000, managerDecision: 'declined', reviewFingerprint: R.timesheetEntryFingerprint(signed1000, 'expense') },
      { ...late, managerDecision: 'approved', reviewFingerprint: fpOf(late), lateExtra: true },
    ] as never,
    reviewedByUserId: LM,
    reviewedAtMs: 9,
  })
  assert.deepEqual(write, {})
  // Even passed on its own (a caller that leaves the signed entries out), the stored declined review is never replaced.
  const alone = R.timesheetEntryReviewWriteFields({
    stored: R.parseTimesheetEntryReviews(sheet),
    entries: [{ ...late, managerDecision: 'approved', reviewFingerprint: fpOf(late), lateExtra: true }] as never,
    reviewedByUserId: LM,
    reviewedAtMs: 9,
  })
  assert.deepEqual(alone, {})
  // ...and with no stored review (an inline-only decision), `signedEntryIds` keeps it off the signed key.
  assert.deepEqual(
    R.timesheetEntryReviewWriteFields({
      stored: {},
      entries: [{ ...late, managerDecision: 'approved', reviewFingerprint: fpOf(late), lateExtra: true }] as never,
      reviewedByUserId: LM,
      reviewedAtMs: 9,
      signedEntryIds: ['E1'],
    }),
    {}
  )
  // The reverse: a signed entry never overwrites a stored late review either — it writes under its own exact id
  // (fourth review of #337: so its decision still applies).
  const lateStored = { e9: { ...lateReview(lateExpense('e9', 10)) } }
  assert.deepEqual(
    Object.keys(R.timesheetEntryReviewWriteFields({
      stored: R.parseTimesheetEntryReviews({ extraEntryReviews: lateStored }),
      entries: [{ id: 'E9', title: 'X', amount: 10, managerDecision: 'declined' }] as never,
      reviewedByUserId: LM,
      reviewedAtMs: 9,
    })),
    ['extraEntryReviews.E9']
  )
  // Had a late review been written under E1 (the bug), the signed £1000 entry never takes it as its own approval.
  const overwritten = { ...sheet, lateExtras: [], extraEntryReviews: { E1: lateReview({ ...late, id: 'E1' }) } }
  assert.equal(R.timesheetEntryDecision(overwritten, signed1000, 'expense').source, 'stale-review')
  // Fingerprint maps keep the two apart: the late key never replaces the signed entry's.
  const map = { ...R.timesheetEntryFingerprintMap([{ id: 'E1', reviewFingerprint: 'signed-fp' }]), ...R.timesheetLateExtraFingerprintMap([{ id: 'e1', reviewFingerprint: 'late-fp' }]) }
  assert.equal(R.timesheetTrustedFingerprint(map, 'E1'), 'signed-fp')
  assert.equal(map[R.timesheetLateExtraFingerprintKey('e1')], 'late-fp')
  // Two late extras with one id: the first is reviewed, the second never.
  const twice = R.timesheetEntryReviewWriteFields({
    stored: {},
    entries: [
      { ...lateExpense('L1', 5), managerDecision: 'approved', reviewFingerprint: fpOf(lateExpense('L1', 5)), lateExtra: true },
      { ...lateExpense('l1', 900), managerDecision: 'approved', reviewFingerprint: fpOf(lateExpense('l1', 900)), lateExtra: true },
    ] as never,
    reviewedByUserId: LM,
    reviewedAtMs: 9,
  })
  assert.deepEqual(Object.keys(twice), ['extraEntryReviews.L1'])
})

test('1.54.0 third review of #337 (2): an exported sheet\'s late extras are frozen — no review offered or written', () => {
  const late = lateExpense('L1', 25)
  const exported = counterSignedSheet({ lateExtras: [late], exportedAt: new Date('2026-11-14T10:00:00Z') })
  assert.equal(R.timesheetLateExtraReviewable(R.timesheetLateExtraDecision(exported, late), { exported: true }), false)
  assert.deepEqual(
    R.timesheetEntryReviewWriteFields({
      stored: R.parseTimesheetEntryReviews(exported),
      entries: [{ ...late, managerDecision: 'approved', reviewFingerprint: fpOf(late), lateExtra: true }] as never,
      reviewedByUserId: LM,
      reviewedAtMs: 9,
      exported: true,
    }),
    {}
  )
})

test('1.54.0 third review of #337 (4): a report counts a snapshot late row only while it is still approved at that amount', () => {
  const late = lateExpense('L1', 25)
  const approved = counterSignedSheet({ lateExtras: [late], extraEntryReviews: { L1: lateReview(late) } })
  const rows = [{ id: 'E1', amount: 100 }, { id: 'L1', amount: 25, lateExtra: true }]
  assert.deepEqual(R.timesheetSnapshotMoneyRowsCurrent(approved, rows).map((row) => row.id), ['E1', 'L1'])
  // The person edited it (the review is stale): the report leaves it out until the reviewer's next save.
  const edited = { ...approved, lateExtras: [{ ...late, amount: 900 }] }
  assert.deepEqual(R.timesheetSnapshotMoneyRowsCurrent(edited, rows).map((row) => row.id), ['E1'])
  // Deleted: out too. Exported: kept as signed.
  assert.deepEqual(R.timesheetSnapshotMoneyRowsCurrent({ ...approved, lateExtras: [] }, rows).map((row) => row.id), ['E1'])
  assert.deepEqual(R.timesheetSnapshotMoneyRowsCurrent({ ...edited, exportedAt: new Date() }, rows).map((row) => row.id), ['E1', 'L1'])
})

// Fourth review of #337, finding 1: a late extra nobody can decide never blocks export — it is ignored ("can't be
// reviewed") on both sides, never left pending.
test('1.54.0 fourth review of #337 (1): an undecidable late extra (unusable id, or a signed entry\'s derived id) is ignored, never pending', () => {
  // A £0.01 extra with id `a.b`: the writer can never store its review, so the reader ignores it.
  const dotted = lateExpense('a.b', 0.01)
  const sheet = counterSignedSheet({ lateExtras: [dotted] })
  const decision = R.timesheetLateExtraDecision(sheet, dotted)
  assert.deepEqual([decision.state, decision.reason], ['ignored', 'id-unusable'])
  assert.equal(R.timesheetLateExtraLabel(decision), R.TIMESHEET_LATE_EXTRA_ID_UNUSABLE_LABEL)
  assert.equal(R.timesheetLateExtrasSummary(sheet).waitingForLineManager, false)
  for (const bad of ['a/b', 'a[b', 'a*b', 'a~b', 'a`b']) {
    assert.equal(R.timesheetLateExtraDecision(counterSignedSheet({ lateExtras: [lateExpense(bad, 1)] }), lateExpense(bad, 1)).reason, 'id-unusable', bad)
  }
  // A signed entry stored without an id has a derived id (`timesheetEntryId`); a late extra using it, in any case, is taken.
  const noId = { title: 'Fuel', details: '', jobNumber: 'J-1', date: SIGNED, amount: 60 }
  const sheetDocId = 'timesheet_u_1'
  const derived = R.timesheetEntryId(sheetDocId, 'expense', 0, noId)
  const copy = lateExpense(derived.toLowerCase(), 5)
  const stored = { userId: 'u', operativeSignedAt: SIGNED, managerSignedAt: COUNTER, expenseEntries: [noId], priceWorkEntries: [], lateExtras: [copy] }
  assert.equal(R.timesheetLateExtraDecision(stored, copy, null, { sheetDocId }).reason, 'id-taken')
  assert.equal(R.timesheetLateExtrasSummary(stored, { sheetDocId }).waitingForLineManager, false)
  const parsed = R.parseTimesheetLateExtras(sheetDocId, stored)
  assert.deepEqual(parsed.map((row) => [row.lateDecision.state, row.lateDecision.reason]), [['ignored', 'id-taken']])
  // ...and the writer refuses it from the stored sheet alone.
  assert.deepEqual(
    R.timesheetEntryReviewWriteFields({
      stored: {},
      entries: [{ ...copy, managerDecision: 'approved', reviewFingerprint: fpOf(copy), lateExtra: true }] as never,
      reviewedByUserId: LM,
      reviewedAtMs: 1,
      sheet: stored,
      sheetDocId,
    }),
    {}
  )
})

// Fourth review of #337, finding 3: the writer never depends on `signedEntryIds`; the probe.
test('1.54.0 fourth review of #337 (3): unreviewed signed E1, only late e1 passed — never under E1, and a later decline of E1 applies', () => {
  const signed1 = { id: 'E1', title: 'Hotel', details: '', jobNumber: 'J-1', date: SIGNED, amount: 1000 }
  const late = lateExpense('e1', 40)
  const sheet = { operativeSignedAt: SIGNED, managerSignedAt: COUNTER, expenseEntries: [signed1], priceWorkEntries: [], lateExtras: [late] }
  const lateOnly = [{ ...late, managerDecision: 'approved', reviewFingerprint: fpOf(late), lateExtra: true }] as never
  // With the stored sheet: nothing is written.
  assert.deepEqual(R.timesheetEntryReviewWriteFields({ stored: {}, entries: lateOnly, reviewedByUserId: LM, reviewedAtMs: 1, sheet }), {})
  // Even a caller that passes neither the sheet nor the signed ids (the worst case) cannot block the signed entry: the
  // late review lands under `e1` (that late extra is ignored for pay anyway)...
  const first = R.timesheetEntryReviewWriteFields({ stored: {}, entries: lateOnly, reviewedByUserId: LM, reviewedAtMs: 1 })
  assert.deepEqual(Object.keys(first), ['extraEntryReviews.e1'])
  const storedReviews = R.timesheetEntryReviewsAfterWrite({}, first)
  // ...and a later decline of E1 is written under E1's own key and applies.
  const decline = R.timesheetEntryReviewWriteFields({
    stored: storedReviews,
    entries: [{ ...signed1, managerDecision: 'declined', reviewFingerprint: R.timesheetEntryFingerprint(signed1, 'expense') }] as never,
    reviewedByUserId: LM,
    reviewedAtMs: 2,
  })
  assert.deepEqual(Object.keys(decline), ['extraEntryReviews.E1'])
  const after = { ...sheet, extraEntryReviews: R.timesheetEntryReviewsAfterWrite(storedReviews, decline) }
  assert.equal(R.timesheetEntryDecision(after, signed1, 'expense').decision, 'declined')
  assert.equal(invoiceTotal(after), 0)
})

// Final check of #337, finding 1: late extras nobody can decide are ignored in one place (reader, rows, summary, writer).
test('1.54.0 final check of #337 (1): duplicates (first wins), untitled rows, __…__ ids and over-long ids never wait', () => {
  const write = (entries: Record<string, unknown>[]) =>
    R.timesheetEntryReviewWriteFields({
      stored: {},
      entries: entries.map((row) => ({ ...row, managerDecision: 'approved', reviewFingerprint: fpOf(row), lateExtra: true })) as never,
      reviewedByUserId: LM,
      reviewedAtMs: 1,
    })
  // Duplicates: the first row of an id is reviewable and shows as waiting; the second is ignored — on the reader too.
  const first = lateExpense('L1', 10)
  const second = { ...lateExpense('l1', 900), title: 'Second' }
  const dup = counterSignedSheet({ lateExtras: [first, second] })
  const parsed = R.parseTimesheetLateExtras('timesheet_u_1', { userId: 'u', ...dup })
  assert.deepEqual(parsed.map((row) => [row.id, row.lateDecision.state]), [['L1', 'pending']])
  assert.deepEqual(R.timesheetLateExtraRows(dup).map((row) => row.decision.state), ['pending', 'ignored'])
  assert.deepEqual(Object.keys(write([first, second])), ['extraEntryReviews.L1'])
  // Approving the first ends the wait (the duplicate never holds it up).
  const approved = { ...dup, weeklyReportOverride: null, extraEntryReviews: { ...(dup.extraEntryReviews as object), L1: lateReview(first) } }
  assert.equal(R.timesheetLateExtrasSummary(approved).pending, 0)
  // Untitled (blank or spaces), `__…__` and over-long ids: ignored ("can't be reviewed"), never written, never waiting.
  for (const row of [
    { ...lateExpense('U1', 5), title: '' },
    { ...lateExpense('U2', 5), title: '   ' },
    lateExpense('__name__', 5),
    lateExpense('x'.repeat(R.TIMESHEET_ENTRY_ID_MAX_LENGTH + 1), 5),
  ]) {
    const sheet = counterSignedSheet({ lateExtras: [row] })
    const decision = R.timesheetLateExtraDecision(sheet, row)
    assert.equal(decision.state, 'ignored', String(row.id).slice(0, 20))
    assert.equal(R.timesheetLateExtraLabel(decision), R.TIMESHEET_LATE_EXTRA_ID_UNUSABLE_LABEL)
    assert.equal(R.timesheetLateExtrasSummary(sheet).waitingForLineManager, false)
    assert.deepEqual(write([row]), {})
  }
  assert.equal(R.timesheetEntryReviewKeyUsable('x'.repeat(R.TIMESHEET_ENTRY_ID_MAX_LENGTH)), true)
  assert.equal(R.timesheetEntryReviewKeyUsable('__a__'), false)
  assert.equal(R.timesheetEntryReviewKeyUsable('__a'), true)
  // A signed entry with an unusable id is skipped by the writer, never a throwing field path.
  assert.deepEqual(
    R.timesheetEntryReviewWriteFields({ stored: {}, entries: [{ id: '__x__', title: 'T', amount: 1, managerDecision: 'declined' }] as never, reviewedByUserId: LM, reviewedAtMs: 1 }),
    {}
  )
})

test('1.54.0 final check of #337 (4): a raw stored review map behaves as the parsed one (lateExtra missing = signed)', () => {
  const signed1 = { id: 'E1', title: 'Hotel', details: '', jobNumber: 'J-1', date: SIGNED, amount: 10 }
  const raw = { E1: { decision: 'approved', revisedAmount: null, reviewedAmount: 10, reviewedByUserId: LM, reviewedAtMs: 1 } } as never
  const fields = R.timesheetEntryReviewWriteFields({
    stored: raw,
    entries: [{ ...signed1, managerDecision: 'declined' }] as never,
    reviewedByUserId: LM,
    reviewedAtMs: 2,
  })
  assert.deepEqual(Object.keys(fields), ['extraEntryReviews.E1'])
})
