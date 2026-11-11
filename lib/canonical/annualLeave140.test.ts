/**
 * Rulebook 1.40.0 (owner decisions 11 Nov): the Team list (F18–F23), the allowance by employment type (G25–G27) and
 * manual adjustments (H28–H35). Old shapes (guardrail 3): no employmentType stored, an id in another letter case, a
 * second same-email users document, a stored "set remaining" override, an anonymised deleted profile, a pending invite.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ANNUAL_LEAVE_ADJUSTMENT_DAYS_MESSAGE,
  ANNUAL_LEAVE_ADJUSTMENT_REASON_MESSAGE,
  annualLeaveAdjustedNoticeText,
  annualLeaveAdjustedRecipients,
  annualLeaveAdjustmentCreateFields,
  annualLeaveAdjustmentLabel,
  annualLeaveAdjustmentValidationError,
  annualLeaveAdjustmentsForPerson,
  annualLeaveBalance,
  annualLeaveBankHolidayRange,
  annualLeaveTeamEmptyMessage,
  annualLeaveTeamPeople,
  annualLeaveTeamTabVisible,
  canAdjustAnnualLeave,
  canViewAnnualLeaveAdjustments,
  devicePushNotificationTypes,
  KNOWN_NOTIFICATION_TYPES,
  leaveAllowanceForWindow,
  notificationDestination,
  notificationPreferenceKeyForType,
  notificationRelatedIdFor,
  parseAnnualLeaveAdjustmentDocument,
  proRataLeaveAllowance,
  type StaffAccountRole,
} from './index'

const LONDON = 'Europe/London'
const ADMIN: StaffAccountRole = { isSuperAdmin: false, isAdmin: true, isManager: false, isOperativeMode: false }
const SUPER: StaffAccountRole = { isSuperAdmin: true, isAdmin: true, isManager: false, isOperativeMode: false }
const MANAGER: StaffAccountRole = { isSuperAdmin: false, isAdmin: false, isManager: true, isOperativeMode: false }
const OPERATIVE: StaffAccountRole = { isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: true }

const people = [
  { id: 'ADMIN1', email: 'ann@x.test', firstName: 'Ann', surname: 'Admin', passwordSet: true, isActive: true, role: ADMIN, hasNoLineManager: true, annualLeaveSelfBook: true },
  { id: 'SUPER1', email: 'sue@x.test', firstName: 'Sue', surname: 'Super', passwordSet: true, isActive: true, role: SUPER },
  { id: 'MGR1', email: 'mo@x.test', firstName: 'Mo', surname: 'Manager', passwordSet: true, isActive: true, role: MANAGER, assignedManagerUserIds: ['ADMIN1'], annualLeaveSelfBook: true },
  { id: 'MGR2', email: 'max@x.test', firstName: 'Max', surname: 'Other', passwordSet: true, isActive: true, role: MANAGER, assignedManagerUserIds: ['ADMIN1'] },
  // Reports Mo by an id in another letter case.
  { id: 'OP1', email: 'olly@x.test', firstName: 'Olly', surname: 'Op', passwordSet: true, isActive: true, role: OPERATIVE, assignedManagerUserIds: ['mgr1'] },
  { id: 'OP2', email: 'pat@x.test', firstName: 'Pat', surname: 'Op', passwordSet: true, isActive: true, role: OPERATIVE, assignedManagerUserIds: ['MGR2'] },
  // A ghost (no email, no login) reporting to Mo.
  { id: 'GHOST1', email: '', firstName: 'Gus', surname: 'Ghost', passwordSet: false, ghost: true, isActive: true, role: OPERATIVE, assignedManagerUserIds: ['MGR1'] },
  // Never listed: a deleted profile, a pending invite, an inactive person (all reporting to Mo).
  { id: 'DEL1', email: '', firstName: 'Deleted', surname: 'user', passwordSet: true, isActive: true, role: OPERATIVE, assignedManagerUserIds: ['MGR1'] },
  { id: 'PEND1', email: 'new@x.test', firstName: 'New', surname: 'Person', passwordSet: false, isActive: true, role: OPERATIVE, assignedManagerUserIds: ['MGR1'] },
  { id: 'GONE1', email: 'gone@x.test', firstName: 'Gone', surname: 'Away', passwordSet: true, isActive: false, role: OPERATIVE, assignedManagerUserIds: ['MGR1'] },
]
const roster = people

test('1.40.0 Team: an admin sees every current person (self-bookers included), never themself, deleted or pending', () => {
  const list = annualLeaveTeamPeople({ viewer: people[0], people, roster }).map((p) => p.id)
  assert.deepEqual(list, ['SUPER1', 'MGR1', 'MGR2', 'OP1', 'OP2', 'GHOST1'])
  assert.equal(annualLeaveTeamTabVisible({ viewer: people[0], people, roster }), true)
  // The Super Admin likewise, never themself.
  const fromSuper = annualLeaveTeamPeople({ viewer: people[1], people, roster }).map((p) => p.id)
  assert.ok(!fromSuper.includes('SUPER1'))
  assert.ok(fromSuper.includes('ADMIN1'))
})

test('1.40.0 Team: a manager sees only the people they line-manage (any id case), self-bookers included', () => {
  const mo = people[2]
  assert.deepEqual(annualLeaveTeamPeople({ viewer: mo, people, roster }).map((p) => p.id), ['OP1', 'GHOST1'])
  assert.equal(annualLeaveTeamTabVisible({ viewer: mo, people, roster }), true)
  // A manager with nobody to manage: no tab (the Operatives toggle plays no part).
  const lonely = { ...people[3], id: 'MGR3', email: 'z@x.test' }
  assert.deepEqual(annualLeaveTeamPeople({ viewer: lonely, people, roster }), [])
  assert.equal(annualLeaveTeamTabVisible({ viewer: lonely, people, roster }), false)
  assert.equal(annualLeaveTeamEmptyMessage(lonely), 'Nobody reports to you yet. People you line-manage appear here.')
})

test('1.40.0 Team: an admin with a line manager is in that manager\'s list; the viewer under a second same-email id is still themself', () => {
  // ADMIN1 manages Mo (a self-booker): Mo is listed for Ann.
  assert.ok(annualLeaveTeamPeople({ viewer: people[0], people, roster }).some((p) => p.id === 'MGR1'))
  // A second users document for Ann on the same email is Ann.
  const withCopy = [...people, { id: 'admin1-old', email: 'ANN@x.test', firstName: 'Ann', surname: 'Admin', passwordSet: true, isActive: true, role: ADMIN }]
  const list = annualLeaveTeamPeople({ viewer: people[0], people: withCopy, roster: withCopy }).map((p) => p.id)
  assert.ok(!list.includes('admin1-old'))
})

test('1.40.0 Team: an operative-level person is never a line manager, so an operative has no Team tab', () => {
  const op = people[4]
  const demoted = people.map((p) => (p.id === 'MGR2' ? { ...p, role: OPERATIVE } : p))
  assert.deepEqual(annualLeaveTeamPeople({ viewer: { ...demoted[3] }, people: demoted, roster: demoted }), [])
  assert.equal(annualLeaveTeamTabVisible({ viewer: op, people, roster }), false)
})

test('1.40.0 Team: a catalogue operatives row with no account is listed for admins only while active', () => {
  const rows = [...people, { id: 'ROW1', email: 'row@x.test', firstName: 'Rowan', surname: 'Row', catalogueOperative: true, isActive: true }, { id: 'ROW2', email: '', firstName: 'Old', surname: 'Row', catalogueOperative: true, isActive: false }]
  const admin = annualLeaveTeamPeople({ viewer: people[0], people: rows, roster }).map((p) => p.id)
  assert.ok(admin.includes('ROW1'))
  assert.ok(!admin.includes('ROW2'))
  assert.ok(!annualLeaveTeamPeople({ viewer: people[2], people: rows, roster }).some((p) => p.id === 'ROW1'))
  // A users document first wins the fold over a catalogue row on the same email.
  const dup = [...people, { id: 'ROWX', email: 'olly@x.test', firstName: 'Olly', surname: 'Op', catalogueOperative: true, isActive: true }]
  assert.equal(annualLeaveTeamPeople({ viewer: people[0], people: dup, roster }).filter((p) => p.email === 'olly@x.test').length, 1)
})

// MARK: - Employment type (G25–G27)

const base = { daysPerYear: 25, orgStartMonth: 1, orgEndMonth: 12, timeZone: LONDON }

test('1.40.0 allowance: no employment passed reads as before 1.40.0', () => {
  const b = annualLeaveBalance({ ...base, onDayKey: '2026-11-10' })
  assert.equal(b.hasAllowance, true)
  assert.equal(b.remaining, 25)
  assert.equal(b.allowanceTaken, 0)
  assert.equal(b.adjustmentDays, 0)
  assert.equal(b.allowanceBeforeAdjustments, 25)
})

test('1.40.0 allowance: self-employed (and a missing type, and a ghost) has no allowance — days taken only', () => {
  const bookings = [{ startDayKey: '2026-03-02', endDayKey: '2026-03-03', status: 'approved' }]
  for (const employment of [{ employmentType: 'self_employed' }, {}, { employmentType: null }]) {
    const b = annualLeaveBalance({ ...base, onDayKey: '2026-11-10', bookings, employment })
    assert.equal(b.hasAllowance, false)
    assert.equal(b.remaining, null)
    assert.equal(b.usedThisYear, 2)
  }
  const paye = annualLeaveBalance({ ...base, onDayKey: '2026-11-10', bookings, employment: { employmentType: 'paye' } })
  assert.equal(paye.hasAllowance, true)
  assert.equal(paye.remaining, 23)
})

test('1.40.0 owner case: self-employed → PAYE from 1 Jul is pro rata from 1 Jul; leave before it does not count', () => {
  const employment = {
    employmentType: 'paye',
    employmentTypeTransitionFrom: 'self_employed',
    employmentTypeEffectiveAt: new Date('2026-06-30T23:00:00Z'), // 1 Jul 00:00 London (BST)
  }
  const bookings = [
    { startDayKey: '2026-03-02', endDayKey: '2026-03-06', status: 'approved' }, // 5 days while self-employed
    { startDayKey: '2026-08-03', endDayKey: '2026-08-04', status: 'approved' }, // 2 days while PAYE
    { startDayKey: '2026-12-21', endDayKey: '2026-12-21', status: 'pending' },
  ]
  // Before D: self-employed, no allowance.
  assert.equal(annualLeaveBalance({ ...base, onDayKey: '2026-06-15', bookings, employment }).hasAllowance, false)
  const b = annualLeaveBalance({ ...base, onDayKey: '2026-11-10', bookings, employment })
  // 25 × 184 / 365 = 12.60… → 13 (rounded up to the next half day, `proRataLeaveAllowance` maths).
  assert.equal(b.yearEntitlement, 13)
  assert.equal(b.proRata, true)
  assert.equal(b.taken, 7)
  assert.equal(b.allowanceTaken, 2)
  assert.equal(b.allowancePending, 1)
  assert.equal(b.remaining, 10)
  // A later start date wins over the PAYE date.
  const joined = annualLeaveBalance({ ...base, onDayKey: '2026-11-10', bookings, employment, employmentStartDayKey: '2026-10-01' })
  assert.equal(joined.yearEntitlement, proRataLeaveAllowance({ daysPerYear: 25, year: { startDayKey: '2026-01-01', endDayKey: '2026-12-31' }, employmentStartDayKey: '2026-10-01' }).allowance)
})

test('1.40.0 owner case: PAYE → self-employed stops the allowance; approved and pending leave stay; no carry-over out', () => {
  const employment = {
    employmentType: 'self_employed',
    employmentTypeTransitionFrom: 'paye',
    employmentTypeEffectiveAt: new Date('2026-09-01T00:00:00+01:00'),
  }
  const bookings = [
    { startDayKey: '2026-08-03', endDayKey: '2026-08-03', status: 'approved' },
    { startDayKey: '2026-10-05', endDayKey: '2026-10-05', status: 'pending' },
  ]
  const after = annualLeaveBalance({ ...base, onDayKey: '2026-11-10', bookings, employment, carriesOver: true })
  assert.equal(after.hasAllowance, false)
  assert.equal(after.taken, 1)
  assert.equal(after.pending, 1)
  // Before the change (still PAYE in the year that changes): pro rata to the PAYE part, Jan–Aug.
  const before = annualLeaveBalance({ ...base, onDayKey: '2026-08-10', bookings, employment })
  assert.equal(before.hasAllowance, true)
  assert.equal(before.yearEntitlement, leaveAllowanceForWindow({ daysPerYear: 25, year: { startDayKey: '2026-01-01', endDayKey: '2026-12-31' }, toDayKey: '2026-08-31' }).allowance)
})

test('1.40.0 carry-over: nothing out of a self-employed year; a part-PAYE year carries its PAYE part less PAYE leave', () => {
  const into2027 = {
    employmentType: 'paye',
    employmentTypeTransitionFrom: 'self_employed',
    employmentTypeEffectiveAt: new Date('2027-01-01T00:00:00Z'),
  }
  const none = annualLeaveBalance({ ...base, onDayKey: '2027-03-01', carriesOver: true, employment: into2027 })
  assert.equal(none.carriedForward, 0)
  assert.equal(none.remaining, 25)
  const midYear = {
    employmentType: 'paye',
    employmentTypeTransitionFrom: 'self_employed',
    employmentTypeEffectiveAt: new Date('2026-06-30T23:00:00Z'),
  }
  const bookings = [
    { startDayKey: '2026-03-02', endDayKey: '2026-03-06', status: 'approved' },
    { startDayKey: '2026-08-03', endDayKey: '2026-08-04', status: 'approved' },
  ]
  const carried = annualLeaveBalance({ ...base, onDayKey: '2027-03-01', carriesOver: true, employment: midYear, bookings })
  assert.equal(carried.carriedForward, 11) // 13 − 2
})

test('1.40.0 bank-holiday range follows the employment-type year months', () => {
  const se = annualLeaveBankHolidayRange({ annualLeaveEnabled: true, startMonth: 4, endMonth: 3, orgStartMonth: 1, orgEndMonth: 12, onDayKey: '2026-11-10', timeZone: LONDON, employment: { employmentType: 'self_employed' } })
  assert.equal(se.startDayKey, '2025-01-01')
  const paye = annualLeaveBankHolidayRange({ annualLeaveEnabled: true, startMonth: 4, endMonth: 3, orgStartMonth: 1, orgEndMonth: 12, onDayKey: '2026-11-10', timeZone: LONDON, employment: { employmentType: 'paye' } })
  assert.equal(paye.startDayKey, '2025-04-01')
})

// MARK: - Adjustments (H28–H35)

const paye = { employmentType: 'paye' }

test('1.40.0 adjustments: added on top of the allowance for their year only; never carried over', () => {
  const adjustments = [
    { days: 2, yearKey: '2026-01-01' },
    { days: -0.5, yearKey: '2026-01-01' },
    { days: 10, yearKey: '2025-01-01' },
  ]
  const b = annualLeaveBalance({ ...base, onDayKey: '2026-11-10', employment: paye, adjustments, carriesOver: true })
  assert.equal(b.adjustmentDays, 1.5)
  assert.equal(b.carriedForward, 25) // 2025's +10 never carries
  assert.equal(b.remaining, 51.5)
})

test('1.40.0 adjustments: remaining may go below zero; ignored while self-employed, counted again on return', () => {
  const minus = annualLeaveBalance({ ...base, onDayKey: '2026-11-10', employment: paye, adjustments: [{ days: -30, yearKey: '2026-01-01' }] })
  assert.equal(minus.remaining, -5)
  const se = annualLeaveBalance({ ...base, onDayKey: '2026-11-10', employment: { employmentType: 'self_employed' }, adjustments: [{ days: 3, yearKey: '2026-01-01' }] })
  assert.equal(se.adjustmentDays, 0)
  assert.equal(se.remaining, null)
})

test('1.40.0 adjustments: a stored "set remaining" override is still read for its year, with adjustments on top', () => {
  const b = annualLeaveBalance({ ...base, onDayKey: '2026-11-10', employment: paye, yearAllowance: 12, yearAllowanceKey: '2026-01-01', adjustments: [{ days: 1, yearKey: '2026-01-01' }] })
  assert.equal(b.allowanceBeforeAdjustments, 12)
  assert.equal(b.remaining, 13)
  const nextYear = annualLeaveBalance({ ...base, onDayKey: '2027-02-01', employment: paye, yearAllowance: 12, yearAllowanceKey: '2026-01-01' })
  assert.equal(nextYear.remaining, 25)
})

test('1.40.0 adjustments: validation, create fields and reader', () => {
  assert.equal(annualLeaveAdjustmentValidationError({ days: 0, reason: 'x' }), ANNUAL_LEAVE_ADJUSTMENT_DAYS_MESSAGE)
  assert.equal(annualLeaveAdjustmentValidationError({ days: 0.3, reason: 'x' }), ANNUAL_LEAVE_ADJUSTMENT_DAYS_MESSAGE)
  assert.equal(annualLeaveAdjustmentValidationError({ days: '', reason: 'x' }), ANNUAL_LEAVE_ADJUSTMENT_DAYS_MESSAGE)
  assert.equal(annualLeaveAdjustmentValidationError({ days: 400, reason: 'x' }), ANNUAL_LEAVE_ADJUSTMENT_DAYS_MESSAGE)
  assert.equal(annualLeaveAdjustmentValidationError({ days: 2, reason: '  ' }), ANNUAL_LEAVE_ADJUSTMENT_REASON_MESSAGE)
  assert.equal(annualLeaveAdjustmentValidationError({ days: -1.5, reason: 'Long service' }), null)
  assert.equal(annualLeaveAdjustmentValidationError({ days: '2.5', reason: 'ok' }), null)
  assert.deepEqual(
    annualLeaveAdjustmentCreateFields({ userId: 'OP1', days: '-1.5', reason: '  Unpaid day ', yearKey: '2026-01-01', createdBy: 'ADMIN1', createdByName: 'Ann Admin' }),
    { userId: 'OP1', days: -1.5, reason: 'Unpaid day', yearKey: '2026-01-01', createdBy: 'ADMIN1', createdByName: 'Ann Admin' }
  )
  assert.equal(annualLeaveAdjustmentCreateFields({ userId: 'OP1', days: 1, reason: 'x', yearKey: '2026', createdBy: 'A' }), null)
  const read = parseAnnualLeaveAdjustmentDocument('ADJ1', { userId: 'OP1', days: '2', reason: 'x', yearKey: '2026-01-01', createdBy: 'ADMIN1', createdAt: { seconds: 1700000000, nanoseconds: 0 } })
  assert.equal(read?.days, 2)
  assert.equal(read?.createdAtMs, 1700000000000)
  assert.equal(parseAnnualLeaveAdjustmentDocument('ADJ2', { userId: 'OP1', yearKey: '2026-01-01' }), null)
  assert.equal(annualLeaveAdjustmentLabel(2), '+2 days')
  assert.equal(annualLeaveAdjustmentLabel(-0.5), '−0.5 day')
  assert.equal(annualLeaveAdjustmentLabel(1), '+1 day')
  const rows = [
    { id: 'b', userId: 'op1', createdAtMs: 2 },
    { id: 'a', userId: 'OP1', createdAtMs: 1 },
    { id: 'c', userId: 'OTHER', createdAtMs: 0 },
  ]
  assert.deepEqual(annualLeaveAdjustmentsForPerson(rows, ['OP1']).map((r) => r.id), ['a', 'b'])
})

test('1.40.0 adjustments: admins and the person\'s line managers may adjust, never the person themself', () => {
  const op1 = people[4]
  assert.equal(canAdjustAnnualLeave(people[0], op1, roster), true) // admin
  assert.equal(canAdjustAnnualLeave(people[2], op1, roster), true) // Mo, line manager (id in another case)
  assert.equal(canAdjustAnnualLeave(people[3], op1, roster), false) // Max manages someone else
  assert.equal(canAdjustAnnualLeave(op1, op1, roster), false) // self
  assert.equal(canAdjustAnnualLeave(people[0], people[0], roster), false) // an admin never adjusts their own
  assert.equal(canViewAnnualLeaveAdjustments(op1, op1, roster), true)
  assert.equal(canViewAnnualLeaveAdjustments(people[5], op1, roster), false)
})

test('1.40.0 annual_leave_adjusted: every admin but the actor, company activity, opens the person\'s leave', () => {
  assert.deepEqual(annualLeaveAdjustedRecipients(people[0], roster).sort(), ['SUPER1'])
  assert.deepEqual(annualLeaveAdjustedRecipients(people[2], roster).sort(), ['ADMIN1', 'SUPER1'])
  assert.ok(KNOWN_NOTIFICATION_TYPES.includes('annual_leave_adjusted'))
  assert.ok(devicePushNotificationTypes().includes('annual_leave_adjusted'))
  assert.equal(notificationPreferenceKeyForType('annual_leave_adjusted'), 'companyActivity')
  assert.equal(notificationRelatedIdFor('annual_leave_adjusted', 'OP1'), 'OP1')
  assert.deepEqual(notificationDestination({ type: 'annual_leave_adjusted', relatedId: 'OP1', role: 'admin' }), { kind: 'annualLeavePerson', relatedId: 'OP1', userId: 'OP1' })
  const text = annualLeaveAdjustedNoticeText({ personName: 'Olly Op', actorName: 'Mo Manager', days: 2, reason: 'Long service' })
  assert.equal(text.message, "Mo Manager adjusted Olly Op's annual leave by +2 days this leave year: Long service")
})
