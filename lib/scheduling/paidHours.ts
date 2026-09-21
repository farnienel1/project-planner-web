/**
 * iOS parity source: Core/TimesheetPayrollPolicy.swift wall-clock + unpaid break
 * Spec: docs/ios-parity/sections/22-daily-overview.md
 *
 * Shared by Daily Overview and job Scheduling so custom hours never fall back
 * to a flat 8h when workStartTime / workEndTime are present.
 */

const FALLBACK_STANDARD_PAID_HOURS = 8
const FALLBACK_UNPAID_BREAK_MINUTES = 30
const FALLBACK_BREAK_START = '12:00'
const FALLBACK_BREAK_END = '12:30'

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

function slotHours(timeSlot?: string): number | null {
  const slot = String(timeSlot || '').toUpperCase().replace(/_/g, ' ').trim()
  if (slot === 'AM' || slot === 'PM' || slot.includes('MORNING') || slot.includes('AFTERNOON')) return 4
  if (slot === 'EVENING' || slot === 'OVERTIME') return 4
  return null
}

/**
 * Paid hours for a booking. Custom hours use start/end wall-clock minus the
 * unpaid break when the span covers the lunch window, unless the break was removed.
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
  const fromSlot = slotHours(input.timeSlot)
  if (fromSlot != null) return fromSlot
  return standard
}

export function customHoursRangeLabel(input: {
  timeSlot?: string
  workStartTime?: string
  workEndTime?: string
}): string | null {
  const slot = String(input.timeSlot || '').toUpperCase().replace(/_/g, ' ')
  const isCustom = slot.includes('CUSTOM')
  if (!isCustom && !input.workStartTime && !input.workEndTime) return null
  if (input.workStartTime && input.workEndTime) {
    return `${input.workStartTime}–${input.workEndTime}`
  }
  return isCustom ? 'Custom hours' : null
}
