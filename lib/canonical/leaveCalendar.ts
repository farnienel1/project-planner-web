/**
 * Rulebook 1.23.0 §9 (audit finding 19): what an annual-leave calendar shows on one day.
 *
 * Before 1.23.0 web read the record's start–end range on the browser day and iOS the record's leave days on the
 * device day; iOS hid approved leave with a pending cancellation, web did not; and the first full-day record in list
 * order won. Now:
 *   - a record covers a day when the day is one of its leave days (`leaveRecordDayKeys`: a single-day record its day;
 *     a multi-day record each day except weekends and the bank holidays given) — the same days the allowance counts;
 *   - status is read with `normalizeHolidayStatus`; rejected records are ignored; approved leave with a pending
 *     cancellation request is still approved leave (§9) and shows as approved;
 *   - the order is fixed, never the list order: a full day beats a half day, and at the same length pending beats
 *     approved (the request waiting for a decision stays visible): pendingFull, approvedFull, pendingHalf,
 *     approvedHalf, none.
 * Records are the person's own (match the person with `personIdSet` before calling). Pure.
 */

import { leaveRecordDayKeys, normalizeHolidayStatus, normalizeHolidayTimeSlot } from './leaveRequests'

export type LeaveDayKind = 'none' | 'approvedFull' | 'approvedHalf' | 'pendingFull' | 'pendingHalf'

export type LeaveCalendarRecord = {
  id?: string | null
  startDayKey: string
  endDayKey?: string | null
  timeSlot?: string | null
  status?: string | null
}

const RANK: Record<LeaveDayKind, number> = { none: 0, approvedHalf: 1, pendingHalf: 2, approvedFull: 3, pendingFull: 4 }

/**
 * The calendar state of `dayKey` for one person's leave records (rulebook 1.23.0 §9), plus the record that decided it
 * (`recordId`, the first such record in input order; null for none). `isLocked` is true for a full day (no more leave
 * can be requested on it).
 */
export function leaveDayKind(
  records: ReadonlyArray<LeaveCalendarRecord> | null | undefined,
  dayKey: string,
  timeZone?: string | null,
  nonWorkingDayKeys?: ReadonlyArray<string> | null
): { kind: LeaveDayKind; recordId: string | null; isLocked: boolean } {
  let best: LeaveDayKind = 'none'
  let recordId: string | null = null
  for (const record of records || []) {
    if (!record) continue
    const status = normalizeHolidayStatus(record.status)
    if (status !== 'approved' && status !== 'pending') continue
    if (!leaveRecordDayKeys(record, timeZone, nonWorkingDayKeys).includes(dayKey)) continue
    const slot = normalizeHolidayTimeSlot(record.timeSlot)
    const half = slot === 'AM' || slot === 'PM'
    const kind: LeaveDayKind = status === 'pending' ? (half ? 'pendingHalf' : 'pendingFull') : half ? 'approvedHalf' : 'approvedFull'
    if (RANK[kind] > RANK[best]) {
      best = kind
      recordId = String(record.id ?? '').trim() || null
    }
  }
  return { kind: best, recordId, isLocked: best === 'approvedFull' || best === 'pendingFull' }
}
