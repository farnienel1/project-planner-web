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

type WeekPerson = {
  id: string
  email?: string
}

function personKey(userId: string, people: WeekPerson[]): string {
  const person = people.find((entry) => entry.id === userId)
  const email = person?.email?.trim().toLowerCase() || ''
  return email || userId
}

function labourIdentity(line: WeeklyReportLabourLine, timeZone: string): string {
  const bookingId = line.bookingId.trim()
  if (bookingId) return `booking:${bookingId}`
  return [
    'row',
    dayKey(line.date, timeZone),
    line.locationKind,
    line.jobNumber,
    line.projectName,
    line.paidHours,
    line.days,
    line.amount,
    line.isOvertime ? 'ot' : 'std',
    line.details,
  ].join('|')
}

function moneyIdentity(line: WeeklyReportMoneyLine, timeZone: string): string {
  const id = line.id.trim()
  if (id) return `money:${id}`
  return ['money', dayKey(line.date, timeZone), line.jobNumber, line.title, line.amount, line.details].join('|')
}

function unionByIdentity<T>(groups: T[][], identity: (line: T) => string): T[] {
  const maxCount = new Map<string, number>()
  for (const group of groups) {
    const seen = new Map<string, number>()
    for (const line of group) {
      const key = identity(line)
      seen.set(key, (seen.get(key) || 0) + 1)
    }
    for (const [key, count] of seen) {
      maxCount.set(key, Math.max(maxCount.get(key) || 0, count))
    }
  }
  const taken = new Map<string, number>()
  const merged: T[] = []
  for (const group of groups) {
    for (const line of group) {
      const key = identity(line)
      const used = taken.get(key) || 0
      if (used >= (maxCount.get(key) || 0)) continue
      taken.set(key, used + 1)
      merged.push(line)
    }
  }
  return merged
}

/**
 * Two user documents can share an email, and each approved week now includes
 * the other account's hours. Keep one week per person: identical booking lines
 * are counted once, and hours that exist on only one account stay.
 */
export function mergeDuplicatePersonWeeks(
  weeks: ApprovedTimesheetWeek[],
  people: WeekPerson[],
  timeZone: string = LONDON_TIME_ZONE
): ApprovedTimesheetWeek[] {
  const groups = new Map<string, ApprovedTimesheetWeek[]>()
  for (const week of weeks) {
    const key = `${personKey(week.userId, people)}|${dayKey(week.weekStart, timeZone)}`
    const group = groups.get(key) || []
    group.push(week)
    groups.set(key, group)
  }
  const merged: ApprovedTimesheetWeek[] = []
  for (const group of groups.values()) {
    const primary = group[0]
    if (!primary) continue
    if (group.length === 1) {
      merged.push(primary)
      continue
    }
    merged.push({
      ...primary,
      override: {
        ...primary.override,
        lines: unionByIdentity(
          group.map((week) => week.override.lines),
          (line) => labourIdentity(line, timeZone)
        ),
        priceWork: unionByIdentity(
          group.map((week) => week.override.priceWork),
          (line) => moneyIdentity(line, timeZone)
        ),
        expenses: unionByIdentity(
          group.map((week) => week.override.expenses),
          (line) => moneyIdentity(line, timeZone)
        ),
      },
    })
  }
  return merged
}

export function timesheetFeedCovers(
  weeks: ApprovedTimesheetWeek[],
  userId: string | string[] | undefined,
  day: Date,
  timeZone: string = LONDON_TIME_ZONE
): boolean {
  const ids = (Array.isArray(userId) ? userId : userId ? [userId] : []).filter(Boolean)
  if (ids.length === 0) return false
  const key = dayKey(day, timeZone)
  return weeks.some(
    (week) =>
      ids.includes(week.userId) &&
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
