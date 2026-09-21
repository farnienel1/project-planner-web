/**
 * iOS parity source: Core/InvoicingPeriodResolver.swift, Core/TimesheetPayrollPolicy.swift payDate,
 * Views/InvoicingView.swift paymentSummaryCard (current-period dates, not first range).
 * Spec: docs/ios-parity/sections/17-timesheets.md
 *
 * Calendar math uses the organisation origin-country time zone, not the device locale.
 */
import type { OrgInvoicingSettings } from '@/lib/settings/organizationSettings'
import { capitalizeDay, WEEKDAY_OPTIONS } from '@/lib/settings/organizationSettings'
import {
  LONDON_TIME_ZONE,
  addLondonDays,
  dayKey,
  daysInLondonMonth,
  londonDateParts,
  londonIsoWeekday,
  londonMidnight,
  formatLongDay,
} from '@/lib/ios-parity/londonTime'
import { computeInvoicingPeriod } from '@/lib/warnings/warningLookahead'

export type PaymentRunCardCopy = {
  periodLine: string
  paidLine: string
  note: string
  periodStart: Date
  periodEnd: Date
  payDate: Date | null
}

export function currentPaymentRunCopy(
  invoicing: OrgInvoicingSettings,
  referenceDate: Date = new Date(),
  timeZone: string = LONDON_TIME_ZONE
): PaymentRunCardCopy {
  const period = computeInvoicingPeriod(referenceDate, invoicing, timeZone)
  const payDate = payDateForPeriodEnd(period.end, invoicing, timeZone)
  return {
    periodLine: formatPaymentPeriodLine(period.start, period.end, timeZone),
    paidLine: payDate
      ? `Paid on ${formatLongDay(payDate, timeZone)}`
      : invoicing.paymentDateMode === 'recurring_date'
        ? `Paid every ${capitalizeDay(invoicing.recurringPaymentDay)}`
        : 'Paid on your organisation payment dates',
    note: invoicing.noteToUsers.trim(),
    periodStart: period.start,
    periodEnd: period.end,
    payDate,
  }
}

/** iOS OrganizationInvoicingSettings.recurringRunDisplaySummary */
export function recurringRunDisplaySummary(invoicing: OrgInvoicingSettings): string {
  return `In arrears: ${capitalizeDay(invoicing.recurringRunStartDay)} to ${capitalizeDay(invoicing.recurringRunEndDay)} (of the previous week)`
}

export function formatPaymentPeriodLine(start: Date, end: Date, timeZone: string = LONDON_TIME_ZONE): string {
  const startParts = londonDateParts(start, timeZone)
  const endParts = londonDateParts(end, timeZone)
  if (startParts.year === endParts.year && startParts.month === endParts.month) {
    return `${startParts.day} – ${endParts.day} ${endParts.monthName} ${endParts.year}`
  }
  if (startParts.year === endParts.year) {
    return `${startParts.day} ${startParts.monthName} – ${endParts.day} ${endParts.monthName} ${endParts.year}`
  }
  return `${formatLongDay(start, timeZone)} – ${formatLongDay(end, timeZone)}`
}

export function formatLondonLongDay(date: Date, timeZone: string = LONDON_TIME_ZONE): string {
  return formatLongDay(date, timeZone)
}

/** iOS TimesheetPayrollPolicy.payDate — first payment day on/after period end, else first day next month. */
export function payDateForPeriodEnd(
  periodEnd: Date,
  invoicing: OrgInvoicingSettings,
  timeZone: string = LONDON_TIME_ZONE
): Date | null {
  const periodEndDay = londonMidnight(periodEnd, timeZone)

  if (invoicing.paymentRunMode === 'recurring_timeframe' && invoicing.paymentDateMode === 'recurring_date') {
    const dayAfter = addLondonDays(periodEndDay, 1, timeZone)
    return nextZoneWeekday(invoicing.recurringPaymentDay, dayAfter, timeZone)
  }

  const days = paymentDayNumbers(invoicing.paymentDates)
  return specificMonthPayDate(periodEndDay, days, timeZone)
}

export function listPreviousPayPeriods(
  invoicing: OrgInvoicingSettings,
  referenceDate: Date = new Date(),
  count = 24,
  timeZone: string = LONDON_TIME_ZONE
): Array<{ start: Date; end: Date }> {
  const periods: Array<{ start: Date; end: Date }> = []
  let cursor = computeInvoicingPeriod(referenceDate, invoicing, timeZone).start
  for (let index = 0; index < Math.max(1, count); index += 1) {
    const previous = computeInvoicingPeriod(addLondonDays(cursor, -1, timeZone), invoicing, timeZone)
    if (dayKey(previous.start, timeZone) === dayKey(cursor, timeZone)) break
    periods.push(previous)
    cursor = previous.start
  }
  return periods
}

export function periodStartKey(date: Date, timeZone: string = LONDON_TIME_ZONE): string {
  return dayKey(date, timeZone)
}

function paymentDayNumbers(dates: string[]): number[] {
  return dates
    .map((value) => Number(String(value).replace(/\D/g, '')))
    .filter((day) => Number.isFinite(day) && day >= 1 && day <= 31)
    .sort((a, b) => a - b)
}

function specificMonthPayDate(periodEnd: Date, paymentDays: number[], timeZone: string): Date | null {
  if (paymentDays.length === 0) return null
  const endKey = dayKey(periodEnd, timeZone)
  const { y, m } = zoneYmd(periodEnd, timeZone)
  const daysInMonth = daysInLondonMonth(periodEnd, timeZone)

  for (const day of paymentDays) {
    const candidate = zoneDateWithYmd(y, m, Math.min(day, daysInMonth), timeZone)
    if (dayKey(candidate, timeZone) >= endKey) return candidate
  }

  const nextMonth = m === 12 ? 1 : m + 1
  const nextYear = m === 12 ? y + 1 : y
  const nextMonthEnd = daysInLondonMonth(zoneDateWithYmd(nextYear, nextMonth, 1, timeZone), timeZone)
  return zoneDateWithYmd(nextYear, nextMonth, Math.min(paymentDays[0], nextMonthEnd), timeZone)
}

function nextZoneWeekday(dayName: string, onOrAfter: Date, timeZone: string): Date {
  const target = WEEKDAY_OPTIONS.indexOf(dayName.trim().toLowerCase() as (typeof WEEKDAY_OPTIONS)[number])
  const iso = target >= 0 ? target + 1 : 5
  let cursor = londonMidnight(onOrAfter, timeZone)
  for (let step = 0; step < 7; step += 1) {
    if (londonIsoWeekday(cursor, timeZone) === iso) return cursor
    cursor = addLondonDays(cursor, 1, timeZone)
  }
  return cursor
}

function zoneYmd(date: Date, timeZone: string): { y: number; m: number; d: number } {
  const [y, m, d] = dayKey(date, timeZone).split('-').map(Number)
  return { y, m, d }
}

function zoneDateWithYmd(year: number, month: number, day: number, timeZone: string): Date {
  return londonMidnight(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)), timeZone)
}
