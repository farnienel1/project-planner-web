import type { Booking } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import { parseHhMm } from '@/lib/ios-parity/londonTime'
import { normalizeManagerTimeSlot, normalizeTimeSlot } from '@/lib/ios-parity/enums'

export type MinuteInterval = { start: number; end: number }

export function intervalsOverlap(a: MinuteInterval, b: MinuteInterval): boolean {
  return a.start < b.end && b.start < a.end
}

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

function clockInterval(start?: string, end?: string): MinuteInterval | null {
  const sm = parseHhMm(start)
  const em = parseHhMm(end)
  if (sm == null || em == null || em <= sm) return null
  return { start: sm, end: em }
}

/** iOS OperativeBookingInterval.clashInterval */
export function operativeClashInterval(
  booking: Pick<Booking, 'timeSlot' | 'workStartTime' | 'workEndTime'>,
  policy: OrgPayrollTimePolicy = DEFAULT_PAYROLL_POLICY
): MinuteInterval | null {
  const clock = clockInterval(booking.workStartTime, booking.workEndTime)
  if (clock) return clock
  const window = standardWindow(policy)
  const kind = slotKind(String(booking.timeSlot))
  if (!window) {
    if (kind.includes('FULL')) return { start: 0, end: 24 * 60 }
    return null
  }
  const mid = window.start + Math.floor((window.end - window.start) / 2)
  if (kind.includes('FULL') || kind === 'CUSTOM HOURS' || kind === 'CUSTOM') return window
  if (kind === 'AM' || kind.includes('MORNING')) return { start: window.start, end: mid }
  if (kind === 'PM' || kind.includes('AFTERNOON')) return { start: mid, end: window.end }
  if (kind.includes('EVENING')) {
    const end = Math.min(window.end + 240, 24 * 60)
    return end > window.end ? { start: window.end, end } : null
  }
  if (kind.includes('OVERTIME')) {
    const start = Math.min(window.end + 240, 24 * 60)
    const end = Math.min(window.end + 360, 24 * 60)
    return end > start ? { start, end } : null
  }
  return window
}

/** iOS ManagerScheduleInterval.clashInterval */
export function managerClashInterval(
  booking: Pick<ManagerSiteBooking, 'timeSlot' | 'workStartTime' | 'workEndTime'>,
  policy: OrgPayrollTimePolicy = DEFAULT_PAYROLL_POLICY
): MinuteInterval | null {
  const clock = clockInterval(booking.workStartTime, booking.workEndTime)
  if (clock) return clock
  const window = standardWindow(policy)
  const kind = slotKind(String(booking.timeSlot))
  if (!window) {
    if (kind.includes('FULL')) return { start: 0, end: 24 * 60 }
    return null
  }
  const mid = window.start + Math.floor((window.end - window.start) / 2)
  if (kind.includes('FULL') || kind === 'CUSTOM HOURS' || kind === 'CUSTOM') return window
  if (kind === 'AM' || kind.includes('MORNING')) return { start: window.start, end: mid }
  if (kind === 'PM' || kind.includes('AFTERNOON')) return { start: mid, end: window.end }
  return window
}

export function bookingsOverlapByInterval(
  a: Pick<Booking, 'timeSlot' | 'workStartTime' | 'workEndTime'>,
  b: Pick<Booking, 'timeSlot' | 'workStartTime' | 'workEndTime'>,
  policy: OrgPayrollTimePolicy = DEFAULT_PAYROLL_POLICY
): boolean {
  const ia = operativeClashInterval(a, policy)
  const ib = operativeClashInterval(b, policy)
  if (!ia || !ib) {
    const ka = slotKind(String(a.timeSlot))
    const kb = slotKind(String(b.timeSlot))
    if (ka.includes('FULL') || kb.includes('FULL')) return true
    return ka === kb
  }
  return intervalsOverlap(ia, ib)
}

export function paidHoursForOperativeBooking(
  booking: Pick<Booking, 'timeSlot' | 'workStartTime' | 'workEndTime' | 'isBreakRemoved'>,
  policy: OrgPayrollTimePolicy = DEFAULT_PAYROLL_POLICY
): number {
  const standard = Math.max(policy.standardPaidHours, 0)
  const clock = clockInterval(booking.workStartTime, booking.workEndTime)
  if (clock) {
    let hours = (clock.end - clock.start) / 60
    if (!booking.isBreakRemoved) {
      hours = Math.max(0, hours - (policy.unpaidBreakMinutes || 0) / 60)
    }
    return hours
  }
  const kind = slotKind(String(booking.timeSlot))
  if (kind === 'AM' || kind === 'PM' || kind.includes('MORNING') || kind.includes('AFTERNOON')) {
    return standard / 2
  }
  return standard
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

/** Connected components of overlapping items — one warning per person-day cluster (iOS). */
export function overlappingClusters<T>(items: T[], overlap: (a: T, b: T) => boolean): T[][] {
  const n = items.length
  if (n < 2) return []
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i: number): number => {
    let x = i
    while (parent[x] !== x) x = parent[x]
    let y = i
    while (parent[y] !== y) {
      const next = parent[y]
      parent[y] = x
      y = next
    }
    return x
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }
  const hasEdge = Array(n).fill(false)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (overlap(items[i], items[j])) {
        union(i, j)
        hasEdge[i] = true
        hasEdge[j] = true
      }
    }
  }
  const groups = new Map<number, T[]>()
  for (let i = 0; i < n; i++) {
    if (!hasEdge[i]) continue
    const root = find(i)
    const list = groups.get(root) || []
    list.push(items[i])
    groups.set(root, list)
  }
  return [...groups.values()].filter((group) => group.length >= 2)
}

/** iOS WarningsComputation.formatHours — nearest 0.5, drop trailing .0 */
export function formatWarningHours(hours: number): string {
  const rounded = Math.round(hours * 2) / 2
  if (Math.abs(rounded - Math.trunc(rounded)) < 0.01) return String(Math.trunc(rounded))
  return rounded.toFixed(1)
}
