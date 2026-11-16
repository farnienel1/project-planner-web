import assert from 'node:assert/strict'
import test from 'node:test'
import * as R from './index'

// Rulebook 1.54.0 §8 (owner decisions 16 Nov): price work and expenses after the line manager signs, the
// "Your signed timesheet has changed" notice and Data health "Timesheets half signed".

const SIGNED = new Date('2026-11-12T10:00:00Z')
const COUNTER = new Date('2026-11-12T11:00:00Z')

const pw = (id: string, fingerprint: string, extra: Record<string, unknown> = {}) => ({ id, reviewFingerprint: fingerprint, title: `PW ${id}`, jobNumber: 'J-1', amount: 100, ...extra })
const ex = (id: string, fingerprint: string, extra: Record<string, unknown> = {}) => ({ id, reviewFingerprint: fingerprint, title: `EX ${id}`, jobNumber: 'J-2', amount: 20, ...extra })

const snapshotRow = (id: string, fingerprint: string | null, extra: Record<string, unknown> = {}) => ({
  id,
  title: id.startsWith('P') ? `PW ${id}` : `EX ${id}`,
  jobNumber: id.startsWith('P') ? 'J-1' : 'J-2',
  amount: id.startsWith('P') ? 100 : 20,
  decision: 'approved',
  ...(fingerprint ? { entryFingerprint: fingerprint } : {}),
  ...extra,
})

/** A counter-signed sheet signed with one price work entry (P1 / fp-p1) and one expense (E1 / fp-e1). */
const counterSigned = (extra: Record<string, unknown> = {}) => ({
  operativeSignedAt: SIGNED,
  managerSignedAt: COUNTER,
  operativeSignedExtras: [
    { kind: 'expense', entryId: 'E1', fingerprint: 'fp-e1' },
    { kind: 'priceWork', entryId: 'P1', fingerprint: 'fp-p1' },
  ],
  operativeSignedExtrasSignedAt: SIGNED,
  weeklyReportOverride: { priceWork: [snapshotRow('P1', 'fp-p1')], expenses: [snapshotRow('E1', 'fp-e1')] },
  ...extra,
})
const unchanged = { priceWorkEntries: [pw('P1', 'fp-p1')], expenseEntries: [ex('E1', 'fp-e1')] }

test('1.54.0 signedTimesheetExtrasRecord: one row per entry, kind and stored id, sorted', () => {
  assert.deepEqual(R.signedTimesheetExtrasRecord({ priceWorkEntries: [pw('P2', 'b'), pw('p1', 'a')], expenseEntries: [ex('E1', 'c'), ex('', 'x')] }), [
    { kind: 'expense', entryId: 'E1', fingerprint: 'c' },
    { kind: 'priceWork', entryId: 'p1', fingerprint: 'a' },
    { kind: 'priceWork', entryId: 'P2', fingerprint: 'b' },
  ])
})

test('1.54.0 signedTimesheetExtrasChanges: an untouched counter-signed sheet is not changed', () => {
  const change = R.signedTimesheetExtrasChanges({ sheet: counterSigned(), entries: unchanged })
  assert.equal(change.changed, false)
  assert.equal(change.reopened, false)
})

test('1.54.0 signedTimesheetExtrasChanges: adding, editing or deleting after the counter-signature sends it back to the person', () => {
  const added = R.signedTimesheetExtrasChanges({ sheet: counterSigned(), entries: { ...unchanged, expenseEntries: [ex('E1', 'fp-e1'), ex('E2', 'fp-e2')] } })
  assert.equal(added.reopened, true)
  assert.equal(added.waitingFor, 'person')
  assert.deepEqual(added.addedEntryIds, ['E2'])
  assert.equal(added.message, R.SIGNED_TIMESHEET_EXTRAS_CHANGED_MESSAGE)
  assert.equal(added.reviewerMessage, R.SIGNED_TIMESHEET_EXTRAS_CHANGED_REVIEWER_MESSAGE)
  const edited = R.signedTimesheetExtrasChanges({ sheet: counterSigned(), entries: { ...unchanged, priceWorkEntries: [pw('P1', 'fp-p1-new')] } })
  assert.deepEqual(edited.changedEntryIds, ['P1'])
  assert.equal(edited.waitingFor, 'person')
  const deleted = R.signedTimesheetExtrasChanges({ sheet: counterSigned(), entries: { ...unchanged, expenseEntries: [] } })
  assert.deepEqual(deleted.removedEntryIds, ['E1'])
  // Ids compare without case (an iOS upper-case id).
  assert.equal(R.signedTimesheetExtrasChanges({ sheet: counterSigned(), entries: { ...unchanged, priceWorkEntries: [pw('p1', 'fp-p1')] } }).changed, false)
})

test('1.54.0 signedTimesheetExtrasChanges: once the person signs again, the line manager counter-signs again; exported = warning only', () => {
  const later = new Date('2026-11-13T09:00:00Z')
  const entries = { ...unchanged, expenseEntries: [ex('E1', 'fp-e1'), ex('E2', 'fp-e2')] }
  const resigned = counterSigned({
    operativeSignedAt: later,
    operativeSignedExtrasSignedAt: later,
    operativeSignedExtras: R.signedTimesheetExtrasRecord(entries),
  })
  const change = R.signedTimesheetExtrasChanges({ sheet: resigned, entries })
  assert.equal(change.reopened, true)
  assert.equal(change.waitingFor, 'lineManager')
  assert.equal(change.snapshotChanged, true)
  assert.equal(change.message, null)
  assert.equal(change.reviewerMessage, R.SIGNED_TIMESHEET_EXTRAS_CHANGED_COUNTERSIGN_MESSAGE)
  assert.deepEqual(R.signedTimesheetActions(change), {
    personMaySignAgain: false,
    lineManagerMayCounterSign: true,
    mayExport: false,
    mayGenerateInvoice: false,
    rebuildSnapshot: true,
  })
  const exported = R.signedTimesheetExtrasChanges({ sheet: counterSigned({ exportedAt: later }), entries })
  assert.equal(exported.changed, true)
  assert.equal(exported.exported, true)
  assert.equal(exported.reopened, false)
  assert.equal(exported.waitingFor, null)
})

test('1.54.0 signedTimesheetExtrasChanges: never before the counter-signature, never for a self-signed sheet', () => {
  const entries = { ...unchanged, expenseEntries: [ex('E1', 'fp-e1'), ex('E2', 'fp-e2')] }
  assert.equal(R.signedTimesheetExtrasChanges({ sheet: counterSigned({ managerSignedAt: null }), entries }).changed, false)
  assert.equal(R.signedTimesheetExtrasChanges({ sheet: counterSigned(), entries, selfSigned: true }).changed, false)
  assert.equal(R.signedTimesheetExtrasChanges({ sheet: null, entries }).changed, false)
})

test('1.54.0 signedTimesheetExtrasChanges: a sheet counter-signed before 1.54.0 (no record, no fingerprints) is unchanged until touched', () => {
  const old = {
    operativeSignedAt: SIGNED,
    approvedAt: COUNTER.getTime(),
    weeklyReportOverride: { priceWork: [snapshotRow('P1', null)], expenses: [snapshotRow('E1', null, { decision: 'edited', amount: 15 })] },
  }
  // Untouched (the edited expense's snapshot amount is its revised amount — never compared): not changed.
  assert.equal(R.signedTimesheetExtrasChanges({ sheet: old, entries: unchanged }).changed, false)
  // An added entry, a new title or a new amount on an agreed row: changed.
  assert.equal(R.signedTimesheetExtrasChanges({ sheet: old, entries: { ...unchanged, expenseEntries: [ex('E1', 'x'), ex('E9', 'y')] } }).waitingFor, 'person')
  assert.deepEqual(R.signedTimesheetExtrasChanges({ sheet: old, entries: { ...unchanged, priceWorkEntries: [pw('P1', 'z', { amount: 150 })] } }).changedEntryIds, ['P1'])
  // An entry stored without an id (derived id differs from the snapshot's): matched by title and job number.
  const legacy = { ...old, weeklyReportOverride: { priceWork: [snapshotRow('RANDOM-ID', null, { title: 'PW P1', jobNumber: 'J-1', amount: 100 })], expenses: old.weeklyReportOverride.expenses } }
  assert.equal(R.signedTimesheetExtrasChanges({ sheet: legacy, entries: unchanged }).changed, false)
})

test('1.54.0 signedTimesheetExtrasBaselineFields: the stored entries, once, tied to the current signature', () => {
  const old = { operativeSignedAt: SIGNED, managerSignedAt: COUNTER, weeklyReportOverride: { priceWork: [], expenses: [] } }
  const baseline = R.signedTimesheetExtrasBaselineFields({ sheet: old, storedEntries: unchanged })
  assert.deepEqual(baseline?.operativeSignedExtras, R.signedTimesheetExtrasRecord(unchanged))
  assert.equal(baseline?.operativeSignedExtrasSignedAt, SIGNED)
  // Never over a current record, never before the counter-signature, never on an exported or self-signed sheet.
  assert.equal(R.signedTimesheetExtrasBaselineFields({ sheet: counterSigned(), storedEntries: unchanged }), null)
  assert.equal(R.signedTimesheetExtrasBaselineFields({ sheet: { ...old, managerSignedAt: null }, storedEntries: unchanged }), null)
  assert.equal(R.signedTimesheetExtrasBaselineFields({ sheet: { ...old, exportedAt: COUNTER }, storedEntries: unchanged }), null)
  assert.equal(R.signedTimesheetExtrasBaselineFields({ sheet: old, storedEntries: unchanged, selfSigned: true }), null)
  // With the baseline written, the person's change reads as a change (an old sheet counter-signed before 1.54.0).
  const withBaseline = { ...old, ...baseline }
  assert.equal(
    R.signedTimesheetExtrasChanges({ sheet: withBaseline, entries: { ...unchanged, priceWorkEntries: [pw('P1', 'fp-p1-edited')] } }).waitingFor,
    'person'
  )
})

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

test('1.54.0 signedTimesheetChanges: one answer for bookings and extras, in the booking rule\'s shape', () => {
  const extras = R.signedTimesheetExtrasChanges({ sheet: counterSigned(), entries: { ...unchanged, expenseEntries: [] } })
  const combined = R.signedTimesheetChanges(noBookingChange, extras)
  assert.equal(combined.reopened, true)
  assert.equal(combined.waitingFor, 'person')
  assert.equal(combined.message, R.SIGNED_TIMESHEET_EXTRAS_CHANGED_MESSAGE)
  assert.equal(R.timesheetListBucket({ operativeSignedAtMs: SIGNED.getTime(), managerSignedAtMs: COUNTER.getTime() } as never, true, combined), 'unsigned')
  // Bookings waiting for the line manager + extras waiting for the person: the person acts first, with the bookings words.
  const bookings = { ...noBookingChange, changed: true, reopened: true, waitingFor: 'lineManager' as const, reviewerMessage: R.SIGNED_TIMESHEET_CHANGED_COUNTERSIGN_MESSAGE }
  const both = R.signedTimesheetChanges(bookings, extras)
  assert.equal(both.waitingFor, 'person')
  assert.equal(both.message, R.SIGNED_TIMESHEET_EXTRAS_CHANGED_MESSAGE)
  // Nothing changed in extras: the booking answer as it was.
  const none = R.signedTimesheetExtrasChanges({ sheet: counterSigned(), entries: unchanged })
  assert.equal(R.signedTimesheetChanges(bookings, none).waitingFor, 'lineManager')
  assert.equal(R.signedTimesheetChanges(noBookingChange, null).changed, false)
})

// Notice ------------------------------------------------------------------------------------------------------------

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
const sheet = (extra: Record<string, unknown> = {}) => ({
  userId: PERSON,
  operativeSignedAt: SIGNED,
  operativeSignedBookings: [{ bookingId: 'B1', collection: 'bookings', fingerprint: '', personId: PERSON, place: 'job|j1' }],
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
  // On the sheet's days but never signed (a filter left it off): not a change.
  assert.equal(notice({ before: doc({ bookingId: 'B7' }), after: doc({ bookingId: 'B7', workEndTime: '18:00' }) }).reason, 'booking-not-signed')
  // Signed before 1.47.0 (neither a record nor a snapshot): never on a guess.
  assert.equal(notice({ sheet: { userId: PERSON, operativeSignedAt: SIGNED } }).reason, 'nothing-signed-to-compare')
  // The snapshot's lines count as signed bookings too.
  assert.equal(
    notice({ sheet: { userId: PERSON, operativeSignedAt: SIGNED, managerSignedAt: COUNTER, weeklyReportOverride: { lines: [{ id: 'op-B1-normal', bookingId: 'B1' }] } } }).notify,
    true
  )
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
