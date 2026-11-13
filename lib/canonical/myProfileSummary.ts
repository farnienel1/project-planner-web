/**
 * Rulebook 1.35.0 §12 (owner decisions 7 Nov, "My Profile"): the five personal figures on My Profile — annual leave
 * left this year, hours booked this week, open tasks, qualifications expiring soon and the line manager(s).
 *
 * Composes existing rules only; no new maths:
 *   - leave: `annualLeaveBalance` over `leaveRecordsForAccount` (every id the person goes by, same-email ids, catalogue
 *     rows on their email, the email itself), with the region's bank holidays. `remaining` already takes pending
 *     requests off (Q4 = after).
 *   - hours this week: the Monday–Sunday organisation week containing today (`organizationWeekDayKeys`, Q2), each day
 *     `bookedWorkedHours` over the person's labour and manager site bookings that day under the working hours in
 *     effect on it (`payrollTimePolicyForDayFromState`): clock time less the unpaid break, never multiplied, overlaps
 *     once (Q1 = a). Days later in the week that are already booked count.
 *   - tasks: `tasksAssignedToViewer` (the Home rule), not completed (`isTaskCompleted`); tasks with no due date count
 *     as open (Q3); overdue `isTaskOverdue`; due this week the Home figure (`homeOverviewMetrics.tasksDueThisWeek`).
 *   - qualifications: `qualificationExpiryCount` limited to the person's own `operatives` rows (none → 0).
 *   - line manager: `lineManagerSummary`; the screens list every `ids[].name` (Q5 = all).
 *
 * Pure, JSON in / JSON out, so iOS calls it through `CanonicalBusinessEngine`.
 */

import {
  annualLeaveBalance,
  annualLeaveBankHolidayRange,
  type AnnualLeaveBalance,
  type AnnualLeaveBankHolidayRange,
  type LeaveDayRecord,
} from './annualLeaveBalance'
import { bookingIdsForAccount, leaveRecordsForAccount } from './bookingPerson'
import type { EmploymentTypeUser } from './userProfile'
import { organizationWeekDayKeys } from './dayKeys'
import { isTaskCompleted, isTaskOverdue } from './dueDates'
import { holidayDocumentDayKey } from './holidayDocument'
import {
  homeBookingDayKey,
  homeOverviewMetrics,
  qualificationExpiryCount,
  tasksAssignedToViewer,
  type HomeOverviewTask,
} from './homeOverview'
import { lineManagerSummary, type LineManagerRosterPerson, type LineManagerSubject } from './lineManagers'
import { bookedWorkedHours, type CoverageBooking } from './managerCoverage'
import { idKey, idText, personIdSet } from './personIds'
import {
  parsePayrollTimePolicyState,
  payrollTimePolicyForDayFromState,
  type PayrollTimePolicyState,
} from './payrollPolicySchedule'
import { bookingOccupiesDay, type QualificationExpiryInput } from './warningRows'

export type MyProfileSummaryUser = LineManagerSubject & {
  id?: string | null
  email?: string | null
  formerUserIds?: ReadonlyArray<string> | null
  sameEmailUserIds?: ReadonlyArray<string> | null
  annualLeaveEnabled?: boolean | null
  annualLeaveDaysPerYear?: number | null
  annualLeaveYearStartMonth?: number | null
  annualLeaveYearEndMonth?: number | null
  annualLeaveCarriesOver?: boolean | null
  annualLeaveYearAllowance?: number | null
  annualLeaveYearAllowanceKey?: string | null
  /** `users/{uid}.employmentStartDate` (organisation-zone day key). */
  employmentStartDate?: string | null
  /** 1.40.0: the allowance applies only on PAYE days (`employmentTypeOnDay`); a missing type reads as self-employed. */
  employmentType?: string | null
  employmentTypeTransitionFrom?: string | null
  employmentTypeEffectiveAt?: Date | string | number | null
}

export type MyProfileSummaryBooking = CoverageBooking & {
  operativeId?: string | null
  /** Stored date (any shape `holidayDocumentDayKey` reads) or `dayKey`. */
  date?: unknown
  dayKey?: string | null
  status?: string | null
  otMultiplierOverride?: number | null
}

export type MyProfileSummaryManagerSiteBooking = CoverageBooking & {
  userId?: string | null
  date?: unknown
  dayKey?: string | null
  /** Manager site bookings normally carry no status; one that reads as not occupying the day is left out. */
  status?: string | null
}

export type MyProfileSummaryInput = {
  nowMs: number
  /** The organisation zone (`organizationTimeZone`). */
  timeZone: string
  /** The signed-in person (account id and email). */
  viewer: { id?: string | null; email?: string | null }
  /** Their users document (leave fields, line manager fields, alias ids). */
  user: MyProfileSummaryUser | null
  /** Every users document of the organisation (unfolded), with names for the line manager. */
  roster: ReadonlyArray<LineManagerRosterPerson & { sameEmailUserIds?: ReadonlyArray<string> | null; isActive?: boolean | null }>
  /** `operatives` rows, with each row's qualification expiries (`qualificationExpiryRows` shape). */
  operatives?: ReadonlyArray<{
    id: string
    email?: string | null
    isActive?: boolean | null
    name?: string | null
    expiries?: QualificationExpiryInput['operatives'][number]['expiries'] | null
  }> | null
  /** `managers` rows. */
  managers?: ReadonlyArray<{ id: string; email?: string | null }> | null
  /** `organizations/{orgId}.annualLeaveDefaults`. */
  leaveDefaults?: {
    daysPerYear?: number | null
    startMonth?: number | null
    endMonth?: number | null
    carriesOver?: boolean | null
    maxCarryOverDays?: number | null
  } | null
  /** Leave records as `parseHolidayDocument` returns them (organisation-zone day keys). */
  holidays?: ReadonlyArray<LeaveDayRecord & { userId?: string | null; operativeId?: string | null }> | null
  /** Bank holidays of the organisation's region. */
  nonWorkingDayKeys?: ReadonlyArray<string> | null
  /** 1.40.0: the person's manual adjustments (`parseAnnualLeaveAdjustmentDocument`), any year; this year's count. */
  leaveAdjustments?: ReadonlyArray<{ days?: unknown; yearKey?: unknown }> | null
  /**
   * 1.40.0 (review r306 #2): the person's employment-type fields from their pay record (`annualLeaveEmploymentInput`:
   * the pay profile while `privatePay` is on). When given — null included, meaning it could not be read — it is used
   * instead of the `user` fields.
   */
  leaveEmployment?: EmploymentTypeUser | null
  tasks?: ReadonlyArray<HomeOverviewTask> | null
  /** Labour bookings (`bookings`). */
  bookings?: ReadonlyArray<MyProfileSummaryBooking> | null
  /** Manager schedule bookings (`managerSiteBookings`). */
  managerSiteBookings?: ReadonlyArray<MyProfileSummaryManagerSiteBooking> | null
  /** The working-hours state (`parsePayrollTimePolicyState`) or the raw organisation document. */
  policyState: PayrollTimePolicyState | Record<string, unknown> | null | undefined
}

export type MyProfileSummary = {
  dayKey: string
  leave: AnnualLeaveBalance
  hoursThisWeek: {
    startDayKey: string
    endDayKey: string
    hours: number
    days: Array<{ dayKey: string; hours: number }>
  }
  tasks: { open: number; overdue: number; dueThisWeek: number }
  qualifications: { expired: number; expiringSoon: number; total: number }
  lineManager: ReturnType<typeof lineManagerSummary>
}

function isState(value: unknown): value is PayrollTimePolicyState {
  return Boolean(value && typeof value === 'object' && 'current' in (value as Record<string, unknown>) && (value as PayrollTimePolicyState).current)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Rulebook 1.35.0 §12: the My Profile figures for the signed-in person (see the module comment). */
function profileDayKey(input: { nowMs: number; timeZone: string }): string {
  return holidayDocumentDayKey(Number.isFinite(input.nowMs) ? input.nowMs : Date.now(), input.timeZone)
}

/**
 * Rulebook 1.35.0 §4.4 / §12: the bank-holiday days My Profile's leave figure needs — `annualLeaveBankHolidayRange`
 * for the person's own leave year on the organisation day of `nowMs` (the previous leave year's start to the current
 * one's end, for carry-over). Takes the same `user` and `leaveDefaults` as `myProfileSummary`.
 */
export function myProfileBankHolidayRange(
  input: Pick<MyProfileSummaryInput, 'nowMs' | 'timeZone' | 'user' | 'leaveDefaults' | 'leaveEmployment'>
): AnnualLeaveBankHolidayRange {
  const user = input.user || null
  const defaults = input.leaveDefaults || {}
  return annualLeaveBankHolidayRange({
    annualLeaveEnabled: user?.annualLeaveEnabled,
    startMonth: user?.annualLeaveYearStartMonth,
    endMonth: user?.annualLeaveYearEndMonth,
    orgStartMonth: defaults.startMonth,
    orgEndMonth: defaults.endMonth,
    onDayKey: profileDayKey(input),
    timeZone: input.timeZone,
    employment: employmentFor(input),
  })
}

/** 1.40.0: the employment-type input — `leaveEmployment` when the caller passed it, else the `user` fields. */
function employmentFor(input: Pick<MyProfileSummaryInput, 'user' | 'leaveEmployment'>): EmploymentTypeUser | null {
  if (Object.prototype.hasOwnProperty.call(input, 'leaveEmployment')) return input.leaveEmployment ?? null
  return employmentOf(input.user || null)
}

/** 1.40.0: the employment-type fields `annualLeaveBalance` reads. */
function employmentOf(user: MyProfileSummaryUser | null) {
  return {
    employmentType: user?.employmentType ?? null,
    employmentTypeTransitionFrom: user?.employmentTypeTransitionFrom ?? null,
    employmentTypeEffectiveAt: user?.employmentTypeEffectiveAt ?? null,
  }
}

export function myProfileSummary(input: MyProfileSummaryInput): MyProfileSummary {
  const timeZone = input.timeZone
  const dayKey = profileDayKey(input)
  const user = input.user || null
  const roster = (input.roster || []).filter((row) => row && idText(row.id))
  const operatives = (input.operatives || []).filter((row) => row && idText(row.id))
  const managers = (input.managers || []).filter((row) => row && idText(row.id))
  const accountId = idText(user?.id) || idText(input.viewer?.id)
  const email = idText(user?.email) || idText(input.viewer?.email)

  // Every id the person goes by: their account, former and same-email ids (`personIdSet` over the roster) and the
  // catalogue rows on their email (`bookingIdsForAccount`).
  const rosterIds = personIdSet(
    { id: accountId || undefined, email: email || null, formerUserIds: user?.formerUserIds ?? [], sameEmailUserIds: user?.sameEmailUserIds ?? [] },
    roster
  )
  const account = {
    id: accountId,
    email: email || null,
    formerIds: user?.formerUserIds ?? [],
    aliasIds: rosterIds.filter((id) => idKey(id) !== idKey(accountId)),
  }
  const catalogue = operatives.map((row) => ({ id: row.id, email: row.email ?? null }))
  const personIds = new Set([...rosterIds, ...(accountId ? bookingIdsForAccount(account, catalogue) : [])].map(idKey).filter(Boolean))

  // 1. Annual leave left this leave year.
  const defaults = input.leaveDefaults || {}
  const records = accountId || email ? leaveRecordsForAccount(input.holidays || [], account, catalogue) : []
  const leave = annualLeaveBalance({
    annualLeaveEnabled: user?.annualLeaveEnabled,
    daysPerYear: user?.annualLeaveDaysPerYear,
    startMonth: user?.annualLeaveYearStartMonth,
    endMonth: user?.annualLeaveYearEndMonth,
    carriesOver: user?.annualLeaveCarriesOver,
    yearAllowance: user?.annualLeaveYearAllowance,
    yearAllowanceKey: user?.annualLeaveYearAllowanceKey,
    orgDaysPerYear: defaults.daysPerYear,
    orgStartMonth: defaults.startMonth,
    orgEndMonth: defaults.endMonth,
    bookings: records.map((row) => ({
      startDayKey: row.startDayKey,
      endDayKey: row.endDayKey,
      timeSlot: row.timeSlot ?? null,
      status: row.status ?? null,
    })),
    onDayKey: dayKey,
    timeZone,
    nonWorkingDayKeys: input.nonWorkingDayKeys ?? [],
    employmentStartDayKey: user?.employmentStartDate ?? null,
    maxCarryOverDays: defaults.maxCarryOverDays ?? null,
    employment: employmentFor(input),
    adjustments: input.leaveAdjustments ?? [],
  })

  // 2. Hours booked this Monday–Sunday week (worked hours, no multiplier).
  const week = organizationWeekDayKeys(dayKey, timeZone)
  const state: PayrollTimePolicyState = isState(input.policyState)
    ? input.policyState
    : parsePayrollTimePolicyState(input.policyState ?? {}, timeZone)
  const byDay = new Map<string, CoverageBooking[]>()
  const add = (key: string, booking: CoverageBooking) => {
    if (!week.dayKeys.includes(key)) return
    const list = byDay.get(key) || []
    list.push({
      timeSlot: booking.timeSlot ?? null,
      workStartTime: booking.workStartTime ?? null,
      workEndTime: booking.workEndTime ?? null,
      isBreakRemoved: booking.isBreakRemoved === true,
    })
    byDay.set(key, list)
  }
  for (const booking of input.bookings || []) {
    if (!booking || !personIds.has(idKey(booking.operativeId)) || !bookingOccupiesDay(booking.status)) continue
    add(homeBookingDayKey(booking, timeZone), booking)
  }
  for (const booking of input.managerSiteBookings || []) {
    if (!booking || !personIds.has(idKey(booking.userId))) continue
    if (idText(booking.status) && !bookingOccupiesDay(booking.status)) continue
    add(homeBookingDayKey(booking, timeZone), booking)
  }
  const days = week.dayKeys.map((key) => ({
    dayKey: key,
    hours: bookedWorkedHours({ bookings: byDay.get(key) || [], dayKey: key, policy: payrollTimePolicyForDayFromState(state, key), timeZone }),
  }))
  const hoursThisWeek = {
    startDayKey: week.startDayKey,
    endDayKey: week.endDayKey,
    hours: round2(days.reduce((sum, row) => sum + row.hours, 0)),
    days,
  }

  // 3. Open tasks (undated included), overdue and due this week.
  const viewer = { id: accountId || null, email: email || null }
  const homeRoster = roster.map((row) => ({
    id: idText(row.id),
    email: row.email ?? null,
    formerUserIds: row.formerUserIds ?? [],
    sameEmailUserIds: row.sameEmailUserIds ?? [],
  }))
  const homeOperatives = operatives.map((row) => ({ id: row.id, email: row.email ?? null, isActive: row.isActive ?? null }))
  const mine = tasksAssignedToViewer({ viewer, roster: homeRoster, operatives: homeOperatives, managers, tasks: input.tasks || [] })
  const nowMs = Number.isFinite(input.nowMs) ? input.nowMs : Date.now()
  const tasks = {
    open: mine.filter((task) => !isTaskCompleted(task)).length,
    overdue: mine.filter((task) => isTaskOverdue(task, nowMs, timeZone)).length,
    dueThisWeek: homeOverviewMetrics({ nowMs, timeZone, viewer, roster: homeRoster, operatives: homeOperatives, managers, tasks: mine })
      .tasksDueThisWeek,
  }

  // 4. Qualifications expiring soon (and expired) on the person's own operatives rows.
  const ownOperativeIds = operatives
    .filter((row) => personIds.has(idKey(row.id)) || (email && idKey(row.email) === idKey(email)))
    .map((row) => row.id)
  const qualifications =
    ownOperativeIds.length === 0
      ? { expired: 0, expiringSoon: 0, total: 0 }
      : qualificationExpiryCount({
          referenceIso: new Date(nowMs).toISOString(),
          timeZone,
          operatives: operatives
            .filter((row) => ownOperativeIds.includes(row.id))
            .map((row) => ({
              id: row.id,
              isActive: row.isActive !== false,
              name: idText(row.name),
              email: row.email ?? null,
              expiries: row.expiries || [],
            })),
          operativeIds: ownOperativeIds,
        })

  // 5. Line manager(s).
  const lineManager = lineManagerSummary(user, roster)

  return { dayKey, leave, hoursThisWeek, tasks, qualifications, lineManager }
}
