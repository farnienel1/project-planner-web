/**
 * Rulebook 1.23.0 §23 (audit findings 12 and 16): the Home overview figures and the qualification-expiry count.
 *
 * Before 1.23.0 web counted Home figures on the London day and iOS on the device day, and both counted people by
 * the raw booking id (web case-sensitively), so one person under two ids counted twice. Now:
 *   - every day is the organisation-zone day of `nowMs` (`organizationTimeZone`);
 *   - every person is counted once under all their ids: `personIdSet` over the roster (users documents with
 *     `formerUserIds` / `sameEmailUserIds`) plus the `operatives` and `managers` rows, so an operatives row, a
 *     users document and a managers row on one email are one person (ids compare without case).
 *
 * Pure, JSON in / JSON out.
 */

import { leaveRecordDayKeys, normalizeHolidayStatus } from './leaveRequests'
import { dueDayKey, addCalendarDayKeys, isTaskCompleted } from './dueDates'
import { holidayDocumentDayKey } from './holidayDocument'
import { idKey, idText, personIdSet, type PersonRosterRow } from './personIds'
import { rosterListKind, type RosterListRow } from './rosterLists'
import { bookingOccupiesDay, qualificationExpiryRows } from './warningRows'
import { isDailyOverviewRowInScope, type DailyOverviewScope } from './staffAccess'

/** A row of the people roster used to fold ids: users documents, `operatives` rows and `managers` rows. */
export type FoldPersonRow = PersonRosterRow

/**
 * One key per person: the lowest id (without case) of `personIdSet({ id }, roster)`. Memoised per call site with a
 * Map, so a list of bookings folds in one pass. Not exported in the packed script (it returns a function).
 */
export function personFolder(roster: ReadonlyArray<FoldPersonRow>): (id: unknown) => string {
  const rows = (roster || []).filter((row) => row && idText(row.id))
  const cache = new Map<string, string>()
  return (id: unknown) => {
    const key = idKey(id)
    if (!key) return ''
    const hit = cache.get(key)
    if (hit != null) return hit
    const ids = personIdSet({ id: idText(id) }, rows).map(idKey).filter(Boolean).sort()
    const folded = ids[0] || key
    for (const each of ids) cache.set(each, folded)
    cache.set(key, folded)
    return folded
  }
}

export type HomeOverviewTask = {
  status?: string | null
  dueDate?: unknown
  assignedOperativeId?: string | null
  assignedOperativeIds?: ReadonlyArray<string> | null
  assignedManagerId?: string | null
  assignedManagerIds?: ReadonlyArray<string> | null
}

export type HomeOverviewInput = {
  /** Now, epoch ms. */
  nowMs: number
  /** The organisation zone (`organizationTimeZone`). */
  timeZone: string
  /** The signed-in person: their account id and email. */
  viewer: { id?: string | null; email?: string | null }
  /** `users` roster rows (with `formerUserIds` / `sameEmailUserIds`, level fields and `isActive`). */
  roster: ReadonlyArray<RosterListRow & { sameEmailUserIds?: ReadonlyArray<string> | null }>
  /** `operatives` rows (`isActive` false = inactive). */
  operatives?: ReadonlyArray<{ id: string; email?: string | null; isActive?: boolean | null }> | null
  /** `managers` rows. */
  managers?: ReadonlyArray<{ id: string; email?: string | null }> | null
  /** The tasks the viewer can see. */
  tasks?: ReadonlyArray<HomeOverviewTask> | null
  /** Labour bookings: `date` any stored shape (or `dayKey`), `status`. */
  bookings?: ReadonlyArray<{ operativeId?: string | null; date?: unknown; dayKey?: string | null; status?: string | null }> | null
  /** Manager schedule bookings. Only those on a project or small works count as on site. */
  managerSiteBookings?: ReadonlyArray<{ userId?: string | null; date?: unknown; dayKey?: string | null; locationType?: string | null }> | null
  /** Leave records as `parseHolidayDocument` returns them (day keys in the organisation zone). */
  holidays?: ReadonlyArray<{
    userId?: string | null
    operativeId?: string | null
    startDayKey: string
    endDayKey?: string | null
    status?: string | null
    approved?: boolean | null
  }> | null
  /** Bank holidays of the organisation's region (a multi-day leave record skips them, `leaveRecordDayKeys`). */
  nonWorkingDayKeys?: ReadonlyArray<string> | null
  /**
   * 1.33.0 (§6, §23): the viewer's Daily Overview scope (`dailyOverviewScopeFor`). The on-site and on-leave figures
   * count only people in it — a manager's own team, like their Daily Overview. Missing → everyone.
   */
  scope?: DailyOverviewScope | null
}

export type HomeOverviewMetrics = {
  /** Organisation-zone day the figures are for. */
  dayKey: string
  /** Not completed, assigned to the viewer, due today. */
  tasksDueToday: number
  /** Not completed, assigned to the viewer, due today or in the next 6 days. */
  tasksDueThisWeek: number
  /** Not completed, assigned to the viewer, due before today. */
  tasksOverdue: number
  /** Every task given that is not completed. */
  outstandingTasksAllUsers: number
  /** People with a labour booking today that occupies the day. */
  operativesOnSiteToday: number
  /** People with a manager schedule booking today on a project or small works. */
  managersOnSiteToday: number
  /** Both together, each person once. */
  peopleOnSiteToday: number
  /** Active people on the Operatives list (or an operatives row with no account) on approved leave today. */
  operativesOnALToday: number
  /** Active people on the Managers list on approved leave today. */
  managersOnALToday: number
}

function bookingDay(row: { date?: unknown; dayKey?: string | null }, timeZone: string): string {
  const given = idText(row.dayKey)
  if (/^\d{4}-\d{2}-\d{2}$/.test(given)) return given
  return holidayDocumentDayKey(row.date, timeZone)
}

const SITE_LOCATIONS = new Set(['project', 'smallwork', 'small_work', 'smallworks', 'small_works'])

/** A manager schedule booking on a project or small works (not office, working from home, site survey or custom). */
export function isSiteLocationType(locationType: unknown): boolean {
  return SITE_LOCATIONS.has(idKey(locationType).replace(/[\s-]+/g, '_'))
}

function taskAssigneeIds(task: HomeOverviewTask): string[] {
  return [
    ...(task.assignedOperativeIds || []),
    task.assignedOperativeId,
    ...(task.assignedManagerIds || []),
    task.assignedManagerId,
  ]
    .map(idText)
    .filter(Boolean)
}

/**
 * Rulebook 1.23.0 §23: the Home overview figures (tasks due today / this week / overdue, open tasks, people on site,
 * people on leave) on the organisation-zone day, each person once under all their ids. A task is the viewer's when
 * any of its assignees (operative or manager ids) is one of the viewer's ids (`personIdSet` of their account and
 * email over the roster, `operatives` and `managers` rows).
 */
export function homeOverviewMetrics(input: HomeOverviewInput): HomeOverviewMetrics {
  const timeZone = input.timeZone
  const today = holidayDocumentDayKey(input.nowMs, timeZone)
  const weekEnd = today ? addCalendarDayKeys(today, 7) : ''
  const users = (input.roster || []).filter((row) => row && idText(row.id))
  const operatives = (input.operatives || []).filter((row) => row && idText(row.id))
  const managers = (input.managers || []).filter((row) => row && idText(row.id))
  const foldRoster: FoldPersonRow[] = [
    ...users.map((row) => ({
      id: idText(row.id),
      email: row.email ?? null,
      formerUserIds: row.formerUserIds ?? [],
      sameEmailUserIds: row.sameEmailUserIds ?? [],
    })),
    ...operatives.map((row) => ({ id: idText(row.id), email: row.email ?? null })),
    ...managers.map((row) => ({ id: idText(row.id), email: row.email ?? null })),
  ]
  const fold = personFolder(foldRoster)

  const viewerIds = new Set(
    personIdSet({ id: idText(input.viewer?.id) || undefined, email: input.viewer?.email ?? null }, foldRoster)
      .map(idKey)
      .filter(Boolean)
  )
  // A viewer with only an email (no account id yet) still owns the rows on that email.
  const viewerEmail = idKey(input.viewer?.email)
  if (viewerEmail) {
    for (const row of foldRoster) if (idKey(row.email) === viewerEmail) for (const id of personIdSet(row, foldRoster)) viewerIds.add(idKey(id))
  }

  let tasksDueToday = 0
  let tasksDueThisWeek = 0
  let tasksOverdue = 0
  let outstandingTasksAllUsers = 0
  for (const task of input.tasks || []) {
    if (!task || isTaskCompleted(task)) continue
    outstandingTasksAllUsers += 1
    const due = dueDayKey(task.dueDate, timeZone)
    if (!due || !today) continue
    if (!taskAssigneeIds(task).some((id) => viewerIds.has(idKey(id)))) continue
    if (due === today) tasksDueToday += 1
    if (due >= today && due < weekEnd) tasksDueThisWeek += 1
    if (due < today) tasksOverdue += 1
  }

  const onSiteOperatives = new Set<string>()
  for (const booking of input.bookings || []) {
    if (!booking || !idText(booking.operativeId) || !bookingOccupiesDay(booking.status)) continue
    if (bookingDay(booking, timeZone) !== today) continue
    if (!isDailyOverviewRowInScope(input.scope, { personIds: [booking.operativeId] })) continue
    onSiteOperatives.add(fold(booking.operativeId))
  }
  const onSiteManagers = new Set<string>()
  for (const booking of input.managerSiteBookings || []) {
    if (!booking || !idText(booking.userId) || !isSiteLocationType(booking.locationType)) continue
    if (bookingDay(booking, timeZone) !== today) continue
    if (!isDailyOverviewRowInScope(input.scope, { personIds: [booking.userId] })) continue
    onSiteManagers.add(fold(booking.userId))
  }
  const onSite = new Set([...onSiteOperatives, ...onSiteManagers])

  // Who is who on leave: each person's users row decides the list (`rosterListKind`), else an operatives row.
  const userByKey = new Map<string, RosterListRow>()
  for (const row of users) {
    const key = fold(row.id)
    if (!userByKey.has(key) || (userByKey.get(key)?.isActive === false && row.isActive !== false)) userByKey.set(key, row)
  }
  const operativeByKey = new Map<string, { isActive?: boolean | null }>()
  for (const row of operatives) operativeByKey.set(fold(row.id), row)

  const onLeaveOperatives = new Set<string>()
  const onLeaveManagers = new Set<string>()
  for (const holiday of input.holidays || []) {
    if (!holiday || !today) continue
    const approved = holiday.status != null && idText(holiday.status) !== ''
      ? normalizeHolidayStatus(holiday.status) === 'approved'
      : holiday.approved !== false
    if (!approved) continue
    if (!leaveRecordDayKeys({ startDayKey: holiday.startDayKey, endDayKey: holiday.endDayKey }, timeZone, input.nonWorkingDayKeys).includes(today)) continue
    const key = fold(idText(holiday.userId) || idText(holiday.operativeId))
    if (!key) continue
    if (!isDailyOverviewRowInScope(input.scope, { personIds: [holiday.userId, holiday.operativeId] })) continue
    const user = userByKey.get(key)
    if (user) {
      if (user.isActive === false) continue
      const kind = rosterListKind(user)
      if (kind === 'operatives') onLeaveOperatives.add(key)
      else if (kind === 'managers') onLeaveManagers.add(key)
      continue
    }
    const operative = operativeByKey.get(key)
    if (operative && operative.isActive !== false) onLeaveOperatives.add(key)
  }

  return {
    dayKey: today,
    tasksDueToday,
    tasksDueThisWeek,
    tasksOverdue,
    outstandingTasksAllUsers,
    operativesOnSiteToday: onSiteOperatives.size,
    managersOnSiteToday: onSiteManagers.size,
    peopleOnSiteToday: onSite.size,
    operativesOnALToday: onLeaveOperatives.size,
    managersOnALToday: onLeaveManagers.size,
  }
}

export type QualificationExpiryCountInput = Parameters<typeof qualificationExpiryRows>[0] & {
  /** Count only these operatives (ids without case), e.g. the signed-in operative's own rows. Omitted = everyone. */
  operativeIds?: ReadonlyArray<string> | null
}

/**
 * Rulebook 1.23.0 §5 (audit finding 16): the qualification-expiry counts a menu or Home badge shows, from the same
 * rows the Warnings screen lists (`qualificationExpiryRows`: active operatives, organisation-zone day, expiring on or
 * before today plus one calendar month, already expired included). `expired` is before today, `expiringSoon` today
 * or later, `total` both. Never a device-calendar 30-day window.
 */
export function qualificationExpiryCount(input: QualificationExpiryCountInput): {
  expired: number
  expiringSoon: number
  total: number
} {
  const only = input.operativeIds ? new Set(input.operativeIds.map(idKey).filter(Boolean)) : null
  const rows = qualificationExpiryRows(input).filter((row) => !only || only.has(idKey(row.operativeId)))
  const expired = rows.filter((row) => row.daysUntilExpiry < 0).length
  return { expired, expiringSoon: rows.length - expired, total: rows.length }
}
