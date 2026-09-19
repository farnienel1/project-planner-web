import { endOfMonth } from 'date-fns'
import type { OrgInvoicingSettings, OrgWarningDetectionSettings } from '@/lib/settings/organizationSettings'
import { WEEKDAY_OPTIONS } from '@/lib/settings/organizationSettings'
import {
  addLondonDays,
  dayKey,
  endOfLondonWeek,
  londonDayOfMonth,
  londonIsoWeekday,
  londonMidnight,
  startOfLondonWeek,
} from '@/lib/ios-parity/londonTime'

function isoWeekdayIndex(day: string): number {
  const normalized = day.trim().toLowerCase()
  const index = WEEKDAY_OPTIONS.indexOf(normalized as (typeof WEEKDAY_OPTIONS)[number])
  return index >= 0 ? index + 1 : 5
}

function weekdayOnOrBefore(reference: Date, isoWeekday: number): Date {
  const current = londonIsoWeekday(reference)
  const delta = current >= isoWeekday ? current - isoWeekday : current + 7 - isoWeekday
  return addLondonDays(londonMidnight(reference), -delta)
}

function weekdayOnOrAfter(reference: Date, isoWeekday: number): Date {
  const current = londonIsoWeekday(reference)
  const delta = current <= isoWeekday ? isoWeekday - current : 7 - current + isoWeekday
  return addLondonDays(londonMidnight(reference), delta)
}

/** Sunday of the current London week — iOS Full week coverageEnd. */
export function endOfWorkingWeek(referenceDate: Date): Date {
  return endOfLondonWeek(referenceDate)
}

export type InvoicingPeriodRange = {
  start: Date
  end: Date
}

export type WarningCoverageWindow = {
  start: Date
  end: Date
}

function resolveDateRangeInvoicingPeriod(
  referenceDate: Date,
  invoicing: OrgInvoicingSettings
): InvoicingPeriodRange {
  const dayOfMonth = londonDayOfMonth(referenceDate)
  const ranges = invoicing.paymentRunDateRanges.filter((range) => range.startDay > 0 && range.endDay > 0)
  const monthEnd = londonDayOfMonth(endOfMonth(londonMidnight(referenceDate)))

  for (const range of ranges) {
    if (dayOfMonth >= range.startDay && dayOfMonth <= range.endDay) {
      const clampedEnd = Math.min(range.endDay, monthEnd)
      return {
        start: londonDateWithDay(referenceDate, range.startDay),
        end: londonDateWithDay(referenceDate, clampedEnd),
      }
    }
  }

  if (ranges.length > 0) {
    const fallback = ranges.reduce((latest, range) => (range.endDay > latest.endDay ? range : latest))
    const clampedEnd = Math.min(fallback.endDay, monthEnd)
    return {
      start: londonDateWithDay(referenceDate, fallback.startDay),
      end: londonDateWithDay(referenceDate, clampedEnd),
    }
  }

  return {
    start: londonMidnight(referenceDate),
    end: londonDateWithDay(referenceDate, monthEnd),
  }
}

function londonDateWithDay(reference: Date, day: number): Date {
  const key = dayKey(reference)
  const [y, m] = key.split('-').map(Number)
  return londonMidnight(new Date(Date.UTC(y, m - 1, day, 12, 0, 0)))
}

function resolveRecurringInvoicingPeriod(
  referenceDate: Date,
  invoicing: OrgInvoicingSettings
): InvoicingPeriodRange {
  const startWd = isoWeekdayIndex(invoicing.recurringRunStartDay)
  const endWd = isoWeekdayIndex(invoicing.recurringRunEndDay)
  const ref = londonMidnight(referenceDate)

  let periodStart = weekdayOnOrBefore(ref, startWd)
  let periodEnd = weekdayOnOrAfter(periodStart, endWd)
  if (dayKey(periodEnd) < dayKey(periodStart)) {
    periodEnd = addLondonDays(periodEnd, 7)
  }

  if (dayKey(ref) > dayKey(periodEnd)) {
    periodStart = addLondonDays(periodStart, 7)
    periodEnd = weekdayOnOrAfter(periodStart, endWd)
    if (dayKey(periodEnd) < dayKey(periodStart)) {
      periodEnd = addLondonDays(periodEnd, 7)
    }
  }

  return { start: periodStart, end: periodEnd }
}

/** Current invoicing / payment run period containing the reference date (iOS parity). */
export function computeInvoicingPeriod(
  referenceDate: Date,
  invoicing: OrgInvoicingSettings
): InvoicingPeriodRange {
  const ref = londonMidnight(referenceDate)
  return invoicing.paymentRunMode === 'date_ranges'
    ? resolveDateRangeInvoicingPeriod(ref, invoicing)
    : resolveRecurringInvoicingPeriod(ref, invoicing)
}

/**
 * Inclusive scan window matching iOS OrgWarningDetectionSettings.coverageStart/End.
 * - numberOfDays: today … today+(N-1)
 * - Full week: Monday … Sunday of the current week (past days included)
 * - Invoicing period: payment-run segment containing today (past days included)
 */
export function computeWarningCoverageWindow(
  referenceDate: Date,
  warningDetection: OrgWarningDetectionSettings,
  invoicing?: OrgInvoicingSettings
): WarningCoverageWindow {
  const today = londonMidnight(referenceDate)

  switch (warningDetection.clashLookaheadMode) {
    case 'numberOfDays': {
      const days = Math.max(1, Math.min(warningDetection.clashLookaheadDays || 1, 366))
      return { start: today, end: addLondonDays(today, days - 1) }
    }
    case 'endOfInvoicingPeriod': {
      if (!invoicing) {
        return { start: startOfLondonWeek(today), end: endOfLondonWeek(today) }
      }
      return computeInvoicingPeriod(today, invoicing)
    }
    case 'endOfWorkingWeek':
    default:
      return { start: startOfLondonWeek(today), end: endOfLondonWeek(today) }
  }
}

export function computeWarningLookaheadEnd(
  referenceDate: Date,
  warningDetection: OrgWarningDetectionSettings,
  invoicing?: OrgInvoicingSettings
): Date {
  return computeWarningCoverageWindow(referenceDate, warningDetection, invoicing).end
}

function formatScanDay(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

/** Copy for the days-ahead stepper — N includes today (iOS numberOfDays). */
export function formatNumberOfDaysScanSummary(days: number, referenceDate = new Date()): string {
  const n = Math.max(1, Math.min(Math.round(days) || 1, 365))
  const window = computeWarningCoverageWindow(referenceDate, {
    detectClashes: true,
    clashLookaheadMode: 'numberOfDays',
    clashLookaheadDays: n,
    includeWeekendsForUnbookedLabour: false,
    excludedUserIdsFromUnbookedWarnings: [],
  })
  const start = formatScanDay(window.start)
  const end = formatScanDay(window.end)
  if (n === 1) return `Scans today only (${start}). Today counts as 1 day.`
  if (n === 2) {
    return `Scans today and tomorrow (${start}–${end}). The day you are on is included.`
  }
  return `Scans ${n} calendar days including today: ${start} through ${end}.`
}

export function isDateWithinWarningWindow(date: Date, windowStart: Date, windowEnd: Date): boolean {
  const key = dayKey(date)
  return key >= dayKey(windowStart) && key <= dayKey(windowEnd)
}

/** Iterate each London calendar day in an inclusive window. */
export function eachLondonDay(start: Date, end: Date): Date[] {
  const days: Date[] = []
  let cursor = londonMidnight(start)
  const lastKey = dayKey(end)
  while (dayKey(cursor) <= lastKey) {
    days.push(cursor)
    cursor = addLondonDays(cursor, 1)
    if (days.length > 400) break
  }
  return days
}
