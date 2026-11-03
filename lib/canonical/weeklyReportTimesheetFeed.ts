/**
 * Rulebook 1.22.0 (§7, audit finding 15): the Weekly Report's approved-timesheet feed, moved unchanged from web
 * `lib/weekly-report/timesheetFeed.ts` so iOS (`WeeklyReportTimesheetFeed.swift`) calls the same rule.
 *
 * - **One week per person.** Approved weeks (a signed sheet's `weeklyReportOverride`) of two accounts that share an
 *   email are one person's week (the person key is the roster email, else the user id; the week key is the
 *   organisation-zone day of `weekStart`). The first week of a group keeps its fields; its lines are the union of the
 *   group's lines by identity — a booking line by its `bookingId`, else by its day, place, job, hours, days, amount,
 *   overtime flag and details; a money line by its `id`, else its day, job, title, amount and details — each identity
 *   counted as many times as the most any one week has it, so a shared booking counts once and lines only one account
 *   has stay.
 * - **Coverage.** A person's live bookings on a day inside an approved week (`weekStart`–`weekEnd`, organisation-zone
 *   days, inclusive) are replaced by that week's lines (`timesheetFeedCovers`).
 * - **Lines in range.** Labour lines in the report range except declined ones; price work and expenses in range
 *   except declined ones and amounts of 0.0001 or less.
 *
 * Dates may be a Date, epoch ms, an ISO string or a `YYYY-MM-DD` key (`documentInstantMs`). Plain data in, plain
 * data out; selected lines carry the index of their week in the merged list (`weekIndex`).
 */

import { dayKeyInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import { documentInstantMs } from './peopleDocuments'

export type FeedLabourLine = {
  id?: string | null
  bookingId?: string | null
  date: unknown
  locationKind?: string | null
  jobNumber?: string | null
  projectName?: string | null
  paidHours?: number | null
  days?: number | null
  amount?: number | null
  isOvertime?: boolean | null
  details?: string | null
  decision?: string | null
}

export type FeedMoneyLine = {
  id?: string | null
  date: unknown
  jobNumber?: string | null
  title?: string | null
  amount?: number | null
  details?: string | null
  decision?: string | null
}

export type FeedWeek<L extends FeedLabourLine = FeedLabourLine, M extends FeedMoneyLine = FeedMoneyLine> = {
  userId: string
  weekStart: unknown
  weekEnd: unknown
  override: { lines: L[]; priceWork: M[]; expenses: M[] } & Record<string, unknown>
}

export type FeedPerson = { id: string; email?: string | null }

function dayKeyOf(raw: unknown, zone: string): string {
  const ms = documentInstantMs(raw)
  return ms == null ? '' : dayKeyInZone(new Date(ms), zone)
}

function personKey(userId: string, people: ReadonlyArray<FeedPerson>): string {
  const person = people.find((entry) => entry.id === userId)
  const email = String(person?.email ?? '').trim().toLowerCase()
  return email || userId
}

function labourIdentity(line: FeedLabourLine, zone: string): string {
  const bookingId = String(line.bookingId ?? '').trim()
  if (bookingId) return `booking:${bookingId}`
  return [
    'row',
    dayKeyOf(line.date, zone),
    line.locationKind ?? '',
    line.jobNumber ?? '',
    line.projectName ?? '',
    line.paidHours ?? '',
    line.days ?? '',
    line.amount ?? '',
    line.isOvertime ? 'ot' : 'std',
    line.details ?? '',
  ].join('|')
}

function moneyIdentity(line: FeedMoneyLine, zone: string): string {
  const id = String(line.id ?? '').trim()
  if (id) return `money:${id}`
  return ['money', dayKeyOf(line.date, zone), line.jobNumber ?? '', line.title ?? '', line.amount ?? '', line.details ?? ''].join('|')
}

function unionByIdentity<T>(groups: T[][], identity: (line: T) => string): T[] {
  const maxCount = new Map<string, number>()
  for (const group of groups) {
    const seen = new Map<string, number>()
    for (const line of group) {
      const key = identity(line)
      seen.set(key, (seen.get(key) || 0) + 1)
    }
    for (const [key, count] of seen) maxCount.set(key, Math.max(maxCount.get(key) || 0, count))
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

/** One approved week per person and week start (see the file comment). Input order decides the primary week. */
export function mergeTimesheetFeedWeeks<W extends FeedWeek>(
  weeks: ReadonlyArray<W> | null | undefined,
  people: ReadonlyArray<FeedPerson> | null | undefined,
  timeZone?: string | null
): W[] {
  const zone = zoneOrLondon(timeZone)
  const roster = people || []
  const groups = new Map<string, W[]>()
  for (const week of weeks || []) {
    if (!week) continue
    const key = `${personKey(week.userId, roster)}|${dayKeyOf(week.weekStart, zone)}`
    const group = groups.get(key) || []
    group.push(week)
    groups.set(key, group)
  }
  const merged: W[] = []
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
        lines: unionByIdentity(group.map((week) => week.override.lines || []), (line) => labourIdentity(line, zone)),
        priceWork: unionByIdentity(group.map((week) => week.override.priceWork || []), (line) => moneyIdentity(line, zone)),
        expenses: unionByIdentity(group.map((week) => week.override.expenses || []), (line) => moneyIdentity(line, zone)),
      },
    })
  }
  return merged
}

/** Whether an approved week of one of `userIds` (exact ids) covers `day` (organisation-zone days, inclusive). */
export function timesheetFeedCovers(
  weeks: ReadonlyArray<FeedWeek> | null | undefined,
  userIds: string | ReadonlyArray<string> | null | undefined,
  day: unknown,
  timeZone?: string | null
): boolean {
  const zone = zoneOrLondon(timeZone)
  const ids = (typeof userIds === 'string' ? [userIds] : userIds || []).filter(Boolean)
  if (ids.length === 0) return false
  const key = dayKeyOf(day, zone)
  if (!key) return false
  return (weeks || []).some(
    (week) => ids.includes(week.userId) && key >= dayKeyOf(week.weekStart, zone) && key <= dayKeyOf(week.weekEnd, zone)
  )
}

export type FeedRange = { start: unknown; end: unknown }

/** Labour lines in the range, declined left out, with their week's index. */
export function timesheetFeedLabourLines<L extends FeedLabourLine>(
  weeks: ReadonlyArray<FeedWeek<L>> | null | undefined,
  range: FeedRange,
  timeZone?: string | null
): Array<{ weekIndex: number; line: L }> {
  const zone = zoneOrLondon(timeZone)
  const start = dayKeyOf(range.start, zone)
  const end = dayKeyOf(range.end, zone)
  const out: Array<{ weekIndex: number; line: L }> = []
  ;(weeks || []).forEach((week, weekIndex) => {
    for (const line of week.override.lines || []) {
      if (line.decision === 'declined') continue
      const key = dayKeyOf(line.date, zone)
      if (key < start || key > end) continue
      out.push({ weekIndex, line })
    }
  })
  return out
}

/** Price work or expense lines in the range, declined and amounts ≤ 0.0001 left out, with their week's index. */
export function timesheetFeedMoneyLines<M extends FeedMoneyLine>(
  weeks: ReadonlyArray<FeedWeek<FeedLabourLine, M>> | null | undefined,
  kind: 'priceWork' | 'expenses',
  range: FeedRange,
  timeZone?: string | null
): Array<{ weekIndex: number; line: M }> {
  const zone = zoneOrLondon(timeZone)
  const start = dayKeyOf(range.start, zone)
  const end = dayKeyOf(range.end, zone)
  const out: Array<{ weekIndex: number; line: M }> = []
  ;(weeks || []).forEach((week, weekIndex) => {
    for (const line of week.override[kind] || []) {
      if (line.decision === 'declined' || (Number(line.amount) || 0) <= 0.0001) continue
      const key = dayKeyOf(line.date, zone)
      if (key < start || key > end) continue
      out.push({ weekIndex, line })
    }
  })
  return out
}

/**
 * The whole feed in one call (iOS): the merged weeks (`mergeTimesheetFeedWeeks`) and, from them, the labour, price
 * work and expense lines in `range`. Coverage of a live booking is `timesheetFeedCovers(result.weeks, ids, day)`.
 */
export function weeklyReportTimesheetFeed<W extends FeedWeek>(input: {
  weeks: ReadonlyArray<W> | null | undefined
  people: ReadonlyArray<FeedPerson> | null | undefined
  range: FeedRange
  timeZone?: string | null
}): {
  weeks: W[]
  labour: Array<{ weekIndex: number; line: W['override']['lines'][number] }>
  priceWork: Array<{ weekIndex: number; line: W['override']['priceWork'][number] }>
  expenses: Array<{ weekIndex: number; line: W['override']['expenses'][number] }>
} {
  const weeks = mergeTimesheetFeedWeeks(input.weeks, input.people, input.timeZone)
  return {
    weeks,
    labour: timesheetFeedLabourLines(weeks, input.range, input.timeZone),
    priceWork: timesheetFeedMoneyLines(weeks, 'priceWork', input.range, input.timeZone),
    expenses: timesheetFeedMoneyLines(weeks, 'expenses', input.range, input.timeZone),
  }
}
