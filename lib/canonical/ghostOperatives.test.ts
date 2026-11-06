/**
 * Rulebook 1.34.0 §11 (owner design 6 Nov): ghost operatives — bookable, no app login. Creation, the add form, roster
 * segment, unbooked labour (two ghosts both listed), unverified rows, timesheets / overtime / notifications exclusions,
 * leave, delete plan, Payrun Snapshot, Give app access, invite accept and the conversion of no-login operatives rows.
 * Includes old document shapes (guardrail 3): a users document without `ghost`, a ghost stored with `ghost: 1`.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GHOST_BADGE_LABEL,
  GHOST_EMAIL_REFUSED_MESSAGE,
  GHOST_INVITED_BADGE_LABEL,
  GHOST_LINE_MANAGER_INVALID_MESSAGE,
  GHOST_LINE_MANAGER_REQUIRED_MESSAGE,
  GHOST_NAME_REQUIRED_MESSAGE,
  GHOST_PHONE_REFUSED_MESSAGE,
  GHOST_RATE_REQUIRED_MESSAGE,
  INVITE_ACCEPT_DROPPED_PLACEHOLDER_FIELDS,
  PAYRUN_SNAPSHOT_GHOST_CELL,
  USER_DOCUMENT_FIELDS,
  canBookLeaveFor,
  canCreateGhost,
  canUpgradeGhost,
  excludeActor,
  exportedTimesheetHistorySubjects,
  ghostAddFormRows,
  ghostBadgeLabel,
  ghostConversionCandidates,
  ghostConversionWrites,
  ghostCreateError,
  ghostCreateWrites,
  ghostLeaveBooking,
  ghostUpgradeRefusal,
  ghostUpgradeWrites,
  inviteAcceptPlaceholderFields,
  inviteAcceptWrites,
  isGhostUser,
  listedRosterUsers,
  overtimeUserSubjects,
  parseUserDocument,
  payrunSnapshotRows,
  personDedupeKey,
  rosterSegment,
  showsMyTimesheets,
  unbookedLabourRowsOnDay,
  unverifiedOperativeRows,
  userDeleteWrites,
  userTimesheetSubjects,
  type LabourPerson,
} from './index'

const ORG = 'org1'
const ADMIN = { id: 'admin1', email: 'admin@x.com', firstName: 'Ada', surname: 'Admin', role: 'admin', adminAccess: true, isActive: true, passwordSet: true, organizationId: ORG }
const MANAGER = { id: 'mgr1', email: 'mgr@x.com', firstName: 'Max', surname: 'Manager', role: 'manager', manager: true, isActive: true, passwordSet: true, organizationId: ORG, assignedManagerUserIds: ['admin1'] }
const OPS_MANAGER = { ...MANAGER, id: 'mgr2', email: 'ops@x.com', operatives: true, permissions: { operatives: true } }
const OTHER_MANAGER = { ...MANAGER, id: 'mgr3', email: 'other@x.com' }
const OPERATIVE = { id: 'op1', email: 'op@x.com', firstName: 'Olly', surname: 'Op', role: 'operative', operativeMode: true, isActive: true, passwordSet: true, organizationId: ORG }

function ghostDoc(id: string, extra: Record<string, unknown> = {}) {
  const plan = ghostCreateWrites({
    organizationId: ORG,
    ghostId: id,
    draft: { firstName: 'Gus', surname: `Ghost ${id}`, payBasis: 'day', dayRate: 150, lineManagerIds: ['mgr1'] },
    actorUserId: 'admin1',
    platform: 'web',
  })
  assert.ok(plan)
  return { id, ...plan.user.fields, ...extra }
}

const ROSTER = [ADMIN, MANAGER, OPS_MANAGER, OTHER_MANAGER, OPERATIVE]

test('isGhostUser: true / 1 / "true" only; a document without ghost (older shape) is not a ghost', () => {
  assert.equal(isGhostUser({ ghost: true }), true)
  assert.equal(isGhostUser({ ghost: 1 }), true)
  assert.equal(isGhostUser({ ghost: 'true' }), true)
  assert.equal(isGhostUser({ ghost: false }), false)
  assert.equal(isGhostUser({}), false)
  assert.equal(isGhostUser(null), false)
  assert.equal(ghostBadgeLabel({ ghost: true }), GHOST_BADGE_LABEL)
  assert.equal(ghostBadgeLabel({ ghost: true, email: 'g@x.com' }), GHOST_INVITED_BADGE_LABEL)
  assert.equal(ghostBadgeLabel({ email: 'a@x.com' }), '')
})

test('canCreateGhost: admins and Operatives managers, never a plain manager or operative', () => {
  assert.equal(canCreateGhost(ADMIN), true)
  assert.equal(canCreateGhost(OPS_MANAGER), true)
  assert.equal(canCreateGhost(MANAGER), false)
  assert.equal(canCreateGhost(OPERATIVE), false)
})

test('ghostCreateError: names, then rate above 0, then line manager; email and phone refused; trade optional', () => {
  const ok = { firstName: 'A', surname: 'B', payBasis: 'hourly', hourlyRate: 20, lineManagerIds: ['mgr1'] }
  assert.equal(ghostCreateError(ok), null)
  assert.equal(ghostCreateError({ ...ok, surname: ' ' }), GHOST_NAME_REQUIRED_MESSAGE)
  assert.equal(ghostCreateError({ ...ok, hourlyRate: 0 }), GHOST_RATE_REQUIRED_MESSAGE)
  assert.equal(ghostCreateError({ ...ok, payBasis: 'day', dayRate: null }), GHOST_RATE_REQUIRED_MESSAGE)
  assert.equal(ghostCreateError({ ...ok, lineManagerIds: [] }), GHOST_LINE_MANAGER_REQUIRED_MESSAGE)
  assert.equal(ghostCreateError({ ...ok, email: 'g@x.com' }), GHOST_EMAIL_REFUSED_MESSAGE)
  assert.equal(ghostCreateError({ ...ok, mobileNumber: '0777' }), GHOST_PHONE_REFUSED_MESSAGE)
  // A line manager must be one the picker offers (an active admin or manager), never an operative.
  assert.equal(ghostCreateError({ ...ok, lineManagerIds: ['op1'] }, { roster: ROSTER }), GHOST_LINE_MANAGER_INVALID_MESSAGE)
  assert.equal(ghostCreateError({ ...ok, lineManagerIds: ['mgr1'] }, { roster: ROSTER }), null)
})

test('ghostCreateWrites: the exact users document; no email, phone, hasNoLineManager, alias ids; pay to payProfiles when privatePay', () => {
  const plan = ghostCreateWrites({
    organizationId: ORG,
    ghostId: 'g1',
    draft: { firstName: ' Gus ', surname: 'Ghost', payBasis: 'day', dayRate: '150', lineManagerIds: ['mgr1', 'MGR1', 'admin1'], tradeTypePreset: 'Labourer' },
    actorUserId: 'mgr2',
    platform: 'web',
  })
  assert.ok(plan)
  const f = plan.user.fields
  assert.equal(plan.user.path, 'users/g1')
  assert.equal(f.ghost, true)
  assert.equal(f.passwordSet, false)
  assert.equal(f.isActive, true)
  assert.equal(f.role, 'operative')
  assert.equal(f.operativeMode, true)
  assert.equal(f.employmentType, 'self_employed')
  assert.equal(f.timesheetsEnabled, false)
  assert.deepEqual(f.assignedManagerUserIds, ['mgr1', 'admin1'])
  assert.equal(f.assignedManagerUserId, 'mgr1')
  assert.equal(f.payBasis, 'day')
  assert.equal(f.dayRate, 150)
  assert.equal(f.firstName, 'Gus')
  assert.equal(f.tradeTypePreset, 'Labourer')
  for (const key of ['email', 'mobileNumber', 'hasNoLineManager', 'formerUserIds', 'sameEmailUserIds', 'hourlyRate']) {
    assert.equal(key in f, false, key)
  }
  for (const key of ['adminAccess', 'manager', 'operatives', 'isSuperAdmin', 'annualLeaveSelfBook', 'timesheetSelfSign']) {
    assert.notEqual(f[key], true, key)
  }
  assert.equal(f.updatedBy, 'mgr2')
  assert.equal(plan.payProfile, null)
  const priv = ghostCreateWrites({
    organizationId: ORG,
    ghostId: 'g1',
    draft: { firstName: 'G', surname: 'H', payBasis: 'hourly', hourlyRate: 20, lineManagerIds: ['mgr1'] },
    actorUserId: 'admin1',
    platform: 'web',
    privatePay: true,
  })
  assert.ok(priv && priv.payProfile)
  assert.equal('hourlyRate' in priv.user.fields, false)
  assert.equal('employmentType' in priv.user.fields, false)
  assert.equal(priv.payProfile.path, `organizations/${ORG}/payProfiles/g1`)
  assert.equal(priv.payProfile.fields.hourlyRate, 20)
  assert.equal(priv.payProfile.fields.userId, 'g1')
  assert.equal(ghostCreateWrites({ organizationId: ORG, ghostId: 'g/1', draft: {}, actorUserId: 'a', platform: 'web' }), null)
})

test('ghostAddFormRows: toggle first; ghost on hides email, phone, permissions, account type, tax, employment, timesheets', () => {
  const on = ghostAddFormRows({ ghost: true, canCreateGhost: true })
  assert.equal(on[0].field, 'ghostToggle')
  const visible = on.filter((row) => row.visible).map((row) => row.field)
  assert.deepEqual(visible, ['ghostToggle', 'firstName', 'surname', 'annualLeave', 'lineManagers', 'pay', 'trade'])
  assert.deepEqual(on.filter((row) => row.required).map((row) => row.field), ['firstName', 'surname', 'lineManagers', 'pay'])
  const off = ghostAddFormRows({ ghost: false, canCreateGhost: true })
  assert.ok(off.find((row) => row.field === 'email')?.visible)
  const noRight = ghostAddFormRows({ ghost: true, canCreateGhost: false })
  assert.equal(noRight[0].visible, false)
  assert.ok(noRight.find((row) => row.field === 'email')?.visible)
})

test('parseUserDocument and USER_DOCUMENT_FIELDS carry ghost and inviteEmailHint; an older document reads ghost false', () => {
  assert.ok((USER_DOCUMENT_FIELDS as readonly string[]).includes('ghost'))
  assert.ok((USER_DOCUMENT_FIELDS as readonly string[]).includes('inviteEmailHint'))
  const doc = parseUserDocument('g1', ghostDoc('g1', { inviteEmailHint: ' Old@X.com ' }))
  assert.ok(doc)
  assert.equal(doc.ghost, true)
  assert.equal(doc.passwordSet, false)
  assert.equal(doc.inviteEmailHint, 'old@x.com')
  const older = parseUserDocument('u1', { email: 'a@x.com', organizationId: ORG })
  assert.equal(older?.ghost, false)
  assert.equal(older?.inviteEmailHint, null)
})

test('roster segment: a ghost is Active or Inactive, never Pending, and never a leftover', () => {
  const ghost = { firstName: 'Gus', surname: 'Ghost', passwordSet: false, isActive: true, ghost: true }
  assert.equal(rosterSegment(ghost), 'active')
  assert.equal(rosterSegment({ ...ghost, isActive: false }), 'inactive')
  assert.equal(rosterSegment({ ...ghost, ghost: undefined }), 'pending')
  assert.equal(listedRosterUsers([ghost], []).length, 1)
  // The same row without `ghost` (an older no-email pending leftover) is still dropped as before.
  assert.equal(listedRosterUsers([{ ...ghost, ghost: undefined }], []).length, 0)
  assert.equal(personDedupeKey({ id: 'G1', email: '' }), 'id:g1')
  assert.equal(personDedupeKey({ id: 'G1', email: ' A@X.com ' }), 'a@x.com')
  assert.notEqual(personDedupeKey({ id: 'g1' }), personDedupeKey({ id: 'g2' }))
})

function labour(doc: Record<string, unknown>): LabourPerson {
  return {
    id: String(doc.id),
    email: String(doc.email ?? ''),
    name: `${doc.firstName} ${doc.surname}`,
    isActive: doc.isActive !== false,
    passwordSet: doc.passwordSet === true,
    isOperativeMode: true,
    isManager: false,
    isAdmin: false,
    isSuperAdmin: false,
    ghost: doc.ghost === true,
  }
}

test('unbooked labour: two ghosts (no email) are both listed; booked ghost covered; inactive ghost never', () => {
  const g1 = ghostDoc('g1')
  const g2 = ghostDoc('g2')
  const g3 = ghostDoc('g3', { isActive: false })
  const base = {
    dayKey: '2026-11-09',
    timeZone: 'Europe/London',
    includeWeekends: false,
    operatives: [],
    holidays: [],
  }
  const rows = unbookedLabourRowsOnDay({ ...base, people: [g1, g2, g3].map(labour), bookings: [] })
  assert.deepEqual(rows.map((row) => row.personKey).sort(), ['g1', 'g2'])
  const booked = unbookedLabourRowsOnDay({
    ...base,
    people: [g1, g2].map(labour),
    bookings: [{ personId: 'G1', dayKey: '2026-11-09', kind: 'operative', timeSlot: 'FULL DAY' }],
  })
  assert.deepEqual(booked.map((row) => row.personKey), ['g2'])
  // An ordinary pending invite (no ghost flag) is still not unbooked labour.
  const pending = unbookedLabourRowsOnDay({ ...base, people: [labour({ ...g1, ghost: false })], bookings: [] })
  assert.equal(pending.length, 0)
})

test('unverified accounts: an invited ghost is never an unverified operative', () => {
  const rows = unverifiedOperativeRows({
    referenceIso: '2026-11-20T09:00:00Z',
    timeZone: 'Europe/London',
    operatives: [{ id: 'g1', email: 'g@x.com', name: 'Gus Ghost' }],
    people: [{ email: 'g@x.com', passwordSet: false, createdAtIso: '2026-11-01T09:00:00Z', isOperativeMode: true, ghost: true }],
  })
  assert.equal(rows.length, 0)
})

test('timesheets, overtime and notifications leave ghosts out', () => {
  const ghost = ghostDoc('g1')
  assert.equal(showsMyTimesheets(ghost, { startDayKey: '2026-11-01', endDayKey: '2026-11-15' }, 'Europe/London'), false)
  const adminRole = { isAdmin: true, isSuperAdmin: false, isManager: false, isOperativeMode: false }
  const opRole = { isAdmin: false, isSuperAdmin: false, isManager: false, isOperativeMode: true }
  const members = [
    { id: 'g1', role: opRole, ghost: true },
    { id: 'op1', role: opRole },
  ]
  assert.deepEqual(userTimesheetSubjects({ viewer: { id: 'admin1', role: adminRole }, members }).map((r) => r.userId), ['op1'])
  assert.deepEqual(
    exportedTimesheetHistorySubjects({ viewer: { id: 'admin1', role: adminRole }, members }).map((r) => r.userId),
    ['op1', 'admin1']
  )
  const roster = [ADMIN, ghost, OPERATIVE] as never
  assert.deepEqual(overtimeUserSubjects(ADMIN as never, roster), ['op1'])
  const notifRoster = [
    { ...ADMIN, role: adminRole },
    { id: 'g1', role: opRole, ghost: true, passwordSet: false },
    { ...OPERATIVE, role: opRole },
  ]
  assert.deepEqual(excludeActor(['g1', 'op1'], 'admin1', notifRoster as never), ['op1'])
})

test('leave: the ghost line manager or an admin books it approved, nobody notified; another manager may not', () => {
  const adminRole = { isAdmin: true, isSuperAdmin: false, isManager: false, isOperativeMode: false }
  const mgrRole = { isAdmin: false, isSuperAdmin: false, isManager: true, isOperativeMode: false }
  const ghost = { id: 'g1', assignedManagerUserIds: ['mgr1'], ghost: true }
  const roster = [
    { id: 'admin1', role: adminRole },
    { id: 'mgr1', role: mgrRole },
    { id: 'mgr3', role: mgrRole },
    { id: 'g1', role: { ...mgrRole, isManager: false, isOperativeMode: true }, assignedManagerUserIds: ['mgr1'] },
  ]
  assert.equal(canBookLeaveFor({ id: 'mgr1', role: mgrRole }, ghost, roster), true)
  assert.equal(canBookLeaveFor({ id: 'admin1', role: adminRole }, ghost, roster), true)
  assert.equal(canBookLeaveFor({ id: 'mgr3', role: mgrRole }, ghost, roster), false)
  assert.deepEqual(ghostLeaveBooking({ id: 'mgr1', role: mgrRole }, ghost, roster), { allowed: true, status: 'approved', notify: false })
})

test('delete: a ghost has only its users document', () => {
  const opRole = { isAdmin: false, isSuperAdmin: false, isManager: false, isOperativeMode: true }
  const steps = userDeleteWrites({
    orgId: ORG,
    user: { id: 'g1', role: opRole, ghost: true },
    actorUserId: 'mgr2',
    platform: 'web',
    nowIso: '2026-11-07T09:00:00Z',
    actorManagesOperatives: true,
  })
  const account = steps.filter((step) => step.step === 'account').flatMap((step) => step.writes)
  assert.deepEqual(account, [{ op: 'delete', path: 'users/g1' }])
  const ordinary = userDeleteWrites({ orgId: ORG, user: { id: 'op1', role: opRole, email: 'op@x.com' }, actorUserId: 'admin1', platform: 'web', nowIso: '2026-11-07T09:00:00Z' })
  assert.equal(ordinary[0].writes.length, 5)
})

test('Payrun Snapshot: a ghost is listed with a grey "No app login" Timesheet cell', () => {
  const rows = payrunSnapshotRows({
    roster: [ghostDoc('g1') as never],
    organization: {},
    period: { start: '2026-11-01', end: '2026-11-15' },
    timeZone: 'Europe/London',
  } as never)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].cells.timesheet.label, PAYRUN_SNAPSHOT_GHOST_CELL)
  assert.equal(rows[0].cells.timesheet.tone, 'neutral')
  assert.equal(rows[0].cells.timesheet.link, null)
  assert.equal(PAYRUN_SNAPSHOT_GHOST_CELL, GHOST_BADGE_LABEL)
})

test('Give app access: admins only, once; the ghost becomes an invite placeholder that is still a ghost', () => {
  const ghost = ghostDoc('g1', { inviteEmailHint: 'old@x.com' })
  assert.equal(canUpgradeGhost(ADMIN, ghost), true)
  assert.equal(ghostUpgradeRefusal(OPS_MANAGER, ghost), 'not_admin')
  assert.equal(ghostUpgradeRefusal(ADMIN, OPERATIVE), 'not_ghost')
  assert.equal(ghostUpgradeRefusal(ADMIN, { ...ghost, isActive: false }), 'inactive')
  assert.equal(ghostUpgradeRefusal(ADMIN, ghost, ''), 'email_required')
  assert.equal(ghostUpgradeRefusal(ADMIN, ghost, 'nope'), 'email_invalid')
  const plan = ghostUpgradeWrites({
    viewer: ADMIN,
    organizationId: ORG,
    ghostId: 'g1',
    ghost,
    email: ' Gus@X.com ',
    invitationId: 'inv1',
    invitedBy: 'admin1',
    now: 'NOW',
    actorUserId: 'admin1',
    platform: 'web',
  })
  assert.ok(plan)
  assert.equal(plan.user.set.email, 'gus@x.com')
  assert.deepEqual(plan.user.remove, ['inviteEmailHint'])
  assert.equal('ghost' in plan.user.set, false)
  assert.equal(plan.invitation.fields.role, 'operative')
  assert.deepEqual(plan.invitation.fields.assignedManagerUserIds, ['mgr1'])
  assert.equal(plan.invitation.fields.dayRate, 150)
  assert.equal(plan.claim.path, `organizations/${ORG}/userEmails/gus@x.com`)
  assert.deepEqual(plan.claim.fields, { userId: 'g1' })
  assert.equal(ghostUpgradeRefusal(ADMIN, { ...ghost, email: 'gus@x.com' }), 'already_invited')
  assert.equal(rosterSegment({ ...ghost, email: 'gus@x.com' } as never), 'active')
})

test('Invite accept never copies the ghost markers onto the account', () => {
  const plan = inviteAcceptWrites({ existingProfile: null, placeholder: { ghost: true }, invitation: { organizationId: ORG, role: 'operative' } })
  assert.deepEqual(plan.dropPlaceholderFields, [...INVITE_ACCEPT_DROPPED_PLACEHOLDER_FIELDS])
  const copied = inviteAcceptPlaceholderFields({ ghost: true, inviteEmailHint: 'a@x.com', firstName: 'Gus' })
  assert.deepEqual(copied, { firstName: 'Gus' })
})

test('Conversion: no-login operatives rows become ghost candidates; rows with an account are left; duplicates fold', () => {
  const candidates = ghostConversionCandidates({
    organizationId: ORG,
    users: [OPERATIVE],
    operatives: [
      { id: 'row-a', firstName: 'Ann', lastName: 'Row', email: 'ann@x.com', dayRate: 120, payBasis: 'day', trade: 'Labourer' },
      { id: 'row-b', firstName: 'Ann', lastName: 'Row', email: 'ANN@x.com' },
      { id: 'row-c', firstName: 'Cal', lastName: '', email: '' },
      { id: 'row-op', firstName: 'Olly', lastName: 'Op', email: 'op@x.com' },
      { id: 'row-off', firstName: 'Off', lastName: 'Row', isActive: false },
      { id: 'op1', firstName: 'Linked', lastName: 'ById' },
    ],
  })
  assert.deepEqual(candidates.map((c) => c.operativeId), ['row-a', 'row-c'])
  assert.deepEqual(candidates[0].duplicateOperativeIds, ['row-b'])
  assert.deepEqual(candidates[0].issues, [])
  assert.deepEqual(candidates[1].issues, ['name', 'rate'])
  const plan = ghostConversionWrites({ organizationId: ORG, candidate: candidates[0], lineManagerIds: ['mgr1'], actorUserId: 'admin1' })
  assert.ok(plan)
  assert.equal(plan.user.path, 'users/row-a')
  assert.equal(plan.user.fields.ghost, true)
  assert.equal(plan.user.fields.inviteEmailHint, 'ann@x.com')
  assert.deepEqual(plan.user.fields.formerUserIds, ['row-b'])
  assert.equal('email' in plan.user.fields, false)
  assert.deepEqual(plan.operativeRow.set, { linkedUserId: 'row-a', email: '' })
  assert.deepEqual(plan.duplicateRows, [{ path: `organizations/${ORG}/operatives/row-b`, set: { linkedUserId: 'row-a', isActive: false } }])
  // No rate and no line manager: refused until the check list fills them.
  assert.equal(ghostConversionWrites({ organizationId: ORG, candidate: candidates[1], lineManagerIds: [], actorUserId: 'admin1' }), null)
  assert.ok(
    ghostConversionWrites({
      organizationId: ORG,
      candidate: candidates[1],
      lineManagerIds: ['mgr1'],
      overrides: { surname: 'Smith', payBasis: 'hourly', hourlyRate: 18 },
      actorUserId: 'admin1',
    })
  )
})
