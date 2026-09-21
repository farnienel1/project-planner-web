/**
 * iOS parity source: Core/TimesheetPayrollPolicy.swift wall-clock + unpaid break
 * Spec: docs/ios-parity/sections/22-daily-overview.md
 *
 * Shared by Daily Overview and job Scheduling so custom hours never fall back
 * to a flat 8h when workStartTime / workEndTime are present.
 *
 * Named slots (AM / PM / full day) always use the slot, never leftover custom
 * clock times — switching the editor to half/full day must not keep showing
 * the previous custom span.
 */

const FALLBACK_STANDARD_PAID_HOURS = 8
const FALLBACK_UNPAID_BREAK_MINUTES = 30
const FALLBACK_BREAK_START = '12:00'
const FALLBACK_BREAK_END = '12:30'
const FALLBACK_DAY_START = '07:30'
const FALLBACK_DAY_END = '16:00'
const FALLBACK_OT_MULTIPLIER = 1.5

function minutesFromHourValue(n: number): number | null {
  if (!Number.isFinite(n) || n < 0) return null
  // Whole-day minutes (0–1439). Values like 480 mean 08:00.
  if (n >= 24 && n < 24 * 60) return Math.round(n)
  // Decimal or whole hours (8 or 8.5 → 08:00 / 08:30).
  if (n <= 24) return Math.round(n * 60)
  return null
}

export function parseMinutes(hhmm?: string | number | Date | null): number | null {
  if (hhmm == null) return null
  if (hhmm instanceof Date && !Number.isNaN(hhmm.getTime())) {
    return hhmm.getHours() * 60 + hhmm.getMinutes()
  }
  if (typeof hhmm === 'number' && Number.isFinite(hhmm)) {
    return minutesFromHourValue(hhmm)
  }
  if (typeof hhmm === 'object' && hhmm && 'toDate' in (hhmm as object)) {
    const date = (hhmm as { toDate?: () => Date }).toDate?.()
    if (date) return parseMinutes(date)
  }
  const raw = String(hhmm).trim()
  if (!raw) return null
  const iso = raw.match(/T(\d{2}):(\d{2})(?::\d{2})?/)
  if (iso) return Number(iso[1]) * 60 + Number(iso[2])
  const ampm = raw.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(AM|PM)$/i)
  if (ampm) {
    let hours = Number(ampm[1])
    const minutes = Number(ampm[2] || '0')
    const mer = ampm[3].toUpperCase()
    if (mer === 'AM' && hours === 12) hours = 0
    if (mer === 'PM' && hours !== 12) hours += 12
    return hours * 60 + minutes
  }
  const m = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(raw)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  const compact = /^(\d{2})(\d{2})$/.exec(raw)
  if (compact) return Number(compact[1]) * 60 + Number(compact[2])
  const numeric = Number(raw)
  if (raw !== '' && Number.isFinite(numeric)) return minutesFromHourValue(numeric)
  return null
}

export function formatHoursLabel(hours: number): string {
  const rounded = Math.round(hours * 100) / 100
  if (Math.abs(rounded - Math.trunc(rounded)) < 0.001) return String(Math.trunc(rounded))
  return String(Number(rounded.toFixed(2)))
}

export type NamedSlotKind = 'am' | 'pm' | 'full' | 'custom' | 'evening' | 'unknown'

export function namedSlotKind(timeSlot?: string): NamedSlotKind {
  const slot = String(timeSlot || '')
    .toUpperCase()
    .replace(/_/g, ' ')
    .trim()
  if (slot === 'AM' || slot.includes('MORNING')) return 'am'
  if (slot === 'PM' || slot.includes('AFTERNOON')) return 'pm'
  if (slot.includes('FULL')) return 'full'
  if (slot.includes('CUSTOM')) return 'custom'
  if (slot === 'EVENING' || slot === 'OVERTIME') return 'evening'
  return 'unknown'
}

export function namedSlotLabel(timeSlot?: string): string {
  switch (namedSlotKind(timeSlot)) {
    case 'am':
      return 'Morning (AM)'
    case 'pm':
      return 'Afternoon (PM)'
    case 'full':
      return 'Full day'
    case 'custom':
      return 'Custom hours'
    case 'evening':
      return 'Evening'
    default:
      return String(timeSlot || '').replace(/_/g, ' ').trim() || 'Full day'
  }
}

function halfDayHours(standardPaidHours: number): number {
  return Math.round((standardPaidHours / 2) * 10) / 10
}

/**
 * Paid hours for a booking.
 * AM / PM / full day ignore leftover custom clock times so the editor and
 * week grid show half-day or full-day hours after you switch away from custom.
 */
export function estimatedPaidHours(input: {
  timeSlot?: string
  workStartTime?: string
  workEndTime?: string
  isBreakRemoved?: boolean
  unpaidBreakMinutes?: number
  breakWindowStart?: string
  breakWindowEnd?: string
  standardPaidHours?: number
}): number {
  const standard = input.standardPaidHours ?? FALLBACK_STANDARD_PAID_HOURS
  const kind = namedSlotKind(input.timeSlot)
  if (kind === 'am' || kind === 'pm' || kind === 'evening') return halfDayHours(standard)
  if (kind === 'full') return standard

  const start = parseMinutes(input.workStartTime)
  const end = parseMinutes(input.workEndTime)
  if (start != null && end != null && end !== start) {
    const span = workSpan(start, end)
    const breakMins = unpaidBreakOverlapMinutes({
      start: span.start,
      spanEnd: span.end,
      isBreakRemoved: input.isBreakRemoved,
      unpaidBreakMinutes: input.unpaidBreakMinutes,
      breakWindowStart: input.breakWindowStart,
      breakWindowEnd: input.breakWindowEnd,
    })
    return Math.max(0, Math.round(((span.minutes - breakMins) / 60) * 10) / 10)
  }
  return standard
}

export function formatClockFromMinutes(minutes: number): string {
  const wrapped = ((Math.round(minutes) % (24 * 60)) + 24 * 60) % (24 * 60)
  const hours = Math.floor(wrapped / 60)
  const mins = wrapped % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function formatClockRange(
  start?: string | number | Date | null,
  end?: string | number | Date | null,
  separator = ' - '
): string | null {
  const startMin = parseMinutes(start)
  const endMin = parseMinutes(end)
  if (startMin == null || endMin == null) return null
  return `${formatClockFromMinutes(startMin)}${separator}${formatClockFromMinutes(endMin)}`
}

export function customHoursRangeLabel(input: {
  timeSlot?: string
  workStartTime?: string
  workEndTime?: string
}): string | null {
  if (namedSlotKind(input.timeSlot) !== 'custom') return null
  return formatClockRange(input.workStartTime, input.workEndTime, '–') || 'Custom hours'
}

function workSpan(start: number, end: number): { start: number; end: number; minutes: number } {
  let minutes = end - start
  if (minutes < 0) minutes += 24 * 60
  return { start, end: start + minutes, minutes }
}

function overlapMinutes(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
}

function unpaidBreakOverlapMinutes(input: {
  start: number
  spanEnd: number
  isBreakRemoved?: boolean
  unpaidBreakMinutes?: number
  breakWindowStart?: string
  breakWindowEnd?: string
}): number {
  if (input.isBreakRemoved) return 0
  const unpaid = input.unpaidBreakMinutes ?? FALLBACK_UNPAID_BREAK_MINUTES
  if (unpaid <= 0) return 0
  const breakStart = parseMinutes(input.breakWindowStart || FALLBACK_BREAK_START)
  const breakEnd = parseMinutes(input.breakWindowEnd || FALLBACK_BREAK_END)
  if (breakStart == null || breakEnd == null) return 0
  const b0 = breakStart < input.start && breakEnd < input.start ? breakStart + 24 * 60 : breakStart
  const b1 = breakEnd <= breakStart ? breakEnd + 24 * 60 : breakEnd
  const overlap = overlapMinutes(input.start, input.spanEnd, b0, b1)
  if (overlap <= 0) return 0
  return Math.min(unpaid, overlap)
}

export type OvertimeSegment = { start: number; end: number }

export function overtimeSegments(input: {
  timeSlot?: string
  workStartTime?: string
  workEndTime?: string
  standardDayStart?: string
  standardDayEnd?: string
}): OvertimeSegment[] {
  const kind = namedSlotKind(input.timeSlot)
  if (kind === 'am' || kind === 'pm' || kind === 'full' || kind === 'evening') return []
  const start = parseMinutes(input.workStartTime)
  const end = parseMinutes(input.workEndTime)
  if (start == null || end == null || end === start) return []
  const span = workSpan(start, end)
  const windowStart = parseMinutes(input.standardDayStart || FALLBACK_DAY_START) ?? 7 * 60 + 30
  const windowEnd = parseMinutes(input.standardDayEnd || FALLBACK_DAY_END) ?? 16 * 60
  const segments: OvertimeSegment[] = []
  if (span.start < windowStart) {
    segments.push({ start: span.start, end: Math.min(span.end, windowStart) })
  }
  if (span.end > windowEnd) {
    segments.push({ start: Math.max(span.start, windowEnd), end: span.end })
  }
  return segments.filter((seg) => seg.end > seg.start)
}

export function overtimeSegmentsLabel(input: {
  timeSlot?: string
  workStartTime?: string
  workEndTime?: string
  standardDayStart?: string
  standardDayEnd?: string
}): string | null {
  const segments = overtimeSegments(input)
  if (segments.length === 0) return null
  return segments
    .map((seg) => `${formatClockFromMinutes(seg.start)} - ${formatClockFromMinutes(seg.end)}`)
    .join(' + ')
}

/** Raw overtime hours outside the standard window — not the already-multiplied equivalent. */
export function overtimeRawHours(input: {
  timeSlot?: string
  workStartTime?: string
  workEndTime?: string
  standardDayStart?: string
  standardDayEnd?: string
}): number {
  const ot = overtimeSegments(input).reduce((sum, seg) => sum + (seg.end - seg.start), 0)
  return Math.max(0, Math.round((ot / 60) * 10) / 10)
}

export function formatOvertimeEquation(rawHours: number, multiplier = FALLBACK_OT_MULTIPLIER): string {
  const equivalent = Math.round(rawHours * multiplier * 100) / 100
  return `${formatHoursLabel(rawHours)} × ${formatHoursLabel(multiplier)} = ${formatHoursLabel(equivalent)}`
}

export type HoursBreakdownLine = {
  kind: 'working' | 'standard' | 'break' | 'overtime-heading' | 'overtime' | 'slot' | 'total'
  label: string
  value: string
}

export type HoursBreakdown = {
  kind: NamedSlotKind
  slotLabel: string
  paidHours: number
  clockPaidHours: number
  totalPaidHours: number
  rangeLabel: string | null
  workingRangeLabel: string | null
  standardRangeLabel: string
  breakHours: number
  overtimeRawHours: number
  overtimeMultiplier: number
  overtimeEquivalentHours: number
  overtimeEquation: string | null
  overtimeSegmentsLabel: string | null
  overtimeLine: string | null
  headline: string
  detail: string
  lines: HoursBreakdownLine[]
}

export function hoursBreakdown(input: {
  timeSlot?: string
  workStartTime?: string
  workEndTime?: string
  isBreakRemoved?: boolean
  unpaidBreakMinutes?: number
  breakWindowStart?: string
  breakWindowEnd?: string
  standardPaidHours?: number
  standardDayStart?: string
  standardDayEnd?: string
  overtimeMultiplier?: number
}): HoursBreakdown {
  const standard = input.standardPaidHours ?? FALLBACK_STANDARD_PAID_HOURS
  const multiplier = input.overtimeMultiplier ?? FALLBACK_OT_MULTIPLIER
  const kind = namedSlotKind(input.timeSlot)
  const slotLabel = namedSlotLabel(input.timeSlot)
  const clockPaidHours = estimatedPaidHours({ ...input, standardPaidHours: standard })
  const rangeLabel = customHoursRangeLabel(input)
  const dayStart = input.standardDayStart || FALLBACK_DAY_START
  const dayEnd = input.standardDayEnd || FALLBACK_DAY_END
  const standardWindowLabel = `${dayStart} - ${dayEnd}`
  const rawOt = overtimeRawHours(input)
  const equivalent = Math.round(rawOt * multiplier * 100) / 100
  const overtimeEquation = rawOt > 0 ? formatOvertimeEquation(rawOt, multiplier) : null
  const segmentsLabel = overtimeSegmentsLabel(input)
  const overtimeLine =
    overtimeEquation && segmentsLabel ? `${segmentsLabel} = ${overtimeEquation}` : overtimeEquation

  const named = (nextKind: NamedSlotKind, nextSlot: string, paid: number, detail: string): HoursBreakdown => ({
    kind: nextKind,
    slotLabel: nextSlot,
    paidHours: paid,
    clockPaidHours: paid,
    totalPaidHours: paid,
    rangeLabel: null,
    workingRangeLabel: null,
    standardRangeLabel: standardWindowLabel,
    breakHours: 0,
    overtimeRawHours: 0,
    overtimeMultiplier: multiplier,
    overtimeEquivalentHours: 0,
    overtimeEquation: null,
    overtimeSegmentsLabel: null,
    overtimeLine: null,
    headline: `Total paid hours ${formatHoursLabel(paid)}`,
    detail,
    lines: [
      { kind: 'slot', label: nextSlot, value: `${formatHoursLabel(paid)} paid hours` },
      { kind: 'total', label: 'Total paid hours', value: formatHoursLabel(paid) },
    ],
  })

  if (kind === 'am' || kind === 'pm' || kind === 'evening') {
    return named(kind, slotLabel, clockPaidHours, `${slotLabel} = ${formatHoursLabel(clockPaidHours)} paid hours`)
  }
  if (kind === 'full' || (kind === 'unknown' && !input.workStartTime && !input.workEndTime)) {
    const nextKind = kind === 'unknown' ? 'full' : kind
    const nextSlot = kind === 'unknown' ? 'Full day' : slotLabel
    return named(nextKind, nextSlot, clockPaidHours, `Full day = ${formatHoursLabel(standard)} paid hours`)
  }

  const start = parseMinutes(input.workStartTime)
  const end = parseMinutes(input.workEndTime)
  const workingRangeLabel = formatClockRange(input.workStartTime, input.workEndTime) || rangeLabel
  const windowStart = parseMinutes(dayStart) ?? 7 * 60 + 30
  const windowEnd = parseMinutes(dayEnd) ?? 16 * 60
  let standardRangeLabel = standardWindowLabel
  let breakHours = 0
  let standardPaid = standard
  if (start != null && end != null && end !== start) {
    const span = workSpan(start, end)
    const standardOverlap = overlapMinutes(span.start, span.end, windowStart, windowEnd)
    if (standardOverlap > 0) {
      standardRangeLabel = `${formatClockFromMinutes(Math.max(span.start, windowStart))} - ${formatClockFromMinutes(Math.min(span.end, windowEnd))}`
    }
    const breakMins = unpaidBreakOverlapMinutes({
      start: span.start,
      spanEnd: span.end,
      isBreakRemoved: input.isBreakRemoved,
      unpaidBreakMinutes: input.unpaidBreakMinutes,
      breakWindowStart: input.breakWindowStart,
      breakWindowEnd: input.breakWindowEnd,
    })
    breakHours = Math.round((breakMins / 60) * 10) / 10
    const standardClock = Math.round((standardOverlap / 60) * 10) / 10
    standardPaid = Math.max(0, Math.round((standardClock - breakHours) * 10) / 10)
  }

  const totalPaidHours = Math.round((standardPaid + equivalent) * 100) / 100
  const lines: HoursBreakdownLine[] = []
  if (workingRangeLabel && workingRangeLabel !== 'Custom hours') {
    lines.push({ kind: 'working', label: 'Working hours', value: workingRangeLabel })
  } else {
    lines.push({ kind: 'working', label: 'Working hours', value: slotLabel })
  }
  lines.push({ kind: 'standard', label: 'Normal working hours', value: standardRangeLabel })
  if (input.isBreakRemoved) {
    lines.push({ kind: 'break', label: 'Break', value: 'unpaid break removed' })
  } else if (breakHours > 0) {
    const breakMins = input.unpaidBreakMinutes ?? FALLBACK_UNPAID_BREAK_MINUTES
    lines.push({
      kind: 'break',
      label: `Minus ${breakMins} minute break`,
      value: `-${formatHoursLabel(breakHours)}`,
    })
  }
  if (overtimeLine) {
    lines.push({ kind: 'overtime-heading', label: 'Overtime', value: '' })
    lines.push({ kind: 'overtime', label: 'Overtime', value: overtimeLine })
  }
  lines.push({ kind: 'total', label: 'Total paid hours', value: formatHoursLabel(totalPaidHours) })

  const range = workingRangeLabel || rangeLabel || slotLabel
  return {
    kind,
    slotLabel,
    paidHours: clockPaidHours,
    clockPaidHours,
    totalPaidHours,
    rangeLabel: range,
    workingRangeLabel,
    standardRangeLabel,
    breakHours,
    overtimeRawHours: rawOt,
    overtimeMultiplier: multiplier,
    overtimeEquivalentHours: equivalent,
    overtimeEquation,
    overtimeSegmentsLabel: segmentsLabel,
    overtimeLine,
    headline: `Total paid hours ${formatHoursLabel(totalPaidHours)}`,
    detail: overtimeLine ? overtimeLine : `${range}${breakHours > 0 ? ` · break -${formatHoursLabel(breakHours)}` : ''}`,
    lines,
  }
}
