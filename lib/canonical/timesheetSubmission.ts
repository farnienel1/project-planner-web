/**
 * Timesheet submit deadline and reminder notify-at, derived from a payment day.
 * Screens pick the values; this module owns the offsets, month wrap, short-month
 * clamp, generated inbox copy, and which occurrence is due in Europe/London.
 */

import {
  addDaysInZone,
  dateFromDayKeyInZone,
  dayKeyInZone,
  daysInZoneMonth,
  isoWeekdayInZone,
  midnightInZone,
  partsInZone,
} from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import { formatClockMinutes, invoicingPeriod, organizationScopedKey } from './engine'

export const TIMESHEET_CLOSE_OF_PLAY_HOUR = 17
export const TIMESHEET_CLOSE_OF_PLAY_MINUTE = 0
export const TIMESHEET_NOTIFY_HOUR = 8
export const TIMESHEET_NOTIFY_MINUTE = 0
export const TIMESHEET_DEADLINE_DAYS_BEFORE_PAYMENT = 1
export const TIMESHEET_NOTIFY_DAYS_BEFORE_PAYMENT = 3
export const TIMESHEET_SUBMISSION_NOTICE_TITLE = 'Timesheet submission reminder'
export const TIMESHEET_SUBMISSION_NOTICE_TYPE = 'timesheet_submission_reminder'

export const TIMESHEET_SUBMISSION_WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export type TimesheetSubmissionWeekday = (typeof TIMESHEET_SUBMISSION_WEEKDAYS)[number]

export type TimesheetSubmissionSettings = {
  timesheetDeadlineDay: number
  timesheetDeadlineWeekday: string
  timesheetDeadlineHour: number
  timesheetDeadlineMinute: number
  notifyDay: number
  notifyWeekday: string
  notifyHour: number
  notifyMinute: number
  notifyCustomised: boolean
}

export type TimesheetSubmissionNotice = {
  runIndex: number
  occurrenceKey: string
  paymentDayKey: string
  deadlineDayKey: string
  notifyDayKey: string
  notifyHour: number
  notifyMinute: number
  deadlineHour: number
  deadlineMinute: number
  title: string
  message: string
}

export type TimesheetSubmissionScanInput = {
  referenceIso: string
  timeZone?: string | null
  paymentRunMode: 'date_ranges' | 'recurring_timeframe'
  paymentDateMode?: 'specific_dates' | 'recurring_date' | string | null
  paymentRunDateRanges?: ReadonlyArray<{ startDay?: number; endDay?: number }>
  paymentDates?: ReadonlyArray<number | string>
  recurringRunStartDay?: string
  recurringRunEndDay?: string
  recurringPaymentDay?: string
  timesheetSubmission?: ReadonlyArray<TimesheetSubmissionSettings>
}

const MONTH_CYCLE = 31
const GRACE_DAYS_AFTER_PAYMENT = 7

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function clampHour(value: unknown, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(23, Math.round(n)))
}

function clampMinute(value: unknown, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(59, Math.round(n)))
}

function monthDayOrZero(value: unknown): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : 0
}

export function normalizeTimesheetWeekday(value: unknown, fallback = 'friday'): TimesheetSubmissionWeekday {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
  return TIMESHEET_SUBMISSION_WEEKDAYS.includes(raw as TimesheetSubmissionWeekday)
    ? (raw as TimesheetSubmissionWeekday)
    : (fallback as TimesheetSubmissionWeekday)
}

export function weekdayOffsetBefore(weekday: string, daysBefore: number): TimesheetSubmissionWeekday {
  const current = normalizeTimesheetWeekday(weekday)
  const index = TIMESHEET_SUBMISSION_WEEKDAYS.indexOf(current)
  const shift = ((index - daysBefore) % 7 + 7) % 7
  return TIMESHEET_SUBMISSION_WEEKDAYS[shift]
}

/** Stored 1–31 day, wrapping the 31-day cycle (5 − 3 → 2; 1 − 1 → 31). */
export function monthDayOffsetBefore(paymentDay: number, daysBefore: number): number {
  const day = monthDayOrZero(paymentDay)
  if (day <= 0) return 0
  const offset = Math.max(0, Math.round(daysBefore))
  return ((day - 1 - offset) % MONTH_CYCLE + MONTH_CYCLE) % MONTH_CYCLE + 1
}

export function monthDayOrdinal(day: number): string {
  const n = monthDayOrZero(day)
  if (n <= 0) return ''
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

export function capitalizeTimesheetWeekday(day: string): string {
  const name = normalizeTimesheetWeekday(day)
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function emptyTimesheetSubmission(): TimesheetSubmissionSettings {
  return {
    timesheetDeadlineDay: 0,
    timesheetDeadlineWeekday: '',
    timesheetDeadlineHour: TIMESHEET_CLOSE_OF_PLAY_HOUR,
    timesheetDeadlineMinute: TIMESHEET_CLOSE_OF_PLAY_MINUTE,
    notifyDay: 0,
    notifyWeekday: '',
    notifyHour: TIMESHEET_NOTIFY_HOUR,
    notifyMinute: TIMESHEET_NOTIFY_MINUTE,
    notifyCustomised: false,
  }
}

export function defaultTimesheetSubmissionFromPaymentDay(paymentDay: number): TimesheetSubmissionSettings {
  const day = monthDayOrZero(paymentDay)
  if (day <= 0) return emptyTimesheetSubmission()
  return {
    timesheetDeadlineDay: monthDayOffsetBefore(day, TIMESHEET_DEADLINE_DAYS_BEFORE_PAYMENT),
    timesheetDeadlineWeekday: '',
    timesheetDeadlineHour: TIMESHEET_CLOSE_OF_PLAY_HOUR,
    timesheetDeadlineMinute: TIMESHEET_CLOSE_OF_PLAY_MINUTE,
    notifyDay: monthDayOffsetBefore(day, TIMESHEET_NOTIFY_DAYS_BEFORE_PAYMENT),
    notifyWeekday: '',
    notifyHour: TIMESHEET_NOTIFY_HOUR,
    notifyMinute: TIMESHEET_NOTIFY_MINUTE,
    notifyCustomised: false,
  }
}

export function defaultTimesheetSubmissionFromPaymentWeekday(paymentWeekday: string): TimesheetSubmissionSettings {
  const pay = normalizeTimesheetWeekday(paymentWeekday)
  return {
    timesheetDeadlineDay: 0,
    timesheetDeadlineWeekday: weekdayOffsetBefore(pay, TIMESHEET_DEADLINE_DAYS_BEFORE_PAYMENT),
    timesheetDeadlineHour: TIMESHEET_CLOSE_OF_PLAY_HOUR,
    timesheetDeadlineMinute: TIMESHEET_CLOSE_OF_PLAY_MINUTE,
    notifyDay: 0,
    notifyWeekday: weekdayOffsetBefore(pay, TIMESHEET_NOTIFY_DAYS_BEFORE_PAYMENT),
    notifyHour: TIMESHEET_NOTIFY_HOUR,
    notifyMinute: TIMESHEET_NOTIFY_MINUTE,
    notifyCustomised: false,
  }
}

export function timesheetSubmissionAfterPaymentDayChange(
  current: TimesheetSubmissionSettings | null | undefined,
  paymentDay: number
): TimesheetSubmissionSettings {
  if (current?.notifyCustomised) {
    return { ...current }
  }
  return defaultTimesheetSubmissionFromPaymentDay(paymentDay)
}

export function timesheetSubmissionAfterPaymentWeekdayChange(
  current: TimesheetSubmissionSettings | null | undefined,
  paymentWeekday: string
): TimesheetSubmissionSettings {
  if (current?.notifyCustomised) {
    return { ...current }
  }
  return defaultTimesheetSubmissionFromPaymentWeekday(paymentWeekday)
}

function isCloseOfPlay(hour: number, minute: number): boolean {
  return hour === TIMESHEET_CLOSE_OF_PLAY_HOUR && minute === TIMESHEET_CLOSE_OF_PLAY_MINUTE
}

function deadlinePhrase(dayLabel: string, hour: number, minute: number): string {
  if (isCloseOfPlay(hour, minute)) return `close of play on ${dayLabel}`
  return `${formatClockMinutes(hour * 60 + minute)} on ${dayLabel}`
}

export function timesheetSubmissionNoticeCopy(input: {
  mode: 'date_ranges' | 'recurring_timeframe'
  deadlineDay?: number
  paymentDay?: number
  deadlineWeekday?: string
  paymentWeekday?: string
  deadlineHour?: number
  deadlineMinute?: number
}): string {
  const hour = clampHour(input.deadlineHour, TIMESHEET_CLOSE_OF_PLAY_HOUR)
  const minute = clampMinute(input.deadlineMinute, TIMESHEET_CLOSE_OF_PLAY_MINUTE)
  if (input.mode === 'recurring_timeframe') {
    const deadlineWeekday = capitalizeTimesheetWeekday(input.deadlineWeekday || 'thursday')
    const paymentWeekday = capitalizeTimesheetWeekday(input.paymentWeekday || 'friday')
    const when = isCloseOfPlay(hour, minute)
      ? `close of play ${deadlineWeekday}`
      : `${formatClockMinutes(hour * 60 + minute)} ${deadlineWeekday}`
    return `Please issue timesheets for the previous payment run by ${when}, to be paid on ${paymentWeekday}.`
  }
  const deadline = monthDayOrdinal(input.deadlineDay || 0)
  const payment = monthDayOrdinal(input.paymentDay || 0)
  if (!deadline || !payment) return ''
  return `Timesheets need to be submitted by ${deadlinePhrase(`the ${deadline}`, hour, minute)} for payment on the ${payment}.`
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

export function parseTimesheetSubmissionEntry(
  raw: unknown,
  fallback: TimesheetSubmissionSettings
): TimesheetSubmissionSettings {
  const data = asRecord(raw)
  if (!data) return { ...fallback }
  const deadlineDay = monthDayOrZero(data.timesheetDeadlineDay)
  const notifyDay = monthDayOrZero(data.notifyDay)
  return {
    timesheetDeadlineDay: deadlineDay || fallback.timesheetDeadlineDay,
    timesheetDeadlineWeekday: data.timesheetDeadlineWeekday
      ? normalizeTimesheetWeekday(data.timesheetDeadlineWeekday, fallback.timesheetDeadlineWeekday || 'thursday')
      : fallback.timesheetDeadlineWeekday,
    timesheetDeadlineHour: clampHour(data.timesheetDeadlineHour, fallback.timesheetDeadlineHour),
    timesheetDeadlineMinute: clampMinute(data.timesheetDeadlineMinute, fallback.timesheetDeadlineMinute),
    notifyDay: notifyDay || fallback.notifyDay,
    notifyWeekday: data.notifyWeekday
      ? normalizeTimesheetWeekday(data.notifyWeekday, fallback.notifyWeekday || 'tuesday')
      : fallback.notifyWeekday,
    notifyHour: clampHour(data.notifyHour, fallback.notifyHour),
    notifyMinute: clampMinute(data.notifyMinute, fallback.notifyMinute),
    notifyCustomised: data.notifyCustomised === true,
  }
}

export function timesheetSubmissionToFirestore(entry: TimesheetSubmissionSettings): Record<string, unknown> {
  return {
    timesheetDeadlineDay: entry.timesheetDeadlineDay,
    timesheetDeadlineWeekday: entry.timesheetDeadlineWeekday,
    timesheetDeadlineHour: entry.timesheetDeadlineHour,
    timesheetDeadlineMinute: entry.timesheetDeadlineMinute,
    notifyDay: entry.notifyDay,
    notifyWeekday: entry.notifyWeekday,
    notifyHour: entry.notifyHour,
    notifyMinute: entry.notifyMinute,
    notifyCustomised: entry.notifyCustomised === true,
  }
}

export function parseTimesheetSubmissionList(input: {
  paymentRunMode: 'date_ranges' | 'recurring_timeframe'
  paymentDates: ReadonlyArray<number | string>
  recurringPaymentDay?: string
  timesheetSubmission?: unknown
  paymentRunDateRanges?: unknown
  invoicingRoot?: Record<string, unknown>
}): TimesheetSubmissionSettings[] {
  const rawList = Array.isArray(input.timesheetSubmission) ? input.timesheetSubmission : []
  const rangeRows = Array.isArray(input.paymentRunDateRanges) ? input.paymentRunDateRanges : []
  if (input.paymentRunMode === 'recurring_timeframe') {
    const fallback = defaultTimesheetSubmissionFromPaymentWeekday(input.recurringPaymentDay || 'friday')
    const fromList = rawList[0] != null ? parseTimesheetSubmissionEntry(rawList[0], fallback) : null
    const fromRoot = input.invoicingRoot
      ? parseTimesheetSubmissionEntry(
          {
            timesheetDeadlineWeekday: input.invoicingRoot.timesheetDeadlineWeekday,
            timesheetDeadlineHour: input.invoicingRoot.timesheetDeadlineHour,
            timesheetDeadlineMinute: input.invoicingRoot.timesheetDeadlineMinute,
            notifyWeekday: input.invoicingRoot.notifyWeekday,
            notifyHour: input.invoicingRoot.notifyHour,
            notifyMinute: input.invoicingRoot.notifyMinute,
            notifyCustomised: input.invoicingRoot.notifyCustomised,
          },
          fallback
        )
      : null
    const chosen = fromList && (asRecord(rawList[0])?.notifyWeekday || asRecord(rawList[0])?.timesheetDeadlineWeekday)
      ? fromList
      : fromRoot && (input.invoicingRoot?.notifyWeekday || input.invoicingRoot?.timesheetDeadlineWeekday)
        ? fromRoot
        : fromList ?? fromRoot ?? fallback
    return [{ ...chosen, timesheetDeadlineDay: 0, notifyDay: 0 }]
  }
  const paymentDays = input.paymentDates
    .map((value) => monthDayOrZero(value))
    .filter((day) => day > 0)
  const count = Math.max(paymentDays.length, rawList.length, 2)
  const rows: TimesheetSubmissionSettings[] = []
  for (let index = 0; index < count; index += 1) {
    const paymentDay = paymentDays[index] || 0
    const fallback = defaultTimesheetSubmissionFromPaymentDay(paymentDay)
    const fromList = rawList[index] != null ? parseTimesheetSubmissionEntry(rawList[index], fallback) : null
    const fromRange = rangeRows[index] != null ? parseTimesheetSubmissionEntry(rangeRows[index], fallback) : null
    rows.push(fromList ?? fromRange ?? fallback)
  }
  return rows
}

function shiftYearMonth(year: number, month: number, offset: number): { y: number; m: number } {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1, 12, 0, 0))
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1 }
}

function monthAnchor(year: number, month: number, timeZone: string): Date {
  return dateFromDayKeyInZone(`${year}-${pad2(month)}-01`, timeZone)
}

export function clampMonthDayInZone(year: number, month: number, day: number, timeZone?: string | null): string {
  const zone = zoneOrLondon(timeZone)
  const dim = daysInZoneMonth(monthAnchor(year, month, zone), zone)
  const clamped = Math.min(Math.max(monthDayOrZero(day) || 1, 1), dim)
  return `${year}-${pad2(month)}-${pad2(clamped)}`
}

/**
 * First payment day on or after the period end, otherwise that day next month.
 * Short months clamp the stored 1–31 day.
 */
export function paymentDateAfterPeriodEnd(
  periodEndDayKey: string,
  paymentDays: readonly number[],
  timeZone?: string | null
): string | null {
  const zone = zoneOrLondon(timeZone)
  const days = paymentDays.map((day) => monthDayOrZero(day)).filter((day) => day > 0)
  if (!periodEndDayKey || days.length === 0) return null
  const periodEnd = dateFromDayKeyInZone(periodEndDayKey, zone)
  const { y, m } = partsInZone(periodEnd, zone)
  for (const day of days) {
    const candidate = clampMonthDayInZone(y, m, day, zone)
    if (candidate >= periodEndDayKey) return candidate
  }
  const next = shiftYearMonth(y, m, 1)
  return clampMonthDayInZone(next.y, next.m, days[0], zone)
}

function relatedMonthDayToPayment(paymentDayKey: string, relatedDay: number, timeZone: string): string {
  const payment = dateFromDayKeyInZone(paymentDayKey, timeZone)
  const { y, m, d } = partsInZone(payment, timeZone)
  const day = monthDayOrZero(relatedDay)
  if (day <= 0) return paymentDayKey
  if (day <= d) return clampMonthDayInZone(y, m, day, timeZone)
  const prev = shiftYearMonth(y, m, -1)
  return clampMonthDayInZone(prev.y, prev.m, day, timeZone)
}

function weekdayOnOrBefore(dayKey: string, weekday: string, timeZone: string): string {
  const target = TIMESHEET_SUBMISSION_WEEKDAYS.indexOf(normalizeTimesheetWeekday(weekday)) + 1
  let cursor = dateFromDayKeyInZone(dayKey, timeZone)
  for (let step = 0; step < 7; step += 1) {
    if (isoWeekdayInZone(cursor, timeZone) === target) return dayKeyInZone(cursor, timeZone)
    cursor = addDaysInZone(cursor, -1, timeZone)
  }
  return dayKey
}

function instantOnDay(dayKey: string, hour: number, minute: number, timeZone: string): Date {
  const midnight = dateFromDayKeyInZone(dayKey, timeZone)
  return new Date(midnight.getTime() + (hour * 60 + minute) * 60_000)
}

function resolveDateRangeInstants(
  paymentDayKey: string,
  settings: TimesheetSubmissionSettings,
  timeZone: string
): { deadlineDayKey: string; notifyDayKey: string } {
  const payment = dateFromDayKeyInZone(paymentDayKey, timeZone)
  if (!settings.notifyCustomised) {
    return {
      deadlineDayKey: dayKeyInZone(addDaysInZone(payment, -TIMESHEET_DEADLINE_DAYS_BEFORE_PAYMENT, timeZone), timeZone),
      notifyDayKey: dayKeyInZone(addDaysInZone(payment, -TIMESHEET_NOTIFY_DAYS_BEFORE_PAYMENT, timeZone), timeZone),
    }
  }
  return {
    deadlineDayKey: relatedMonthDayToPayment(paymentDayKey, settings.timesheetDeadlineDay, timeZone),
    notifyDayKey: relatedMonthDayToPayment(paymentDayKey, settings.notifyDay, timeZone),
  }
}

function resolveRecurringInstants(
  paymentDayKey: string,
  settings: TimesheetSubmissionSettings,
  timeZone: string
): { deadlineDayKey: string; notifyDayKey: string } {
  const deadlineWeekday =
    settings.timesheetDeadlineWeekday || weekdayOffsetBefore(settings.notifyWeekday || 'friday', 2)
  const notifyWeekday = settings.notifyWeekday || weekdayOffsetBefore(deadlineWeekday, 2)
  return {
    deadlineDayKey: weekdayOnOrBefore(paymentDayKey, deadlineWeekday, timeZone),
    notifyDayKey: weekdayOnOrBefore(paymentDayKey, notifyWeekday, timeZone),
  }
}

export function timesheetSubmissionNoticeDedupKey(input: {
  organizationId: string
  paymentDayKey: string
  runIndex: number
  userId: string
}): string {
  const scoped = organizationScopedKey('timesheetSubmission', input.organizationId, input.userId)
  return `${scoped}|${input.runIndex}|${input.paymentDayKey}`
}

function paymentNumbers(values: ReadonlyArray<number | string> | undefined): number[] {
  return (values ?? []).map((value) => monthDayOrZero(value)).filter((day) => day > 0)
}

function noticeFromInstants(input: {
  runIndex: number
  paymentDayKey: string
  deadlineDayKey: string
  notifyDayKey: string
  settings: TimesheetSubmissionSettings
  mode: 'date_ranges' | 'recurring_timeframe'
  paymentWeekday?: string
  timeZone: string
}): TimesheetSubmissionNotice {
  const paymentDay = partsInZone(dateFromDayKeyInZone(input.paymentDayKey, input.timeZone), input.timeZone).d
  const deadlineDay =
    monthDayOrZero(input.settings.timesheetDeadlineDay) ||
    partsInZone(dateFromDayKeyInZone(input.deadlineDayKey, input.timeZone), input.timeZone).d
  const message = timesheetSubmissionNoticeCopy({
    mode: input.mode,
    deadlineDay,
    paymentDay,
    deadlineWeekday: input.settings.timesheetDeadlineWeekday,
    paymentWeekday: input.paymentWeekday,
    deadlineHour: input.settings.timesheetDeadlineHour,
    deadlineMinute: input.settings.timesheetDeadlineMinute,
  })
  return {
    runIndex: input.runIndex,
    occurrenceKey: `${input.runIndex}:${input.paymentDayKey}`,
    paymentDayKey: input.paymentDayKey,
    deadlineDayKey: input.deadlineDayKey,
    notifyDayKey: input.notifyDayKey,
    notifyHour: input.settings.notifyHour,
    notifyMinute: input.settings.notifyMinute,
    deadlineHour: input.settings.timesheetDeadlineHour,
    deadlineMinute: input.settings.timesheetDeadlineMinute,
    title: TIMESHEET_SUBMISSION_NOTICE_TITLE,
    message,
  }
}

function isDue(now: Date, notifyAt: Date, paymentDayKey: string, timeZone: string): boolean {
  if (now.getTime() < notifyAt.getTime()) return false
  const latest = addDaysInZone(dateFromDayKeyInZone(paymentDayKey, timeZone), GRACE_DAYS_AFTER_PAYMENT, timeZone)
  return dayKeyInZone(now, timeZone) <= dayKeyInZone(latest, timeZone)
}

/**
 * Reminders whose notify-at has arrived in the organisation zone (default London).
 * One row per payment occurrence. Dedup keys include organisation id + occurrence.
 */
export function dueTimesheetSubmissionNotices(input: TimesheetSubmissionScanInput): TimesheetSubmissionNotice[] {
  const timeZone = zoneOrLondon(input.timeZone)
  const now = new Date(input.referenceIso)
  if (Number.isNaN(now.getTime())) return []
  const found = new Map<string, TimesheetSubmissionNotice>()

  const consider = (notice: TimesheetSubmissionNotice, settings: TimesheetSubmissionSettings) => {
    const notifyAt = instantOnDay(notice.notifyDayKey, settings.notifyHour, settings.notifyMinute, timeZone)
    if (!isDue(now, notifyAt, notice.paymentDayKey, timeZone)) return
    found.set(notice.occurrenceKey, notice)
  }

  if (input.paymentRunMode === 'recurring_timeframe') {
    const settings =
      input.timesheetSubmission?.[0] ??
      defaultTimesheetSubmissionFromPaymentWeekday(input.recurringPaymentDay || 'friday')
    const anchors = [
      now,
      addDaysInZone(now, -8, timeZone),
      addDaysInZone(now, 8, timeZone),
    ]
    for (const anchor of anchors) {
      const period = invoicingPeriod({
        referenceIso: midnightInZone(anchor, timeZone).toISOString(),
        timeZone,
        paymentRunMode: 'recurring_timeframe',
        recurringRunStartDay: input.recurringRunStartDay || 'monday',
        recurringRunEndDay: input.recurringRunEndDay || 'sunday',
      })
      const dayAfter = addDaysInZone(dateFromDayKeyInZone(period.endDayKey, timeZone), 1, timeZone)
      const payIso = TIMESHEET_SUBMISSION_WEEKDAYS.indexOf(normalizeTimesheetWeekday(input.recurringPaymentDay || 'friday')) + 1
      let pay = dayAfter
      for (let step = 0; step < 7; step += 1) {
        if (isoWeekdayInZone(pay, timeZone) === payIso) break
        pay = addDaysInZone(pay, 1, timeZone)
      }
      const paymentDayKey = dayKeyInZone(pay, timeZone)
      const instants = resolveRecurringInstants(paymentDayKey, settings, timeZone)
      consider(
        noticeFromInstants({
          runIndex: 0,
          paymentDayKey,
          deadlineDayKey: instants.deadlineDayKey,
          notifyDayKey: instants.notifyDayKey,
          settings,
          mode: 'recurring_timeframe',
          paymentWeekday: input.recurringPaymentDay || 'friday',
          timeZone,
        }),
        settings
      )
    }
    return [...found.values()]
  }

  const paymentDays = paymentNumbers(input.paymentDates)
  const ranges = (input.paymentRunDateRanges ?? []).slice(0, 2)
  const { y, m } = partsInZone(now, timeZone)
  for (let monthOffset = -1; monthOffset <= 1; monthOffset += 1) {
    const month = shiftYearMonth(y, m, monthOffset)
    ranges.forEach((range, index) => {
      const endDay = Number(range?.endDay) || 0
      if (endDay <= 0) return
      const paymentDay = paymentDays[index] || 0
      if (paymentDay <= 0) return
      const periodEnd = clampMonthDayInZone(month.y, month.m, endDay, timeZone)
      const paymentDayKey = paymentDateAfterPeriodEnd(periodEnd, [paymentDay], timeZone)
      if (!paymentDayKey) return
      const settings =
        input.timesheetSubmission?.[index] ?? defaultTimesheetSubmissionFromPaymentDay(paymentDay)
      const instants = resolveDateRangeInstants(paymentDayKey, settings, timeZone)
      consider(
        noticeFromInstants({
          runIndex: index,
          paymentDayKey,
          deadlineDayKey: instants.deadlineDayKey,
          notifyDayKey: instants.notifyDayKey,
          settings,
          mode: 'date_ranges',
          timeZone,
        }),
        settings
      )
    })
  }
  return [...found.values()]
}
