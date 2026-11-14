import type { Operative, User } from '@/types'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import { dayKey, startOfLondonWeek } from '@/lib/ios-parity/londonTime'
import { exportedTimesheetSubjectIds, userTimesheetSubjectIds } from '@/lib/permissions'

export type TimesheetSubjectKind = 'operative' | 'manager'

export type TimesheetSubject = {
  key: string
  kind: TimesheetSubjectKind
  name: string
  userId?: string
  operativeId?: string
  dayRate?: number
  hourlyRate?: number
  payBasis?: 'day' | 'hourly' | null
  employmentType?: string
}

/** Monday of the week containing `date`, as an organisation-zone day key (never the browser zone). */
export function weekStartKey(date: Date, timeZone?: string): string {
  return dayKey(startOfLondonWeek(date, timeZone), timeZone)
}

export function subjectForUser(user: User, operatives: Operative[]): TimesheetSubject {
  const linked = findOperativeForUser(user, operatives)
  return {
    key: linked ? `operative:${linked.id}` : `user:${user.id}`,
    kind: linked ? 'operative' : 'manager',
    name: `${user.firstName} ${user.surname}`.trim() || user.email,
    userId: user.id,
    operativeId: linked?.id,
    dayRate: user.dayRate ?? linked?.dayRate,
    hourlyRate: user.hourlyRate ?? linked?.hourlyRate,
    payBasis: user.payBasis ?? linked?.payBasis,
    employmentType: user.employmentType,
  }
}

/** iOS TimesheetMoneyEntrySheet jobSuggestions — unique job numbers, skip exact query. */
export function extraFormJobSuggestions(
  jobs: Array<{ jobNumber: string; siteName: string }>,
  query: string
): Array<{ jobNumber: string; siteName: string }> {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const seen = new Set<string>()
  const matches: Array<{ jobNumber: string; siteName: string }> = []
  for (const job of jobs) {
    const number = job.jobNumber.trim()
    if (!number) continue
    const key = number.toLowerCase()
    const haystack = `${number} ${job.siteName}`.toLowerCase()
    if (!haystack.includes(needle) || key === needle || seen.has(key)) continue
    seen.add(key)
    matches.push(job)
    if (matches.length >= 6) break
  }
  return matches
}

export function userIdsSharingEmail(member: User, users: User[]): string[] {
  const email = member.email.trim().toLowerCase()
  if (!email) return [member.id]
  const ids = users
    .filter((row) => row.email.trim().toLowerCase() === email)
    .map((row) => row.id)
  return ids.length ? ids : [member.id]
}

export function usersSharingEmail(member: User, users: User[]): User[] {
  const ids = new Set(userIdsSharingEmail(member, users))
  const rows = users.filter((row) => ids.has(row.id))
  return rows.length ? rows : [member]
}

/**
 * User Timesheets rows, one group per email. Who is listed is the rulebook's
 * `userTimesheetSubjects` (via `userTimesheetSubjectIds`); this only groups the
 * same-email documents of each listed person.
 */
export function timesheetRosterGroups(viewer: User, users: User[]): User[][] {
  const subjects = new Set(userTimesheetSubjectIds(viewer, users))
  const listed = users.filter((member) => subjects.has(member.id))
  const seen = new Set<string>()
  const groups: User[][] = []
  for (const member of listed) {
    const key = member.email.trim().toLowerCase() || member.id
    if (seen.has(key)) continue
    seen.add(key)
    groups.push(listed.filter((row) => (row.email.trim().toLowerCase() || row.id) === key))
  }
  return groups
}

/**
 * Exported list rows, one group per email (rulebook 1.31.0 `exportedTimesheetHistorySubjects`): the User Timesheets
 * people, the viewer's own sheets (read-only) and inactive people in scope.
 */
export function exportedTimesheetRosterGroups(viewer: User, users: User[]): User[][] {
  const subjects = new Set(exportedTimesheetSubjectIds(viewer, users))
  const listed = users.filter((member) => subjects.has(member.id))
  if (!listed.some((member) => member.id === viewer.id) && subjects.has(viewer.id)) listed.push(viewer)
  const seen = new Set<string>()
  const groups: User[][] = []
  for (const member of listed) {
    const key = member.email.trim().toLowerCase() || member.id
    if (seen.has(key)) continue
    seen.add(key)
    groups.push(listed.filter((row) => (row.email.trim().toLowerCase() || row.id) === key))
  }
  return groups
}

export function buildTimesheetSubjects(users: User[], operatives: Operative[]): TimesheetSubject[] {
  const subjects = new Map<string, TimesheetSubject>()

  for (const operative of operatives) {
    const linkedUser = users.find(
      (user) => findOperativeForUser(user, [operative])?.id === operative.id
    )
    subjects.set(`operative:${operative.id}`, {
      key: `operative:${operative.id}`,
      kind: 'operative',
      name: `${operative.firstName} ${operative.lastName}`.trim(),
      operativeId: operative.id,
      userId: linkedUser?.id,
      dayRate: linkedUser?.dayRate ?? operative.dayRate,
      hourlyRate: linkedUser?.hourlyRate ?? operative.hourlyRate,
      payBasis: linkedUser?.payBasis ?? operative.payBasis,
      employmentType: linkedUser?.employmentType,
    })
  }

  for (const user of users) {
    if (user.permissions.operativeMode) continue
    const shouldInclude =
      user.timesheetsEnabled === true ||
      user.permissions.adminAccess ||
      user.isSuperAdmin ||
      user.permissions.manager
    if (!shouldInclude) continue

    const linked = findOperativeForUser(user, operatives)
    if (linked) continue

    subjects.set(`user:${user.id}`, {
      key: `user:${user.id}`,
      kind: 'manager',
      name: `${user.firstName} ${user.surname}`.trim(),
      userId: user.id,
      dayRate: user.dayRate,
      hourlyRate: user.hourlyRate,
      payBasis: user.payBasis,
      employmentType: user.employmentType,
    })
  }

  return Array.from(subjects.values()).sort((a, b) => a.name.localeCompare(b.name))
}


