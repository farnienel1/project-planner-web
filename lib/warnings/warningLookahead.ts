import { coverageWindow, invoicingPeriod, parsePaymentRunDateRanges } from '@/lib/canonical'
import {
  DEFAULT_INVOICING,
  type OrgInvoicingSettings,
  type OrgWarningDetectionSettings,
} from '@/lib/settings/organizationSettings'
import {
  LONDON_TIME_ZONE,
  addLondonDays,
  dateFromDayKey,
  dayKey,
  startOfLondonWeek,
  londonMidnight,
} from '@/lib/ios-parity/londonTime'

function periodFromCanonical(
  referenceDate: Date,
  invoicing: OrgInvoicingSettings,
  timeZone: string
) {
  const window = invoicingPeriod({
    referenceIso: referenceDate.toISOString(),
    timeZone,
    paymentRunMode: invoicing.paymentRunMode,
    ranges: parsePaymentRunDateRanges({ paymentRunDateRanges: invoicing.paymentRunDateRanges }),
    recurringRunStartDay: invoicing.recurringRunStartDay,
    recurringRunEndDay: invoicing.recurringRunEndDay,
  })
  return {
    start: dateFromDayKey(window.startDayKey, timeZone),
    end: dateFromDayKey(window.endDayKey, timeZone),
  }
}

/** Friday of the current organisation week. Saturday and Sunday are the include-weekends toggle. */
export function endOfWorkingWeek(referenceDate: Date): Date {
  return addLondonDays(startOfLondonWeek(referenceDate), 4)
}

export type InvoicingPeriodRange = {
  start: Date
  end: Date
}

export type WarningCoverageWindow = {
  start: Date
  end: Date
}

/** Current invoicing / payment run period containing the reference date (org-country zone). */
export function computeInvoicingPeriod(
  referenceDate: Date,
  invoicing: OrgInvoicingSettings,
  timeZone: string = LONDON_TIME_ZONE
): InvoicingPeriodRange {
  return periodFromCanonical(londonMidnight(referenceDate, timeZone), invoicing, timeZone)
}

/**
 * Inclusive scan window matching iOS OrgWarningDetectionSettings.coverageStart/End.
 * - numberOfDays: today … today+(N-1)
 * - Full week: Monday … Friday of the current week (past days included). Weekends stay off unless include-weekends is on.
 * - Invoicing period: payment-run segment containing today (past days included)
 */
export function computeWarningCoverageWindow(
  referenceDate: Date,
  warningDetection: OrgWarningDetectionSettings,
  invoicing?: OrgInvoicingSettings,
  timeZone: string = LONDON_TIME_ZONE
): WarningCoverageWindow {
  const settings = invoicing ?? DEFAULT_INVOICING
  const window = coverageWindow({
    referenceIso: referenceDate.toISOString(),
    timeZone,
    clashLookaheadMode: warningDetection.clashLookaheadMode,
    clashLookaheadDays: warningDetection.clashLookaheadDays,
    paymentRunMode: settings.paymentRunMode,
    ranges: parsePaymentRunDateRanges({ paymentRunDateRanges: settings.paymentRunDateRanges }),
    recurringRunStartDay: settings.recurringRunStartDay,
    recurringRunEndDay: settings.recurringRunEndDay,
  })
  return {
    start: dateFromDayKey(window.startDayKey, timeZone),
    end: dateFromDayKey(window.endDayKey, timeZone),
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
