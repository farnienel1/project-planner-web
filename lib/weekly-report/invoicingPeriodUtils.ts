import { addDays, format, isAfter, isBefore, startOfDay, subDays } from 'date-fns'
import { endOfWeek, startOfWeek } from 'date-fns'
import type { OrgInvoicingSettings } from '@/lib/settings/organizationSettings'
import { capitalizeDay } from '@/lib/settings/organizationSettings'
import { computeInvoicingPeriod } from '@/lib/warnings/warningLookahead'

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

export function formatReportPeriodLabel(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear()
  if (sameYear && start.getMonth() === end.getMonth()) {
    return `${format(start, 'd')} – ${format(end, 'd MMM yyyy')}`
  }
  if (sameYear) {
    return `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`
  }
  return `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`
}

export function formatInvoicingPeriodDescription(invoicing: OrgInvoicingSettings): string {
  if (invoicing.paymentRunMode === 'recurring_timeframe') {
    return `${capitalizeDay(invoicing.recurringRunStartDay)} – ${capitalizeDay(invoicing.recurringRunEndDay)}`
  }
  const ranges = invoicing.paymentRunDateRanges.filter((range) => range.startDay > 0 && range.endDay > 0)
  if (ranges.length === 0) return 'Payment run periods'
  return ranges.map((range) => `${range.startDay}–${range.endDay}`).join(' · ')
}

function invoicingPeriodContainingDate(referenceDate: Date, invoicing: OrgInvoicingSettings): ReportPeriod {
  const { start, end } = computeInvoicingPeriod(referenceDate, invoicing)
  return {
    start,
    end,
    label: formatReportPeriodLabel(start, end),
  }
}

function previousInvoicingPeriod(period: ReportPeriod, invoicing: OrgInvoicingSettings): ReportPeriod {
  const anchor = subDays(startOfDay(period.start), 1)
  return invoicingPeriodContainingDate(anchor, invoicing)
}

/** Recent invoicing periods for the report picker (current first). */
export function listInvoicingPeriodOptions(
  invoicing: OrgInvoicingSettings,
  referenceDate: Date = new Date(),
  count = 6
): InvoicingPeriodOption[] {
  const options: InvoicingPeriodOption[] = []
  let current = invoicingPeriodContainingDate(referenceDate, invoicing)

  for (let index = 0; index < count; index += 1) {
    options.push({
      ...current,
      id: `${format(current.start, 'yyyy-MM-dd')}_${format(current.end, 'yyyy-MM-dd')}`,
      isCurrent: index === 0,
    })
    current = previousInvoicingPeriod(current, invoicing)
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
}: {
  mode: WeeklyReportPeriodMode
  invoicing?: OrgInvoicingSettings
  invoicingPeriodId?: string
  weekStart: string
  customStart: string
  customEnd: string
  referenceDate?: Date
}): ReportPeriod | null {
  if (mode === 'week') {
    return resolveWeekPeriod(weekStart)
  }

  if (mode === 'custom') {
    return resolveCustomPeriod(customStart, customEnd)
  }

  if (!invoicing) return null
  const options = listInvoicingPeriodOptions(invoicing, referenceDate)
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
