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

  const active = members.filter((member) => idKey(member.id) && memberIsActive(member))

  if (seesEveryUserTimesheet(viewer.role)) {
    return active.filter((member) => isTimesheetUser(member.role)).map((member) => ({ userId: member.id }))
  }

  const viewerKeys = new Set(
    [viewer.id, ...(viewer.formerIds ?? []), ...(viewer.aliasIds ?? [])].map(idKey).filter(Boolean)
  )
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
