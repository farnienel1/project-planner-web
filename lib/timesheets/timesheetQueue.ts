/**
 * User Timesheets → Awaiting sign-off / Signed off (rulebook 1.66.0 §8, owner decision 17 Nov): every stored sheet of the
 * viewer's people, however old. Who is listed, one row per person and pay run, PAYE runs, revisions and the bucket are the
 * rulebook's `userTimesheetQueue`; which sheets are a person's is the rulebook's person-id rule (`personIdSet`). This file
 * shapes the web roster and sheets into its input, maps the rows back, and keeps the recent-pay-run window the background
 * snapshot repair and the booking-change check use.
 */
import { listSelectablePayPeriods, periodStartKey } from '@/lib/timesheets/paymentRunCopy'
import { computeInvoicingPeriod } from '@/lib/warnings/warningLookahead'
import {
  normalizeDocumentId,
  personIdSet,
  timesheetStoredStartDayKey,
  userTimesheetQueue,
  type TimesheetListBucket,
  type UserTimesheetQueueMember,
  type UserTimesheetQueueSheet,
} from '@/lib/canonical'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'
import { dateFromDayKey, dayKey } from '@/lib/ios-parity/londonTime'
import { userTimesheetAccessInput } from '@/lib/permissions'
import { timesheetPerson } from '@/lib/timesheets/timesheetPayrollPolicy'
import { userTimesheetSelfSigned } from '@/lib/timesheets/timesheetApprovalPolicy'
import { timesheetStatusFieldsFromDraft } from '@/lib/timesheets/timesheetHubStats'
import { timesheetDraftHasActivity, type TimesheetQueueStoredSheet } from '@/lib/timesheets/timesheetStorage'
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

export type TimesheetQueueRow = {
  /** `memberId|start|end` — one row per person and pay run. */
  key: string
  member: User
  period: PayRun
  draft: TimesheetDraft
}

type BookingChangeOf = (
  member: User,
  draft: TimesheetDraft,
  run: PayRun
) => { reopened?: boolean | null; waitingFor?: 'person' | 'lineManager' | null } | null

/** A queue row with the rulebook's bucket (`unsigned`, `awaiting`, `signed` or `exported`). */
export type TimesheetQueueBucketRow = TimesheetQueueRow & { bucket: TimesheetListBucket }

/**
 * Rulebook 1.66.0 §8 (owner decision 17 Nov): User Timesheets → Awaiting sign-off / Signed off and their counts, from
 * every stored sheet of the viewer's people, however old — `userTimesheetQueue` decides who, one row per person and pay
 * run, PAYE runs, revisions and the bucket. This only shapes the web roster and sheets into its input and maps its rows
 * back. A sheet's booking change is worked out only for a signed, unexported sheet (`bookingChange`, which reads a run
 * whose bookings are not loaded as not changed). A stored sheet with no end day takes the end of the payment run that
 * starts on its start day.
 */
export function userTimesheetQueueRows(input: {
  viewer: User
  users: ReadonlyArray<User>
  sheets: ReadonlyArray<TimesheetQueueStoredSheet>
  invoicing: OrgInvoicingSettings
  timeZone: string
  bookingChange?: BookingChangeOf
}): TimesheetQueueBucketRow[] {
  const { viewer, timeZone } = input
  const users = [...input.users]
  const access = userTimesheetAccessInput(viewer, users)
  const byId = new Map(users.map((member) => [member.id, member]))
  const members: UserTimesheetQueueMember[] = access.members.map((member) => {
    const user = byId.get(member.id)
    if (!user) return member
    return {
      ...member,
      ...timesheetPerson(user),
      ghost: member.ghost,
      email: user.email,
      formerUserIds: user.formerUserIds ?? [],
      sameEmailUserIds: (user as { sameEmailUserIds?: string[] }).sameEmailUserIds ?? [],
      timesheetSelfSigned: userTimesheetSelfSigned(user, users),
    }
  })
  const owner = timesheetOwnerResolver(users, users)
  const sheets: UserTimesheetQueueSheet[] = input.sheets.map((sheet) => {
    const startDayKey = timesheetStoredStartDayKey(sheet.weekStart, timeZone) || dayKey(sheet.weekStart, timeZone)
    const endDayKey = sheet.endDayKey || dayKey(computeInvoicingPeriod(sheet.weekStart, input.invoicing, timeZone).end, timeZone)
    const status = timesheetStatusFieldsFromDraft(sheet.draft)
    const member = status.exportedAtMs == null && input.bookingChange ? owner(sheet.userId) : null
    const run = { start: dateFromDayKey(startDayKey, timeZone), end: dateFromDayKey(endDayKey, timeZone) }
    return {
      userId: sheet.userId,
      startDayKey,
      endDayKey,
      status,
      documentId: sheet.documentId,
      hasActivity: timesheetDraftHasActivity(sheet.draft),
      bookingsChange: member && input.bookingChange ? input.bookingChange(member, sheet.draft, run) : null,
    }
  })
  return userTimesheetQueue({ viewer: access.viewer, members, sheets, timeZone }).flatMap((row) => {
    const member = byId.get(row.personId)
    const stored = input.sheets[row.sheetIndex]
    if (!member || !stored) return []
    const period = { start: dateFromDayKey(row.startDayKey, timeZone), end: dateFromDayKey(row.endDayKey, timeZone) }
    return [{ key: row.key, member, period, draft: stored.draft, bucket: row.bucket }]
  })
}

/** Whether a Firestore error is the security rules refusing the read. */
export function isPermissionDenied(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'permission-denied'
}

/**
 * Review of #368 (S1): run one `in` query per chunk of ids; when the rules refuse a chunk (one id in it is not readable by
 * this viewer — e.g. a former invite id whose users document is gone, under `privatePay`), ask for each id of that chunk
 * on its own and skip only the refused ones, so one unreadable alias never empties the whole list. Any other error is
 * thrown. Returns the rows and the ids refused.
 */
export async function queryIdsSkippingRefused<T>(
  ids: ReadonlyArray<string>,
  chunkSize: number,
  run: (chunk: string[]) => Promise<T[]>
): Promise<{ rows: T[]; refusedIds: string[] }> {
  const rows: T[] = []
  const refusedIds: string[] = []
  const chunks: string[][] = []
  for (let index = 0; index < ids.length; index += Math.max(1, chunkSize)) {
    const chunk = ids.slice(index, index + Math.max(1, chunkSize))
    if (chunk.length > 0) chunks.push(chunk)
  }
  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        rows.push(...(await run(chunk)))
      } catch (error) {
        if (!isPermissionDenied(error)) throw error
        if (chunk.length === 1) {
          refusedIds.push(chunk[0])
          return
        }
        const singles = await Promise.all(
          chunk.map(async (id) => {
            try {
              return await run([id])
            } catch (single) {
              if (!isPermissionDenied(single)) throw single
              refusedIds.push(id)
              return [] as T[]
            }
          })
        )
        for (const part of singles) rows.push(...part)
      }
    })
  )
  return { rows, refusedIds }
}
