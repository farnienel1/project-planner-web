/**
 * People and access (rulebook 1.31.0, §5, §8, §11, §16; owner decisions 4 Nov, access audit).
 *
 * One rule set for both apps for what happens around a person's level, line manager, active flag and deletion:
 *   - `lineManagerReports(person, roster)`: the people who have this person as their line manager.
 *   - `lineManagerChangeBlock({ person, roster, change })`: a line manager cannot be made an operative, deactivated or
 *     deleted while anyone reports to them (owner decision: no rights carry over on a level change, so their reports
 *     would be left without an approver). The screen lists the reports and refuses the save until they are reassigned.
 *   - `jobManagerRemovalWrites(...)`: a person who stops being a manager (made an operative, deactivated, deleted) is
 *     taken off every job they manage; the job stays with no manager and the admins are told (`job_manager_removed`).
 *     Admin ↔ manager keeps every job.
 *   - `jobManagerRequiredError(ids)`: a new project or small works needs a manager.
 *   - `superAdminTransferWrites(...)`: Change Super Admin as one batch.
 *   - `userActiveWrites(...)`: deactivate / reactivate every users document of the person in this organisation.
 *   - `jobTypeStoredFields(name, collection)` / `jobTypeDisplayName(job)`: the job-type picker value ↔ the stored
 *     `jobType` / `customJobType` pair (web `collectionJobTypeForName`, iOS `jobTypeFromString`).
 * Pure, JSON in / JSON out.
 */

import { rosterPersonGroups, rosterPersonName, type LineManagerRosterPerson } from './lineManagers'
import { canonicalJobTypeName } from './operationsDocuments'
import { canManageOperatives, permissionLevelOf, storedPermissionFlag, type PermissionLevel } from './permissionLevels'
import { idKey, idText, personIdSet, rosterMemberActive } from './personIds'
import { jobManagerIds, stableManagerId, type JobManagerRosterRow } from './staffAccess'
import { isAnonymisedDeletedProfile } from './userRosterSegment'
import { hasActiveLineManager } from './leaveRequests'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function sameOrg(value: unknown, organizationId: string): boolean {
  const raw = text(value)
  const id = raw.includes('/') ? raw.split('/').filter(Boolean).pop() ?? '' : raw
  return id !== '' && id.toLowerCase() === organizationId.trim().toLowerCase()
}

function storedLineManagerIds(row: LineManagerRosterPerson): string[] {
  if (row.hasNoLineManager === true) return []
  const listed = (row.assignedManagerUserIds || []).map(text).filter(Boolean)
  return listed.length > 0 ? listed : [text(row.assignedManagerUserId)].filter(Boolean)
}

// MARK: - Line manager reports and the change block

export type LineManagerReport = { id: string; name: string }

/**
 * The people whose line manager is `person` (rulebook 1.31.0 §11): every active, not deleted roster person (one per
 * person, `rosterPersonGroups`; the live users document speaks for them) with one of the person's ids
 * (`personIdSet`: id, former and same-email ids, same-email rows) among their stored line manager ids
 * (`assignedManagerUserIds`, else the single id; none when `hasNoLineManager`), never the person themself. Sorted by
 * name. The roster is every users document of the organisation (not the email fold), so a report stored against the
 * person's other document is found too.
 */
export function lineManagerReports(
  person: (LineManagerRosterPerson & { id: string }) | null | undefined,
  roster: ReadonlyArray<LineManagerRosterPerson> | null | undefined
): LineManagerReport[] {
  if (!person || !text(person.id)) return []
  const rows = (roster || []).filter((row) => row && text(row.id))
  const keys = new Set(personIdSet(person as never, rows).map(idKey))
  const out: LineManagerReport[] = []
  for (const group of rosterPersonGroups(rows)) {
    if ([...group.keys].some((key) => keys.has(key))) continue
    const primary = group.primary
    if (!rosterMemberActive(primary) || isAnonymisedDeletedProfile(primary as never)) continue
    const reports = group.rows.some((row) => storedLineManagerIds(row).some((id) => keys.has(idKey(id))))
    if (reports) out.push({ id: text(primary.id), name: rosterPersonName(primary) || text(primary.id) })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id))
}

/** A change Manage Users is about to save for a person. */
export type PersonAccessChange =
  | { kind: 'level'; to: PermissionLevel }
  | { kind: 'deactivate' }
  | { kind: 'delete' }

export const LINE_MANAGER_REPORTS_BLOCK_MESSAGE =
  'This user is the line manager for the users below. Give each of them another line manager first, then try again.'

/**
 * Whether a change would leave people without their line manager (rulebook 1.31.0 §11, owner decision): making the
 * person an operative, deactivating or deleting them is refused while `lineManagerReports` lists anyone, and the
 * screen shows `LINE_MANAGER_REPORTS_BLOCK_MESSAGE` with the list. Admin ↔ manager never blocks (both are line
 * managers). `reports` is always filled, so a screen can show who reports to the person.
 */
export function lineManagerChangeBlock(input: {
  person: (LineManagerRosterPerson & { id: string }) | null | undefined
  roster: ReadonlyArray<LineManagerRosterPerson> | null | undefined
  change: PersonAccessChange | null | undefined
}): { blocked: boolean; reports: LineManagerReport[]; message: string | null } {
  const reports = lineManagerReports(input?.person, input?.roster)
  const change = input?.change
  const removesLineManager =
    !!change &&
    (change.kind === 'deactivate' ||
      change.kind === 'delete' ||
      (change.kind === 'level' && change.to === 'operative' && permissionLevelOf(input?.person) !== 'operative'))
  const blocked = removesLineManager && reports.length > 0
  return { blocked, reports, message: blocked ? LINE_MANAGER_REPORTS_BLOCK_MESSAGE : null }
}

// MARK: - Line manager set once, then locked (1.33.0, owner decision 6 Nov §6d.1)

/** The fields that hold a person's line manager on `users/{uid}` (and an invitation). */
export const LINE_MANAGER_FIELDS = ['assignedManagerUserIds', 'assignedManagerUserId', 'hasNoLineManager'] as const

export const LINE_MANAGER_LOCKED_MESSAGE = 'Only an admin can change the line manager once this person has been added.'

/**
 * Who may set or change a person's line manager (`LINE_MANAGER_FIELDS`; rulebook §11, **1.33.0 owner decision:
 * "line manager set once, then locked"**):
 *   - admins and super admins (outside operative mode): any person, any time;
 *   - a manager with the Operatives toggle (`canManageOperatives`): only for an operative, and only while adding them
 *     (`isCreate`, the Add User / invite form) or on an invitation they sent that is not accepted yet (`invitation`
 *     with `accepted` false and `invitedBy` one of the actor's ids). After that only an admin changes it — removing
 *     and re-adding the operative is the accepted way round (owner, 6 Nov);
 *   - everyone else (managers without the toggle, operatives, the person themself): never.
 * `actor` and `target` are users documents (or the draft being added); ids compare without case.
 */
export function canChangeLineManager(
  actor: unknown,
  target: unknown,
  options?: { isCreate?: boolean | null; invitation?: { accepted?: boolean | null; invitedBy?: string | null } | null } | null
): boolean {
  if (!actor || typeof actor !== 'object') return false
  const actorLevel = permissionLevelOf(actor)
  if (actorLevel === 'operative') return false
  if (actorLevel === 'admin') return true
  if (!canManageOperatives(actor)) return false
  if (permissionLevelOf(target) !== 'operative') return false
  if (options?.isCreate === true) return true
  const invitation = options?.invitation
  if (!invitation || invitation.accepted === true) return false
  const row = actor as { id?: unknown; formerUserIds?: unknown }
  const actorIds = new Set(
    [row.id, ...(Array.isArray(row.formerUserIds) ? row.formerUserIds : [])].map((id) => idKey(id)).filter(Boolean)
  )
  return idKey(invitation.invitedBy) !== '' && actorIds.has(idKey(invitation.invitedBy))
}

/**
 * Whether a save changes the line manager: the stored line manager ids (`assignedManagerUserIds`, else the single id)
 * or `hasNoLineManager` differ between `before` and `after` (ids without case, order ignored). A screen that may not
 * change it (`canChangeLineManager` false) refuses such a save with `LINE_MANAGER_LOCKED_MESSAGE`.
 */
export function lineManagerChanged(before: unknown, after: unknown): boolean {
  const ids = (row: unknown): string => {
    const r = (row && typeof row === 'object' ? row : {}) as LineManagerRosterPerson
    return [...new Set(storedLineManagerIds(r).map(idKey).filter(Boolean))].sort().join('|')
  }
  const none = (row: unknown) => (row as { hasNoLineManager?: unknown } | null)?.hasNoLineManager === true
  return ids(before) !== ids(after) || none(before) !== none(after)
}

/**
 * Whether a change takes the person off the jobs they manage (rulebook 1.31.0 §11): made an operative, deactivated
 * or deleted. Admin ↔ manager keeps every job.
 */
export function changeRemovesJobManager(person: unknown, change: PersonAccessChange | null | undefined): boolean {
  if (!change) return false
  if (change.kind === 'deactivate' || change.kind === 'delete') return true
  return change.kind === 'level' && change.to === 'operative' && permissionLevelOf(person) !== 'operative'
}

// MARK: - Job managers on a level change, deactivation or delete

export const JOB_MANAGER_REQUIRED_MESSAGE = 'Please assign at least one manager'

/**
 * Rulebook 1.31.0 §11 (owner decision): a new project or small works needs at least one manager. Null when one is
 * given. Editing an existing job may leave it with none (a manager removed from it, `jobManagerRemovalWrites`).
 */
export function jobManagerRequiredError(managerIds: ReadonlyArray<string | null | undefined> | null | undefined): string | null {
  return (managerIds || []).some((id) => text(id) !== '') ? null : JOB_MANAGER_REQUIRED_MESSAGE
}

export type JobManagerRemovalJob = {
  id: string
  collection: 'projects' | 'smallWorks'
  managerId?: string | null
  managerIds?: ReadonlyArray<string> | null
  managerUserIds?: ReadonlyArray<string> | null
  assignedManagerUserIds?: ReadonlyArray<string> | null
}

export type JobManagerRemovalWrite = {
  path: string
  collection: 'projects' | 'smallWorks'
  jobId: string
  /** Fields to write (the lists without the person). */
  set: Record<string, unknown>
  /** Fields to remove (a list left empty, or `managerId` when nobody is left). */
  remove: string[]
}

/** The notice type admins get when a person is taken off jobs (company activity, `companyActivityRecipients`). */
export const JOB_MANAGER_REMOVED_NOTICE_TYPE = 'job_manager_removed'

export function jobManagerRemovedNoticeText(name: string, jobCount: number): { title: string; message: string } {
  const who = text(name) || 'A manager'
  const jobs = jobCount === 1 ? '1 job' : `${jobCount} jobs`
  return {
    title: 'Manager removed from jobs',
    message: `${who} is no longer a manager and was removed from ${jobs}. Those jobs may have no manager now.`,
  }
}

/**
 * The job updates when `person` stops being a manager (rulebook 1.31.0 §11, owner decision): made an operative,
 * deactivated or deleted (`changeRemovesJobManager`). Every id of the person — `personIdSet` over the roster, the
 * `user:` form the web picker stored, and the `managers` catalogue rows on their email (row id and `stableManagerId`)
 * — is taken out of each job's `managerIds`, `managerId`, `managerUserIds` and `assignedManagerUserIds`, without
 * case. A list left empty is removed; `managerId` moves to the first manager left, else is removed. The job stays,
 * with no manager when none is left. Jobs that do not name the person are not written. Empty for admin ↔ manager.
 */
export function jobManagerRemovalWrites(input: {
  organizationId: string
  person: ({ id: string } & Record<string, unknown>) | null | undefined
  change: PersonAccessChange | null | undefined
  jobs: ReadonlyArray<JobManagerRemovalJob> | null | undefined
  roster?: ReadonlyArray<LineManagerRosterPerson> | null
  managers?: ReadonlyArray<JobManagerRosterRow> | null
}): JobManagerRemovalWrite[] {
  const org = text(input?.organizationId)
  const person = input?.person
  if (!org || !person || !text(person.id) || !changeRemovesJobManager(person, input.change)) return []
  const rows = (input.roster || []).filter((row) => row && text(row.id))
  const keys = new Set<string>()
  for (const id of personIdSet(person as never, rows)) {
    keys.add(idKey(id))
    keys.add(idKey(`user:${id}`))
  }
  const emails = new Set<string>()
  if (idKey(person.email)) emails.add(idKey(person.email))
  for (const row of rows) if (keys.has(idKey(row.id)) && idKey(row.email)) emails.add(idKey(row.email))
  for (const row of input.managers || []) {
    if (!row || !text(row.id) || !emails.has(idKey(row.email))) continue
    keys.add(idKey(row.id))
    keys.add(idKey(stableManagerId(row.id)))
  }
  keys.delete('')
  const out: JobManagerRemovalWrite[] = []
  for (const job of input.jobs || []) {
    const jobId = text(job?.id)
    if (!jobId || jobId.includes('/') || (job.collection !== 'projects' && job.collection !== 'smallWorks')) continue
    if (!jobManagerIds(job as never).some((id) => keys.has(idKey(id)))) continue
    const set: Record<string, unknown> = {}
    const remove: string[] = []
    const keep = (list: ReadonlyArray<string> | null | undefined) => (list || []).map(text).filter((id) => id && !keys.has(idKey(id)))
    let remainingManagerIds: string[] = keep(job.managerIds)
    for (const field of ['managerIds', 'managerUserIds', 'assignedManagerUserIds'] as const) {
      const stored = (job[field] || []).map(text).filter(Boolean)
      if (stored.length === 0) continue
      const kept = keep(stored)
      if (kept.length === stored.length) continue
      if (kept.length > 0) set[field] = kept
      else remove.push(field)
    }
    const primary = text(job.managerId)
    if (primary && keys.has(idKey(primary))) {
      if (remainingManagerIds.length === 0) remainingManagerIds = keep(job.managerUserIds)
      if (remainingManagerIds.length > 0) set.managerId = remainingManagerIds[0]
      else remove.push('managerId')
    }
    if (Object.keys(set).length === 0 && remove.length === 0) continue
    out.push({ path: `organizations/${org}/${job.collection}/${jobId}`, collection: job.collection, jobId, set, remove })
  }
  return out
}

// MARK: - Change Super Admin

export type SuperAdminTransferWrite =
  | { path: string; kind: 'organization'; fields: Record<string, unknown> }
  | { path: string; kind: 'userProfile'; fields: Record<string, unknown> }
  | { path: string; kind: 'membership'; fields: Record<string, unknown> }

/**
 * Change Super Admin as one batch (rulebook 1.31.0 §11, §16). Before 1.31.0 web wrote the organisation's
 * `creatorUserId` first and each person after, and the outgoing Super Admin — who never needed a line manager — was
 * left an admin with both self-manage toggles off and no line manager: their own leave and timesheets had no approver.
 *   1. `organizations/{orgId}`: `creatorUserId` = the new Super Admin and `members.{to}` = admin.
 *   2. The new Super Admin (`users/{to}` and their membership here): `isSuperAdmin` true, admin, and both self-manage
 *      toggles on (`annualLeaveSelfBook`, `timesheetSelfSign`; the card shows them on and greyed out — the Super Admin
 *      reads both on whatever is stored).
 *   3. The outgoing Super Admin and anyone else of this organisation still flagged `isSuperAdmin` (and the previous
 *      creator): `isSuperAdmin` false, admin. **Owner to confirm (safe option):** when the outgoing Super Admin has no
 *      active line manager (`hasActiveLineManager`), both self-manage toggles are written on so they keep the
 *      self-approval they had and are never left without an approver; with a line manager their stored toggles are
 *      kept (normal approval).
 * Same-email users documents of this organisation get the same flags. Refused (null) when `to` is `from` or missing.
 */
export function superAdminTransferWrites(input: {
  organizationId: string
  fromUserId: string
  toUserId: string
  previousCreatorUserId?: string | null
  /** Every users document of the organisation (unfolded), with the line-manager fields. */
  roster: ReadonlyArray<LineManagerRosterPerson & { organizationId?: unknown; isSuperAdmin?: boolean | null }>
}): SuperAdminTransferWrite[] | null {
  const org = text(input?.organizationId)
  const from = text(input?.fromUserId)
  const to = text(input?.toUserId)
  if (!org || !to || idKey(to) === idKey(from) || org.includes('/') || to.includes('/')) return null
  const rows = (input.roster || []).filter((row) => row && text(row.id))
  const toRow = rows.find((row) => idKey(row.id) === idKey(to))
  const toKeys = new Set(personIdSet(toRow ?? { id: to }, rows).map(idKey))
  const writes: SuperAdminTransferWrite[] = [
    { path: `organizations/${org}`, kind: 'organization', fields: { creatorUserId: to, [`members.${to}`]: 'admin' } },
  ]
  const promote = {
    isSuperAdmin: true,
    adminAccess: true,
    role: 'admin',
    'permissions.adminAccess': true,
    annualLeaveSelfBook: true,
    'permissions.annualLeaveSelfBook': true,
    timesheetSelfSign: true,
    'permissions.timesheetSelfSign': true,
  }
  const inOrg = (row: { organizationId?: unknown }) => sameOrg(row.organizationId, org)
  writes.push({ path: `users/${to}`, kind: 'userProfile', fields: { ...promote } })
  for (const row of rows) {
    if (idKey(row.id) !== idKey(to) && toKeys.has(idKey(row.id)) && inOrg(row) && idKey(row.email) === idKey(toRow?.email)) {
      writes.push({ path: `users/${text(row.id)}`, kind: 'userProfile', fields: { ...promote, isSuperAdmin: false } })
    }
  }
  writes.push({
    path: `users/${to}/orgMemberships/${org}`,
    kind: 'membership',
    fields: { role: 'admin', isSuperAdmin: true, 'permissions.adminAccess': true, 'permissions.annualLeaveSelfBook': true, 'permissions.timesheetSelfSign': true },
  })

  const demote = new Map<string, LineManagerRosterPerson | null>()
  if (from) demote.set(idKey(from), rows.find((row) => idKey(row.id) === idKey(from)) ?? null)
  const creator = text(input.previousCreatorUserId)
  if (creator) demote.set(idKey(creator), rows.find((row) => idKey(row.id) === idKey(creator)) ?? null)
  for (const row of rows) if (storedPermissionFlag(row, 'isSuperAdmin') === true && inOrg(row)) demote.set(idKey(row.id), row)
  for (const key of toKeys) demote.delete(key)
  for (const [key, row] of demote) {
    const id = text(row?.id) || (idKey(from) === key ? from : creator)
    if (!id || id.includes('/')) continue
    const needsSelfApproval = !hasActiveLineManager((row ?? { id }) as never, rows as never)
    const fields: Record<string, unknown> = { isSuperAdmin: false, adminAccess: true, role: 'admin', 'permissions.adminAccess': true }
    if (needsSelfApproval) {
      Object.assign(fields, {
        annualLeaveSelfBook: true,
        'permissions.annualLeaveSelfBook': true,
        timesheetSelfSign: true,
        'permissions.timesheetSelfSign': true,
      })
    }
    writes.push({ path: `users/${id}`, kind: 'userProfile', fields })
    const membership: Record<string, unknown> = { role: 'admin', isSuperAdmin: false, 'permissions.adminAccess': true }
    if (needsSelfApproval) Object.assign(membership, { 'permissions.annualLeaveSelfBook': true, 'permissions.timesheetSelfSign': true })
    writes.push({ path: `users/${id}/orgMemberships/${org}`, kind: 'membership', fields: membership })
  }
  return writes
}

// MARK: - Deactivate / reactivate

/**
 * Deactivating or reactivating a person (rulebook 1.31.0 §11, audit finding 9): `isActive` on every users document of
 * the person in this organisation (their id and each same-email document whose `organizationId` is this one — before
 * 1.31.0 only the one document was written and a same-email copy kept the person active), and `accountActive` on
 * their membership here. One batch. Another company's document is never written.
 *
 * 1.33.0 (owner row 4 Nov): the person's own users document is written only when it belongs to this organisation —
 * `person.organizationId`, else their roster row's; when neither is known it is written as before (the rules decide).
 * A person whose home company is another one is deactivated here through their membership (and any same-email
 * document of this organisation) only. The membership write is an **update of an existing membership, never a
 * create**: with `membershipExists: false` it is left out, and the app updates it (never a merge-set), so a missing
 * membership is never created as a bare `{ accountActive }` document (a session reads any membership as a level).
 */
export function userActiveWrites(input: {
  organizationId: string
  person: { id: string; email?: string | null; organizationId?: unknown }
  isActive: boolean
  roster?: ReadonlyArray<{ id: string; email?: string | null; organizationId?: unknown }> | null
  /** 1.33.0: false when the app knows the person has no membership in this organisation (then none is written). */
  membershipExists?: boolean | null
}): Array<{ path: string; kind: 'userProfile' | 'membership'; fields: Record<string, unknown> }> {
  const org = text(input?.organizationId)
  const uid = text(input?.person?.id)
  if (!org || !uid || uid.includes('/')) return []
  const active = input.isActive === true
  const out: Array<{ path: string; kind: 'userProfile' | 'membership'; fields: Record<string, unknown> }> = []
  const ownRow = (input.roster || []).find((row) => idKey(row?.id) === idKey(uid))
  const homeOrg = text(input.person.organizationId) ? input.person.organizationId : ownRow?.organizationId
  if (!text(homeOrg) || sameOrg(homeOrg, org)) out.push({ path: `users/${uid}`, kind: 'userProfile', fields: { isActive: active } })
  const email = idKey(input.person.email)
  const seen = new Set([idKey(uid)])
  if (email) {
    for (const row of input.roster || []) {
      const id = text(row?.id)
      if (!id || id.includes('/') || seen.has(idKey(id)) || idKey(row.email) !== email || !sameOrg(row.organizationId, org)) continue
      seen.add(idKey(id))
      out.push({ path: `users/${id}`, kind: 'userProfile', fields: { isActive: active } })
    }
  }
  if (input.membershipExists !== false) {
    out.push({ path: `users/${uid}/orgMemberships/${org}`, kind: 'membership', fields: { accountActive: active } })
  }
  return out
}

// MARK: - Job type picker ↔ stored fields

/**
 * The stored job type for a picker name (rulebook 1.31.0 §21; web `collectionJobTypeForName`, iOS
 * `jobTypeFromString`): `jobType` is the collection's enum — small works always `Small Works`; a project the default
 * type it names (`CAT A`, `CAT B`, `Maintenance`), otherwise `CAT A` — and `customJobType` is the chosen name when it
 * is not the collection's default (`CAT A` for projects, `Small Works` for small works), else null, which a save of
 * an existing job writes as a removal (switching a custom type back to CAT A clears it). Names compare through
 * `canonicalJobTypeName`.
 */
export function jobTypeStoredFields(
  name: unknown,
  collection: 'projects' | 'smallWorks'
): { jobType: string; customJobType: string | null } {
  const canonical = canonicalJobTypeName(typeof name === 'string' ? name : '')
  if (collection === 'smallWorks') {
    return { jobType: 'Small Works', customJobType: canonical && canonical !== 'Small Works' ? canonical : null }
  }
  const enumType = canonical === 'CAT B' || canonical === 'Maintenance' || canonical === 'CAT A' ? canonical : 'CAT A'
  return { jobType: enumType, customJobType: canonical && canonical !== 'CAT A' && canonical !== 'Small Works' ? canonical : null }
}

/** The name a job-type picker shows for a stored job: `customJobType`, else the canonical `jobType`, else `CAT A` / `Small Works`. */
export function jobTypeDisplayName(
  job: { jobType?: unknown; customJobType?: unknown } | null | undefined,
  collection: 'projects' | 'smallWorks'
): string {
  const custom = canonicalJobTypeName(typeof job?.customJobType === 'string' ? job.customJobType : '')
  if (custom) return custom
  const stored = canonicalJobTypeName(typeof job?.jobType === 'string' ? job.jobType : '')
  return stored || (collection === 'smallWorks' ? 'Small Works' : 'CAT A')
}
