import { isAfter } from 'date-fns'
import type { OrgInvoicingSettings } from '@/lib/settings/organizationSettings'
import { capitalizeDay } from '@/lib/settings/organizationSettings'
import { computeInvoicingPeriod } from '@/lib/warnings/warningLookahead'
import {
  LONDON_TIME_ZONE,
  addLondonDays,
  dateFromDayKey,
  dayKey,
  londonMidnight,
  startOfLondonWeek,
} from '@/lib/ios-parity/londonTime'
import { formatPaymentPeriodLine } from '@/lib/timesheets/paymentRunCopy'

export type WeeklyReportPeriodMode = 'invoicing' | 'week' | 'custom'

export type ReportPeriod = {
  start: Date
  end: Date
  label: string
}

export type InvoicingPeriodOption = ReportPeriod & {
  id: string
  isCurrent: boolean
}

export function formatReportPeriodLabel(start: Date, end: Date, timeZone: string = LONDON_TIME_ZONE): string {
  return formatPaymentPeriodLine(start, end, timeZone)
}

export function formatInvoicingPeriodDescription(invoicing: OrgInvoicingSettings): string {
  if (invoicing.paymentRunMode === 'recurring_timeframe') {
    return `${capitalizeDay(invoicing.recurringRunStartDay)} – ${capitalizeDay(invoicing.recurringRunEndDay)}`
  }
  const ranges = invoicing.paymentRunDateRanges.filter((range) => range.startDay > 0 && range.endDay > 0)
  if (ranges.length === 0) return 'Payment run periods'
  return ranges.map((range) => `${range.startDay}–${range.endDay}`).join(' · ')
}

function invoicingPeriodContainingDate(
  referenceDate: Date,
  invoicing: OrgInvoicingSettings,
  timeZone: string = LONDON_TIME_ZONE
): ReportPeriod {
  const { start, end } = computeInvoicingPeriod(referenceDate, invoicing, timeZone)
  return {
    start,
    end,
    label: formatReportPeriodLabel(start, end, timeZone),
  }
}

function previousInvoicingPeriod(
  period: ReportPeriod,
  invoicing: OrgInvoicingSettings,
  timeZone: string = LONDON_TIME_ZONE
): ReportPeriod {
  const anchor = addLondonDays(londonMidnight(period.start, timeZone), -1, timeZone)
  return invoicingPeriodContainingDate(anchor, invoicing, timeZone)
}

/** Two years of payment runs. The picker only stores date labels, so this does not load historical bookings. */
export const INVOICING_PERIOD_HISTORY_DAYS = 730

/** Stops a one-day run from building hundreds of rows. Weekly history for two years is about 105. */
export const INVOICING_PERIOD_HISTORY_CAP = 120

/**
 * Invoicing periods for the report picker, current first.
 * Omit `count` for two years of history (capped). Pass `count` for a fixed recent slice.
 */
export function listInvoicingPeriodOptions(
  invoicing: OrgInvoicingSettings,
  referenceDate: Date = new Date(),
  count?: number,
  timeZone: string = LONDON_TIME_ZONE
): InvoicingPeriodOption[] {
  const options: InvoicingPeriodOption[] = []
  const limit = count ?? INVOICING_PERIOD_HISTORY_CAP
  const cutoff = addLondonDays(londonMidnight(referenceDate, timeZone), -INVOICING_PERIOD_HISTORY_DAYS, timeZone)
  let current = invoicingPeriodContainingDate(referenceDate, invoicing, timeZone)
  const seen = new Set<string>()

  while (options.length < limit) {
    const id = `${dayKey(current.start, timeZone)}_${dayKey(current.end, timeZone)}`
    if (seen.has(id)) break
    seen.add(id)
    options.push({
      ...current,
      id,
      isCurrent: options.length === 0,
    })
    if (count == null && !isAfter(current.start, cutoff)) break
    const previous = previousInvoicingPeriod(current, invoicing, timeZone)
    if (previous.start.getTime() >= current.start.getTime()) break
    current = previous
  }

  return options
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

/** A `YYYY-MM-DD` value as organisation-zone midnight (never `new Date(key)`, which is UTC). */
function zoneDayFromValue(value: string, timeZone: string): Date | null {
  const raw = String(value || '').trim().slice(0, 10)
  if (DAY_KEY.test(raw)) return dateFromDayKey(raw, timeZone)
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : londonMidnight(parsed, timeZone)
}

export function resolveWeekPeriod(weekStartValue: string, timeZone: string = LONDON_TIME_ZONE): ReportPeriod {
  const day = zoneDayFromValue(weekStartValue, timeZone) ?? londonMidnight(new Date(), timeZone)
  const start = startOfLondonWeek(day, timeZone)
  const end = addLondonDays(start, 6, timeZone)
  const label = new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short', year: 'numeric' }).format(start)
  return { start, end, label: `Week of ${label}` }
}

export function resolveCustomPeriod(
  customStart: string,
  customEnd: string,
  timeZone: string = LONDON_TIME_ZONE
): ReportPeriod | null {
  const start = zoneDayFromValue(customStart, timeZone)
  const end = zoneDayFromValue(customEnd, timeZone)
  if (!start || !end) return null
  if (dayKey(start, timeZone) > dayKey(end, timeZone)) return null
  return {
    start,
    end,
    label: formatReportPeriodLabel(start, end, timeZone),
  }
}

export function resolveReportPeriod({
  mode,
  invoicing,
  invoicingPeriodId,
  weekStart,
  customStart,
  customEnd,
  referenceDate = new Date(),
  timeZone = LONDON_TIME_ZONE,
}: {
  mode: WeeklyReportPeriodMode
  invoicing?: OrgInvoicingSettings
  invoicingPeriodId?: string
  weekStart: string
  customStart: string
  customEnd: string
  referenceDate?: Date
  timeZone?: string
}): ReportPeriod | null {
  if (mode === 'week') {
    return resolveWeekPeriod(weekStart, timeZone)
  }

  if (mode === 'custom') {
    return resolveCustomPeriod(customStart, customEnd, timeZone)
  }

  if (!invoicing) return null
  const options = listInvoicingPeriodOptions(invoicing, referenceDate, undefined, timeZone)
  const selected =
    (invoicingPeriodId && options.find((option) => option.id === invoicingPeriodId)) || options[0]
  if (!selected) return null
  return {
    start: selected.start,
    end: selected.end,
    label: selected.label,
  }
}

export function isDateWithinReportPeriod(date: Date, period: ReportPeriod, timeZone: string = LONDON_TIME_ZONE): boolean {
  const key = dayKey(date, timeZone)
  return key >= dayKey(period.start, timeZone) && key <= dayKey(period.end, timeZone)
}

export function eachDayInReportPeriod(period: ReportPeriod, timeZone: string = LONDON_TIME_ZONE): Date[] {
  const days: Date[] = []
  const endKey = dayKey(period.end, timeZone)
  let cursor = londonMidnight(period.start, timeZone)
  while (dayKey(cursor, timeZone) <= endKey && days.length <= 400) {
    days.push(cursor)
    cursor = addLondonDays(cursor, 1, timeZone)
  }
  return days
}
