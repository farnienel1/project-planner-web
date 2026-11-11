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
  ghostAccountsEnabled,
  ghostToggleVisible,
  GHOST_ACCOUNTS_SWITCH_FIELD,
  GHOST_ACCOUNTS_ORGANIZATION_IDS_FIELD,
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
  unbookedLabourRows,
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

test('isGhostUser: the boolean true only (as the rules); a document without ghost (older shape) is not a ghost', () => {
  assert.equal(isGhostUser({ ghost: true }), true)
  assert.equal(isGhostUser({ ghost: 1 }), false)
  assert.equal(isGhostUser({ ghost: 'true' }), false)
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
  assert.equal(f.email, '')
  for (const key of ['mobileNumber', 'hasNoLineManager', 'formerUserIds', 'sameEmailUserIds', 'hourlyRate']) {
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
  const on = ghostAddFormRows({ ghost: true, canCreateGhost: true, ghostAccountsEnabled: true })
  assert.equal(on[0].field, 'ghostToggle')
  const visible = on.filter((row) => row.visible).map((row) => row.field)
  assert.deepEqual(visible, ['ghostToggle', 'firstName', 'surname', 'annualLeave', 'lineManagers', 'pay', 'trade'])
  assert.deepEqual(on.filter((row) => row.required).map((row) => row.field), ['firstName', 'surname', 'lineManagers', 'pay'])
  const off = ghostAddFormRows({ ghost: false, canCreateGhost: true, ghostAccountsEnabled: true })
  assert.ok(off.find((row) => row.field === 'email')?.visible)
  const noRight = ghostAddFormRows({ ghost: true, canCreateGhost: false, ghostAccountsEnabled: true })
  assert.equal(noRight[0].visible, false)
  assert.ok(noRight.find((row) => row.field === 'email')?.visible)
})

test('ghostAccountsEnabled (owner decision 7 Nov "1b"): platformConfig/app switch, missing means off', () => {
  assert.equal(GHOST_ACCOUNTS_SWITCH_FIELD, 'ghostAccounts')
  assert.equal(GHOST_ACCOUNTS_ORGANIZATION_IDS_FIELD, 'ghostAccountsOrganizationIds')
  assert.equal(ghostAccountsEnabled(null, ORG), false)
  assert.equal(ghostAccountsEnabled(undefined, ORG), false)
  assert.equal(ghostAccountsEnabled({}, ORG), false)
  assert.equal(ghostAccountsEnabled({ ghostAccounts: false }, ORG), false)
  assert.equal(ghostAccountsEnabled({ ghostAccounts: 'true' }, ORG), false)
  assert.equal(ghostAccountsEnabled({ ghostAccounts: 1 }, ORG), false)
  assert.equal(ghostAccountsEnabled({ ghostAccounts: true }, ORG), true)
  assert.equal(ghostAccountsEnabled({ ghostAccounts: true }, null), true)
  assert.equal(ghostAccountsEnabled({ ghostAccountsOrganizationIds: [ORG] }, ORG), true)
  // Ids compare exactly as stored, like the security switches.
  assert.equal(ghostAccountsEnabled({ ghostAccountsOrganizationIds: ['ORG1'] }, 'org1'), false)
  assert.equal(ghostAccountsEnabled({ ghostAccountsOrganizationIds: ['other'] }, ORG), false)
  assert.equal(ghostAccountsEnabled({ ghostAccountsOrganizationIds: [ORG] }, ''), false)
  assert.equal(ghostAccountsEnabled({ ghostAccountsOrganizationIds: ORG }, ORG), false)
  // The security switches never turn ghost accounts on.
  assert.equal(ghostAccountsEnabled({ enforcedReads: true, privatePay: true }, ORG), false)
})

test('ghostToggleVisible / ghostAddFormRows: the toggle needs both the permission and the switch', () => {
  assert.equal(ghostToggleVisible({ canCreateGhost: true, ghostAccountsEnabled: true }), true)
  assert.equal(ghostToggleVisible({ canCreateGhost: true, ghostAccountsEnabled: false }), false)
  assert.equal(ghostToggleVisible({ canCreateGhost: true }), false)
  assert.equal(ghostToggleVisible({ canCreateGhost: true, ghostAccountsEnabled: null }), false)
  assert.equal(ghostToggleVisible({ canCreateGhost: false, ghostAccountsEnabled: true }), false)
  // Switch off (or not passed): no toggle, and a ghost flag left on never turns the form into the ghost form.
  for (const rows of [
    ghostAddFormRows({ ghost: true, canCreateGhost: true }),
    ghostAddFormRows({ ghost: true, canCreateGhost: true, ghostAccountsEnabled: false }),
  ]) {
    assert.equal(rows.find((row) => row.field === 'ghostToggle')?.visible, false)
    assert.ok(rows.find((row) => row.field === 'email')?.visible)
    assert.equal(rows.find((row) => row.field === 'email')?.required, true)
    assert.ok(rows.find((row) => row.field === 'permissions')?.visible)
  }
  // canCreateGhost stays the permission rule, unchanged by the switch.
  assert.equal(canCreateGhost(ADMIN), true)
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

test('unbooked labour (review fix B2): a converted ghost with its operatives row is one person', () => {
  const ghost = labour(ghostDoc('G9'))
  const row = { id: 'g9', email: '', name: 'Gus Ghost G9', isActive: true, isPlaceholder: false, profileWeight: 1 }
  const base = { dayKey: '2026-11-09', timeZone: 'Europe/London', includeWeekends: false, bookings: [], people: [ghost], operatives: [row] }
  // No leave: one row, not two (the row's id is the ghost's id, in another letter case).
  assert.equal(unbookedLabourRowsOnDay({ ...base, holidays: [] }).length, 1)
  // Approved leave stored under the users id covers the person and the row.
  const leave = { userId: 'G9', operativeId: null, startDayKey: '2026-11-09', endDayKey: '2026-11-09', approved: true }
  assert.equal(unbookedLabourRowsOnDay({ ...base, holidays: [leave] as never }).length, 0)
  // Excluded under the users id: no row from the person or the row.
  assert.equal(unbookedLabourRowsOnDay({ ...base, holidays: [], excludedUserIds: ['G9'] }).length, 0)
  // Same over a range (unbookedLabourRows).
  assert.equal(unbookedLabourRows({ ...base, startDayKey: '2026-11-09', endDayKey: '2026-11-10', holidays: [leave] as never }).length, 1)
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

test('delete: the ghost flag never skips a document (review fix B1)', () => {
  const opRole = { isAdmin: false, isSuperAdmin: false, isManager: false, isOperativeMode: true }
  const accountOf = (steps: ReturnType<typeof userDeleteWrites>) =>
    steps.filter((step) => step.step === 'account').flatMap((step) => step.writes)
  // A real ghost (not in `members`): its users document, plus the tax ids and membership deletes (no-ops when missing).
  const ghost = accountOf(userDeleteWrites({
    orgId: ORG,
    user: { id: 'g1', role: opRole, ghost: true },
    actorUserId: 'mgr2',
    platform: 'web',
    nowIso: '2026-11-07T09:00:00Z',
    actorManagesOperatives: true,
    listedInMembers: false,
  }))
  assert.deepEqual(ghost.map((write) => write.path).sort(), [`users/g1`, `users/g1/orgMemberships/${ORG}`, 'users/g1/private/taxIds'].sort())
  // Someone who marked themself a ghost but is listed in `members` still loses the entry, membership and tax ids.
  const flagged = accountOf(userDeleteWrites({
    orgId: ORG,
    user: { id: 'self1', role: opRole, email: 'self@x.com', ghost: true },
    actorUserId: 'admin1',
    platform: 'web',
    nowIso: '2026-11-07T09:00:00Z',
    listedInMembers: true,
  }))
  assert.ok(flagged.some((write) => write.path === `users/self1/orgMemberships/${ORG}`))
  assert.ok(flagged.some((write) => write.path === 'users/self1/private/taxIds'))
  assert.ok(flagged.some((write) => write.op === 'update' && write.path === `organizations/${ORG}` && write.deleteFields.includes('members.self1')))
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
  assert.equal(plan.user.fields.email, '')
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
  // With the roster, a line manager who is not an active admin or manager of the organisation is refused.
  const withRoster = (ids: string[]) =>
    ghostConversionWrites({ organizationId: ORG, candidate: candidates[0], lineManagerIds: ids, actorUserId: 'admin1', roster: ROSTER as never })
  assert.ok(withRoster(['mgr1']))
  assert.equal(withRoster(['op1']), null)
  assert.equal(withRoster(['nobody']), null)
})

test('ghostsToCheck: missing rate or line manager, and converted rows; ordinary users never', async () => {
  const { ghostsToCheck } = await import('./index')
  const ok = ghostDoc('g1')
  const rows = ghostsToCheck([
    { ...MANAGER },
    ok,
    { ...ghostDoc('g2'), dayRate: 0, assignedManagerUserIds: ['gone'], assignedManagerUserId: 'gone' },
    { ...ghostDoc('g3'), inviteEmailHint: 'old@x.com' },
    { ...ghostDoc('g4'), isActive: false, dayRate: 0 },
    OPERATIVE,
  ] as never)
  assert.deepEqual(rows, [
    { id: 'g2', issues: ['rate', 'lineManager'] },
    { id: 'g3', issues: ['converted'] },
  ])
})

test('1.36.0 conversion: users storing the organisation as a path, and anchored members, are accounts (never ghosts)', () => {
  const operatives = [
    { id: 'row-visitor', firstName: 'Vic', lastName: 'Visitor', email: 'vic@other.com', dayRate: 100, payBasis: 'day' as const },
    { id: 'row-path', firstName: 'Pat', lastName: 'Path', email: 'pat@x.com', dayRate: 100, payBasis: 'day' as const },
    { id: 'row-ref', firstName: 'Rae', lastName: 'Ref', email: 'rae@x.com', dayRate: 100, payBasis: 'day' as const },
    { id: 'row-ghost', firstName: 'Gus', lastName: 'Ghost', email: 'gus@x.com', dayRate: 100, payBasis: 'day' as const },
  ]
  const users = [
    { id: 'u-vic', email: 'vic@other.com', organizationId: 'OTHER' },
    { id: 'u-pat', email: 'pat@x.com', organizationId: `organizations/${ORG}` },
    { id: 'u-rae', email: 'rae@x.com', organizationId: { id: ORG, path: `organizations/${ORG}` } },
  ]
  const ids = (memberIds?: string[]) =>
    ghostConversionCandidates({ organizationId: ORG, operatives, users, memberIds }).map((c) => c.operativeId)
  assert.deepEqual(ids(), ['row-ghost', 'row-visitor'])
  assert.deepEqual(ids(['u-vic']), ['row-ghost'])
})
