import type { Booking } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import { parseHhMm } from '@/lib/ios-parity/londonTime'
import { normalizeManagerTimeSlot, normalizeTimeSlot } from '@/lib/ios-parity/enums'
import { formatClockMinutes, intervalsOverlap, overlappingIntervalGroups, slotInterval } from '@/lib/canonical'
import { bookingPayrollHours } from '@/lib/scheduling/paidHours'

export type MinuteInterval = { start: number; end: number }

export { intervalsOverlap }

export function mergeIntervals(intervals: MinuteInterval[]): MinuteInterval[] {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  const merged: MinuteInterval[] = [{ ...sorted[0] }]
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    const next = sorted[i]
    if (next.start <= last.end) {
      last.end = Math.max(last.end, next.end)
    } else {
      merged.push({ ...next })
    }
  }
  return merged
}

function slotKind(raw: string | undefined): string {
  const normalized = normalizeTimeSlot(raw) || normalizeManagerTimeSlot(raw) || String(raw || '')
  return String(normalized).toUpperCase().replace(/_/g, ' ')
}

function standardWindow(policy: OrgPayrollTimePolicy): MinuteInterval | null {
  const start = parseHhMm(policy.standardDayStart)
  const end = parseHhMm(policy.standardDayEnd)
  if (start == null || end == null || end <= start) return null
  return { start, end }
}

function clockText(value?: string): string | undefined {
  const minutes = parseHhMm(value)
  return minutes == null ? undefined : formatClockMinutes(minutes)
}

/** The interval a booking occupies for clashes: the rulebook's `slotInterval`, as on iOS. */
export function operativeClashInterval(
  booking: Pick<Booking, 'timeSlot' | 'workStartTime' | 'workEndTime'>,
  policy: OrgPayrollTimePolicy = DEFAULT_PAYROLL_POLICY
): MinuteInterval | null {
  return slotInterval(
    {
      timeSlot: String(booking.timeSlot ?? ''),
      workStartTime: clockText(booking.workStartTime),
      workEndTime: clockText(booking.workEndTime),
    },
    policy
  )
}

/** Manager schedule interval for clashes: the same `slotInterval`. */
export function managerClashInterval(
  booking: Pick<ManagerSiteBooking, 'timeSlot' | 'workStartTime' | 'workEndTime'>,
  policy: OrgPayrollTimePolicy = DEFAULT_PAYROLL_POLICY
): MinuteInterval | null {
  return operativeClashInterval(booking as Pick<Booking, 'timeSlot' | 'workStartTime' | 'workEndTime'>, policy)
}

export function bookingsOverlapByInterval(
  a: Pick<Booking, 'timeSlot' | 'workStartTime' | 'workEndTime'>,
  b: Pick<Booking, 'timeSlot' | 'workStartTime' | 'workEndTime'>,
  policy: OrgPayrollTimePolicy = DEFAULT_PAYROLL_POLICY
): boolean {
  const ia = operativeClashInterval(a, policy)
  const ib = operativeClashInterval(b, policy)
  if (!ia || !ib) return false
  return intervalsOverlap(ia, ib)
}

/** Paid hours shown on a clash row: the rulebook's `payrollHoursResult` for the booking's day. */
export function paidHoursForOperativeBooking(
  booking: Pick<Booking, 'timeSlot' | 'workStartTime' | 'workEndTime' | 'isBreakRemoved'> &
    Partial<Pick<Booking, 'date' | 'otMultiplierOverride'>>,
  policy: OrgPayrollTimePolicy = DEFAULT_PAYROLL_POLICY
): number {
  return bookingPayrollHours({
    timeSlot: String(booking.timeSlot ?? ''),
    workStartTime: booking.workStartTime,
    workEndTime: booking.workEndTime,
    isBreakRemoved: booking.isBreakRemoved,
    otMultiplierOverride: booking.otMultiplierOverride,
    policy,
    date: booking.date ? new Date(booking.date) : undefined,
  }).totalPaidHours
}

export function isLegacyFullDaySlot(timeSlot: string | undefined, workStartTime?: string, workEndTime?: string): boolean {
  const kind = slotKind(timeSlot)
  const hasClock = Boolean(workStartTime?.trim() && workEndTime?.trim())
  return kind.includes('FULL') && !hasClock
}

/** iOS ManagerScheduleInterval.combinedPaidHoursFromIntervals */
export function combinedPaidHoursFromIntervals(
  intervals: MinuteInterval[],
  options: {
    anyBreakRemoved: boolean
    includesLegacyFullDay: boolean
    policy: OrgPayrollTimePolicy
  }
): number {
  const standard = Math.max(options.policy.standardPaidHours, 0)
  if (options.includesLegacyFullDay) return standard
  if (intervals.length === 0) return 0
  const merged = mergeIntervals(intervals)
  const window = standardWindow(options.policy)
  if (window) {
    const unionStart = Math.min(...merged.map((iv) => iv.start))
    const unionEnd = Math.max(...merged.map((iv) => iv.end))
    if (unionStart <= window.start && unionEnd >= window.end) return standard
  }
  const totalMinutes = merged.reduce((sum, iv) => sum + Math.max(0, iv.end - iv.start), 0)
  let wallHours = totalMinutes / 60
  if (!options.anyBreakRemoved) {
    wallHours = Math.max(0, wallHours - (options.policy.unpaidBreakMinutes || 0) / 60)
  }
  return wallHours
}

/** Clash groups for one person-day: the rulebook's `overlappingIntervalGroups`, in its order. */
export function overlappingClusters<T>(items: T[], intervalOf: (item: T) => MinuteInterval | null | undefined): T[][] {
  return overlappingIntervalGroups(items.map(intervalOf)).map((group) => group.map((index) => items[index]))
}

/** iOS WarningsComputation.formatHours — nearest 0.5, drop trailing .0 */
export function formatWarningHours(hours: number): string {
  const rounded = Math.round(hours * 2) / 2
  if (Math.abs(rounded - Math.trunc(rounded)) < 0.01) return String(Math.trunc(rounded))
  return rounded.toFixed(1)
}
