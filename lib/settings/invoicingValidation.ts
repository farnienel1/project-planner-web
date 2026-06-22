import type { OrgInvoicingSettings, PaymentRunDateRange } from '@/lib/settings/organizationSettings'

const MONTH_DAYS = 31

function isValidDay(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= MONTH_DAYS
}

export function validatePaymentRunDateRanges(ranges: PaymentRunDateRange[]): string | null {
  if (ranges.length < 2) {
    return 'Set two payment run date ranges that together cover every day of the month.'
  }

  const [run1, run2] = ranges
  if (!isValidDay(run1.startDay) || !isValidDay(run1.endDay)) {
    return 'Payment run 1 needs a start and end day (1–31).'
  }
  if (!isValidDay(run2.startDay) || !isValidDay(run2.endDay)) {
    return 'Payment run 2 needs a start and end day (1–31).'
  }
  if (run1.startDay > run1.endDay) {
    return 'Payment run 1: start day must be on or before end day.'
  }
  if (run2.startDay > run2.endDay) {
    return 'Payment run 2: start day must be on or before end day.'
  }
  if (run1.startDay !== 1) {
    return 'Payment run 1 must start on day 1 of the month.'
  }
  if (run2.endDay !== MONTH_DAYS) {
    return `Payment run 2 must end on day ${MONTH_DAYS} so all days of the month are covered.`
  }
  if (run2.startDay !== run1.endDay + 1) {
    return 'Payment runs must not overlap — run 2 should start the day after run 1 ends (e.g. 1–15 then 16–31).'
  }

  const covered = new Set<number>()
  for (const range of ranges) {
    for (let day = range.startDay; day <= range.endDay; day += 1) {
      if (covered.has(day)) {
        return 'Payment run date ranges overlap. Each day of the month must belong to exactly one run.'
      }
      covered.add(day)
    }
  }

  if (covered.size !== MONTH_DAYS) {
    return `All ${MONTH_DAYS} days of the month must be covered across your payment runs.`
  }

  return null
}

export function validatePaymentDates(
  paymentDates: number[],
  expectedCount: number
): string | null {
  if (paymentDates.length < expectedCount) {
    return `Set ${expectedCount} payment date${expectedCount === 1 ? '' : 's'} — one for each payment run.`
  }
  for (let i = 0; i < expectedCount; i += 1) {
    const day = paymentDates[i]
    if (!isValidDay(day)) {
      return `Payment date ${i + 1} must be a day of the month (1–31).`
    }
  }
  return null
}

export function validateInvoicingSettings(settings: OrgInvoicingSettings): string | null {
  if (settings.paymentRunMode === 'date_ranges') {
    const rangeError = validatePaymentRunDateRanges(settings.paymentRunDateRanges)
    if (rangeError) return rangeError

    if (settings.paymentDateMode !== 'specific_dates') {
      return 'Choose payment date/s when using payment run date ranges.'
    }

    const paymentDays = settings.paymentDates
      .map((d) => Number(d))
      .filter((d) => Number.isFinite(d) && d > 0)

    return validatePaymentDates(paymentDays, 2)
  }

  if (settings.paymentRunMode === 'recurring_timeframe') {
    if (!settings.recurringRunStartDay || !settings.recurringRunEndDay) {
      return 'Choose a start day and end day for your recurring payment run.'
    }
    if (settings.paymentDateMode === 'recurring_date' && !settings.recurringPaymentDay) {
      return 'Choose a recurring payment date.'
    }
    if (settings.paymentDateMode === 'specific_dates') {
      const paymentDays = settings.paymentDates
        .map((d) => Number(d))
        .filter((d) => Number.isFinite(d) && d > 0)
      if (paymentDays.length < 1) {
        return 'Set at least one payment date.'
      }
      for (const day of paymentDays) {
        if (!isValidDay(day)) {
          return 'Each payment date must be a day of the month (1–31).'
        }
      }
    }
  }

  return null
}

export const DAY_OF_MONTH_OPTIONS = Array.from({ length: MONTH_DAYS }, (_, i) => i + 1)
