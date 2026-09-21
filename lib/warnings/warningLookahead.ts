import type { OrgInvoicingSettings, OrgWarningDetectionSettings } from '@/lib/settings/organizationSettings'
import { WEEKDAY_OPTIONS } from '@/lib/settings/organizationSettings'
import {
  LONDON_TIME_ZONE,
  addLondonDays,
  dayKey,
  daysInLondonMonth,
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

function weekdayOnOrBefore(reference: Date, isoWeekday: number, timeZone: string): Date {
  const current = londonIsoWeekday(reference, timeZone)
  const delta = current >= isoWeekday ? current - isoWeekday : current + 7 - isoWeekday
  return addLondonDays(londonMidnight(reference, timeZone), -delta, timeZone)
}

function weekdayOnOrAfter(reference: Date, isoWeekday: number, timeZone: string): Date {
  const current = londonIsoWeekday(reference, timeZone)
  const delta = current <= isoWeekday ? isoWeekday - current : 7 - current + isoWeekday
  return addLondonDays(londonMidnight(reference, timeZone), delta, timeZone)
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
  invoicing: OrgInvoicingSettings,
  timeZone: string
): InvoicingPeriodRange {
  const dayOfMonth = londonDayOfMonth(referenceDate, timeZone)
  const ranges = invoicing.paymentRunDateRanges.filter((range) => range.startDay > 0 && range.endDay > 0)
  const monthEnd = daysInLondonMonth(referenceDate, timeZone)

  for (const range of ranges) {
    if (dayOfMonth >= range.startDay && dayOfMonth <= range.endDay) {
      const clampedEnd = Math.min(range.endDay, monthEnd)
      return {
        start: londonDateWithDay(referenceDate, range.startDay, timeZone),
        end: londonDateWithDay(referenceDate, clampedEnd, timeZone),
      }
    }
  }

  if (ranges.length > 0) {
    const fallback = ranges.reduce((latest, range) => (range.endDay > latest.endDay ? range : latest))
    const clampedEnd = Math.min(fallback.endDay, monthEnd)
    return {
      start: londonDateWithDay(referenceDate, fallback.startDay, timeZone),
      end: londonDateWithDay(referenceDate, clampedEnd, timeZone),
    }
  }

  return {
    start: londonMidnight(referenceDate, timeZone),
    end: londonDateWithDay(referenceDate, monthEnd, timeZone),
  }
}

function londonDateWithDay(reference: Date, day: number, timeZone: string): Date {
  const key = dayKey(reference, timeZone)
  const [y, m] = key.split('-').map(Number)
  const clamped = Math.min(Math.max(day, 1), daysInLondonMonth(reference, timeZone))
  return londonMidnight(new Date(Date.UTC(y, m - 1, clamped, 12, 0, 0)), timeZone)
}

function resolveRecurringInvoicingPeriod(
  referenceDate: Date,
  invoicing: OrgInvoicingSettings,
  timeZone: string
): InvoicingPeriodRange {
  const startWd = isoWeekdayIndex(invoicing.recurringRunStartDay)
  const endWd = isoWeekdayIndex(invoicing.recurringRunEndDay)
  const ref = londonMidnight(referenceDate, timeZone)

  let periodStart = weekdayOnOrBefore(ref, startWd, timeZone)
  let periodEnd = weekdayOnOrAfter(periodStart, endWd, timeZone)
  if (dayKey(periodEnd, timeZone) < dayKey(periodStart, timeZone)) {
    periodEnd = addLondonDays(periodEnd, 7, timeZone)
  }

  if (dayKey(ref, timeZone) > dayKey(periodEnd, timeZone)) {
    periodStart = addLondonDays(periodStart, 7, timeZone)
    periodEnd = weekdayOnOrAfter(periodStart, endWd, timeZone)
    if (dayKey(periodEnd, timeZone) < dayKey(periodStart, timeZone)) {
      periodEnd = addLondonDays(periodEnd, 7, timeZone)
    }
  }

  return { start: periodStart, end: periodEnd }
}

/** Current invoicing / payment run period containing the reference date (org-country zone). */
export function computeInvoicingPeriod(
  referenceDate: Date,
  invoicing: OrgInvoicingSettings,
  timeZone: string = LONDON_TIME_ZONE
): InvoicingPeriodRange {
  const ref = londonMidnight(referenceDate, timeZone)
  return invoicing.paymentRunMode === 'date_ranges'
    ? resolveDateRangeInvoicingPeriod(ref, invoicing, timeZone)
    : resolveRecurringInvoicingPeriod(ref, invoicing, timeZone)
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
  invoicing?: OrgInvoicingSettings,
  timeZone: string = LONDON_TIME_ZONE
): WarningCoverageWindow {
  const today = londonMidnight(referenceDate, timeZone)

  switch (warningDetection.clashLookaheadMode) {
    case 'numberOfDays': {
      const days = Math.max(1, Math.min(warningDetection.clashLookaheadDays || 1, 366))
      return { start: today, end: addLondonDays(today, days - 1, timeZone) }
    }
    case 'endOfInvoicingPeriod': {
      if (!invoicing) {
        return { start: startOfLondonWeek(today, timeZone), end: endOfLondonWeek(today, timeZone) }
      }
      return computeInvoicingPeriod(today, invoicing, timeZone)
    }
    case 'endOfWorkingWeek':
    default:
      return { start: startOfLondonWeek(today, timeZone), end: endOfLondonWeek(today, timeZone) }
  }
}

export function computeWarningLookaheadEnd(
  referenceDate: Date,
  warningDetection: OrgWarningDetectionSettings,
  invoicing?: OrgInvoicingSettings,
  timeZone: string = LONDON_TIME_ZONE
): Date {
  return computeWarningCoverageWindow(referenceDate, warningDetection, invoicing, timeZone).end
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

export function isDateWithinWarningWindow(
  date: Date,
  windowStart: Date,
  windowEnd: Date,
  timeZone: string = LONDON_TIME_ZONE
): boolean {
  const key = dayKey(date, timeZone)
  return key >= dayKey(windowStart, timeZone) && key <= dayKey(windowEnd, timeZone)
}

/** Iterate each calendar day in an inclusive window in the org zone. */
export function eachLondonDay(start: Date, end: Date, timeZone: string = LONDON_TIME_ZONE): Date[] {
  const days: Date[] = []
  let cursor = londonMidnight(start, timeZone)
  const lastKey = dayKey(end, timeZone)
  while (dayKey(cursor, timeZone) <= lastKey) {
    days.push(cursor)
    cursor = addLondonDays(cursor, 1, timeZone)
    if (days.length > 400) break
  }
  return days
}
