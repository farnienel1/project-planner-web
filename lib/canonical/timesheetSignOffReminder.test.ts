import assert from 'node:assert/strict'
import test from 'node:test'
import * as R from './index'
import { dateFromDayKeyInZone, wallTimeInZone } from '../orgTime/zoneTime'

// Rulebook 1.78.0 §8 / §13 (owner decision 23 Nov, point 4): the sign-off reminder to line managers before payday.

const LONDON = 'Europe/London'
const AUCKLAND = 'Pacific/Auckland'
const DATE_RANGES = {
  paymentRunMode: 'date_ranges',
  paymentRunDateRanges: [
    { startDay: 1, endDay: 15 },
    { startDay: 16, endDay: 31 },
  ],
  paymentDates: [20, 5],
}

/** Epoch ms of the wall-clock time `HH:mm` on a day key in a zone. */
function at(dayKey: string, hh: number, mm: number, zone = LONDON): number {
  return wallTimeInZone(dayKey, hh, mm, zone).getTime()
}

test('1.78.0 sign-off reminder timing: 08:00 two days before payday by default, until the start of payday (date ranges)', () => {
  const due = (now: number) => R.timesheetSignOffReminderDue({ invoicing: DATE_RANGES, now, timeZone: LONDON })
  // 16–30 Nov paid 5 Dec → reminder Thu 3 Dec 08:00.
  assert.equal(due(at('2026-12-03', 7, 59)).due, false)
  const on = due(at('2026-12-03', 8, 0))
  assert.equal(on.due, true)
  assert.deepEqual(on.runs, [
    {
      startDayKey: '2026-11-16',
      endDayKey: '2026-11-30',
      startMs: dateFromDayKeyInZone('2026-11-16', LONDON).getTime(),
      endExclusiveMs: dateFromDayKeyInZone('2026-12-01', LONDON).getTime(),
      paymentDayKey: '2026-12-05',
      notifyDayKey: '2026-12-03',
      notifyAtMs: at('2026-12-03', 8, 0),
    },
  ])
  assert.equal(due(at('2026-12-04', 23, 59)).due, true)
  assert.equal(due(at('2026-12-05', 0, 0)).due, false, 'not on payday itself')
  // 1–15 Nov paid 20 Nov → reminder 18 Nov 08:00 (BST is over: 08:00 GMT).
  const run1 = due(at('2026-11-18', 9, 0)).runs
  assert.deepEqual(run1.map((run) => [run.startDayKey, run.endDayKey, run.paymentDayKey]), [['2026-11-01', '2026-11-15', '2026-11-20']])
  // Nothing due on an ordinary day.
  assert.equal(due(at('2026-11-10', 12, 0)).due, false)
})

test('1.78.0 sign-off reminder timing: month-end paydays clamp to short months', () => {
  const invoicing = { ...DATE_RANGES, paymentDates: [15, 31] }
  // 16–30 Nov, payday 31 → 30 Nov (the period end); reminder 28 Nov.
  const nov = R.timesheetSignOffReminderDue({ invoicing, now: at('2026-11-28', 8, 30), timeZone: LONDON }).runs
  assert.deepEqual(nov.map((run) => [run.startDayKey, run.endDayKey, run.paymentDayKey, run.notifyDayKey]), [
    ['2026-11-16', '2026-11-30', '2026-11-30', '2026-11-28'],
  ])
  // 16–28 Feb 2027 paid 28 Feb; reminder 26 Feb.
  const feb = R.timesheetSignOffReminderDue({ invoicing, now: at('2027-02-26', 8, 0), timeZone: LONDON }).runs
  assert.deepEqual(feb.map((run) => [run.startDayKey, run.endDayKey, run.paymentDayKey]), [['2027-02-16', '2027-02-28', '2027-02-28']])
})

test('1.78.0 sign-off reminder timing: recurring weekly runs paid the following Friday', () => {
  const invoicing = { paymentRunMode: 'recurring_timeframe', recurringRunStartDay: 'monday', recurringRunEndDay: 'sunday', recurringPaymentDay: 'friday' }
  // Mon 16 – Sun 22 Nov paid Fri 27 Nov → reminder Wed 25 Nov 08:00.
  const runs = R.timesheetSignOffReminderDue({ invoicing, now: at('2026-11-25', 8, 0), timeZone: LONDON }).runs
  assert.deepEqual(runs.map((run) => [run.startDayKey, run.endDayKey, run.paymentDayKey, run.notifyDayKey]), [
    ['2026-11-16', '2026-11-22', '2026-11-27', '2026-11-25'],
  ])
  assert.equal(R.timesheetSignOffReminderDue({ invoicing, now: at('2026-11-25', 7, 0), timeZone: LONDON }).due, false)
})

test('1.78.0 sign-off reminder timing: organisation zone, never UTC (Auckland)', () => {
  const runs = R.timesheetSignOffReminderDue({ invoicing: DATE_RANGES, now: at('2026-12-03', 8, 0, AUCKLAND), timeZone: AUCKLAND }).runs
  assert.equal(runs.length, 1)
  assert.equal(runs[0].notifyAtMs, at('2026-12-03', 8, 0, AUCKLAND))
  // 07:59 Auckland is already 18:59 UTC on 2 Dec, and still not due.
  assert.equal(R.timesheetSignOffReminderDue({ invoicing: DATE_RANGES, now: at('2026-12-03', 7, 59, AUCKLAND), timeZone: AUCKLAND }).due, false)
  // No invoicing map → never due.
  assert.equal(R.timesheetSignOffReminderDue({ invoicing: null, now: Date.now(), timeZone: LONDON }).due, false)
})

const ORG = 'org-1'
const SIGNED = Date.UTC(2026, 10, 27, 10)
const run = { startDayKey: '2026-11-16', endDayKey: '2026-11-30' }
const users: Array<[string, Record<string, unknown>]> = [
  ['ADMIN', { organizationId: ORG, firstName: 'Ann', surname: 'Admin', email: 'ann@x.test', adminAccess: true, passwordSet: true, annualLeaveSelfBook: true }],
  ['SELF', { organizationId: ORG, firstName: 'Sid', surname: 'Self', email: 'sid@x.test', adminAccess: true, passwordSet: true, timesheetSelfSign: true, assignedManagerUserIds: ['ADMIN'] }],
  ['MGR', { organizationId: ORG, firstName: 'Mo', surname: 'Manager', email: 'mo@x.test', manager: true, passwordSet: true, assignedManagerUserIds: ['ADMIN'] }],
  ['OP1', { organizationId: ORG, firstName: 'Olly', surname: 'One', email: 'olly@x.test', role: 'operative', operativeMode: true, passwordSet: true, assignedManagerUserIds: ['mgr'], formerUserIds: ['old-op1'] }],
  ['OP2', { organizationId: ORG, firstName: 'Pat', surname: 'Two', email: 'pat@x.test', role: 'operative', operativeMode: true, passwordSet: true, assignedManagerUserIds: ['MGR'] }],
  ['OP3', { organizationId: ORG, firstName: 'Quin', surname: 'Three', email: 'quin@x.test', role: 'operative', operativeMode: true, passwordSet: true }],
  ['PAYE', { organizationId: ORG, firstName: 'Paul', surname: 'Paye', email: 'paul@x.test', role: 'operative', operativeMode: true, passwordSet: true, employmentType: 'paye', assignedManagerUserIds: ['MGR'] }],
  ['GONE', { organizationId: ORG, firstName: 'Gone', surname: 'Away', email: 'gone@x.test', manager: true, passwordSet: true, isActive: false }],
  ['OP4', { organizationId: ORG, firstName: 'Ray', surname: 'Four', email: 'ray@x.test', role: 'operative', operativeMode: true, passwordSet: true, assignedManagerUserIds: ['GONE'] }],
]
const roster = users.map(([id, data]) => R.timesheetSignOffReminderRosterMember(id, data, { organizationId: ORG, creatorUserId: 'ADMIN' })!)
const personSigned = { operativeSignedAt: SIGNED, operativeSignedByName: 'x' }
const sheet = (userId: string, extra: Record<string, unknown> = {}, start = '2026-11-16', end = '2026-11-30') => ({
  documentId: `timesheet_${userId}_${start}`,
  data: { userId, weekStartKey: start, weekEndKey: end, ...extra },
})

test('1.78.0 sign-off reminder recipients: line managers, else active admins; never the subject; self-signed and PAYE left out', () => {
  const sheets = [
    sheet('old-op1', personSigned), // filed under a former id: still Olly's
    sheet('OP2'), // not signed by the person: not waiting for the line manager
    sheet('OP3', personSigned), // no line manager: the active admins
    sheet('MGR', personSigned), // the manager's own sheet: their line manager (Ann)
    sheet('SELF', personSigned), // self-signed: nobody
    sheet('PAYE', personSigned), // PAYE every day of the run: no sheet
    sheet('OP4', personSigned), // line manager inactive: the admins
    sheet('OP1', { ...personSigned, managerSignedAt: SIGNED + 1000, managerSignedByName: 'Mo' }, '2026-11-01', '2026-11-15'), // another run
    sheet('OP2', { ...personSigned, managerSignedAt: SIGNED + 1000, managerSignedByName: 'Mo' }, '2026-11-16', '2026-11-30'),
  ]
  const out = R.timesheetSignOffReminderRecipients({ sheets, roster, payRun: run, timeZone: LONDON })
  const byUser = Object.fromEntries(out.map((row) => [row.userId, row]))
  assert.deepEqual(Object.keys(byUser).sort(), ['ADMIN', 'MGR', 'SELF'])
  assert.deepEqual(byUser.MGR.names, ['Olly One'])
  assert.equal(byUser.MGR.count, 1)
  assert.deepEqual(byUser.ADMIN.names.sort(), ['Mo Manager', 'Quin Three', 'Ray Four'])
  // Sid is an admin too: the people with no active line manager, never Mo (Mo has a line manager, Ann).
  assert.deepEqual(byUser.SELF.names.sort(), ['Quin Three', 'Ray Four'])
  for (const row of out) assert.ok(!row.personIds.map((id) => id.toLowerCase()).includes(row.userId.toLowerCase()), 'never the subject')
})

test('1.78.0 sign-off reminder recipients: a counter-signed, exported or unsigned sheet is not waiting; a late extra waiting is', () => {
  const lateExtra = { kind: 'expense', id: 'L1', title: 'Late fuel', jobNumber: 'J-1', date: SIGNED, amount: 12, evidence: [] }
  const sheets = [
    sheet('OP1', { ...personSigned, managerSignedAt: SIGNED + 1000, managerSignedByName: 'Mo', lateExtras: [lateExtra] }),
    sheet('OP2', { ...personSigned, managerSignedAt: SIGNED + 1000, managerSignedByName: 'Mo' }),
  ]
  const out = R.timesheetSignOffReminderRecipients({ sheets, roster, payRun: run, timeZone: LONDON })
  assert.deepEqual(out.map((row) => [row.userId, row.names]), [['MGR', ['Olly One']]])
  assert.deepEqual(R.timesheetSignOffReminderRecipients({ sheets: [], roster, payRun: run, timeZone: LONDON }), [])
})

test('1.78.0 sign-off reminder: sheets dated by stored instants in the organisation zone', () => {
  const start = dateFromDayKeyInZone('2026-11-16', LONDON).getTime()
  const sheets = [{ documentId: 'timesheet_OP1_x', data: { userId: 'OP1', weekStart: start, ...personSigned } }]
  const out = R.timesheetSignOffReminderRecipients({ sheets, roster, payRun: run, timeZone: LONDON })
  assert.deepEqual(out.map((row) => row.userId), ['MGR'], 'a sheet with no stored end takes the pay run end')
})

test('1.78.0 sign-off reminder notice text and a stable id', () => {
  assert.deepEqual(R.timesheetSignOffReminderNotice({ count: 3, paymentDayKey: '2026-11-27', names: ['A', 'B', 'C'] }), {
    title: 'Timesheets waiting for your sign-off',
    message: '3 timesheets are waiting for you to sign off before payday Fri 27 Nov.',
    detail: 'A, B, C',
  })
  assert.equal(
    R.timesheetSignOffReminderNotice({ count: 1, paymentDayKey: '2026-11-27' }).message,
    '1 timesheet is waiting for you to sign off before payday Fri 27 Nov.'
  )
  const many = R.timesheetSignOffReminderNotice({ count: 10, paymentDayKey: '2026-11-27', names: Array.from({ length: 10 }, (_, i) => `P${i}`) })
  assert.equal(many.detail, 'P0, P1, P2, P3, P4, P5, P6, P7 and 2 more')
  const input = { organizationId: ORG, recipientId: 'MGR', startDayKey: '2026-11-16', endDayKey: '2026-11-30', paymentDayKey: '2026-12-05' }
  const id = R.timesheetSignOffReminderNoticeId(input)
  assert.match(id ?? '', /^[0-9A-F-]{36}$/)
  assert.equal(R.timesheetSignOffReminderNoticeId({ ...input, recipientId: 'mgr' }), id, 'recipient without case')
  assert.equal(R.timesheetSignOffReminderNoticeId({ ...input, paymentDayKey: '2026-12-06' }), id, 'a moved payday never re-sends')
  assert.equal(R.timesheetSignOffReminderNoticeId({ ...input, recipientId: '' }), null)
})

test('1.78.0 timesheet_signoff_reminder: known type, push, timesheet sign-off toggle, opens User Timesheets → Awaiting', () => {
  const type = R.TIMESHEET_SIGNOFF_REMINDER_NOTICE_TYPE
  assert.equal(type, 'timesheet_signoff_reminder')
  assert.ok(R.KNOWN_NOTIFICATION_TYPES.includes(type))
  assert.equal(R.notificationDeliversDevicePush(type), true)
  assert.equal(R.isScheduledNotificationType(type), false, 'written when due, so it pushes')
  assert.deepEqual(R.notificationDestination({ type, dayKey: '2026-11-16', role: 'manager' } as never), {
    kind: 'timesheetTeamAwaiting',
    dayKey: '2026-11-16',
  })
  assert.equal(R.notificationRelatedIdFor(type, '2026-12-05'), '2026-12-05')
  const row = R.notificationCatalogRow(type)
  assert.ok(row && row.devicePush && row.writtenBy.includes('function'))
  assert.equal(R.notificationPreferenceAllowsDelivery({ timesheetSignOff: false } as never, type), false)
})

test('1.78.0 line manager reminder setting: 1–3 days before payday, missing or invalid reads 2; write fields and validation', () => {
  assert.equal(R.parseLineManagerReminderDays(undefined), 2)
  assert.equal(R.parseLineManagerReminderDays(1), 1)
  assert.equal(R.parseLineManagerReminderDays('3'), 3)
  assert.equal(R.parseLineManagerReminderDays(4), 2)
  assert.equal(R.parseLineManagerReminderDays(0), 2)
  assert.equal(R.parseLineManagerReminderDays(1.5), 2)
  assert.equal(R.parseInvoicing({}).lineManagerReminderDaysBeforePayday, 2)
  assert.equal(R.parseInvoicing({ lineManagerReminderDaysBeforePayday: 3 }).lineManagerReminderDaysBeforePayday, 3)
  assert.equal(R.invoicingToFirestore(R.parseInvoicing({ lineManagerReminderDaysBeforePayday: 1 })).lineManagerReminderDaysBeforePayday, 1)
  const { lineManagerReminderDaysBeforePayday: _omit, ...unaware } = R.parseInvoicing({})
  assert.ok(!('lineManagerReminderDaysBeforePayday' in R.invoicingToFirestore(unaware as never)), 'a caller without the field never writes it')
  assert.equal(R.lineManagerReminderDaysValidationError(2), null)
  assert.match(R.lineManagerReminderDaysValidationError(5) ?? '', /1, 2 or 3/)
  assert.match(R.validateInvoicingSettings({ ...R.parseInvoicing({}), lineManagerReminderDaysBeforePayday: 9 }) ?? '', /1, 2 or 3/)
  assert.deepEqual(R.lineManagerReminderWriteFields({ lineManagerReminderDaysBeforePayday: 2 }, 3), { 'invoicing.lineManagerReminderDaysBeforePayday': 3 })
  assert.deepEqual(R.lineManagerReminderWriteFields({ lineManagerReminderDaysBeforePayday: 3 }, 3), {}, 'unchanged: nothing written')
  assert.deepEqual(R.lineManagerReminderWriteFields({}, 7), {}, 'invalid: nothing written')
  assert.equal(R.lineManagerReminderSummary(1), 'Sent at 08:00, 1 day before payday.')
  assert.equal(R.LINE_MANAGER_REMINDER_LABEL, 'Line manager sign-off reminder')
})

test('1.78.0 sign-off reminder follows the chosen days, one per pay run in both modes', () => {
  const dueOn = (invoicing: Record<string, unknown>, dayKey: string, zone = LONDON) =>
    R.timesheetSignOffReminderDue({ invoicing, now: at(dayKey, 8, 0, zone), timeZone: zone }).runs.map((run) => [run.startDayKey, run.paymentDayKey, run.notifyDayKey])
  // Date ranges, 3 days: 16–30 Nov paid 5 Dec → 2 Dec; 1–15 Nov paid 20 Nov → 17 Nov.
  const three = { ...DATE_RANGES, lineManagerReminderDaysBeforePayday: 3 }
  assert.deepEqual(dueOn(three, '2026-12-02'), [['2026-11-16', '2026-12-05', '2026-12-02']])
  assert.deepEqual(dueOn(three, '2026-11-17'), [['2026-11-01', '2026-11-20', '2026-11-17']])
  // 1 day: due only on the day before payday; never two for one run on any day of the month.
  const one = { ...DATE_RANGES, lineManagerReminderDaysBeforePayday: 1 }
  assert.deepEqual(dueOn(one, '2026-12-04'), [['2026-11-16', '2026-12-05', '2026-12-04']])
  assert.deepEqual(dueOn(one, '2026-12-03'), [])
  for (let d = 1; d <= 31; d += 1) {
    const key = `2026-12-${String(d).padStart(2, '0')}`
    const runs = dueOn(DATE_RANGES, key)
    assert.equal(new Set(runs.map((run) => run[0])).size, runs.length, key)
  }
  // Recurring Mon–Sun paid the following Friday, 1 day → Thursday 26 Nov.
  const recurring = { paymentRunMode: 'recurring_timeframe', recurringRunStartDay: 'monday', recurringRunEndDay: 'sunday', recurringPaymentDay: 'friday', lineManagerReminderDaysBeforePayday: 1 }
  assert.deepEqual(dueOn(recurring, '2026-11-26'), [['2026-11-16', '2026-11-27', '2026-11-26']])
  assert.deepEqual(dueOn(recurring, '2026-11-25'), [])
})

test('1.78.0 sign-off reminder: month-end paydays in 28, 29, 30 and 31-day months, and across a month end in another zone', () => {
  const lastDay = { ...DATE_RANGES, paymentDates: [15, 31] } // run 2 (16th–last day) paid on the last day of the month
  const check = (notifyKey: string, start: string, pay: string, zone = LONDON) =>
    assert.deepEqual(
      R.timesheetSignOffReminderDue({ invoicing: lastDay, now: at(notifyKey, 8, 0, zone), timeZone: zone }).runs.map((run) => [run.startDayKey, run.paymentDayKey]),
      [[start, pay]],
      notifyKey
    )
  check('2027-02-26', '2027-02-16', '2027-02-28') // 28 days
  check('2028-02-27', '2028-02-16', '2028-02-29') // 29 days (leap year)
  check('2026-11-28', '2026-11-16', '2026-11-30') // 30 days
  check('2026-12-29', '2026-12-16', '2026-12-31') // 31 days
  // 16–31 Dec paid 5 Jan: the reminder on 3 Jan, across the year end, in Auckland.
  const runs = R.timesheetSignOffReminderDue({ invoicing: DATE_RANGES, now: at('2027-01-03', 8, 0, AUCKLAND), timeZone: AUCKLAND }).runs
  assert.deepEqual(runs.map((run) => [run.startDayKey, run.endDayKey, run.paymentDayKey]), [['2026-12-16', '2026-12-31', '2027-01-05']])
})

test('1.78.0 escalation timing: 08:00 on the day before each run\'s payday, both modes', () => {
  const due = (invoicing: Record<string, unknown>, dayKey: string, hh = 8, zone = LONDON) =>
    R.timesheetSignOffEscalationDue({ invoicing, now: at(dayKey, hh, 0, zone), timeZone: zone }).runs.map((run) => [run.startDayKey, run.paymentDayKey, run.notifyDayKey])
  // 16–30 Nov paid Sat 5 Dec → escalation Fri 4 Dec 08:00, whatever the reminder days.
  assert.deepEqual(due({ ...DATE_RANGES, lineManagerReminderDaysBeforePayday: 3 }, '2026-12-04'), [['2026-11-16', '2026-12-05', '2026-12-04']])
  assert.deepEqual(due(DATE_RANGES, '2026-12-04', 7), [])
  assert.deepEqual(due(DATE_RANGES, '2026-12-03', 12), [], 'the 2-day reminder day is not the escalation')
  // Recurring Mon–Sun paid Fri 27 Nov → Thu 26 Nov.
  const recurring = { paymentRunMode: 'recurring_timeframe', recurringRunStartDay: 'monday', recurringRunEndDay: 'sunday', recurringPaymentDay: 'friday' }
  assert.deepEqual(due(recurring, '2026-11-26'), [['2026-11-16', '2026-11-27', '2026-11-26']])
  // Month end: 16–28 Feb 2027 paid the 31st → 28 Feb; escalation 27 Feb. 16–31 Dec paid 5 Jan → 4 Jan, Auckland.
  assert.deepEqual(due({ ...DATE_RANGES, paymentDates: [15, 31] }, '2027-02-27'), [['2027-02-16', '2027-02-28', '2027-02-27']])
  assert.deepEqual(due(DATE_RANGES, '2027-01-04', 8, AUCKLAND), [['2026-12-16', '2027-01-05', '2027-01-04']])
})

test('1.78.0 escalation recipients: every active admin, every awaiting sheet (their own reports too), never their own, never self-signed', () => {
  const sheets = [
    sheet('OP1', personSigned), // line manager Mo: still goes to the admins the day before payday
    sheet('MGR', personSigned), // Ann is Mo's line manager: Ann gets it as an admin too
    sheet('SELF', personSigned), // self-signed: nobody
    sheet('OP2'), // not signed by the person: not waiting
    sheet('PAYE', personSigned), // PAYE run: nobody
  ]
  const out = R.timesheetSignOffEscalationRecipients({ sheets, roster, payRun: run, timeZone: LONDON })
  const byUser = Object.fromEntries(out.map((row) => [row.userId, row.names.sort()]))
  assert.deepEqual(byUser, { ADMIN: ['Mo Manager', 'Olly One'], SELF: ['Mo Manager', 'Olly One'] })
  // Ann is the organisation's creator (the Super Admin), so her own sheet is self-signed: nobody is reminded.
  assert.deepEqual(R.timesheetSignOffEscalationRecipients({ sheets: [sheet('ADMIN', personSigned)], roster, payRun: run, timeZone: LONDON }), [])
  // Mo's sheet waits for Ann; Ann is an admin too, so she is counted once (never twice) in the escalation.
  const mo = R.timesheetSignOffEscalationRecipients({ sheets: [sheet('MGR', personSigned)], roster, payRun: run, timeZone: LONDON })
  assert.deepEqual(mo.map((row) => [row.userId, row.count]), [['ADMIN', 1], ['SELF', 1]])
  assert.deepEqual(R.timesheetSignOffEscalationRecipients({ sheets: [sheet('OP2')], roster, payRun: run, timeZone: LONDON }), [])
})

test('1.78.0 escalation notice text, and its id never equals the reminder\'s', () => {
  assert.deepEqual(R.timesheetSignOffEscalationNotice({ count: 2, paymentDayKey: '2026-11-27', names: ['A', 'B'] }), {
    title: 'Timesheets not signed off — payday tomorrow',
    message: '2 timesheets are still not signed off, payday is tomorrow Fri 27 Nov.',
    detail: 'A, B',
  })
  assert.equal(R.timesheetSignOffEscalationNotice({ count: 1, paymentDayKey: '2026-11-27' }).message, '1 timesheet is still not signed off, payday is tomorrow Fri 27 Nov.')
  const input = { organizationId: ORG, recipientId: 'ADMIN', startDayKey: '2026-11-16', endDayKey: '2026-11-30', paymentDayKey: '2026-12-05' }
  assert.notEqual(R.timesheetSignOffEscalationNoticeId(input), R.timesheetSignOffReminderNoticeId(input))
  assert.equal(R.timesheetSignOffEscalationNoticeId({ ...input, recipientId: 'admin' }), R.timesheetSignOffEscalationNoticeId(input))
  assert.equal(R.LINE_MANAGER_REMINDER_ADMIN_NOTE, 'Admins are also reminded about people with no line manager, and about any timesheet still not signed off 24 hours before payday.')
})

test('1.78.0 escalation: an admin\'s own waiting sheet goes to the other admins, never to them', () => {
  const adm3 = R.timesheetSignOffReminderRosterMember('ADM3', { organizationId: ORG, firstName: 'Ada', surname: 'Three', email: 'ada@x.test', adminAccess: true, passwordSet: true, assignedManagerUserIds: ['ADMIN'] }, { organizationId: ORG, creatorUserId: 'ADMIN' })!
  const out = R.timesheetSignOffEscalationRecipients({ sheets: [sheet('ADM3', personSigned)], roster: [...roster, adm3], payRun: run, timeZone: LONDON })
  assert.deepEqual(out.map((row) => row.userId).sort(), ['ADMIN', 'SELF'])
})

test('1.78.0 sign-off reminder: 08:00 wall clock on clock-change days (London, Auckland)', () => {
  const custom = (pay: number) => ({ ...DATE_RANGES, paymentDates: [pay, 5] })
  // London: 1–15 Mar 2027 paid Tue 30 Mar; 2 days → Sun 28 Mar 2027 (clocks go forward 01:00 GMT) → 08:00 BST = 07:00 UTC.
  const march = R.timesheetSignOffReminderDue({ invoicing: custom(30), now: Date.parse('2027-03-28T07:00:00Z'), timeZone: LONDON }).runs
  assert.deepEqual(march.map((r) => [r.notifyDayKey, r.notifyAtMs]), [['2027-03-28', Date.parse('2027-03-28T07:00:00Z')]])
  assert.equal(R.timesheetSignOffReminderDue({ invoicing: custom(30), now: Date.parse('2027-03-28T06:59:00Z'), timeZone: LONDON }).due, false)
  // London: 1–15 Oct 2026 paid Tue 27 Oct; 2 days → Sun 25 Oct 2026 (clocks go back) → 08:00 GMT = 08:00 UTC.
  const oct = R.timesheetSignOffReminderDue({ invoicing: custom(27), now: Date.parse('2026-10-25T08:00:00Z'), timeZone: LONDON }).runs
  assert.deepEqual(oct.map((r) => [r.notifyDayKey, r.notifyAtMs]), [['2026-10-25', Date.parse('2026-10-25T08:00:00Z')]])
  assert.equal(R.timesheetSignOffReminderDue({ invoicing: custom(27), now: Date.parse('2026-10-25T07:59:00Z'), timeZone: LONDON }).due, false)
  // Auckland: Sun 27 Sep 2026 clocks go forward (NZST → NZDT, UTC+13): 08:00 local = 19:00 UTC on 26 Sep.
  const sep = R.timesheetSignOffReminderDue({ invoicing: custom(29), now: Date.parse('2026-09-26T19:00:00Z'), timeZone: AUCKLAND }).runs
  assert.deepEqual(sep.map((r) => [r.notifyDayKey, r.notifyAtMs]), [['2026-09-27', Date.parse('2026-09-26T19:00:00Z')]])
  // Auckland: Sun 4 Apr 2027 clocks go back (NZDT → NZST, UTC+12): 08:00 local = 20:00 UTC on 3 Apr.
  const apr = R.timesheetSignOffReminderDue({ invoicing: custom(6), now: Date.parse('2027-04-03T20:00:00Z'), timeZone: AUCKLAND }).runs
  // (16–31 Mar, paid 5 Apr, is due too: its reminder went out on 3 Apr.)
  assert.deepEqual(apr.filter((r) => r.notifyDayKey === '2027-04-04').map((r) => r.notifyAtMs), [Date.parse('2027-04-03T20:00:00Z')])
  assert.ok(!R.timesheetSignOffReminderDue({ invoicing: custom(6), now: Date.parse('2027-04-03T19:59:00Z'), timeZone: AUCKLAND }).runs.some((r) => r.notifyDayKey === '2027-04-04'))
  // The escalation the same way: 1–15 Mar paid Mon 29 Mar 2027 → Sun 28 Mar 08:00 BST.
  const esc = R.timesheetSignOffEscalationDue({ invoicing: custom(29), now: Date.parse('2027-03-28T07:00:00Z'), timeZone: LONDON }).runs
  assert.deepEqual(esc.map((r) => r.notifyAtMs), [Date.parse('2027-03-28T07:00:00Z')])
})

test('1.78.0 sign-off reminder: a sheet a booking change sent back to the person is not counted (owner fix 2)', () => {
  // A labour booking Olly signed on Tue 17 Nov 07:00–16:00, and its fingerprint as the collector writes it.
  const booking = {
    bookingId: 'B1',
    collection: 'bookings',
    dayKey: '2026-11-17',
    timeSlot: 'CUSTOM',
    workStartTime: '07:00',
    workEndTime: '16:00',
    personId: 'OP1',
    projectId: 'J1',
    createdAt: SIGNED - 86_400_000,
    updatedAt: SIGNED - 86_400_000,
  }
  const lines = R.timesheetLiveLinesFromBookings({ bookings: [booking], personIds: ['OP1'], periodStartDayKey: run.startDayKey, periodEndDayKey: run.endDayKey, timeZone: LONDON })
  assert.equal(lines.length, 1)
  const record = R.signedTimesheetBookingRecord(lines, [booking])
  const signed = { ...personSigned, operativeSignedBookings: record, operativeSignedBookingsSignedAt: SIGNED, operativeSignedBookingsAt: SIGNED }
  const sheets = [sheet('OP1', signed)]
  const counted = (bookings: Array<Record<string, unknown>>) =>
    R.timesheetSignOffReminderRecipients({ sheets, roster, payRun: run, timeZone: LONDON, bookings: bookings as never, bookingsLoaded: true }).map((row) => [row.userId, row.names])
  // Unchanged: waiting for the line manager.
  assert.deepEqual(counted([booking]), [['MGR', ['Olly One']]])
  // Changed after signing (finish moved): back with the person — not counted.
  assert.deepEqual(counted([{ ...booking, workEndTime: '18:00', updatedAt: SIGNED + 86_400_000 }]), [])
  // Deleted: back with the person — not counted.
  assert.deepEqual(counted([]), [])
  // Without the bookings (a failed read): stored signals only, as before.
  assert.deepEqual(
    R.timesheetSignOffReminderRecipients({ sheets, roster, payRun: run, timeZone: LONDON, bookings: [], bookingsLoaded: false }).map((row) => row.userId),
    ['MGR']
  )
})

test('1.78.0 sign-off reminder: a PAYE-day booking and another run\'s booking are never live lines', () => {
  const payeFromNov20 = R.timesheetSignOffReminderRosterMember(
    'OPX',
    { organizationId: ORG, firstName: 'X', employmentType: 'paye', employmentTypeTransitionFrom: 'self_employed', employmentTypeEffectiveAt: dateFromDayKeyInZone('2026-11-20', LONDON).getTime() },
    { organizationId: ORG }
  )!
  const base = { collection: 'bookings', timeSlot: 'FULL DAY', personId: 'OPX', projectId: 'J1' }
  const lines = R.timesheetLiveLinesFromBookings({
    bookings: [
      { ...base, bookingId: 'SE', dayKey: '2026-11-17' },
      { ...base, bookingId: 'PAYE', dayKey: '2026-11-24' },
      { ...base, bookingId: 'OUT', dayKey: '2026-12-01' },
      { ...base, bookingId: 'CANCELLED', dayKey: '2026-11-18', status: 'Cancelled' },
      { ...base, bookingId: 'OTHER', dayKey: '2026-11-18', personId: 'SOMEONE' },
      { bookingId: 'OFFICE', collection: 'managerSiteBookings', dayKey: '2026-11-19', timeSlot: 'FULL DAY', personId: 'opx', locationType: 'office' },
    ],
    personIds: ['OPX'],
    periodStartDayKey: run.startDayKey,
    periodEndDayKey: run.endDayKey,
    person: payeFromNov20,
    timeZone: LONDON,
  })
  assert.deepEqual(lines.map((line) => [line.bookingId, line.scheduleOptionPlace]), [['SE', false], ['OFFICE', true]])
})

test('1.78.0 sign-off reminder roster: a member through the members map takes their level here, not their home company\'s', () => {
  // Visiting admin elsewhere, a manager here (members map): reviews their reports here.
  const visitor = R.timesheetSignOffReminderRosterMember(
    'VIS',
    { organizationId: 'other-org', firstName: 'Vi', surname: 'Sitor', email: 'vi@x.test', adminAccess: true, annualLeaveSelfBook: true, timesheetSelfSign: true, passwordSet: true },
    { organizationId: ORG, membersRole: 'manager' }
  )!
  assert.equal(visitor.role?.isAdmin, false)
  assert.equal(visitor.role?.isManager, true)
  assert.equal(visitor.timesheetSelfSign, false, 'never the home company\'s toggles')
  // Deactivated in their own company but active here (§14: only a membership here deactivates them here).
  const awayInactive = R.timesheetSignOffReminderRosterMember(
    'VIS2',
    { organizationId: 'other-org', firstName: 'Vi', surname: 'Two', email: 'vi2@x.test', isActive: false, passwordSet: true },
    { organizationId: ORG, membersRole: 'manager' }
  )!
  assert.equal(awayInactive.isActive, true, 'home isActive never counts here')
  const membershipOff = R.timesheetSignOffReminderRosterMember(
    'VIS3',
    { organizationId: 'other-org', firstName: 'Vi', surname: 'Three', email: 'vi3@x.test', passwordSet: true },
    { organizationId: ORG, membersRole: 'manager', membership: { role: 'manager', accountActive: false } }
  )!
  assert.equal(membershipOff.isActive, false, 'deactivated by the membership here')
  const op = R.timesheetSignOffReminderRosterMember(
    'OPV',
    { organizationId: ORG, firstName: 'Op', surname: 'Visited', role: 'operative', operativeMode: true, passwordSet: true, assignedManagerUserIds: ['VIS'] },
    { organizationId: ORG }
  )!
  const out = R.timesheetSignOffReminderRecipients({ sheets: [sheet('OPV', personSigned)], roster: [...roster, visitor, op], payRun: run, timeZone: LONDON })
  assert.deepEqual(out.map((row) => [row.userId, row.names]), [['VIS', ['Op Visited']]])
  // A users document storing its organisation as a path is a home member.
  const pathed = R.timesheetSignOffReminderRosterMember('P', { organizationId: `organizations/${ORG}`, adminAccess: true }, { organizationId: ORG })!
  assert.equal(pathed.role?.isAdmin, true)
  // The creator is admin and Super Admin here whatever their users document says.
  const creator = R.timesheetSignOffReminderRosterMember('C', { organizationId: 'other-org', role: 'operative', operativeMode: true }, { organizationId: ORG, creatorUserId: 'C' })!
  assert.equal(creator.role?.isSuperAdmin, true)
})
