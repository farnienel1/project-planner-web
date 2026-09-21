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
  const rounded = Math.round(hours * 2) / 2
  if (Math.abs(rounded - Math.trunc(rounded)) < 0.01) return String(Math.trunc(rounded))
  return rounded.toFixed(1)
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
    let minutes = end - start
    if (minutes < 0) minutes += 24 * 60
    if (!input.isBreakRemoved) {
      const breakStart = parseMinutes(input.breakWindowStart || FALLBACK_BREAK_START)
      const breakEnd = parseMinutes(input.breakWindowEnd || FALLBACK_BREAK_END)
      const unpaid = input.unpaidBreakMinutes ?? FALLBACK_UNPAID_BREAK_MINUTES
      if (unpaid > 0 && breakStart != null && breakEnd != null) {
        const spanStart = start
        const spanEnd = start + minutes
        const b0 = breakStart < start && breakEnd < start ? breakStart + 24 * 60 : breakStart
        const b1 = breakEnd <= breakStart ? breakEnd + 24 * 60 : breakEnd
        const overlap = Math.max(0, Math.min(spanEnd, b1) - Math.max(spanStart, b0))
        if (overlap > 0) minutes -= Math.min(unpaid, overlap)
      }
    }
    return Math.max(0, Math.round((minutes / 60) * 10) / 10)
  }
  return standard
}

export function customHoursRangeLabel(input: {
  timeSlot?: string
  workStartTime?: string
  workEndTime?: string
}): string | null {
  if (namedSlotKind(input.timeSlot) !== 'custom') return null
  if (input.workStartTime && input.workEndTime) {
    return `${input.workStartTime}–${input.workEndTime}`
  }
  return 'Custom hours'
}

/** Raw overtime hours outside the standard window — not the already-multiplied equivalent. */
export function overtimeRawHours(input: {
  timeSlot?: string
  workStartTime?: string
  workEndTime?: string
  standardDayStart?: string
  standardDayEnd?: string
}): number {
  const kind = namedSlotKind(input.timeSlot)
  if (kind === 'am' || kind === 'pm' || kind === 'full' || kind === 'evening') return 0
  const start = parseMinutes(input.workStartTime)
  const end = parseMinutes(input.workEndTime)
  if (start == null || end == null || end === start) return 0
  let span = end - start
  if (span < 0) span += 24 * 60
  const spanEnd = start + span
  const windowStart = parseMinutes(input.standardDayStart || FALLBACK_DAY_START) ?? 7 * 60 + 30
  const windowEnd = parseMinutes(input.standardDayEnd || FALLBACK_DAY_END) ?? 16 * 60
  let ot = 0
  if (start < windowStart) ot += Math.min(spanEnd, windowStart) - start
  if (spanEnd > windowEnd) ot += spanEnd - Math.max(start, windowEnd)
  return Math.max(0, Math.round((ot / 60) * 10) / 10)
}

export function formatOvertimeEquation(rawHours: number, multiplier = FALLBACK_OT_MULTIPLIER): string {
  const equivalent = Math.round(rawHours * multiplier * 10) / 10
  return `${formatHoursLabel(rawHours)} × ${formatHoursLabel(multiplier)} = ${formatHoursLabel(equivalent)}`
}

export type HoursBreakdown = {
  kind: NamedSlotKind
  slotLabel: string
  paidHours: number
  rangeLabel: string | null
  overtimeRawHours: number
  overtimeMultiplier: number
  overtimeEquivalentHours: number
  overtimeEquation: string | null
  headline: string
  detail: string
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
  const paidHours = estimatedPaidHours({ ...input, standardPaidHours: standard })
  const rangeLabel = customHoursRangeLabel(input)
  const rawOt = overtimeRawHours(input)
  const equivalent = Math.round(rawOt * multiplier * 10) / 10
  const overtimeEquation = rawOt > 0 ? formatOvertimeEquation(rawOt, multiplier) : null

  if (kind === 'am' || kind === 'pm' || kind === 'evening') {
    return {
      kind,
      slotLabel,
      paidHours,
      rangeLabel: null,
      overtimeRawHours: 0,
      overtimeMultiplier: multiplier,
      overtimeEquivalentHours: 0,
      overtimeEquation: null,
      headline: `${formatHoursLabel(paidHours)}h paid`,
      detail: `${slotLabel} = ${formatHoursLabel(paidHours)} paid hours`,
    }
  }
  if (kind === 'full' || (kind === 'unknown' && !input.workStartTime && !input.workEndTime)) {
    return {
      kind: kind === 'unknown' ? 'full' : kind,
      slotLabel: kind === 'unknown' ? 'Full day' : slotLabel,
      paidHours,
      rangeLabel: null,
      overtimeRawHours: 0,
      overtimeMultiplier: multiplier,
      overtimeEquivalentHours: 0,
      overtimeEquation: null,
      headline: `${formatHoursLabel(paidHours)}h paid`,
      detail: `Full day = ${formatHoursLabel(standard)} paid hours`,
    }
  }

  const breakNote = input.isBreakRemoved
    ? 'unpaid break removed'
    : `${input.unpaidBreakMinutes ?? FALLBACK_UNPAID_BREAK_MINUTES} min unpaid break when it overlaps`
  const range = rangeLabel || (input.workStartTime && input.workEndTime ? `${input.workStartTime}–${input.workEndTime}` : slotLabel)
  return {
    kind,
    slotLabel,
    paidHours,
    rangeLabel: range,
    overtimeRawHours: rawOt,
    overtimeMultiplier: multiplier,
    overtimeEquivalentHours: equivalent,
    overtimeEquation,
    headline: `${formatHoursLabel(paidHours)}h paid`,
    detail: overtimeEquation ? `${range} · overtime ${overtimeEquation}` : `${range} · ${breakNote}`,
  }
}
