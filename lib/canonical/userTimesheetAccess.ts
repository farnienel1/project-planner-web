/**
 * Whose timesheets a viewer sees on User Timesheets, and whether the viewer
 * gets that screen at all. The hub tile, the Awaiting / Signed off / Exported
 * lists, their counts, and the review page all read this one list, on web
 * (`lib/permissions.ts`, `timesheetWeekUtils.ts`) and on iOS
 * (`UserTimesheetAccessRulebook`, through `CanonicalBusinessEngine.objectRows`).
 *
 * The role is `canReviewUserTimesheets` / `seesEveryUserTimesheet`. Admins see
 * every active timesheet user. A manager sees the active people they
 * line-manage under any of their ids (own id, former invite ids, same-email
 * ids). A person whose other users document on the same email names the
 * manager is the same person, so it is in scope too. Operative mode on the
 * report is not required.
 *
 * Never the viewer themself (rulebook 1.30.2): nobody reviews their own
 * timesheet, admins and the Super Admin included — not under their own id,
 * `formerIds`, `aliasIds`, nor a roster row on the same email as one of those.
 * Their own sheet is on My Timesheets (the owner path; a self-signed admin's
 * own signature completes it, `timesheetSelfSigned`).
 */

import { canReviewUserTimesheets, seesEveryUserTimesheet, type StaffAccountRole } from './staffAccess'

export type UserTimesheetViewer = {
  id: string
  /** `users/{uid}.formerUserIds`: invite placeholder ids from before sign-up. */
  formerIds?: readonly string[] | null
  /** Other users document ids on the viewer's email. */
  aliasIds?: readonly string[] | null
  role: StaffAccountRole
}

export type UserTimesheetMember = {
  id: string
  email?: string | null
  /** Missing counts as active, as `users/{uid}.isActive` defaults to true. */
  isActive?: boolean | null
  role: StaffAccountRole
  assignedManagerUserIds?: readonly string[] | null
  /** Legacy single line manager, used only when `assignedManagerUserIds` is empty. */
  assignedManagerUserId?: string | null
  hasNoLineManager?: boolean | null
}

export type UserTimesheetSubjectsInput = {
  viewer: UserTimesheetViewer
  members: readonly UserTimesheetMember[]
}

export type UserTimesheetSubjectRow = {
  userId: string
}

export type CanOpenUserTimesheetsInput = UserTimesheetSubjectsInput & {
  /** The viewer's profile or this organisation's roster has not arrived yet. */
  rosterLoading?: boolean | null
}

function idKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function memberIsActive(member: UserTimesheetMember): boolean {
  return member.isActive !== false
}

/** Any account kind that keeps a timesheet: operative, manager, admin, or super admin. */
function isTimesheetUser(role: StaffAccountRole): boolean {
  return role.isOperativeMode || role.isManager || role.isAdmin || role.isSuperAdmin
}

/** `assignedManagerUserIds`, or the legacy single id when that list is empty. None when `hasNoLineManager`. */
function lineManagerKeys(member: UserTimesheetMember): string[] {
  if (member.hasNoLineManager === true) return []
  const listed = (member.assignedManagerUserIds ?? []).map(idKey).filter(Boolean)
  if (listed.length > 0) return listed
  const legacy = idKey(member.assignedManagerUserId)
  return legacy ? [legacy] : []
}

/** Member ids the viewer may open on User Timesheets, in roster order. */
export function userTimesheetSubjects(input: UserTimesheetSubjectsInput): UserTimesheetSubjectRow[] {
  const { viewer, members } = input
  if (!viewer || !idKey(viewer.id)) return []
  if (!canReviewUserTimesheets(viewer.role)) return []

  const viewerKeys = new Set(
    [viewer.id, ...(viewer.formerIds ?? []), ...(viewer.aliasIds ?? [])].map(idKey).filter(Boolean)
  )
  // The viewer under any of their ids: their own keys, and every roster row on the same email as one of them.
  const viewerEmails = new Set(
    members.filter((member) => viewerKeys.has(idKey(member.id))).map((member) => idKey(member.email)).filter(Boolean)
  )
  const isViewer = (member: UserTimesheetMember) =>
    viewerKeys.has(idKey(member.id)) || (idKey(member.email) !== '' && viewerEmails.has(idKey(member.email)))

  const active = members.filter((member) => idKey(member.id) && memberIsActive(member) && !isViewer(member))

  if (seesEveryUserTimesheet(viewer.role)) {
    return active.filter((member) => isTimesheetUser(member.role)).map((member) => ({ userId: member.id }))
  }

  const reportsToViewer = (member: UserTimesheetMember) =>
    lineManagerKeys(member).some((key) => viewerKeys.has(key))

  const managedEmails = new Set<string>()
  for (const member of active) {
    const email = idKey(member.email)
    if (email && reportsToViewer(member)) managedEmails.add(email)
  }

  return active
    .filter((member) => {
      if (reportsToViewer(member)) return true
      const email = idKey(member.email)
      return Boolean(email) && managedEmails.has(email)
    })
    .map((member) => ({ userId: member.id }))
}

/**
 * The User Timesheets screen. Admins always have it, even while the roster
 * loads or the company has no one to review. A manager keeps it while the
 * roster is still loading, then has it when `userTimesheetSubjects` lists
 * at least one person. Operatives never do.
 */
export function canOpenUserTimesheets(input: CanOpenUserTimesheetsInput): boolean {
  const { viewer } = input
  if (!viewer || !idKey(viewer.id)) return false
  if (!canReviewUserTimesheets(viewer.role)) return false
  if (seesEveryUserTimesheet(viewer.role)) return true
  if (input.rosterLoading === true) return true
  return userTimesheetSubjects(input).length > 0
}

export type ExportedTimesheetHistorySubjectRow = {
  userId: string
  /** True for the viewer's own sheets: shown read-only, never reviewable (`timesheetWriterIsReviewer` unchanged). */
  own: boolean
}

/**
 * Whose EXPORTED timesheets the Exported list (and its hub count) shows (rulebook 1.31.0 §8, owner decision). Exported
 * sheets are history, so the list is wider than `userTimesheetSubjects` (which stays as it is — nobody reviews their
 * own sheet, 1.30.2):
 *   - everyone `userTimesheetSubjects` lists;
 *   - the viewer's own sheets, under any of their ids (own id, `formerIds`, `aliasIds`, roster rows on the same email
 *     as one of them) — `own: true`, read-only. Before 1.31.0 the viewer's own exported sheets vanished from the list
 *     (and a PAYE admin's showed nowhere);
 *   - inactive (and anonymised deleted) people in scope: for an admin (`seesEveryUserTimesheet`) every timesheet user,
 *     for a manager the people they line-manage under any of their ids (and those people's same-email rows).
 * Only for a viewer who has User Timesheets (`canReviewUserTimesheets`); anyone else gets nothing here (their own
 * sheets are on My Timesheets). Roster order, one row per users document.
 */
export function exportedTimesheetHistorySubjects(input: UserTimesheetSubjectsInput): ExportedTimesheetHistorySubjectRow[] {
  const { viewer, members } = input
  if (!viewer || !idKey(viewer.id)) return []
  if (!canReviewUserTimesheets(viewer.role)) return []
  const viewerKeys = new Set([viewer.id, ...(viewer.formerIds ?? []), ...(viewer.aliasIds ?? [])].map(idKey).filter(Boolean))
  const viewerEmails = new Set(
    members.filter((member) => viewerKeys.has(idKey(member.id))).map((member) => idKey(member.email)).filter(Boolean)
  )
  const isViewer = (member: UserTimesheetMember) =>
    viewerKeys.has(idKey(member.id)) || (idKey(member.email) !== '' && viewerEmails.has(idKey(member.email)))
  const listed = new Set(userTimesheetSubjects(input).map((row) => idKey(row.userId)))
  const seesEvery = seesEveryUserTimesheet(viewer.role)
  const reportsToViewer = (member: UserTimesheetMember) => lineManagerKeys(member).some((key) => viewerKeys.has(key))
  const managedEmails = new Set<string>()
  if (!seesEvery) {
    for (const member of members) {
      const email = idKey(member.email)
      if (email && !isViewer(member) && reportsToViewer(member)) managedEmails.add(email)
    }
  }
  const out: ExportedTimesheetHistorySubjectRow[] = []
  const seen = new Set<string>()
  for (const member of members) {
    const key = idKey(member.id)
    if (!key || seen.has(key)) continue
    const own = isViewer(member)
    const inScope =
      own ||
      listed.has(key) ||
      (seesEvery
        ? isTimesheetUser(member.role)
        : reportsToViewer(member) || (idKey(member.email) !== '' && managedEmails.has(idKey(member.email))))
    if (!inScope) continue
    seen.add(key)
    out.push({ userId: member.id, own })
  }
  // The viewer's own id even when the roster does not list it (a viewer read before the roster arrives).
  if (!seen.has(idKey(viewer.id))) out.push({ userId: viewer.id, own: true })
  return out
}
