/**
 * Rulebook 1.33.0 §7 (owner 6 Nov, spec B): the Payrun Snapshot — periods, who is listed, the four cells for PAYE and
 * self-employed people, several timesheets in one period, every id of a person, and the links.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PAYRUN_SNAPSHOT_LABEL,
  parseExpenseDocument,
  parseOvertimeReportDocument,
  parseOvertimeRequestDocument,
  parseOvertimeReviewDocument,
  overtimeBookingFingerprint,
  overtimeReportSnapshot,
  overtimeReviewDocId,
  payeOvertimeLines,
  parsePayeClaimReportDocument,
  parsePayrunSnapshotSheet,
  parsePriceWorkDocument,
  payrunSnapshotCustomPeriod,
  payrunSnapshotPeriods,
  payrunSnapshotRows,
  type PayrunSnapshotPerson,
  type PayrunSnapshotRow,
} from './index'

const TZ = 'Europe/London'
const ORG_ID = 'org1'
const ORGANIZATION = {
  invoicing: {
    paymentRunMode: 'recurring_timeframe',
    recurringRunStartDay: 'monday',
    recurringRunEndDay: 'sunday',
    recurringPaymentDay: 'friday',
    payePayday: 25,
    payePaydayHistory: [{ day: 25, effectiveFrom: '2026-01-01' }],
  },
}
const SIGNED = '2026-11-10T09:00:00Z'

const person = (id: string, extra: Partial<PayrunSnapshotPerson> & Record<string, unknown> = {}): PayrunSnapshotPerson =>
  ({ id, email: `${id}@x.com`, firstName: id[0].toUpperCase() + id.slice(1), surname: 'Test', passwordSet: true, isActive: true, role: 'operative', operativeMode: true, employmentType: 'paye', ...extra }) as PayrunSnapshotPerson

const ROSTER: PayrunSnapshotPerson[] = [
  person('ann', { role: 'admin', operativeMode: false, adminAccess: true, isSuperAdmin: true }),
  person('lee', { role: 'manager', operativeMode: false, manager: true }),
  person('sam', { assignedManagerUserIds: ['lee'], formerUserIds: ['sam-old'] }),
  person('pat', { employmentType: 'self_employed', assignedManagerUserIds: ['lee'] }),
  person('solo', { employmentType: 'self_employed' }),
  person('old', { employmentType: 'self_employed', isActive: false }),
  person('gone', { isActive: false }),
  person('tom', { employmentType: 'paye', employmentTypeTransitionFrom: 'self_employed', employmentTypeEffectiveAt: new Date('2026-11-09T00:00:00Z') }),
  { id: 'del', email: '', firstName: 'Deleted', surname: 'user', passwordSet: true, isActive: true } as PayrunSnapshotPerson,
]

const sheet = (userId: string, start: string, end: string, data: Record<string, unknown>) =>
  parsePayrunSnapshotSheet(`timesheet_${userId}_${start}`, { userId, weekStartKey: start, weekEndKey: end, ...data }, TZ)!

const PERIOD = { start: '2026-11-02', end: '2026-11-15' }

function rows(extra: Record<string, unknown> = {}): PayrunSnapshotRow[] {
  return payrunSnapshotRows({
    roster: ROSTER,
    organization: ORGANIZATION,
    period: PERIOD,
    timeZone: TZ,
    sheets: [
      sheet('pat', '2026-11-02', '2026-11-08', { operativeSignedAt: SIGNED, operativeSignedByName: 'Pat', managerSignedAt: SIGNED }),
      sheet('pat', '2026-11-09', '2026-11-15', { operativeSignedAt: SIGNED, operativeSignedByName: 'Pat' }),
      sheet('solo', '2026-11-02', '2026-11-08', { operativeSignedAt: SIGNED, operativeSignedByName: 'Solo' }),
      sheet('solo', '2026-11-09', '2026-11-15', { operativeSignedAt: SIGNED, operativeSignedByName: 'Solo' }),
    ],
    overtimeRequests: [
      parseOvertimeRequestDocument('R1', { userId: 'sam-old', rangeStart: '2026-10-26', rangeEnd: '2026-11-25', status: 'pending', lines: [] }),
      parseOvertimeRequestDocument('R2', { userId: 'tom', rangeStart: '2026-10-26', rangeEnd: '2026-11-25', status: 'withdrawn', lines: [] }),
    ],
    overtimeReports: [parseOvertimeReportDocument('O1', { userId: 'ann', rangeStart: '2026-10-26', rangeEnd: '2026-11-25', lines: [] })],
    payeClaimReports: [parsePayeClaimReportDocument('C1', { userId: 'sam', kind: 'priceWork', rangeStart: '2026-10-26', rangeEnd: '2026-11-25', items: [] })],
    expenses: [
      parseExpenseDocument('E1', { userId: 'sam', title: 'Fuel', amount: 10, date: '2026-11-04' }, { organizationId: ORG_ID }),
      parseExpenseDocument('E2', { userId: 'sam', title: 'Parking', amount: 5, date: '2026-11-05' }, { organizationId: ORG_ID }),
      parseExpenseDocument('E3', { userId: 'gone', title: 'Train', amount: 20, date: '2026-11-06' }, { organizationId: ORG_ID }),
      parseExpenseDocument('E4', { userId: 'sam', title: 'Outside', amount: 5, date: '2026-12-05' }, { organizationId: ORG_ID }),
    ],
    priceWork: [parsePriceWorkDocument('P1', { userId: 'lee', title: 'Tiles', amount: 100, startDate: '2026-11-03', endDate: '2026-11-03', jobNumber: 'J-1', approvedByUserId: 'ann', approvedByName: 'Ann' }, { organizationId: ORG_ID })],
    ...extra,
  })
}

const byId = (list: PayrunSnapshotRow[], id: string) => list.find((row) => row.personId === id)!

test('1.33.0 payrunSnapshotPeriods: current PAYE payrun, current payment run, custom range', () => {
  assert.equal(PAYRUN_SNAPSHOT_LABEL, 'Payrun Snapshot')
  const periods = payrunSnapshotPeriods({ organization: ORGANIZATION, todayKey: '2026-11-06', timeZone: TZ })
  assert.deepEqual(periods.paye, { kind: 'paye', start: '2026-10-26', end: '2026-11-25', label: 'PAYE payrun: 26 Oct – 25 Nov · paid 25 Nov' })
  assert.equal(periods.paymentRun?.start, '2026-11-02')
  assert.equal(periods.paymentRun?.end, '2026-11-08')
  assert.match(periods.paymentRun!.label, /^Payment run: Mon 2 Nov – Sun 8 Nov/)
  const none = payrunSnapshotPeriods({ organization: {}, todayKey: '2026-11-06', timeZone: TZ })
  assert.equal(none.paye, null)
  assert.equal(none.payeMessage, 'Ask an admin to set the PAYE payday')
  assert.equal(none.paymentRun, null)
  assert.deepEqual(payrunSnapshotCustomPeriod('2026-11-15', '2026-11-02'), { kind: 'custom', start: '2026-11-02', end: '2026-11-15', label: 'Custom: Mon 2 Nov – Sun 15 Nov' })
  assert.equal(payrunSnapshotCustomPeriod('', '2026-11-02'), null)
})

test('1.33.0 payrunSnapshotRows: who is listed (active always; inactive or deleted only with records), sorted by name', () => {
  const list = rows()
  assert.deepEqual(
    list.map((row) => row.personId),
    ['ann', 'gone', 'lee', 'pat', 'sam', 'solo', 'tom']
  )
  assert.equal(byId(list, 'gone').active, false, 'inactive, listed because of an expense in the period')
  assert.equal(list.some((row) => row.personId === 'old'), false, 'inactive with no records: hidden')
  assert.equal(list.some((row) => row.personId === 'del'), false, 'deleted profile with no records: hidden')
  assert.deepEqual(payrunSnapshotRows({ roster: ROSTER, organization: ORGANIZATION, period: null }), [])
})

test('1.33.0 payrunSnapshotRows: user level and employment type (last day of the period, with a note)', () => {
  const list = rows()
  assert.equal(byId(list, 'ann').levelLabel, 'Admin (Super Admin)')
  assert.equal(byId(list, 'lee').levelLabel, 'Manager')
  assert.equal(byId(list, 'sam').levelLabel, 'Operative')
  assert.equal(byId(list, 'pat').employmentLabel, 'Self-employed')
  const tom = byId(list, 'tom')
  assert.equal(tom.employment, 'paye')
  assert.equal(tom.employmentNote, 'Self-employed at the start of the period')
  assert.equal(byId(list, 'sam').employmentNote, '')
})

test('1.33.0 payrunSnapshotRows: PAYE cells — overtime by line manager or report, expenses / price work by report or count', () => {
  const list = rows()
  const sam = byId(list, 'sam')
  assert.deepEqual(sam.cells.timesheet, { state: 'notApplicable', label: 'PAYE', tone: 'blocked', link: null })
  assert.deepEqual(sam.cells.overtime, { state: 'submitted', label: 'Submitted', tone: 'warn', link: { kind: 'overtime', personId: 'sam', start: PERIOD.start, end: PERIOD.end } }, 'a pending request under a former id')
  assert.deepEqual(sam.cells.expenses, { state: 'itemsNoReport', label: '2 items, no report', tone: 'warn', link: { kind: 'expenses', personId: 'sam', start: PERIOD.start, end: PERIOD.end } })
  assert.equal(sam.cells.priceWork.label, 'Report generated: Yes')
  // No line manager: the report answers.
  const ann = byId(list, 'ann')
  assert.equal(ann.cells.overtime.label, 'Report generated: Yes')
  assert.equal(byId(list, 'lee').cells.overtime.label, 'Report generated: No')
  assert.equal(byId(list, 'lee').cells.priceWork.label, '1 item, no report')
  assert.equal(byId(list, 'lee').cells.expenses.label, 'No items')
  // A withdrawn request does not count: Not started.
  const tom = byId(list, 'tom')
  assert.equal(tom.cells.overtime.label, 'Report generated: No', 'tom has no line manager')
  // Returned (1.33.0 Return writes `approved`); an out-of-date report is not "Yes".
  const later = rows({
    overtimeRequests: [parseOvertimeRequestDocument('R1', { userId: 'sam', rangeStart: '2026-10-26', rangeEnd: '2026-11-25', status: 'approved', lines: [] })],
    overtimeReports: [{ ...parseOvertimeReportDocument('O1', { userId: 'ann', rangeStart: '2026-10-26', rangeEnd: '2026-11-25', lines: [] }), outOfDate: true }],
  })
  assert.deepEqual([byId(later, 'sam').cells.overtime.state, byId(later, 'sam').cells.overtime.label], ['returned', 'Returned'])
  assert.deepEqual([byId(later, 'ann').cells.overtime.state, byId(later, 'ann').cells.overtime.tone], ['reportOutOfDate', 'warn'])
  const none = rows({ overtimeRequests: [] })
  assert.deepEqual([byId(none, 'sam').cells.overtime.state, byId(none, 'sam').cells.overtime.label], ['notStarted', 'Not started'])
})

test('1.33.0 payrunSnapshotRows: self-employed cells — least-advanced timesheet with a count; red Self Employed', () => {
  const list = rows()
  const pat = byId(list, 'pat')
  assert.deepEqual(pat.cells.timesheet, {
    state: 'submitted',
    label: 'Submitted · 1 of 2 signed',
    tone: 'warn',
    link: { kind: 'timesheet', personId: 'pat', start: '2026-11-09', end: '2026-11-15' },
  })
  for (const key of ['overtime', 'expenses', 'priceWork'] as const) assert.deepEqual(pat.cells[key], { state: 'notApplicable', label: 'Self Employed', tone: 'blocked', link: null })
  // No line manager: the person's own signature signs the sheet.
  assert.deepEqual([byId(list, 'solo').cells.timesheet.state, byId(list, 'solo').cells.timesheet.label], ['signed', 'Signed · 2 of 2 signed'])
  // One pay run, no sheet: Not started.
  const oneWeek = payrunSnapshotRows({ roster: ROSTER, organization: ORGANIZATION, period: { start: '2026-11-16', end: '2026-11-22' }, timeZone: TZ })
  assert.deepEqual(byId(oneWeek, 'pat').cells.timesheet, {
    state: 'notStarted',
    label: 'Not started',
    tone: 'neutral',
    link: { kind: 'timesheet', personId: 'pat', start: '2026-11-16', end: '2026-11-22' },
  })
})

test('1.33.0 parsePayrunSnapshotSheet: only timesheet documents with a person and a start', () => {
  assert.equal(parsePayrunSnapshotSheet('deadlines_x', { userId: 'a' }), null)
  assert.equal(parsePayrunSnapshotSheet('timesheet_a_1', { weekStartKey: '2026-11-02' }), null)
  const parsed = parsePayrunSnapshotSheet('timesheet_a_1', { userId: 'a', weekStart: '2026-11-02T00:00:00Z' }, TZ)!
  assert.deepEqual([parsed.startDayKey, parsed.endDayKey], ['2026-11-02', ''])
})

test('1.33.0 payrunSnapshotRows: a report is out of date when its live lines changed (reopen), not for declined or deleted lines', () => {
  const org = {
    ...ORGANIZATION,
    payrollTimePolicy: {
      standardDayStart: '07:30',
      standardDayEnd: '16:00',
      unpaidBreakMinutes: 30,
      breakWindowStart: '12:00',
      breakWindowEnd: '12:30',
      weekdayOutsideStandardMultiplier: 1.5,
    },
  }
  const booking = (id: string, dayKey: string, start: string, end: string) => ({
    id,
    collection: 'bookings',
    personId: 'ann',
    dayKey,
    timeSlot: 'CUSTOM_HOURS',
    workStartTime: start,
    workEndTime: end,
    status: 'Confirmed',
    jobId: 'job-1',
    jobNumber: 'J-1',
    jobName: 'Riverside',
  })
  const b1 = booking('B1', '2026-11-04', '06:30', '17:00')
  const b2 = booking('B2', '2026-11-05', '06:30', '17:00')
  const range = { start: '2026-10-26', end: '2026-11-25' }
  // B1 confirmed directly (no request); B2 returned Declined by a decider (0h, "Declined by Lee").
  const request = parseOvertimeRequestDocument('R9', { userId: 'ann', rangeStart: range.start, rangeEnd: range.end, status: 'approved', decidedBy: 'lee', lines: [] })
  const reviews = [
    parseOvertimeReviewDocument(overtimeReviewDocId('ann', 'B1'), { userId: 'ann', bookingId: 'B1', collection: 'bookings', decision: 'approved', fingerprint: overtimeBookingFingerprint(b1), reviewedBy: 'ann' }),
    parseOvertimeReviewDocument(overtimeReviewDocId('ann', 'B2'), { userId: 'ann', bookingId: 'B2', collection: 'bookings', decision: 'declined', fingerprint: overtimeBookingFingerprint(b2), reviewedBy: 'lee', requestId: 'R9' }),
  ]
  const lines = payeOvertimeLines({ personIds: ['ann'], bookings: [b1, b2], organization: org, timeZone: TZ, range, reviews, requests: [request], names: { lee: 'Lee' } })
  assert.deepEqual(lines.map((line) => line.state), ['confirmed', 'returnedDeclined'])
  const saved = overtimeReportSnapshot({ userId: 'ann', userName: 'Ann', rangeStart: range.start, rangeEnd: range.end, lines, generatedBy: 'ann' })
  assert.equal(saved.lines.find((line) => line.bookingId === 'B2')?.overtimeHours, 0)
  const report = parseOvertimeReportDocument('O9', { ...saved })
  const cellFor = (bookings: ReadonlyArray<ReturnType<typeof booking>> | null) =>
    byId(
      payrunSnapshotRows({
        roster: ROSTER,
        organization: org,
        period: PERIOD,
        timeZone: TZ,
        overtimeRequests: [request],
        overtimeReviews: reviews,
        overtimeReports: [report],
        bookings,
      }),
      'ann'
    ).cells.overtime
  // Nothing changed since: the report (with its declined 0h line) is up to date.
  assert.equal(cellFor([b1, b2]).state, 'reportYes')
  // A manager moves B1's finish after the report: the line reopens, the report is out of date (never rewritten).
  assert.deepEqual([cellFor([{ ...b1, workEndTime: '18:00' }, b2]).state, cellFor([{ ...b1, workEndTime: '18:00' }, b2]).tone], ['reportOutOfDate', 'warn'])
  // Without bookings only a stored mark counts (older callers).
  assert.equal(cellFor(null).state, 'reportYes')
})
