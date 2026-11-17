/**
 * Rulebook 1.62.0 §4.3 (owner request 17 Nov): the simpler hours breakdown every booking screen shows, on web and iOS,
 * in the same words. One line under the timeline and a short breakdown that reads down and adds up:
 *
 *   06:00–17:30 · 12.25 paid hours
 *
 *   HOURS BREAKDOWN  Tuesday, full day
 *   Normal hours      07:00–16:00, less 30 min break                 8.5h
 *   Overtime          06:00–07:00 and 16:00–17:30 / 2.5h at ×1.5      3.75h
 *   Total paid hours                                                 12.25h
 *
 * Wording only. Every figure is read from `payrollHoursResult` (the timesheet pay rule) for that day under the working
 * hours in effect on it: the normal row is the standard-window segments, the overtime row the segments at the
 * multiplier (`payrollMultipliedHours` for "2.5h at ×1.5 − 0.5h break", `payrollLineClockRanges` for the times), the
 * total `totalPaidHours` — the figure on the Save button (`saveHoursLabel`). Nothing is priced here, so normal +
 * overtime = total by construction. Replaces the long `bookingHoursExplanation` text on the booking screens (that
 * function stays for older app builds).
 */

import { formatClockMinutes, namedSlotKind, parseClockMinutes } from './engine'
import { weekendCountsAsHours, type OrgPayrollTimePolicy } from './organizationSettings'
import {
  payrollBreakOnDay,
  payrollHoursResult,
  payrollLineClockRanges,
  payrollMultipliedHours,
  unpaidBreakAppliesOnDay,
  weekendFullDayWindow,
  weekendRuleForIsoWeekday,
  type PayrollHoursSegment,
} from './payrollHours'
import { isoWeekdayOfDayKey, zoneOrLondon } from './dayKeys'
import { payrollTimePolicyForDayFromState, type PayrollTimePolicyState } from './payrollPolicySchedule'

export type BookingHoursBreakdownRowKind = 'normal' | 'overtime' | 'total'

export type BookingHoursBreakdownRow = {
  kind: BookingHoursBreakdownRowKind
  /** "Normal hours", "Overtime" or "Total paid hours". */
  label: string
  /** Muted lines under the label, e.g. ["06:00–07:00 and 16:00–17:30", "2.5h at ×1.5"]. Empty on the total row. */
  details: string[]
  /** The figure, e.g. "3.75h" (up to 2 decimals, trailing zeros dropped). */
  value: string
  /** The figure as a number, rounded to hundredths. */
  hours: number
  /** The row read as one sentence, e.g. "Overtime, 06:00 to 07:00 and 16:00 to 17:30, 2.5 hours at 1.5 times, 3.75 hours". */
  accessibilityLabel: string
}

export type BookingHoursBreakdownDayKind = 'weekday' | 'weekendWindow' | 'weekendAllHours'

export type BookingHoursBreakdown = {
  dayKey: string
  /** 'Monday' … 'Sunday'. */
  weekdayLabel: string
  dayKind: BookingHoursBreakdownDayKind
  /** The day's rule in a few words: "full day", "half day (AM)", "full day 07:30–14:00 counts as 8h", "every hour is overtime". */
  dayType: string
  /** "{Day}, {day type}", e.g. "Tuesday, full day". */
  headerDetail: string
  /** The booking's times ("06:00–17:30") or its slot ("Full day", "AM") — the first half of the summary line. */
  range: string
  /** "12.25 paid hours" — the bold half of the summary line. */
  summaryHours: string
  /** The one line under the timeline: "06:00–17:30 · 12.25 paid hours". */
  summary: string
  /** Normal (when there are normal hours), Overtime (when there is overtime), then Total — in that order. */
  rows: BookingHoursBreakdownRow[]
  normalPaidHours: number
  overtimePaidHours: number
  /** `payrollHoursResult.totalPaidHours`, rounded to hundredths: the Save button's figure. */
  totalPaidHours: number
}

export type BookingHoursBreakdownBooking = {
  workStartTime?: string | null
  workEndTime?: string | null
  /** Missing = custom hours. */
  timeSlot?: string | null
  isBreakRemoved?: boolean | null
  otMultiplierOverride?: number | null
}

const WEEKDAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function round(hours: number): number {
  return Math.round((Number(hours) || 0) * 100) / 100
}

function h(hours: number): string {
  return `${round(hours)}h`
}

function isPolicyState(value: unknown): value is PayrollTimePolicyState {
  return Boolean(value && typeof value === 'object' && 'current' in (value as object) && 'scheduled' in (value as object))
}

function dayPolicyOf(policy: OrgPayrollTimePolicy | PayrollTimePolicyState, dayKey: string): OrgPayrollTimePolicy {
  return isPolicyState(policy) ? payrollTimePolicyForDayFromState(policy, dayKey) : policy
}

function validDayKey(dayKey: string | null | undefined): string | null {
  const key = String(dayKey ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null
}

function slotName(slot: string): string {
  switch (namedSlotKind(slot)) {
    case 'AM':
      return 'AM'
    case 'PM':
      return 'PM'
    case 'EVENING':
      return 'Evening'
    case 'OVERTIME':
      return 'Overtime'
    default:
      return 'Full day'
  }
}

/** How a screen reader reads our own text: "06:00–07:00" → "06:00 to 07:00", "2.5h" → "2.5 hours", "×1.5" → "1.5 times". */
function spoken(text: string): string {
  return text
    .replace(/–/g, ' to ')
    .replace(/ − /g, ' less ')
    .replace(/×(\d+(?:\.\d+)?)/g, '$1 times')
    .replace(/(\d+(?:\.\d+)?)h\b/g, (_, n: string) => `${n} ${n === '1' ? 'hour' : 'hours'}`)
}

function row(kind: BookingHoursBreakdownRowKind, label: string, details: string[], hours: number): BookingHoursBreakdownRow {
  const value = h(hours)
  return {
    kind,
    label,
    details,
    value,
    hours: round(hours),
    accessibilityLabel: [label, ...details, value].map(spoken).join(', '),
  }
}

function sumPaid(rows: PayrollHoursSegment[]): number {
  return rows.reduce((sum, segment) => sum + (Number(segment.paidHours) || 0), 0)
}

/**
 * Rulebook 1.62.0 §4.3: the simple breakdown of one booking on one day — the summary line, the header detail and the
 * Normal / Overtime / Total rows — read from `payrollHoursResult` under the policy in effect that day (`policy` may be
 * the policy state). Null with no policy, an invalid day key, or custom hours with no valid times.
 */
export function bookingHoursBreakdownRows(
  policy: OrgPayrollTimePolicy | PayrollTimePolicyState | null | undefined,
  dayKey: string | null | undefined,
  booking: BookingHoursBreakdownBooking | null | undefined,
  timeZone?: string | null
): BookingHoursBreakdown | null {
  const key = validDayKey(dayKey)
  if (!policy || !key || !booking) return null
  const zone = zoneOrLondon(timeZone)
  const startMinutes = parseClockMinutes(booking.workStartTime ?? null)
  const endMinutes = parseClockMinutes(booking.workEndTime ?? null)
  const slot = String(booking.timeSlot ?? '').trim() || 'CUSTOM_HOURS'
  const slotKind = namedSlotKind(slot)
  const custom = slotKind === 'CUSTOM'
  if (custom && (startMinutes == null || endMinutes == null || startMinutes === endMinutes)) return null
  const dayPolicy = dayPolicyOf(policy, key)
  const removed = booking.isBreakRemoved === true
  const paid = payrollHoursResult({
    booking: {
      timeSlot: slot,
      workStartTime: startMinutes == null ? booking.workStartTime : formatClockMinutes(startMinutes),
      workEndTime: endMinutes == null ? booking.workEndTime : formatClockMinutes(endMinutes),
      isBreakRemoved: removed,
      otMultiplierOverride: booking.otMultiplierOverride ?? null,
    },
    dayKey: key,
    policy: dayPolicy,
    timeZone: zone,
  })

  const iso = isoWeekdayOfDayKey(key, zone)
  const weekdayLabel = WEEKDAY_NAMES[iso] || key
  const weekend = weekendRuleForIsoWeekday(iso, dayPolicy)
  const window = weekend && !weekend.allHoursAtMultiplierMode ? weekendFullDayWindow(dayPolicy, weekend) : null
  const dayKind: BookingHoursBreakdownDayKind = weekend ? (window ? 'weekendWindow' : 'weekendAllHours') : 'weekday'
  const half = slotKind === 'AM' || slotKind === 'PM'
  const windowText = window ? `${formatClockMinutes(window.start)}–${formatClockMinutes(window.end)}` : ''
  const dayType = half
    ? `half day (${slotKind})`
    : slotKind === 'EVENING'
      ? 'evening'
      : dayKind === 'weekendAllHours'
        ? 'every hour is overtime'
        : dayKind === 'weekendWindow' && weekend
          ? `full day ${windowText} counts as ${h(weekendCountsAsHours(weekend, dayPolicy))}`
          : 'full day'

  const standard = paid.segments.filter((segment) => segment.kind === 'standardWindow')
  const multiplied = paid.segments.filter((segment) => segment.kind !== 'standardWindow')
  const ranges = payrollLineClockRanges(paid)
  const normalPaid = sumPaid(standard)
  const overtimePaid = sumPaid(multiplied)
  const total = round(paid.totalPaidHours)

  // The day's break, as the pay rule read it (`payrollBreakOnDay`, `unpaidBreakAppliesOnDay`, the segments' own
  // `unpaidBreakHours`). Words only.
  const dayBreak = payrollBreakOnDay(dayPolicy, key, zone)
  const breakUnpaid = unpaidBreakAppliesOnDay(dayPolicy, key, zone)
  const standardBreakHours = standard.reduce((sum, segment) => sum + (segment.unpaidBreakHours ?? 0), 0)
  const coversBreak = (segment: PayrollHoursSegment): boolean => {
    const start = parseClockMinutes(segment.clockStart ?? null)
    const end = parseClockMinutes(segment.clockEnd ?? null)
    if (!dayBreak || !(dayBreak.minutes > 0) || start == null || end == null) return false
    return Math.min(end > start ? end : end + 24 * 60, dayBreak.end) > Math.max(start, dayBreak.start)
  }
  const breakInWindow = Boolean(window && dayBreak && dayBreak.minutes > 0 && Math.min(window.end, dayBreak.end) > Math.max(window.start, dayBreak.start))

  const rows: BookingHoursBreakdownRow[] = []
  const showNormal = standard.length > 0 && (normalPaid > 0.001 || multiplied.length === 0)
  if (showNormal) {
    let detail = ranges.standard.length > 0 ? ranges.standard.join(' and ') : slotName(slot)
    if (normalPaid <= 0.001 && total <= 0.001 && breakUnpaid && !removed) {
      detail += ', inside the unpaid break'
    } else if (dayKind === 'weekendWindow' && !half && window) {
      const segment = standard[0]
      const start = parseClockMinutes(segment.clockStart ?? null)
      const end = parseClockMinutes(segment.clockEnd ?? null)
      const full = standard.length === 1 && start != null && end != null && start <= window.start && end >= window.end
      if (full) {
        detail += breakUnpaid && breakInWindow ? ', counts as a full day, unpaid break allowed for' : ', counts as a full day'
      } else {
        detail += `, part of the ${windowText} window, pro rata`
        if (breakUnpaid && breakInWindow) detail += ' (unpaid break not counted)'
      }
      if (!breakUnpaid && dayBreak && standard.some(coversBreak)) detail += `, ${dayBreak.minutes} min break paid`
    } else if (!half) {
      if (round(standardBreakHours) > 0) detail += `, less ${Math.round(standardBreakHours * 60)} min break`
      else if (!breakUnpaid && dayBreak && standard.some(coversBreak)) detail += `, ${dayBreak.minutes} min break paid`
    }
    rows.push(row('normal', 'Normal hours', [detail], normalPaid))
  }
  if (multiplied.length > 0) {
    const sum = payrollMultipliedHours(paid)
    const details: string[] = []
    if (ranges.overtime.length > 0) details.push(ranges.overtime.join(' and '))
    if (sum) {
      const rate = `${round(sum.clockHours)}h at ×${round(sum.multiplier)}`
      details.push(round(sum.breakHours) > 0 ? `${rate} − ${h(sum.breakHours)} break` : rate)
    }
    rows.push(row('overtime', 'Overtime', details, overtimePaid))
  }
  rows.push(row('total', 'Total paid hours', [], total))

  const range =
    custom && startMinutes != null && endMinutes != null
      ? `${formatClockMinutes(startMinutes)}–${formatClockMinutes(endMinutes)}`
      : slotName(slot)
  const summaryHours = `${round(total)} paid hours`
  return {
    dayKey: key,
    weekdayLabel,
    dayKind,
    dayType,
    headerDetail: `${weekdayLabel}, ${dayType}`,
    range,
    summaryHours,
    summary: `${range} · ${summaryHours}`,
    rows,
    normalPaidHours: round(normalPaid),
    overtimePaidHours: round(overtimePaid),
    totalPaidHours: total,
  }
}

export type BookingHoursBreakdownGroup = BookingHoursBreakdown & {
  /** Every day this breakdown reads the same on, in date order. */
  dayKeys: string[]
  weekdayLabels: string[]
}

export type BookingHoursBreakdownDays = {
  /** One line under the timeline: "06:00–17:30 · 12.25 paid hours", or "… · paid hours vary by day". */
  summary: string
  range: string
  /** "12.25 paid hours", or "paid hours vary by day" when the days differ. */
  summaryHours: string
  /** One breakdown per group of days that read the same once the day name is taken off ("Monday/Tuesday, full day"). */
  groups: BookingHoursBreakdownGroup[]
}

/**
 * Rulebook 1.62.0 §4.3: the breakdown for one pair of times booked on several days. Each day is priced under the
 * working hours in effect on it (`bookingHoursBreakdownRows`); days whose breakdown reads the same once the day name is
 * taken off share one group, headed "Monday/Tuesday, full day". Text grouping only. Null when no day answers.
 */
export function bookingHoursBreakdownDays(
  policy: OrgPayrollTimePolicy | PayrollTimePolicyState | null | undefined,
  dayKeys: ReadonlyArray<string> | null | undefined,
  booking: BookingHoursBreakdownBooking | null | undefined,
  timeZone?: string | null
): BookingHoursBreakdownDays | null {
  const keys = Array.from(new Set((dayKeys ?? []).map((key) => validDayKey(key)).filter((key): key is string => Boolean(key)))).sort()
  const days = keys
    .map((key) => bookingHoursBreakdownRows(policy, key, booking, timeZone))
    .filter((day): day is BookingHoursBreakdown => Boolean(day))
  if (days.length === 0) return null
  const groups = new Map<string, BookingHoursBreakdownGroup>()
  for (const day of days) {
    const signature = `${day.dayKind}|${day.dayType}|${day.rows.map((entry) => `${entry.label}|${entry.details.join('|')}|${entry.value}`).join('||')}`
    const group = groups.get(signature)
    if (!group) {
      groups.set(signature, { ...day, dayKeys: [day.dayKey], weekdayLabels: [day.weekdayLabel] })
      continue
    }
    group.dayKeys.push(day.dayKey)
    if (!group.weekdayLabels.includes(day.weekdayLabel)) group.weekdayLabels.push(day.weekdayLabel)
    group.headerDetail = `${group.weekdayLabels.join('/')}, ${group.dayType}`
  }
  const list = Array.from(groups.values())
  const same = list.every((group) => group.totalPaidHours === list[0].totalPaidHours)
  const summaryHours = same ? list[0].summaryHours : 'paid hours vary by day'
  return { summary: `${list[0].range} · ${summaryHours}`, range: list[0].range, summaryHours, groups: list }
}
