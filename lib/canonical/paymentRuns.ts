/**
 * Payment runs: when a run is paid, and the run that is active today.
 *
 * A run is the work period. Recurring runs (e.g. Monday–Sunday) are paid in arrears on the pay
 * weekday after the period ends (the following Friday). Date-range runs (e.g. 1st–15th) are paid
 * on that run's payment day: the first such day on or after the run ends, else that day next
 * month (short months clamp). This is the same payday the timesheet reminders use
 * (`paymentDateAfterPeriodEnd`, `paymentWeekdayAfterPeriodEnd` in `timesheetSubmission.ts`).
 *
 * The active run is the work period containing today in the organisation zone (`invoicingPeriod`).
 * When no date-range run contains today, `invoicingPeriod` falls back to the run with the latest
 * end day; that is the canonical answer (iOS used to show "Not configured" there).
 */
import { invoicingPeriod, normalizePaymentRunRange, type DayWindow } from './engine'
import { parseInvoicing, type OrgInvoicingSettings } from './organizationSettings'
import { paymentDateAfterPeriodEnd, paymentWeekdayAfterPeriodEnd } from './timesheetSubmission'

const DEFAULT_ZONE = 'Europe/London'
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export type PaymentRunInvoicing = Pick<
  OrgInvoicingSettings,
  | 'paymentRunMode'
  | 'paymentDateMode'
  | 'recurringRunStartDay'
  | 'recurringRunEndDay'
  | 'recurringPaymentDay'
  | 'paymentRunDateRanges'
  | 'paymentDates'
>

export type ActivePaymentRunSummary =
  | { notConfigured: true }
  | {
      notConfigured: false
      /** Work period start, organisation-zone `YYYY-MM-DD`. */
      start: string
      /** Work period end, inclusive. */
      end: string
      /** Pay date, or null when no payment day is set for this run. */
      payDate: string | null
      /** e.g. `Mon 26 Oct – Sun 1 Nov · paid Fri 6 Nov` */
      label: string
    }

function zone(timeZone?: string | null): string {
  return String(timeZone || '').trim() || DEFAULT_ZONE
}

function monthDay(value: unknown): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : 0
}

function dayOfKey(dayKey: string): number {
  return Number(dayKey.slice(8, 10)) || 0
}

/** `2026-11-06` → `Fri 6 Nov`. Pure calendar arithmetic, no device zone. */
export function formatPaymentRunDay(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map((part) => Number(part))
  if (!y || !m || !d) return dayKey
  const weekday = WEEKDAY_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${weekday} ${d} ${MONTH_SHORT[m - 1]}`
}

/** Which date-range run (0 or 1) a period belongs to, by its start day. */
function dateRangeRunIndex(invoicing: PaymentRunInvoicing, period: DayWindow): number {
  const startDay = dayOfKey(period.startDayKey)
  const ranges = (invoicing.paymentRunDateRanges ?? []).slice(0, 2).map((range) => normalizePaymentRunRange(range))
  const exact = ranges.findIndex((range) => range?.startDay === startDay)
  if (exact >= 0) return exact
  const containing = ranges.findIndex((range) =>
    range ? (range.startDay <= range.endDay ? startDay >= range.startDay && startDay <= range.endDay : startDay >= range.startDay || startDay <= range.endDay) : false
  )
  return containing >= 0 ? containing : 0
}

/** Pay date (organisation-zone day key) for the run `period`, or null when no pay day is set. */
export function paymentRunPayDate(
  invoicing: PaymentRunInvoicing,
  period: DayWindow,
  timeZone?: string | null
): string | null {
  const tz = zone(timeZone)
  if (!period?.endDayKey) return null
  const paymentDays = (invoicing.paymentDates ?? []).map((day) => monthDay(day))
  if (invoicing.paymentRunMode === 'recurring_timeframe') {
    if (invoicing.paymentDateMode === 'specific_dates') {
      const days = paymentDays.filter((day) => day > 0).sort((a, b) => a - b)
      if (days.length === 0) return null
      // In arrears: the first payment day after the period ends.
      const [y, m, d] = period.endDayKey.split('-').map(Number)
      const next = new Date(Date.UTC(y, m - 1, d + 1))
      const nextDay = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
      return paymentDateAfterPeriodEnd(nextDay, days, tz)
    }
    return paymentWeekdayAfterPeriodEnd(period.endDayKey, invoicing.recurringPaymentDay || 'friday', tz)
  }
  const index = dateRangeRunIndex(invoicing, period)
  const day = paymentDays[index] ?? 0
  if (day <= 0) return null
  return paymentDateAfterPeriodEnd(period.endDayKey, [day], tz)
}

export function paymentRunLabel(period: DayWindow, payDate: string | null): string {
  const span = `${formatPaymentRunDay(period.startDayKey)} – ${formatPaymentRunDay(period.endDayKey)}`
  return payDate ? `${span} · paid ${formatPaymentRunDay(payDate)}` : span
}

/**
 * The payment run active at `now` (the work period containing today, organisation zone) with its
 * pay date. `{ notConfigured: true }` only when the organisation has no `invoicing` map at all.
 * Accepts the raw `organizations/{orgId}.invoicing` map or parsed settings.
 */
export function activePaymentRunSummary(
  invoicing: Record<string, unknown> | PaymentRunInvoicing | null | undefined,
  now: Date | string,
  timeZone?: string | null
): ActivePaymentRunSummary {
  if (!invoicing || typeof invoicing !== 'object' || Array.isArray(invoicing)) return { notConfigured: true }
  const reference = now instanceof Date ? now : new Date(now)
  if (Number.isNaN(reference.getTime())) return { notConfigured: true }
  const tz = zone(timeZone)
  const settings = parseInvoicing(invoicing as Record<string, unknown>)
  const period = invoicingPeriod({
    referenceIso: reference.toISOString(),
    timeZone: tz,
    paymentRunMode: settings.paymentRunMode,
    ranges: settings.paymentRunDateRanges,
    recurringRunStartDay: settings.recurringRunStartDay,
    recurringRunEndDay: settings.recurringRunEndDay,
  })
  const payDate = paymentRunPayDate(settings, period, tz)
  return {
    notConfigured: false,
    start: period.startDayKey,
    end: period.endDayKey,
    payDate,
    label: paymentRunLabel(period, payDate),
  }
}
