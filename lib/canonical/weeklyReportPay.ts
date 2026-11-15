/**
 * Rulebook 1.51.0 §7 (owner decisions 15 Nov, Q1–Q3): the Weekly Report's Pay Summary, invoice check lines and paid
 * days, on every platform. Web (`lib/weekly-report`) and iOS (`WeeklyReportView`) only render what this returns; no
 * app prices a weekly-report row itself.
 *
 * Pricing is the timesheet's, never a second calculator: each booking is `payrollHoursResult` under the working hours
 * in effect on its day (`payrollTimePolicyForDayFromState`), its rate `payRateOnDay`, its pay `bookingPaySlices`
 * (`payForHours`, rounded per booking line, 1.46.0) and rows add bookings with `mergeBookingPaySlice`. A person's days
 * inside an approved timesheet week are the signed lines (`timesheetFeedCovers`, `timesheetFeedLabourLines`), never
 * re-priced. PAYE days are left out (they are the PAYE overtime section, 1.29.0). Pay is shown with
 * `reportPayForViewer` (1.32.0). The check line is `timesheetListBucket` (with `signedTimesheetBookingChanges`, 1.47.0)
 * and `timesheetInvoiceRows` for the same days.
 *
 * Rows (Q1): one per person, per rate period (the days a rate applied inside the range), per kind of hours —
 * Weekday standard, Weekday overtime ×N, each Saturday / Sunday by its date (window, outside the window, or every
 * hour), Hourly / Hourly overtime ×N, Price work, Expenses. Hours are paid hours (overtime: clock × N − break), Days are
 * paid hours ÷ the day-rate divisor of each part (`payrollDayRateHours`, 1.49.0), Rate is the rate in effect (a day or
 * hourly rate, never multiplied), Pay is the sum of each booking's rounded pay.
 */

import { dayKeyInZone } from '../orgTime/zoneTime'
import { eachDayKey, isoWeekdayOfDayKey, zoneOrLondon } from './dayKeys'
import { documentInstantMs } from './peopleDocuments'
import { formatMoney } from './money'
import { payRateOnDay, roundPennies, type PayRateHistoryRow, type PayRateProfile, type PayRateUser } from './payRate'
import { payrollHoursResult, multipliedHoursText, parseMultipliedHoursText, type PayrollHoursResult } from './payrollHours'
import { payrollTimePolicyForDayFromState, type PayrollTimePolicyState } from './payrollPolicySchedule'
import { weekdayPaidHours, type OrgPayrollTimePolicy } from './organizationSettings'
import { bookingPaySlices, mergeBookingPaySlice, type BookingPaySlice } from './timesheetLineEdit'
import { timesheetFeedCovers, timesheetFeedLabourLines, timesheetFeedMoneyLines, type FeedWeek } from './weeklyReportTimesheetFeed'
import { reportPayForViewer, timesheetInvoiceRows, type InvoiceLineInput } from './reportPay'
import { parseTimesheetStatusFields, timesheetListBucket, type TimesheetStatusFields } from './timesheetPeriod'
import { normalizeDocumentId } from './scheduleSources'
import { bookingOccupiesDay } from './warningRows'
import { leaveDaysInRange } from './leaveRequests'
import { parseClockMinutes } from './engine'

// MARK: - Inputs

export type WeeklyReportPayPerson = {
  /** The person's key (the kept users id, or an `operatives` row id for a person with no account). */
  id: string
  name: string
  role: string
  /** Every id the person goes by (`personIdSet`, former and same-email ids, `operatives` rows on their email). */
  ids?: ReadonlyArray<string> | null
  /** `operatives` row ids for rate history (`operativeId` rows). */
  operativeIds?: ReadonlyArray<string> | null
  /** The users document (employment type and its dates, live rate); null for a catalogue-only person. */
  user?: PayRateUser | null
  /** The person's `operatives` row (live rate fallback). */
  operative?: PayRateProfile | null
  /** A ghost operative (1.34.0): no app login, so no timesheet. */
  ghost?: boolean | null
  /** `hasActiveLineManager` for the person (Submitted vs Signed). */
  hasLineManager?: boolean | null
  /** Whose pay this is, for `canViewPersonPay` (`reportPayForViewer`). */
  paySubject?: Record<string, unknown> | null
}

export type WeeklyReportPayBooking = {
  id: string
  /** `bookings` (default) or `managerSiteBookings`. */
  collection?: string | null
  /** The booking's person id as stored (`operativeId`, or `userId` on a manager site booking). */
  personId: string
  /** Organisation-zone day key. */
  dayKey: string
  timeSlot?: string | null
  workStartTime?: string | null
  workEndTime?: string | null
  isBreakRemoved?: boolean | null
  otMultiplierOverride?: number | null
  status?: string | null
  /** Where it is, for the Project Breakdown and Additional Schedule (`paidDays`). */
  jobId?: string | null
  jobNumber?: string | null
  jobName?: string | null
  locationKind?: string | null
}

export type WeeklyReportPaySignedLine = {
  id?: string | null
  bookingId?: string | null
  date: unknown
  paidHours?: number | null
  days?: number | null
  amount?: number | null
  isOvertime?: boolean | null
  payBasis?: string | null
  otMultiplier?: number | null
  details?: string | null
  decision?: string | null
  isPayeDay?: boolean | null
  isLeave?: boolean | null
  locationKind?: string | null
  jobNumber?: string | null
  projectName?: string | null
}

export type WeeklyReportPayMoneyLine = { id?: string | null; date: unknown; amount?: number | null; decision?: string | null; title?: string | null; jobNumber?: string | null; details?: string | null }

/** An approved timesheet week (the feed, `weeklyReportTimesheetFeed`). */
export type WeeklyReportPayWeek = FeedWeek<WeeklyReportPaySignedLine & { date: unknown }, WeeklyReportPayMoneyLine & { date: unknown }>

/**
 * One payment run of one person for the check line: the stored sheet (`settings/timesheet_*`, null when there is none),
 * the live payroll lines the app's timesheet collector builds for that run (the input of `timesheetInvoiceRows`), and
 * the sheet's `signedTimesheetBookingChanges` (1.47.0).
 */
export type WeeklyReportPaySheet = {
  personId: string
  startDayKey: string
  endDayKey: string
  sheet?: Record<string, unknown> | null
  payrollLines?: ReadonlyArray<InvoiceLineInput & { id: string; amount: number }> | null
  change?: { reopened?: boolean | null; changed?: boolean | null; waitingFor?: 'person' | 'lineManager' | null } | null
  /** The sheet's sign-off fields when the app holds a loaded copy (`parseTimesheetStatusFields` of the stored sheet). */
  status?: TimesheetStatusFields | null
  /** 1.45.0: the reader's entry fingerprints for a loaded copy (`timesheetInvoiceRows` `entryFingerprints`). */
  entryFingerprints?: Record<string, string> | null
}

export type WeeklyReportPayInput = {
  people: ReadonlyArray<WeeklyReportPayPerson>
  /** Live labour and manager site bookings (any range; only days in `range` count). */
  bookings: ReadonlyArray<WeeklyReportPayBooking>
  /** Approved timesheet weeks (merged per person, `mergeTimesheetFeedWeeks`). */
  timesheetWeeks?: ReadonlyArray<WeeklyReportPayWeek> | null
  /** Payment runs of self-employed people overlapping the range, for the check line. */
  sheets?: ReadonlyArray<WeeklyReportPaySheet> | null
  /** The roster (`canViewPersonPay`). */
  roster?: ReadonlyArray<Record<string, unknown>> | null
  /** The working-hours state (`PayrollTimePolicyState`) or one policy for every day. */
  organization: PayrollTimePolicyState | OrgPayrollTimePolicy
  payRateHistory?: ReadonlyArray<PayRateHistoryRow> | null
  range: { start: string; end: string }
  timeZone?: string | null
  /** The viewer; null shows every pay figure (tests, server). */
  viewer?: Record<string, unknown> | null
  currency?: string | null
}

// MARK: - Outputs

export type WeeklyReportPayRowKind =
  | 'weekdayStandard'
  | 'weekdayOvertime'
  | 'weekendWindow'
  | 'weekendOutside'
  | 'weekendEveryHour'
  | 'priceWork'
  | 'expenses'

export type WeeklyReportPayRow = {
  kind: WeeklyReportPayRowKind
  payBasis: 'day' | 'hourly' | null
  /** The rate period ("1–13 Nov"), or the items' dates for price work and expenses. */
  dates: string
  startDayKey: string
  endDayKey: string
  /** "Weekday standard", "Weekday overtime ×1.5 (12h × 1.5 = 18h)", "Saturday 14 Nov window (counts as a full day)". */
  line: string
  /** Paid hours (0 on price work and expenses). */
  hours: number
  /** Paid hours ÷ the day-rate divisor (0 on price work and expenses). */
  days: number
  /** The rate in effect (per day or per hour); 0 when not set or on money rows. */
  rate: number
  rateText: string
  pay: number
  /** `—` when the viewer may not see this person's pay (`reportPayForViewer`). */
  payLabel?: string | null
  isPaye?: boolean
  /** Rows from a signed timesheet (never re-priced). */
  source: 'live' | 'signed' | 'claim'
  /** The day-rate divisor of this row (weekday paid day, or a weekend day's "counts as"). */
  divisor: number | null
  multiplier: number | null
}

export type WeeklyReportTimesheetState = 'notStarted' | 'submitted' | 'signed' | 'exported'

export const WEEKLY_REPORT_TIMESHEET_STATE_LABELS: Record<WeeklyReportTimesheetState, string> = {
  notStarted: 'Not started',
  submitted: 'Submitted',
  signed: 'Signed',
  exported: 'Exported',
}

export type WeeklyReportCheckLine = {
  state: WeeklyReportTimesheetState
  /** "Timesheet: Signed · Invoice £3,141.77 ✓". */
  label: string
  tone: 'good' | 'warn' | 'neutral'
  /** Invoice rows dated in the range (null when pay is hidden or there is no sheet to invoice). */
  invoiceTotal: number | null
  /** The person's Pay Summary total. */
  reportTotal: number | null
  matches: boolean
  changedSinceSigned: boolean
  /** True when a payment run is only partly inside the range (only its rows dated in the range count). */
  partialRun: boolean
}

export type WeeklyReportPayPersonRow = {
  personId: string
  person: string
  role: string
  lines: WeeklyReportPayRow[]
  personTotal: number
  personTotalLabel?: string | null
  paySubject?: Record<string, unknown> | null
  /** Self-employed people only (Q2); null for PAYE, ghosts and people with no account. */
  check: WeeklyReportCheckLine | null
}

/** One booking or signed line's paid hours and days, for the Project Breakdown and Additional Schedule (Q4a). */
export type WeeklyReportPaidDay = {
  personId: string | null
  /** The booking's person id as stored (when no person matched). */
  bookingPersonId: string
  dayKey: string
  jobId: string | null
  jobNumber: string
  jobName: string
  locationKind: string
  hours: number
  days: number
  source: 'live' | 'signed'
  /** The booking id (a signed line: its `bookingId`, '' when unknown). */
  bookingId: string
  /** "07:00 – 16:00", the slot, or a signed line's details. */
  time: string
}

export type WeeklyReportPayResult = {
  people: WeeklyReportPayPersonRow[]
  grandTotal: number
  hiddenPeople: number
  /** Paid hours and days per booking or signed line (PAYE days left out), people matched or not. */
  paidDays: WeeklyReportPaidDay[]
  /** Bookings in range whose person id matches nobody (`Person not found`). */
  unmatchedBookingIds: string[]
}

export const WEEKLY_REPORT_PAY_COLUMNS: ReadonlyArray<string> = ['Person', 'Role', 'Dates', 'Line', 'Hours', 'Days', 'Rate', 'Pay']
export const WEEKLY_REPORT_RATE_NOT_SET = 'Rate not set'

// MARK: - Helpers

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const EPS = 1e-9

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

function idKey(value: unknown): string {
  return normalizeDocumentId(value)
}

function parts(dayKey: string): { y: number; m: number; d: number } {
  const [y, m, d] = dayKey.split('-').map(Number)
  return { y, m, d }
}

/** "14 Nov". */
export function weeklyReportDayText(dayKey: string): string {
  const { m, d } = parts(dayKey)
  return `${d} ${MONTHS[m - 1] ?? ''}`.trim()
}

/** "1–13 Nov", "30 Oct – 2 Nov", "14 Nov", "28 Dec 2026 – 3 Jan 2027". */
export function weeklyReportDatesText(startDayKey: string, endDayKey: string): string {
  if (!startDayKey) return ''
  if (!endDayKey || endDayKey === startDayKey) return weeklyReportDayText(startDayKey)
  const a = parts(startDayKey)
  const b = parts(endDayKey)
  if (a.y !== b.y) return `${a.d} ${MONTHS[a.m - 1]} ${a.y} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`
  if (a.m !== b.m) return `${a.d} ${MONTHS[a.m - 1]} – ${b.d} ${MONTHS[b.m - 1]}`
  return `${a.d}–${b.d} ${MONTHS[b.m - 1]}`
}

function hoursText(hours: number): string {
  return `${round2(hours)}h`
}

function isState(value: unknown): value is PayrollTimePolicyState {
  return Boolean(value) && typeof value === 'object' && 'current' in (value as Record<string, unknown>)
}

function policyFor(organization: PayrollTimePolicyState | OrgPayrollTimePolicy, dayKey: string): OrgPayrollTimePolicy {
  return isState(organization) ? payrollTimePolicyForDayFromState(organization, dayKey) : organization
}

function clockText(value: unknown): string | undefined {
  const minutes = parseClockMinutes(value as string)
  if (minutes == null) return undefined
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
}

function lineDayKey(raw: unknown, zone: string): string {
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim()
  const ms = documentInstantMs(raw)
  return ms == null ? '' : dayKeyInZone(new Date(ms), zone)
}

function weekendRule(policy: OrgPayrollTimePolicy, iso: number) {
  if (iso === 6) return policy.saturday
  if (iso === 7) return policy.sunday?.sameAsSaturday ? policy.saturday : policy.sunday
  return null
}

/**
 * Rulebook 1.51.0 §7 (Q4a): a booking's paid days — the standard part ÷ its divisor (a set-window weekend day's
 * "counts as", else the weekday paid day) plus the hours at the multiplier (clock × N − break) ÷ the weekday paid day
 * (`payrollDayRateHours`). Never capped, so the Project Breakdown ties to the Pay Summary. `standardDayHours` is the
 * weekday paid day for a result built by hand.
 */
export function bookingPaidDays(hours: PayrollHoursResult, standardDayHours: number): { hours: number; days: number } {
  const weekday = Math.max(Number(standardDayHours) || 0, 0.01)
  const standardPart = Math.max(Number(hours.standardPartDayHours ?? weekday) || 0, 0.01)
  const overtimePart = Math.max(Number(hours.overtimePartDayHours ?? weekday) || 0, 0.01)
  const std = Math.max(0, Number(hours.standardHours) || 0)
  const ot = Math.max(0, Number(hours.outsideHours) || 0) * (Number(hours.outsideMultiplier) > 0 ? Number(hours.outsideMultiplier) : 1)
  return { hours: std + ot, days: std / standardPart + ot / overtimePart }
}

type RatePeriod = { startDayKey: string; endDayKey: string; payBasis: 'day' | 'hourly'; rate: number | null; isPaye: boolean; index: number }

/** The rate periods of a person over the range: consecutive days with the same basis, rate and PAYE flag. */
function ratePeriods(person: WeeklyReportPayPerson, input: WeeklyReportPayInput, zone: string, days: string[]): { periods: RatePeriod[]; byDay: Map<string, RatePeriod> } {
  const periods: RatePeriod[] = []
  const byDay = new Map<string, RatePeriod>()
  for (const day of days) {
    const rate = rateOn(person, input, zone, day)
    const last = periods[periods.length - 1]
    if (last && last.payBasis === rate.payBasis && last.rate === rate.rate && last.isPaye === rate.isPaye) {
      last.endDayKey = day
    } else {
      periods.push({ startDayKey: day, endDayKey: day, payBasis: rate.payBasis, rate: rate.rate, isPaye: rate.isPaye, index: periods.length })
    }
    byDay.set(day, periods[periods.length - 1])
  }
  return { periods, byDay }
}

function rateOn(person: WeeklyReportPayPerson, input: WeeklyReportPayInput, zone: string, dayKey: string) {
  const user = person.user ?? null
  return payRateOnDay({
    user,
    operative: person.operative ?? null,
    history: input.payRateHistory ?? [],
    userIds: [person.id, ...(person.ids ?? [])].filter(Boolean),
    operativeIds: [...(person.operativeIds ?? [])].filter(Boolean),
    dayKey,
    timeZone: zone,
  })
}

type RowAcc = WeeklyReportPayRow & { clockHours: number; breakHours: number; overtime: boolean; weekendDayKey: string | null; weekendIso: number | null; creditHours: number }

function rateTextOf(basis: 'day' | 'hourly' | null, rate: number | null, currency: string): string {
  if (basis == null) return ''
  if (rate == null) return WEEKLY_REPORT_RATE_NOT_SET
  return `${formatMoney(rate, currency)}/${basis === 'hourly' ? 'h' : 'day'}`
}

function labelFor(row: RowAcc): string {
  const hourly = row.payBasis === 'hourly'
  const multiplied = row.multiplier != null ? ` (${multipliedHoursText({ clockHours: row.clockHours, multiplier: row.multiplier, breakHours: row.breakHours })})` : ''
  const signed = row.source === 'signed' ? ' · signed timesheet' : ''
  if (row.kind === 'weekdayStandard') return `${hourly ? 'Hourly' : 'Weekday standard'}${signed}`
  if (row.kind === 'weekdayOvertime') return `${hourly ? 'Hourly overtime' : 'Weekday overtime'} ×${round2(row.multiplier ?? 1)}${multiplied}${signed}`
  const day = row.weekendDayKey ? `${WEEKDAYS[row.weekendIso ?? 0]} ${weeklyReportDayText(row.weekendDayKey)}` : 'Weekend'
  const prefix = hourly ? 'Hourly · ' : ''
  if (row.kind === 'weekendWindow') {
    const credit = row.divisor ?? 0
    const full = credit > 0 && Math.abs(row.hours - credit) < 0.005
    return `${prefix}${day} window (${full ? 'counts as a full day' : `${hoursText(row.hours)} of ${hoursText(credit)}`})${signed}`
  }
  if (row.kind === 'weekendOutside') return `${prefix}${day} outside the window ×${round2(row.multiplier ?? 1)}${multiplied}${signed}`
  return `${prefix}${day} every hour ×${round2(row.multiplier ?? 1)}${multiplied}${signed}`
}

// MARK: - The rule

/**
 * Rulebook 1.51.0 §7: the Weekly Report's Pay Summary for one range and viewer — the rows, each person's total and
 * invoice check line, the grand total, and every booking's paid hours and days (Project Breakdown). See the file header.
 */
export function weeklyReportPayRows(input: WeeklyReportPayInput): WeeklyReportPayResult {
  const zone = zoneOrLondon(input.timeZone)
  const currency = String(input.currency || 'GBP')
  const start = String(input.range?.start || '')
  const end = String(input.range?.end || '')
  const days = eachDayKey(start, end, zone)
  const inRange = (dayKey: string) => Boolean(dayKey) && dayKey >= start && dayKey <= end
  const people = (input.people || []).filter((person) => person && idKey(person.id))
  const byId = new Map<string, WeeklyReportPayPerson>()
  for (const person of people) {
    for (const id of [person.id, ...(person.ids ?? [])]) {
      const key = idKey(id)
      if (key && !byId.has(key)) byId.set(key, person)
    }
  }
  const idsOf = (person: WeeklyReportPayPerson) => [person.id, ...(person.ids ?? [])].map(String).filter(Boolean)
  const weeks = (input.timesheetWeeks || []) as ReadonlyArray<WeeklyReportPayWeek>
  const weekOwner = (week: { userId: string }) => byId.get(idKey(week.userId)) ?? null
  const periodsOf = new Map<string, ReturnType<typeof ratePeriods>>()
  const periodsFor = (person: WeeklyReportPayPerson) => {
    let found = periodsOf.get(person.id)
    if (!found) {
      found = ratePeriods(person, input, zone, days)
      periodsOf.set(person.id, found)
    }
    return found
  }
  const rows = new Map<string, Map<string, RowAcc>>()
  const paidDays: WeeklyReportPaidDay[] = []
  const unmatched: string[] = []

  const addRow = (person: WeeklyReportPayPerson, key: string, seed: () => RowAcc, slice: Pick<BookingPaySlice, 'isOvertime' | 'paidHours' | 'pay' | 'clockHours' | 'breakHours'>, hours: number, daysValue: number, dayKey: string) => {
    let list = rows.get(person.id)
    if (!list) {
      list = new Map()
      rows.set(person.id, list)
    }
    const row = list.get(key) ?? seed()
    const clock = Number(slice.breakHours) > 0 ? Number(slice.clockHours) || 0 : slice.paidHours
    row.clockHours += row.overtime ? clock : 0
    row.breakHours += row.overtime ? Number(slice.breakHours) || 0 : 0
    const merged = mergeBookingPaySlice({ isOvertime: row.overtime, paidHours: 0, pay: row.pay }, slice)
    row.pay = merged.pay
    row.hours += hours
    row.days += daysValue
    void dayKey
    list.set(key, row)
  }

  const kindOf = (iso: number, overtime: boolean, everyHour: boolean): WeeklyReportPayRowKind => {
    if (iso !== 6 && iso !== 7) return overtime ? 'weekdayOvertime' : 'weekdayStandard'
    if (!overtime) return 'weekendWindow'
    return everyHour ? 'weekendEveryHour' : 'weekendOutside'
  }

  const seedFor = (person: WeeklyReportPayPerson, period: RatePeriod, kind: WeeklyReportPayRowKind, basis: 'day' | 'hourly', rate: number | null, source: 'live' | 'signed', divisor: number, multiplier: number | null, dayKey: string, iso: number): RowAcc => {
    const weekend = kind.startsWith('weekend')
    return {
      kind,
      payBasis: basis,
      dates: weeklyReportDatesText(period.startDayKey, period.endDayKey),
      startDayKey: period.startDayKey,
      endDayKey: period.endDayKey,
      line: '',
      hours: 0,
      days: 0,
      rate: rate ?? 0,
      rateText: rateTextOf(basis, rate, currency),
      pay: 0,
      source,
      divisor,
      multiplier,
      clockHours: 0,
      breakHours: 0,
      overtime: kind === 'weekdayOvertime' || kind === 'weekendOutside' || kind === 'weekendEveryHour',
      weekendDayKey: weekend ? dayKey : null,
      weekendIso: weekend ? iso : null,
      creditHours: 0,
    }
  }

  // 1. Live bookings (not covered by an approved timesheet week).
  for (const booking of input.bookings || []) {
    const dayKey = String(booking?.dayKey || '')
    if (!booking || !inRange(dayKey) || !bookingOccupiesDay(booking.status ?? 'Confirmed')) continue
    const person = byId.get(idKey(booking.personId)) ?? null
    if (person && timesheetFeedCovers(weeks as never, idsOf(person), dayKey, zone)) continue
    const policy = policyFor(input.organization, dayKey)
    const hours = payrollHoursResult({
      booking: {
        timeSlot: booking.timeSlot ?? undefined,
        workStartTime: clockText(booking.workStartTime),
        workEndTime: clockText(booking.workEndTime),
        isBreakRemoved: booking.isBreakRemoved === true,
        otMultiplierOverride: booking.otMultiplierOverride ?? undefined,
      } as never,
      dayKey,
      policy,
      timeZone: zone,
    })
    const weekday = weekdayPaidHours(policy)
    const period = person ? periodsFor(person).byDay.get(dayKey) ?? null : null
    if (period?.isPaye) continue
    const paid = bookingPaidDays(hours, weekday)
    paidDays.push({
      personId: person?.id ?? null,
      bookingPersonId: String(booking.personId ?? ''),
      dayKey,
      jobId: booking.jobId ?? null,
      jobNumber: String(booking.jobNumber ?? ''),
      jobName: String(booking.jobName ?? ''),
      locationKind: String(booking.locationKind ?? ''),
      hours: paid.hours,
      days: paid.days,
      source: 'live',
      bookingId: String(booking.id ?? ''),
      time: booking.workStartTime && booking.workEndTime ? `${clockText(booking.workStartTime) ?? booking.workStartTime} – ${clockText(booking.workEndTime) ?? booking.workEndTime}` : String(booking.timeSlot || 'Full Day'),
    })
    if (!person || !period) {
      unmatched.push(booking.id)
      continue
    }
    const iso = isoWeekdayOfDayKey(dayKey, zone)
    const everyHour = Boolean(weekendRule(policy, iso)?.allHoursAtMultiplierMode)
    const slices = bookingPaySlices({
      hours,
      standardDayHours: weekday,
      payBasis: period.payBasis,
      dayRate: period.payBasis === 'day' ? period.rate : null,
      hourlyRate: period.payBasis === 'hourly' ? period.rate : null,
    })
    for (const slice of slices) {
      const kind = kindOf(iso, slice.isOvertime, everyHour)
      const multiplier = slice.isOvertime ? slice.otMultiplier ?? 1 : null
      const divisor = slice.standardDayHours
      const sliceHours = slice.isOvertime ? slice.paidHours * (multiplier ?? 1) : slice.paidHours
      const key = ['live', period.index, period.payBasis, kind, kind.startsWith('weekend') ? dayKey : '', multiplier ?? '', round2(divisor)].join('|')
      addRow(person, key, () => seedFor(person, period, kind, period.payBasis, period.rate, 'live', divisor, multiplier, dayKey, iso), slice, sliceHours, sliceHours / Math.max(divisor, 0.01), dayKey)
    }
  }

  // 2. Signed timesheet lines (never re-priced).
  for (const { weekIndex, line } of timesheetFeedLabourLines(weeks as never, { start, end }, zone)) {
    const week = weeks[weekIndex]
    const person = week ? weekOwner(week) : null
    const signed = line as WeeklyReportPaySignedLine
    const dayKey = lineDayKey(signed.date, zone)
    if (!person || !inRange(dayKey) || signed.isPayeDay === true || signed.isLeave === true) continue
    const period = periodsFor(person).byDay.get(dayKey)
    if (!period || period.isPaye) continue
    const basis: 'day' | 'hourly' = signed.payBasis === 'hourly' ? 'hourly' : 'day'
    const overtime = signed.isOvertime === true
    const multiplier = overtime ? (Number(signed.otMultiplier) > 0 ? Number(signed.otMultiplier) : 1) : null
    const stored = Math.max(0, Number(signed.paidHours) || 0)
    const storedDays = Math.max(0, Number(signed.days) || 0)
    const policy = policyFor(input.organization, dayKey)
    const weekday = weekdayPaidHours(policy)
    // 1.44.0: a signed day-rate line's own paid day is paidHours ÷ days; else that day's weekday paid day.
    // 1.44.0 / 1.49.0: the hours at a multiplier always divide by the weekday paid day (1.49.0).
    const divisor = !overtime && basis === 'day' && storedDays > 0.0001 && stored > 0 ? stored / storedDays : weekday
    const parsed = overtime ? parseMultipliedHoursText(signed.details) : null
    const paidHours = overtime ? (parsed ? Math.max(0, parsed.clockHours * parsed.multiplier - parsed.breakHours) : stored * (multiplier ?? 1)) : stored
    const amount = roundPennies(Number(signed.amount) || 0)
    const daysValue = paidHours / Math.max(divisor, 0.01)
    const quantity = basis === 'hourly' ? paidHours : daysValue
    const rate = quantity > 0.0001 ? roundPennies(amount / quantity) : 0
    const iso = isoWeekdayOfDayKey(dayKey, zone)
    const everyHour = Boolean(weekendRule(policy, iso)?.allHoursAtMultiplierMode)
    const kind = kindOf(iso, overtime, everyHour)
    paidDays.push({
      personId: person.id,
      bookingPersonId: String(week?.userId ?? ''),
      dayKey,
      jobId: null,
      jobNumber: String(signed.jobNumber ?? ''),
      jobName: String(signed.projectName ?? ''),
      locationKind: String(signed.locationKind ?? ''),
      hours: paidHours,
      days: daysValue,
      source: 'signed',
      bookingId: String(signed.bookingId ?? ''),
      time: String(signed.details || 'Timesheet'),
    })
    const slice = {
      isOvertime: overtime,
      paidHours: overtime ? (parsed ? parsed.clockHours - parsed.breakHours / parsed.multiplier : stored) : stored,
      pay: amount,
      ...(parsed && parsed.breakHours > 0 ? { clockHours: parsed.clockHours, breakHours: parsed.breakHours } : {}),
    }
    const key = ['signed', period.index, basis, kind, kind.startsWith('weekend') ? dayKey : '', multiplier ?? '', round2(divisor), rate].join('|')
    addRow(person, key, () => seedFor(person, period, kind, basis, rate, 'signed', divisor, multiplier, dayKey, iso), slice, paidHours, daysValue, dayKey)
  }

  // 3. Price work and expenses from approved weeks.
  for (const kind of ['priceWork', 'expenses'] as const) {
    for (const { weekIndex, line } of timesheetFeedMoneyLines(weeks as never, kind, { start, end }, zone)) {
      const week = weeks[weekIndex]
      const person = week ? weekOwner(week) : null
      if (!person) continue
      const dayKey = lineDayKey((line as WeeklyReportPayMoneyLine).date, zone)
      let list = rows.get(person.id)
      if (!list) {
        list = new Map()
        rows.set(person.id, list)
      }
      const row: RowAcc = list.get(kind) ?? {
        kind,
        payBasis: null,
        dates: '',
        startDayKey: dayKey,
        endDayKey: dayKey,
        line: kind === 'priceWork' ? 'Price work' : 'Expenses',
        hours: 0,
        days: 0,
        rate: 0,
        rateText: '',
        pay: 0,
        source: 'claim',
        divisor: null,
        multiplier: null,
        clockHours: 0,
        breakHours: 0,
        overtime: false,
        weekendDayKey: null,
        weekendIso: null,
        creditHours: 0,
      }
      row.pay = roundPennies(row.pay + roundPennies(Number((line as WeeklyReportPayMoneyLine).amount) || 0))
      if (dayKey && dayKey < row.startDayKey) row.startDayKey = dayKey
      if (dayKey && dayKey > row.endDayKey) row.endDayKey = dayKey
      row.dates = weeklyReportDatesText(row.startDayKey, row.endDayKey)
      list.set(kind, row)
    }
  }

  // 4. People: rows in order, totals, check lines.
  const kindOrder: Record<WeeklyReportPayRowKind, number> = { weekdayStandard: 0, weekdayOvertime: 1, weekendWindow: 2, weekendOutside: 3, weekendEveryHour: 4, priceWork: 8, expenses: 9 }
  const built: WeeklyReportPayPersonRow[] = []
  for (const person of people) {
    const list = rows.get(person.id)
    if (!list || list.size === 0) continue
    const ordered = [...list.values()]
      .filter((row) => row.pay > 0.0001 || row.hours > 0.0001)
      .sort(
        (a, b) =>
          (a.source === 'claim' ? 1 : 0) - (b.source === 'claim' ? 1 : 0) ||
          a.startDayKey.localeCompare(b.startDayKey) ||
          (a.weekendDayKey ?? '').localeCompare(b.weekendDayKey ?? '') ||
          kindOrder[a.kind] - kindOrder[b.kind] ||
          (a.multiplier ?? 0) - (b.multiplier ?? 0)
      )
    if (ordered.length === 0) continue
    const lines: WeeklyReportPayRow[] = ordered.map((row) => {
      const out: WeeklyReportPayRow = {
        kind: row.kind,
        payBasis: row.payBasis,
        dates: row.dates,
        startDayKey: row.startDayKey,
        endDayKey: row.endDayKey,
        line: row.source === 'claim' ? row.line : labelFor(row),
        hours: round2(row.hours),
        days: round2(row.days),
        rate: row.rate,
        rateText: row.rateText,
        pay: roundPennies(row.pay),
        isPaye: false,
        source: row.source,
        divisor: row.divisor,
        multiplier: row.multiplier,
      }
      return out
    })
    const personTotal = roundPennies(lines.reduce((sum, row) => sum + row.pay, 0))
    built.push({
      personId: person.id,
      person: person.name,
      role: person.role,
      lines,
      personTotal,
      personTotalLabel: null,
      paySubject: person.paySubject ?? null,
      check: checkLine(person, personTotal, input, zone, currency),
    })
  }
  built.sort((a, b) => a.person.localeCompare(b.person) || a.personId.localeCompare(b.personId))

  const shown = reportPayForViewer(built, { viewer: input.viewer === undefined ? null : input.viewer, roster: input.roster ?? [] })
  const viewerGiven = input.viewer != null
  const out = viewerGiven ? shown.rows : built
  const hiddenIds = new Set(viewerGiven ? out.filter((row) => row.personTotalLabel === '—').map((row) => row.personId) : [])
  const people2 = out.map((row) => (hiddenIds.has(row.personId) && row.check ? { ...row, check: hideCheckAmounts(row.check) } : row))
  return {
    people: people2,
    grandTotal: viewerGiven ? shown.grandTotal : roundPennies(built.reduce((sum, row) => sum + row.personTotal, 0)),
    hiddenPeople: viewerGiven ? shown.hiddenPeople : 0,
    paidDays,
    unmatchedBookingIds: unmatched,
  }
}

function hideCheckAmounts(check: WeeklyReportCheckLine): WeeklyReportCheckLine {
  return { ...check, invoiceTotal: null, reportTotal: null, label: `Timesheet: ${WEEKLY_REPORT_TIMESHEET_STATE_LABELS[check.state]}`, tone: 'neutral' }
}

const STATE_ORDER: Record<WeeklyReportTimesheetState, number> = { notStarted: 0, submitted: 1, signed: 2, exported: 3 }

/**
 * Rulebook 1.51.0 §7 (Q2): a self-employed person's check line — the timesheet state of the payment runs in the range
 * (`timesheetListBucket`; the least advanced, with a count when there are several) and the invoice rows dated in the
 * range (`timesheetInvoiceRows` in `decided` mode, `timesheetDays` = the run's days in the range; a signed snapshot's
 * rows by their stored date), compared with the person's Pay Summary total. Amber when they differ or a signed sheet's
 * bookings changed since it was signed (1.47.0). Null for PAYE-only people, ghosts and people with no account.
 */
function checkLine(person: WeeklyReportPayPerson, reportTotal: number, input: WeeklyReportPayInput, zone: string, currency: string): WeeklyReportCheckLine | null {
  if (!person.user || person.ghost === true) return null
  const start = input.range.start
  const end = input.range.end
  const ids = new Set([person.id, ...(person.ids ?? [])].map(idKey).filter(Boolean))
  const sheets = (input.sheets || []).filter((row) => row && ids.has(idKey(row.personId)) && row.endDayKey >= start && row.startDayKey <= end)
  const selfEmployedDays = eachDayKey(start, end, zone).filter((day) => !rateOn(person, input, zone, day).isPaye)
  if (selfEmployedDays.length === 0) return null
  const counted = new Set(selfEmployedDays)
  let invoice = 0
  let partialRun = false
  let changedSinceSigned = false
  let invoiced = false
  const states: WeeklyReportTimesheetState[] = []
  for (const row of sheets) {
    if (row.startDayKey < start || row.endDayKey > end) partialRun = true
    const fields = row.status ?? parseTimesheetStatusFields(row.sheet ?? null)
    const bucket = row.sheet || row.status ? timesheetListBucket(fields, person.hasLineManager === true, row.change ?? null) : 'unsigned'
    states.push(bucket === 'exported' ? 'exported' : bucket === 'signed' ? 'signed' : bucket === 'awaiting' ? 'submitted' : 'notStarted')
    if (row.change?.reopened === true || (row.change?.changed === true && fields.operativeSignedAtMs != null && bucket !== 'exported')) changedSinceSigned = true
    const days = eachDayKey(row.startDayKey, row.endDayKey, zone).filter((day) => counted.has(day))
    const invoiceRows = timesheetInvoiceRows({ sheet: row.sheet ?? null, payrollLines: row.payrollLines ?? [], extrasMode: 'decided', timesheetDays: days, timeZone: zone, entryFingerprints: row.entryFingerprints ?? null })
    for (const invoiceRow of invoiceRows) {
      if (invoiceRow.source === 'override') {
        const stored = invoiceRow.stored ?? {}
        const day = lineDayKey(stored.date ?? stored.startDate, zone)
        if (day && !counted.has(day)) continue
      }
      invoice += invoiceRow.amount
      invoiced = true
    }
  }
  if (states.length === 0) states.push('notStarted')
  const least = states.reduce((a, b) => (STATE_ORDER[b] < STATE_ORDER[a] ? b : a))
  const signedCount = states.filter((state) => state === 'signed' || state === 'exported').length
  const stateText = `${WEEKLY_REPORT_TIMESHEET_STATE_LABELS[least]}${states.length > 1 ? ` · ${signedCount} of ${states.length} signed` : ''}`
  const invoiceTotal = invoiced || sheets.some((row) => row.sheet || row.status) ? roundPennies(invoice) : null
  const money = (value: number) => formatMoney(value, currency)
  const invoiceWord = partialRun ? 'Invoice rows in this period' : 'Invoice'
  const matches = invoiceTotal != null && Math.abs(invoiceTotal - reportTotal) < 0.005 && !changedSinceSigned
  let label = `Timesheet: ${stateText}`
  if (invoiceTotal == null) label += ' · no invoice yet'
  else if (matches) label += ` · ${invoiceWord} ${money(invoiceTotal)} ✓`
  else label += ` · ${invoiceWord} ${money(invoiceTotal)} · report ${money(reportTotal)}`
  if (changedSinceSigned) label += ' · changed since signed'
  return {
    state: least,
    label,
    tone: invoiceTotal == null ? 'neutral' : matches ? 'good' : 'warn',
    invoiceTotal,
    reportTotal,
    matches,
    changedSinceSigned,
    partialRun,
  }
}

// MARK: - Annual leave (Q4b)

export const WEEKLY_REPORT_PERSON_NOT_FOUND = 'Person not found'

export type WeeklyReportLeaveRecord = {
  id: string
  userId?: string | null
  operativeId?: string | null
  /** Older iOS builds stored the account's email as `userId` (§10); a stored name is shown when nobody matches. */
  userName?: string | null
  startDayKey: string
  endDayKey: string
  timeSlot?: string | null
  status?: string | null
}

export type WeeklyReportLeavePerson = { id: string; name: string; role: string; ids?: ReadonlyArray<string> | null; email?: string | null }

export type WeeklyReportLeaveRow = { personId: string | null; person: string; role: string; days: number; type: string; found: boolean }

/**
 * Rulebook 1.51.0 §7 (Q4b): the Annual Leave section. Approved records in the range (`leaveDaysInRange`), matched to a
 * person under every id they go by and their email, without case (`personIdSet`, `leaveRecordsForAccount`) — never by
 * one exact id. A record nobody matches is listed as its stored name, else "Person not found (id …)", and returned in
 * `unmatched` for Settings → Data health. Rows per person (never per display name), sorted by name.
 */
export function weeklyReportLeaveRows(input: {
  records: ReadonlyArray<WeeklyReportLeaveRecord>
  people: ReadonlyArray<WeeklyReportLeavePerson>
  range: { start: string; end: string }
  timeZone?: string | null
  nonWorkingDayKeys?: ReadonlyArray<string> | null
}): { rows: WeeklyReportLeaveRow[]; total: number; unmatched: Array<{ recordId: string; userId: string | null; operativeId: string | null }> } {
  const zone = zoneOrLondon(input.timeZone)
  const personFor = leavePersonMatcher(input.people)
  const rows = new Map<string, WeeklyReportLeaveRow>()
  const unmatched: Array<{ recordId: string; userId: string | null; operativeId: string | null }> = []
  for (const record of input.records || []) {
    if (!record || String(record.status ?? 'approved').toLowerCase() !== 'approved') continue
    const days = leaveDaysInRange(
      { startDayKey: record.startDayKey, endDayKey: record.endDayKey, timeSlot: record.timeSlot ?? 'FULL DAY' },
      { startDayKey: input.range.start, endDayKey: input.range.end },
      zone,
      input.nonWorkingDayKeys ?? null
    )
    if (!(days > 0)) continue
    const person = personFor(record)
    if (!person) {
      const missingId = String(record.userId || record.operativeId || record.id || '').trim()
      unmatched.push({ recordId: record.id, userId: record.userId ?? null, operativeId: record.operativeId ?? null })
      const stored = String(record.userName ?? '').trim()
      const name = stored || `${WEEKLY_REPORT_PERSON_NOT_FOUND} (id ${missingId})`
      const key = `missing:${idKey(missingId)}`
      const row = rows.get(key) ?? { personId: null, person: name, role: '—', days: 0, type: 'Approved', found: false }
      row.days = round2(row.days + days)
      rows.set(key, row)
      continue
    }
    const row = rows.get(person.id) ?? { personId: person.id, person: person.name, role: person.role, days: 0, type: 'Approved', found: true }
    row.days = round2(row.days + days)
    rows.set(person.id, row)
  }
  const list = [...rows.values()].sort((a, b) => Number(b.found) - Number(a.found) || a.person.localeCompare(b.person))
  return { rows: list, total: round2(list.reduce((sum, row) => sum + row.days, 0)), unmatched }
}

function leavePersonMatcher(people: ReadonlyArray<WeeklyReportLeavePerson> | null | undefined) {
  const byId = new Map<string, WeeklyReportLeavePerson>()
  for (const person of people || []) {
    if (!person) continue
    for (const id of [person.id, ...(person.ids ?? []), person.email ?? '']) {
      const key = idKey(id)
      if (key && !byId.has(key)) byId.set(key, person)
    }
  }
  return (record: Pick<WeeklyReportLeaveRecord, 'userId' | 'operativeId'>) => byId.get(idKey(record.userId)) ?? byId.get(idKey(record.operativeId)) ?? null
}

/**
 * Rulebook 1.51.0 §7 (Q4b): leave records (any status, any date) that match no person under any id or email — the same
 * matching as `weeklyReportLeaveRows`. Settings → Data health lists them so an admin can fix the record or the person.
 */
export function leaveRecordsWithoutPerson<T extends WeeklyReportLeaveRecord>(input: {
  records: ReadonlyArray<T>
  people: ReadonlyArray<WeeklyReportLeavePerson>
}): T[] {
  const personFor = leavePersonMatcher(input.people)
  return (input.records || []).filter((record) => record && !personFor(record))
}

// MARK: - Warnings (Q4d)

/** One status word for every open warning on the weekly report ("Active" was the same thing). */
export const WEEKLY_REPORT_WARNING_OPEN = 'Open'

/**
 * Rulebook 1.51.0 §7 (Q4d): a clash row's Detail on the weekly report — facts only, never an app instruction:
 * "Booked in two places on 10 Nov 2026: 1 Carnaby Street 07:00–16:00; Office 09:00–17:00."
 */
export function weeklyReportClashDetail(input: { dayText: string; places: ReadonlyArray<{ label?: string | null; time?: string | null }> }): string {
  const places = (input.places || []).filter(Boolean)
  const count = places.length === 2 ? 'two' : String(places.length)
  const list = places.map((place) => [String(place.label ?? '').trim(), String(place.time ?? '').trim()].filter(Boolean).join(' ')).filter(Boolean)
  return `Booked in ${count} places on ${input.dayText}${list.length ? `: ${list.join('; ')}` : ''}.`
}

// Day keys helper for callers that hold Dates (organisation zone).
export function weeklyReportDayKey(date: Date | string | number, timeZone?: string | null): string {
  return dayKeyInZone(date instanceof Date ? date : new Date(date), zoneOrLondon(timeZone))
}

