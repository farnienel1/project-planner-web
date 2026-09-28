import { addDays, format, isAfter, isBefore, startOfDay } from 'date-fns'
import { endOfWeek, startOfWeek } from 'date-fns'
import type { OrgInvoicingSettings } from '@/lib/settings/organizationSettings'
import { capitalizeDay } from '@/lib/settings/organizationSettings'
import { computeInvoicingPeriod } from '@/lib/warnings/warningLookahead'
import { LONDON_TIME_ZONE, addLondonDays, dayKey, londonMidnight } from '@/lib/ios-parity/londonTime'
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

export function resolveWeekPeriod(weekStartValue: string): ReportPeriod {
  const start = startOfWeek(new Date(weekStartValue), { weekStartsOn: 1 })
  const end = endOfWeek(start, { weekStartsOn: 1 })
  return {
    start: startOfDay(start),
    end: startOfDay(end),
    label: `Week of ${format(start, 'd MMM yyyy')}`,
  }
}

export function resolveCustomPeriod(customStart: string, customEnd: string): ReportPeriod | null {
  const start = startOfDay(new Date(customStart))
  const end = startOfDay(new Date(customEnd))
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  if (isAfter(start, end)) return null
  return {
    start,
    end,
    label: formatReportPeriodLabel(start, end),
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
    return resolveWeekPeriod(weekStart)
  }

  if (mode === 'custom') {
    return resolveCustomPeriod(customStart, customEnd)
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

export function isDateWithinReportPeriod(date: Date, period: ReportPeriod): boolean {
  const day = startOfDay(date)
  return !isBefore(day, period.start) && !isAfter(day, period.end)
}

export function eachDayInReportPeriod(period: ReportPeriod): Date[] {
  const days: Date[] = []
  let cursor = startOfDay(period.start)
  while (!isAfter(cursor, period.end)) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return days
}
