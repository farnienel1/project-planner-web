import {
  addDays,
  endOfMonth,
  getDate,
  getISODay,
  isAfter,
  isBefore,
  startOfDay,
} from 'date-fns'
import type { OrgInvoicingSettings, OrgWarningDetectionSettings } from '@/lib/settings/organizationSettings'
import { WEEKDAY_OPTIONS } from '@/lib/settings/organizationSettings'

function isoWeekdayIndex(day: string): number {
  const normalized = day.trim().toLowerCase()
  const index = WEEKDAY_OPTIONS.indexOf(normalized as (typeof WEEKDAY_OPTIONS)[number])
  return index >= 0 ? index + 1 : 5
}

function weekdayOnOrBefore(reference: Date, isoWeekday: number): Date {
  const current = getISODay(reference)
  const delta = current >= isoWeekday ? current - isoWeekday : current + 7 - isoWeekday
  return startOfDay(addDays(reference, -delta))
}

function weekdayOnOrAfter(reference: Date, isoWeekday: number): Date {
  const current = getISODay(reference)
  const delta = current <= isoWeekday ? isoWeekday - current : 7 - current + isoWeekday
  return startOfDay(addDays(reference, delta))
}

/** Friday of the current working week (Mon–Fri), matching iOS endOfWorkingWeek. */
export function endOfWorkingWeek(referenceDate: Date): Date {
  return weekdayOnOrBefore(referenceDate, 5)
}

export type InvoicingPeriodRange = {
  start: Date
  end: Date
}

function resolveDateRangeInvoicingPeriod(
  referenceDate: Date,
  invoicing: OrgInvoicingSettings
): InvoicingPeriodRange {
  const dayOfMonth = getDate(referenceDate)
  const ranges = invoicing.paymentRunDateRanges.filter((range) => range.startDay > 0 && range.endDay > 0)

  for (const range of ranges) {
    if (dayOfMonth >= range.startDay && dayOfMonth <= range.endDay) {
      const monthEnd = endOfMonth(referenceDate)
      const clampedEnd = Math.min(range.endDay, getDate(monthEnd))
      const start = new Date(referenceDate)
      start.setDate(range.startDay)
      const end = new Date(referenceDate)
      end.setDate(clampedEnd)
      return { start: startOfDay(start), end: startOfDay(end) }
    }
  }

  if (ranges.length > 0) {
    const fallback = ranges.reduce((latest, range) => (range.endDay > latest.endDay ? range : latest))
    const monthEnd = endOfMonth(referenceDate)
    const clampedEnd = Math.min(fallback.endDay, getDate(monthEnd))
    const start = new Date(referenceDate)
    start.setDate(fallback.startDay)
    const end = new Date(referenceDate)
    end.setDate(clampedEnd)
    return { start: startOfDay(start), end: startOfDay(end) }
  }

  return { start: startOfDay(referenceDate), end: startOfDay(endOfMonth(referenceDate)) }
}

function resolveRecurringInvoicingPeriod(
  referenceDate: Date,
  invoicing: OrgInvoicingSettings
): InvoicingPeriodRange {
  const startWd = isoWeekdayIndex(invoicing.recurringRunStartDay)
  const endWd = isoWeekdayIndex(invoicing.recurringRunEndDay)
  const ref = startOfDay(referenceDate)

  let periodStart = weekdayOnOrBefore(ref, startWd)
  let periodEnd = weekdayOnOrAfter(periodStart, endWd)
  if (isBefore(periodEnd, periodStart)) {
    periodEnd = addDays(periodEnd, 7)
  }

  if (isAfter(ref, periodEnd)) {
    periodStart = addDays(periodStart, 7)
    periodEnd = weekdayOnOrAfter(periodStart, endWd)
    if (isBefore(periodEnd, periodStart)) {
      periodEnd = addDays(periodEnd, 7)
    }
  }

  return { start: startOfDay(periodStart), end: startOfDay(periodEnd) }
}

/** Current invoicing / payment run period containing the reference date (iOS parity). */
export function computeInvoicingPeriod(
  referenceDate: Date,
  invoicing: OrgInvoicingSettings
): InvoicingPeriodRange {
  const ref = startOfDay(referenceDate)
  return invoicing.paymentRunMode === 'date_ranges'
    ? resolveDateRangeInvoicingPeriod(ref, invoicing)
    : resolveRecurringInvoicingPeriod(ref, invoicing)
}

function endOfDateRangeInvoicingPeriod(referenceDate: Date, invoicing: OrgInvoicingSettings): Date {
  return resolveDateRangeInvoicingPeriod(referenceDate, invoicing).end
}

function endOfRecurringInvoicingPeriod(referenceDate: Date, invoicing: OrgInvoicingSettings): Date {
  return resolveRecurringInvoicingPeriod(referenceDate, invoicing).end
}

export function computeWarningLookaheadEnd(
  referenceDate: Date,
  warningDetection: OrgWarningDetectionSettings,
  invoicing?: OrgInvoicingSettings
): Date {
  const ref = startOfDay(referenceDate)

  switch (warningDetection.clashLookaheadMode) {
    case 'numberOfDays': {
      const days = Math.max(1, warningDetection.clashLookaheadDays || 1)
      return startOfDay(addDays(ref, days - 1))
    }
    case 'endOfInvoicingPeriod':
      if (!invoicing) return endOfWorkingWeek(ref)
      return invoicing.paymentRunMode === 'date_ranges'
        ? endOfDateRangeInvoicingPeriod(ref, invoicing)
        : endOfRecurringInvoicingPeriod(ref, invoicing)
    case 'endOfWorkingWeek':
    default:
      return endOfWorkingWeek(ref)
  }
}

export function isDateWithinWarningWindow(date: Date, windowStart: Date, windowEnd: Date): boolean {
  const day = startOfDay(date)
  return !isBefore(day, windowStart) && !isAfter(day, windowEnd)
}
