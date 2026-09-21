/**
 * iOS parity source: Core/InvoicingPeriodResolver.swift, Core/TimesheetPayrollPolicy.swift payDate,
 * Views/InvoicingView.swift paymentSummaryCard (current-period dates, not first range).
 * Spec: docs/ios-parity/sections/17-timesheets.md
 */
import type { OrgInvoicingSettings } from '@/lib/settings/organizationSettings'
import { capitalizeDay, WEEKDAY_OPTIONS } from '@/lib/settings/organizationSettings'
import { addLondonDays, dayKey, daysInLondonMonth, londonIsoWeekday, londonMidnight } from '@/lib/ios-parity/londonTime'
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
  referenceDate: Date = new Date()
): PaymentRunCardCopy {
  const period = computeInvoicingPeriod(referenceDate, invoicing)
  const payDate = payDateForPeriodEnd(period.end, invoicing)
  return {
    periodLine: formatPaymentPeriodLine(period.start, period.end),
    paidLine: payDate
      ? `Paid on ${formatLondonLongDay(payDate)}`
      : invoicing.paymentDateMode === 'recurring_date'
        ? `Paid every ${capitalizeDay(invoicing.recurringPaymentDay)}`
        : 'Paid on your organisation payment dates',
    note: invoicing.noteToUsers.trim(),
    periodStart: period.start,
    periodEnd: period.end,
    payDate,
  }
}

export function formatPaymentPeriodLine(start: Date, end: Date): string {
  const startParts = londonDateParts(start)
  const endParts = londonDateParts(end)
  if (startParts.year === endParts.year && startParts.month === endParts.month) {
    return `${startParts.day} – ${endParts.day} ${endParts.monthName} ${endParts.year}`
  }
  if (startParts.year === endParts.year) {
    return `${startParts.day} ${startParts.monthName} – ${endParts.day} ${endParts.monthName} ${endParts.year}`
  }
  return `${formatLondonLongDay(start)} – ${formatLondonLongDay(end)}`
}

export function formatLondonLongDay(date: Date): string {
  const parts = londonDateParts(date)
  return `${parts.day} ${parts.monthName} ${parts.year}`
}

/** iOS TimesheetPayrollPolicy.payDate — first payment day on/after period end, else first day next month. */
export function payDateForPeriodEnd(periodEnd: Date, invoicing: OrgInvoicingSettings): Date | null {
  const periodEndDay = londonMidnight(periodEnd)

  if (invoicing.paymentRunMode === 'recurring_timeframe' && invoicing.paymentDateMode === 'recurring_date') {
    const dayAfter = addLondonDays(periodEndDay, 1)
    return nextLondonWeekday(invoicing.recurringPaymentDay, dayAfter)
  }

  const days = paymentDayNumbers(invoicing.paymentDates)
  return specificMonthPayDate(periodEndDay, days)
}

export function listPreviousPayPeriods(
  invoicing: OrgInvoicingSettings,
  referenceDate: Date = new Date(),
  count = 24
): Array<{ start: Date; end: Date }> {
  const periods: Array<{ start: Date; end: Date }> = []
  let cursor = computeInvoicingPeriod(referenceDate, invoicing).start
  for (let index = 0; index < Math.max(1, count); index += 1) {
    const previous = computeInvoicingPeriod(addLondonDays(cursor, -1), invoicing)
    if (dayKey(previous.start) === dayKey(cursor)) break
    periods.push(previous)
    cursor = previous.start
  }
  return periods
}

export function periodStartKey(date: Date): string {
  return dayKey(date)
}

function paymentDayNumbers(dates: string[]): number[] {
  return dates
    .map((value) => Number(String(value).replace(/\D/g, '')))
    .filter((day) => Number.isFinite(day) && day >= 1 && day <= 31)
    .sort((a, b) => a - b)
}

function specificMonthPayDate(periodEnd: Date, paymentDays: number[]): Date | null {
  if (paymentDays.length === 0) return null
  const endKey = dayKey(periodEnd)
  const { y, m } = londonYmd(periodEnd)
  const daysInMonth = daysInLondonMonth(periodEnd)

  for (const day of paymentDays) {
    const candidate = londonDateWithYmd(y, m, Math.min(day, daysInMonth))
    if (dayKey(candidate) >= endKey) return candidate
  }

  const nextMonth = m === 12 ? 1 : m + 1
  const nextYear = m === 12 ? y + 1 : y
  const nextMonthEnd = daysInLondonMonth(londonDateWithYmd(nextYear, nextMonth, 1))
  return londonDateWithYmd(nextYear, nextMonth, Math.min(paymentDays[0], nextMonthEnd))
}

function nextLondonWeekday(dayName: string, onOrAfter: Date): Date {
  const target = WEEKDAY_OPTIONS.indexOf(dayName.trim().toLowerCase() as (typeof WEEKDAY_OPTIONS)[number])
  const iso = target >= 0 ? target + 1 : 5
  let cursor = londonMidnight(onOrAfter)
  for (let step = 0; step < 7; step += 1) {
    if (londonIsoWeekday(cursor) === iso) return cursor
    cursor = addLondonDays(cursor, 1)
  }
  return cursor
}

function londonYmd(date: Date): { y: number; m: number; d: number } {
  const [y, m, d] = dayKey(date).split('-').map(Number)
  return { y, m, d }
}

function londonDateWithYmd(year: number, month: number, day: number): Date {
  return londonMidnight(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)))
}

function londonDateParts(date: Date): { day: number; month: number; year: number; monthName: string } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const map: Record<string, string> = {}
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  return {
    day: Number(map.day),
    month: Number(
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', month: 'numeric' }).format(date)
    ),
    year: Number(map.year),
    monthName: map.month,
  }
}
