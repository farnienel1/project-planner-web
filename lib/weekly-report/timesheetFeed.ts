/**
 * The Weekly Report's approved-timesheet feed. The rule is the rulebook's (1.22.0, §7):
 * `mergeTimesheetFeedWeeks`, `timesheetFeedCovers`, `timesheetFeedLabourLines`, `timesheetFeedMoneyLines`
 * (iOS calls `weeklyReportTimesheetFeed`). This file only adapts the web types.
 */
import {
  mergeTimesheetFeedWeeks,
  timesheetFeedCovers as canonicalTimesheetFeedCovers,
  timesheetFeedLabourLines,
  timesheetFeedMoneyLines,
} from '@/lib/canonical/weeklyReportTimesheetFeed'
import type {
  WeeklyReportLabourLine,
  WeeklyReportMoneyLine,
  WeeklyReportOverride,
} from '@/lib/timesheets/timesheetDraft'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'

export type ApprovedTimesheetWeek = {
  userId: string
  personName: string
  role: string
  trade: string
  weekStart: Date
  weekEnd: Date
  override: WeeklyReportOverride
}

type WeekPerson = {
  id: string
  email?: string
}

/**
 * Rulebook 1.22.0 (§7): one approved week per person (`mergeTimesheetFeedWeeks`). Two user documents can share an
 * email; identical booking lines are counted once and hours on only one account stay.
 */
export function mergeDuplicatePersonWeeks(
  weeks: ApprovedTimesheetWeek[],
  people: WeekPerson[],
  timeZone: string = organizationZoneOr()
): ApprovedTimesheetWeek[] {
  return mergeTimesheetFeedWeeks(weeks, people, timeZone)
}

/** Rulebook 1.22.0 (§7): `timesheetFeedCovers`. */
export function timesheetFeedCovers(
  weeks: ApprovedTimesheetWeek[],
  userId: string | string[] | undefined,
  day: Date,
  timeZone: string = organizationZoneOr()
): boolean {
  return canonicalTimesheetFeedCovers(weeks, userId ?? null, day, timeZone)
}

/** Rulebook 1.22.0 (§7): `timesheetFeedLabourLines`. */
export function timesheetLabourLines(
  weeks: ApprovedTimesheetWeek[],
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string = organizationZoneOr()
): Array<{ week: ApprovedTimesheetWeek; line: WeeklyReportLabourLine }> {
  return timesheetFeedLabourLines<WeeklyReportLabourLine>(weeks, { start: rangeStart, end: rangeEnd }, timeZone).map(
    ({ weekIndex, line }) => ({ week: weeks[weekIndex] as ApprovedTimesheetWeek, line })
  )
}

/** Rulebook 1.22.0 (§7): `timesheetFeedMoneyLines`. */
export function timesheetMoneyLines(
  weeks: ApprovedTimesheetWeek[],
  kind: 'priceWork' | 'expenses',
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string = organizationZoneOr()
): Array<{ week: ApprovedTimesheetWeek; line: WeeklyReportMoneyLine }> {
  return timesheetFeedMoneyLines<WeeklyReportMoneyLine>(weeks, kind, { start: rangeStart, end: rangeEnd }, timeZone).map(
    ({ weekIndex, line }) => ({ week: weeks[weekIndex] as ApprovedTimesheetWeek, line })
  )
}

const ADDITIONAL_KINDS = new Set(['office', 'working_from_home', 'site_survey', 'custom'])
const PROJECT_KINDS = new Set(['project', 'small_work'])

export function isProjectLocationKind(kind: string): boolean {
  return PROJECT_KINDS.has(kind)
}

export function isAdditionalScheduleLocationKind(kind: string): boolean {
  return ADDITIONAL_KINDS.has(kind)
}

export function additionalScheduleLocation(line: WeeklyReportLabourLine): string {
  if (line.locationKind === 'custom') {
    const name = line.projectName.trim()
    return !name || name === '—' ? 'Custom' : name
  }
  if (line.locationKind === 'office') return 'Office'
  if (line.locationKind === 'working_from_home') return 'Working from home'
  if (line.locationKind === 'site_survey') return 'Site survey'
  return line.projectName || 'Booking'
}
