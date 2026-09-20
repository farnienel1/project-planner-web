/**
 * iOS parity source: Views/InvoicingView.swift paymentSummaryCard
 * Spec: docs/ios-parity/sections/17-timesheets.md
 */
import type { OrgInvoicingSettings } from '@/lib/settings/organizationSettings'
import { capitalizeDay } from '@/lib/settings/organizationSettings'

export function currentPaymentRunCopy(invoicing: OrgInvoicingSettings): {
  periodLine: string
  paidLine: string
  note: string
} {
  if (invoicing.paymentRunMode === 'recurring_timeframe') {
    return {
      periodLine: `In arrears: ${capitalizeDay(invoicing.recurringRunStartDay)} to ${capitalizeDay(invoicing.recurringRunEndDay)} (of the previous week)`,
      paidLine:
        invoicing.paymentDateMode === 'recurring_date'
          ? `Paid every ${capitalizeDay(invoicing.recurringPaymentDay)}`
          : paidOnDaysLine(invoicing.paymentDates),
      note: invoicing.noteToUsers.trim(),
    }
  }

  const range = invoicing.paymentRunDateRanges.find((row) => row.startDay > 0 && row.endDay > 0)
  const periodLine = range ? `Day ${range.startDay} - Day ${range.endDay}` : 'Current payment run'
  return {
    periodLine,
    paidLine:
      invoicing.paymentDateMode === 'recurring_date'
        ? `Paid every ${capitalizeDay(invoicing.recurringPaymentDay)}`
        : paidOnDaysLine(invoicing.paymentDates),
    note: invoicing.noteToUsers.trim(),
  }
}

function paidOnDaysLine(dates: string[]): string {
  const days = dates.map((value) => value.replace(/\D/g, '')).filter(Boolean)
  if (days.length === 0) return 'Paid on your organisation payment dates'
  return `Paid on day ${days.join(' & ')}`
}
