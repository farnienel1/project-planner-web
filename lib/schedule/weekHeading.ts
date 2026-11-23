import { format } from 'date-fns'

/**
 * My Schedule week heading (owner request 23 Nov): "Mon 23 – Sun 29 Nov 2026". Display only — the dates are the
 * organisation week's Monday and Sunday the screen already holds (`organizationCurrentWeekStart`,
 * `organizationCalendarWeekEnd`, calendar dates of the organisation's days); no business date is worked out here.
 * The month and year are written once when both ends share them.
 */
export function myScheduleWeekHeading(monday: Date, sunday: Date): string {
  const sameYear = monday.getFullYear() === sunday.getFullYear()
  const sameMonth = sameYear && monday.getMonth() === sunday.getMonth()
  const start = sameMonth ? format(monday, 'EEE d') : sameYear ? format(monday, 'EEE d MMM') : format(monday, 'EEE d MMM yyyy')
  return `${start} – ${format(sunday, 'EEE d MMM yyyy')}`
}
