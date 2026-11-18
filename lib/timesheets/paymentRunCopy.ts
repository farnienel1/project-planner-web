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
  addLondonDays,
  dateFromDayKey,
  dayKey,
  daysInLondonMonth,
  londonDateParts,
  londonIsoWeekday,
  londonMidnight,
  formatLongDay,
} from '@/lib/ios-parity/londonTime'
import { computeInvoicingPeriod } from '@/lib/warnings/warningLookahead'
import { selectableTimesheetPaymentRunPeriods } from '@/lib/canonical'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'

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
  timeZone: string = organizationZoneOr()
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

export function formatPaymentPeriodLine(start: Date, end: Date, timeZone: string = organizationZoneOr()): string {
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

export function formatLondonLongDay(date: Date, timeZone: string = organizationZoneOr()): string {
  return formatLongDay(date, timeZone)
}

/** iOS TimesheetPayrollPolicy.payDate — first payment day on/after period end, else first day next month. */
export function payDateForPeriodEnd(
  periodEnd: Date,
  invoicing: OrgInvoicingSettings,
  timeZone: string = organizationZoneOr()
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
  timeZone: string = organizationZoneOr()
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

export function periodStartKey(date: Date, timeZone: string = organizationZoneOr()): string {
  return dayKey(date, timeZone)
}

/** The stored `createdAt` of an organisation document (Timestamp, `{ seconds }`, Date, ms or ISO); null when missing. */
export function organizationCreatedAt(data: Record<string, unknown> | null | undefined): Date | null {
  const raw = data?.createdAt as unknown
  if (raw == null) return null
  if (raw instanceof Date) return raw
  if (typeof (raw as { toDate?: unknown }).toDate === 'function') return (raw as { toDate: () => Date }).toDate()
  if (typeof raw === 'object' && typeof (raw as { seconds?: unknown }).seconds === 'number') return new Date((raw as { seconds: number }).seconds * 1000)
  if (typeof raw === 'number' || typeof raw === 'string') {
    const parsed = new Date(raw)
    return Number.isFinite(parsed.getTime()) ? parsed : null
  }
  return null
}

/**
 * Owner item 6 (17 Nov follow-up): the first day a payment-run picker lists — the organisation's creation day
 * (`organizations/{orgId}.createdAt`, organisation zone); without one, the earliest stored timesheet or booking day
 * given; else null (no bound). A run with a stored sheet is always listed whatever this says (guardrail 3).
 */
export function payRunListStartDayKey(input: {
  createdAt?: Date | null
  storedDayKeys?: ReadonlyArray<string | null | undefined>
  timeZone: string
}): string | null {
  const created = input.createdAt
  // A missing or placeholder creation time (the epoch) is no bound.
  if (created instanceof Date && Number.isFinite(created.getTime()) && created.getTime() > Date.UTC(2000, 0, 1)) {
    return dayKey(created, input.timeZone)
  }
  const stored = (input.storedDayKeys ?? []).filter((key): key is string => typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key))
  return stored.length > 0 ? stored.reduce((earliest, key) => (key < earliest ? key : earliest)) : null
}

export function listSelectablePayPeriods(
  invoicing: OrgInvoicingSettings,
  referenceDate: Date = new Date(),
  count = 120,
  timeZone: string = organizationZoneOr(),
  observedPeriods: Array<{ start: Date; end: Date }> = [],
  /**
   * Owner item 6: leave out generated runs that end before this day (`payRunListStartDayKey`); runs observed from stored
   * sheets (`observedPeriods`) are always kept. Missing: no bound.
   */
  notBeforeDayKey: string | null = null
): Array<{ start: Date; end: Date }> {
  const periods = selectableTimesheetPaymentRunPeriods({
    current: {
      paymentRunMode: invoicing.paymentRunMode,
      ranges: invoicing.paymentRunDateRanges,
      recurringRunStartDay: invoicing.recurringRunStartDay,
      recurringRunEndDay: invoicing.recurringRunEndDay,
    },
    historicalWindows: invoicing.paymentRunHistory,
    observedPeriods: observedPeriods.map((period) => ({
      startDayKey: dayKey(period.start, timeZone),
      endDayKey: dayKey(period.end, timeZone),
    })),
    referenceDayKey: dayKey(referenceDate, timeZone),
    lookbackCount: count,
    timeZone,
  })
  // A generated run that also has a stored sheet is kept too (the dedupe marks it generated, not observed).
  const observedKeys = new Set(observedPeriods.map((period) => `${dayKey(period.start, timeZone)}|${dayKey(period.end, timeZone)}`))
  return periods
    .filter(
      (period) =>
        !notBeforeDayKey ||
        period.source === 'observed' ||
        observedKeys.has(`${period.startDayKey}|${period.endDayKey}`) ||
        period.endDayKey >= notBeforeDayKey
    )
    .map((period) => ({
    start: dateFromDayKey(period.startDayKey, timeZone),
    end: dateFromDayKey(period.endDayKey, timeZone),
  }))
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
  // 1.12.0: the day key's own local midnight (UTC noon is already the next local day at UTC+12 and later).
  return dateFromDayKey(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, timeZone)
}
