/**
 * iOS parity: Core/WeeklyReportTimesheetFeed.swift selection rules.
 * Live bookings for a user are replaced on days inside a fully approved timesheet week.
 */
import { LONDON_TIME_ZONE, dayKey } from '@/lib/ios-parity/londonTime'
import type {
  WeeklyReportLabourLine,
  WeeklyReportMoneyLine,
  WeeklyReportOverride,
} from '@/lib/timesheets/timesheetDraft'

export type ApprovedTimesheetWeek = {
  userId: string
  personName: string
  role: string
  trade: string
  weekStart: Date
  weekEnd: Date
  override: WeeklyReportOverride
}

export function timesheetFeedCovers(
  weeks: ApprovedTimesheetWeek[],
  userId: string | undefined,
  day: Date,
  timeZone: string = LONDON_TIME_ZONE
): boolean {
  if (!userId) return false
  const key = dayKey(day, timeZone)
  return weeks.some(
    (week) =>
      week.userId === userId &&
      key >= dayKey(week.weekStart, timeZone) &&
      key <= dayKey(week.weekEnd, timeZone)
  )
}

export function timesheetLabourLines(
  weeks: ApprovedTimesheetWeek[],
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string = LONDON_TIME_ZONE
): Array<{ week: ApprovedTimesheetWeek; line: WeeklyReportLabourLine }> {
  const start = dayKey(rangeStart, timeZone)
  const end = dayKey(rangeEnd, timeZone)
  const out: Array<{ week: ApprovedTimesheetWeek; line: WeeklyReportLabourLine }> = []
  for (const week of weeks) {
    for (const line of week.override.lines) {
      if (line.decision === 'declined') continue
      const key = dayKey(line.date, timeZone)
      if (key < start || key > end) continue
      out.push({ week, line })
    }
  }
  return out
}

export function timesheetMoneyLines(
  weeks: ApprovedTimesheetWeek[],
  kind: 'priceWork' | 'expenses',
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string = LONDON_TIME_ZONE
): Array<{ week: ApprovedTimesheetWeek; line: WeeklyReportMoneyLine }> {
  const start = dayKey(rangeStart, timeZone)
  const end = dayKey(rangeEnd, timeZone)
  const out: Array<{ week: ApprovedTimesheetWeek; line: WeeklyReportMoneyLine }> = []
  for (const week of weeks) {
    for (const line of week.override[kind]) {
      if (line.decision === 'declined' || line.amount <= 0.0001) continue
      const key = dayKey(line.date, timeZone)
      if (key < start || key > end) continue
      out.push({ week, line })
    }
  }
  return out
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
