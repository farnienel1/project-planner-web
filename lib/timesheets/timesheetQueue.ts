/**
 * User Timesheets → Awaiting sign-off / Signed off across the recent pay runs (17 Nov follow-up): a signed sheet of an
 * earlier pay run that was never exported stays listed (with its own run) until it is exported. Which bucket a sheet is
 * in stays the rulebook's (`timesheetListBucket` via `currentPeriodTimesheetMembers`); which sheets are a person's
 * stays the rulebook's person-id rule (`personIdSet`). This file only walks the pay runs and keys the rows.
 */
import { listSelectablePayPeriods, periodStartKey } from '@/lib/timesheets/paymentRunCopy'
import { computeInvoicingPeriod } from '@/lib/warnings/warningLookahead'
import { currentPeriodTimesheetMembers } from '@/lib/timesheets/timesheetHubStats'
import { normalizeDocumentId, personIdSet } from '@/lib/canonical'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'
import { dayKey } from '@/lib/ios-parity/londonTime'
import type { OrgInvoicingSettings } from '@/lib/settings/organizationSettings'
import type { TimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import type { User } from '@/types'

/** How many pay runs (the current one included) the hub and User Timesheets look back over. */
export const RECENT_PAY_RUN_COUNT = 6

export type PayRun = { start: Date; end: Date }

/** `start|end` day keys in the organisation zone: one pay run. */
export function payRunKey(period: PayRun, timeZone: string): string {
  return `${periodStartKey(period.start, timeZone)}|${dayKey(period.end, timeZone)}`
}

/**
 * The current pay run and the ones before it, newest first, `count` in all (organisation zone). The same window the
 * hub has checked for changed signed sheets since 1.47.0 (review #325 item 7).
 */
export function recentPayRuns(invoicing: OrgInvoicingSettings, now: Date, timeZone: string, count = RECENT_PAY_RUN_COUNT): PayRun[] {
  const current = computeInvoicingPeriod(now, invoicing, timeZone)
  const seen = new Set<string>()
  const runs: PayRun[] = []
  for (const period of [current, ...listSelectablePayPeriods(invoicing, now, count + 1, timeZone)]) {
    const key = payRunKey(period, timeZone)
    if (seen.has(key)) continue
    seen.add(key)
    runs.push({ start: period.start, end: period.end })
  }
  return runs.sort((a, b) => b.start.getTime() - a.start.getTime()).slice(0, Math.max(1, count))
}

/** The earliest start day key of `runs` (where the bookings must be loaded from). */
export function payRunsStartDayKey(runs: ReadonlyArray<PayRun>, timeZone: string): string {
  return runs.reduce((earliest, period) => {
    const key = periodStartKey(period.start, timeZone)
    return !earliest || key < earliest ? key : earliest
  }, '')
}

/**
 * Every users id a roster member's sheets may be filed under (guardrail 1): the rulebook's `personIdSet` — their own id,
 * `formerUserIds`, `sameEmailUserIds` and same-email users documents — over the whole organisation roster.
 */
export function timesheetMemberIds(member: User, roster: ReadonlyArray<User>): string[] {
  const ids = personIdSet(rulebookPerson(member, roster), rulebookRoster(roster))
  return ids.length > 0 ? ids : [member.id]
}

/**
 * The person (from `candidates`) a stored timesheet `userId` belongs to, under every id they go by; null when it is
 * none of them. An exact id match wins over an alias, so two documents of one person keep their own sheets.
 */
export function timesheetOwnerResolver(
  candidates: ReadonlyArray<User>,
  roster: ReadonlyArray<User>
): (storedUserId: string | null | undefined) => User | null {
  const exact = new Map<string, User>()
  const alias = new Map<string, User>()
  for (const member of candidates) exact.set(normalizeDocumentId(member.id), member)
  for (const member of candidates) {
    for (const id of timesheetMemberIds(member, roster)) {
      const key = normalizeDocumentId(id)
      if (key && !exact.has(key) && !alias.has(key)) alias.set(key, member)
    }
  }
  return (storedUserId) => {
    const key = normalizeDocumentId(storedUserId ?? '')
    if (!key) return null
    return exact.get(key) ?? alias.get(key) ?? null
  }
}

/**
 * Re-keys the sheets loaded by their stored `userId` to the roster members of `groups`: a member's own id first, then
 * any id they go by (a sheet filed under a former invite id or a second users document on their email).
 */
export function draftsForMembers(
  groups: ReadonlyArray<ReadonlyArray<User>>,
  stored: ReadonlyMap<string, TimesheetDraft>,
  roster: ReadonlyArray<User>
): Map<string, TimesheetDraft> {
  const byKey = new Map<string, TimesheetDraft>()
  for (const [userId, draft] of stored) {
    const key = normalizeDocumentId(userId)
    if (key && !byKey.has(key)) byKey.set(key, draft)
  }
  const out = new Map<string, TimesheetDraft>()
  const members = groups.flat()
  const memberKeys = new Set(members.map((member) => normalizeDocumentId(member.id)))
  for (const member of members) {
    const own = byKey.get(normalizeDocumentId(member.id))
    if (own) {
      out.set(member.id, own)
      continue
    }
    for (const id of timesheetMemberIds(member, roster)) {
      const key = normalizeDocumentId(id)
      // Another listed member's own sheet is theirs, never borrowed.
      if (!key || memberKeys.has(key)) continue
      const hit = byKey.get(key)
      if (hit) {
        out.set(member.id, hit)
        break
      }
    }
  }
  return out
}

export type TimesheetQueueRow = {
  /** `memberId|start|end` — one row per person and pay run. */
  key: string
  member: User
  period: PayRun
  draft: TimesheetDraft
}

/**
 * The Awaiting / Signed off rows over several pay runs: per run, the members `currentPeriodTimesheetMembers` puts in
 * `bucket` (the rulebook's `timesheetListBucket`, with that run's booking change), newest run first. An exported sheet
 * is never in these buckets, so a run's rows disappear once exported.
 */
export function timesheetQueueRows(input: {
  runs: ReadonlyArray<PayRun>
  groupsFor: (run: PayRun) => User[][]
  draftsFor: (run: PayRun) => ReadonlyMap<string, TimesheetDraft> | undefined
  bucket: 'awaiting' | 'signed'
  users: ReadonlyArray<User>
  timeZone: string
  bookingChange?: (member: User, draft: TimesheetDraft, run: PayRun) => { reopened?: boolean | null; waitingFor?: 'person' | 'lineManager' | null } | null
}): TimesheetQueueRow[] {
  const rows: TimesheetQueueRow[] = []
  const runs = [...input.runs].sort((a, b) => b.start.getTime() - a.start.getTime())
  for (const run of runs) {
    const drafts = input.draftsFor(run)
    if (!drafts || drafts.size === 0) continue
    const members = currentPeriodTimesheetMembers(
      input.groupsFor(run),
      drafts,
      input.bucket,
      input.users,
      input.bookingChange ? (member, draft) => input.bookingChange!(member, draft, run) : undefined
    )
    for (const member of members) {
      const draft = drafts.get(member.id)
      if (!draft) continue
      rows.push({ key: `${member.id}|${payRunKey(run, input.timeZone)}`, member, period: run, draft })
    }
  }
  return rows
}
