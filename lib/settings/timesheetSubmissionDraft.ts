import {
  defaultTimesheetSubmissionFromPaymentDay,
  defaultTimesheetSubmissionFromPaymentWeekday,
  parseTimesheetSubmissionList,
  timesheetSubmissionAfterPaymentDayChange,
  timesheetSubmissionAfterPaymentWeekdayChange,
  timesheetSubmissionNoticeCopy,
  type TimesheetSubmissionSettings,
} from '@/lib/canonical'
import type { OrgInvoicingSettings } from '@/lib/canonical/organizationSettings'

export function syncedTimesheetSubmission(settings: OrgInvoicingSettings): TimesheetSubmissionSettings[] {
  return parseTimesheetSubmissionList({
    paymentRunMode: settings.paymentRunMode,
    paymentDates: settings.paymentDates,
    recurringPaymentDay: settings.recurringPaymentDay,
    timesheetSubmission: settings.timesheetSubmission,
  })
}

export function withPaymentDateAt(
  settings: OrgInvoicingSettings,
  index: number,
  day: number
): Partial<OrgInvoicingSettings> {
  const dates = [...(settings.paymentDates.length >= 2 ? settings.paymentDates : ['', ''])]
  dates[index] = String(day)
  const rows = syncedTimesheetSubmission(settings)
  rows[index] = timesheetSubmissionAfterPaymentDayChange(rows[index], day)
  return { paymentDates: dates, timesheetSubmission: rows }
}

export function withRecurringPaymentDay(
  settings: OrgInvoicingSettings,
  weekday: string
): Partial<OrgInvoicingSettings> {
  const rows = syncedTimesheetSubmission(settings)
  rows[0] = timesheetSubmissionAfterPaymentWeekdayChange(rows[0], weekday)
  return { recurringPaymentDay: weekday, timesheetSubmission: rows }
}

export function withTimesheetSubmissionAt(
  settings: OrgInvoicingSettings,
  index: number,
  patch: Partial<TimesheetSubmissionSettings>
): TimesheetSubmissionSettings[] {
  const rows = syncedTimesheetSubmission(settings)
  rows[index] = { ...rows[index], ...patch, notifyCustomised: true }
  return rows
}

export function resetTimesheetSubmissionAt(
  settings: OrgInvoicingSettings,
  index: number
): TimesheetSubmissionSettings[] {
  const rows = syncedTimesheetSubmission(settings)
  if (settings.paymentRunMode === 'recurring_timeframe') {
    rows[0] = defaultTimesheetSubmissionFromPaymentWeekday(settings.recurringPaymentDay)
    return rows.slice(0, 1)
  }
  const paymentDay = Number(settings.paymentDates[index]) || 0
  rows[index] = defaultTimesheetSubmissionFromPaymentDay(paymentDay)
  return rows
}

export function previewTimesheetSubmissionCopy(
  settings: OrgInvoicingSettings,
  index: number
): string {
  const rows = syncedTimesheetSubmission(settings)
  const row = rows[index]
  if (!row) return ''
  if (settings.paymentRunMode === 'recurring_timeframe') {
    return timesheetSubmissionNoticeCopy({
      mode: 'recurring_timeframe',
      deadlineWeekday: row.timesheetDeadlineWeekday,
      paymentWeekday: settings.recurringPaymentDay,
      deadlineHour: row.timesheetDeadlineHour,
      deadlineMinute: row.timesheetDeadlineMinute,
    })
  }
  return timesheetSubmissionNoticeCopy({
    mode: 'date_ranges',
    deadlineDay: row.timesheetDeadlineDay,
    paymentDay: Number(settings.paymentDates[index]) || 0,
    deadlineHour: row.timesheetDeadlineHour,
    deadlineMinute: row.timesheetDeadlineMinute,
  })
}
