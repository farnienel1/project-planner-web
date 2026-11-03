import { format } from 'date-fns'
import {
  bookingOccupiesDay,
  clashResolutionKey,
  dayKeyInOrganizationZone,
  isClashApproved,
  isClashGroupApproved,
  isWarningActive,
  resolveOrganizationCurrency,
  rosterAliasIdsFor,
  type AcceptedClashRecord,
} from '@/lib/canonical'
import { holidayBookingDayKeys } from '@/lib/annualLeave/holidayDayKeys'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { leaveDaysInRange } from '@/lib/canonical/leaveRequests'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import { mergeProjectsAndSmallWorks } from '@/lib/projects/workStatus'
import { computeOperativeBookingClashWarnings } from '@/lib/scheduling/bookingClashUtils'
import { managerSiteBookingDisplayTitle } from '@/lib/scheduling/managerSiteBookingUtils'
import { getActiveOperativesForScheduling } from '@/lib/operatives/operativeRosterUtils'
import type { OrganizationDetails } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY, includesManagerScheduleLocation, orgPayrollPolicyForDay } from '@/lib/settings/organizationSettings'
import { ianaTimeZoneForCountry } from '@/lib/orgTime/orgTimeZone'
import { computeManagerBookingClashWarnings } from '@/lib/warnings/managerClashWarnings'
import { employmentTypeOnDay, isAnonymisedDeletedProfile, reportPayCell, reportPayTotal, reportPersonPayCell, subcontractorDayValue } from '@/lib/canonical'
import { computeUnbookedLabourWarningsForDateRange } from '@/lib/warnings/unbookedLabourWarnings'
import type { Booking, HolidayBooking, Operative, Project, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { Subcontractor } from '@/types'
import {
  computeInvoicingPeriod,
} from '@/lib/warnings/warningLookahead'
import {
  formatReportPeriodLabel,
  isDateWithinReportPeriod,
  type ReportPeriod,
} from '@/lib/weekly-report/invoicingPeriodUtils'
import {
  bookingDayUnits,
  findUserAndOperative,
  labourPaySlices,
  paySliceDisplay,
  resolveDisplayName,
  resolvePersonRole,
  resolvePersonTrade,
  signedLabourSlice,
  type LabourPaySlice,
} from '@/lib/weekly-report/weeklyReportPayroll'
import { emptyDayRateHistory, type OperativeDayRateHistoryCollection } from '@/lib/timesheets/dayRateHistoryStorage'
import { orgDayHours, roundPennies } from '@/lib/timesheets/payBasis'
import {
  additionalScheduleLocation,
  isAdditionalScheduleLocationKind,
  isProjectLocationKind,
  timesheetFeedCovers,
  timesheetLabourLines,
  timesheetMoneyLines,
  type ApprovedTimesheetWeek,
} from '@/lib/weekly-report/timesheetFeed'
import {
  formatSubcontractorBookingLabel,
  resolveSubcontractorBookingPeople,
} from '@/lib/subcontractors/bookingPeople'
import { bookingJobLabel, weekdayPaidHours } from '@/lib/canonical'

export type WeeklyReportWarningRow = {
  status: string
  priority: string
  type: string
  date: string
  description: string
  detail: string
  forPerson: string
}

/** A clash approved on Warnings (either platform) whose day is in the report period. */
export type WeeklyReportApprovedClashRow = {
  /** Organisation day key. */
  dayKey: string
  date: string
  priority: 'High' | 'Medium'
  type: 'Booking clash' | 'Manager overlap'
  person: string
  detail: string
  bookingAId: string
  bookingBId: string
  /** `warningResolutions` key (`clashResolutionKey`): `mgr-clash-…` for managers, the booking pair for operatives. */
  resolutionKey: string
  /** Operative clashes: every overlapping pair (`operativeClashGroups`); un-approving removes each. */
  pairs?: Array<{ bookingAId: string; bookingBId: string }>
}

/**
 * Approvals from `warningResolutions` and `acceptedBookingClashes`. `approvedKeys` is `approvedWarningKeys`
 * (approvals only): a dismissed clash is not an approved clash. `resolvedKeys` (`resolvedWarningKeys`) is kept
 * for callers that still pass only that.
 */
export type WeeklyReportWarningDecisions = {
  resolvedKeys: readonly string[]
  approvedKeys?: readonly string[]
  acceptedClashes: readonly AcceptedClashRecord[]
}

export type WeeklyReportProjectRow = {
  person: string
  trade: string
  role: string
  days: number
}

export type WeeklyReportProjectGroup = {
  projectName: string
  jobNumber: string
  rows: WeeklyReportProjectRow[]
  projectTotal: number
}

export type WeeklyReportSubRow = {
  projectName: string
  jobNumber: string
  subContractor: string
  people: string
  type: string
  time: string
  days: number
}

export type WeeklyReportLeaveRow = {
  person: string
  role: string
  days: number
  type: string
}

export type WeeklyReportManagerScheduleRow = {
  person: string
  role: string
  location: string
  time: string
  days: number
}

export type WeeklyReportPayPerson = {
  person: string
  role: string
  lines: {
    rateType: string
    days: number
    rate: number
    pay: number
    quantityText?: string
    rateText?: string
    /** True for a PAYE line: hours count, pay is not shown or totalled (`reportPayCell`). */
    isPaye?: boolean
    /** `PAYE` when the pay cell shows that instead of a figure. */
    payLabel?: string | null
  }[]
  personTotal: number
  /** `PAYE` when every line is PAYE (`reportPersonPayCell`). */
  personTotalLabel?: string | null
}

export type WeeklyReportMoneyRow = {
  person: string
  title: string
  jobNumber: string
  date: string
  details: string
  amount: number
}

export type WeeklyReportData = {
  organizationName: string
  companyLogoURL?: string
  reportPeriod: ReportPeriod
  invoicingPeriodLabel: string
  generatedAt: Date
  /** Organisation currency code for every money figure (`formatMoney`). */
  currencyCode: string
  warnings: WeeklyReportWarningRow[]
  /** Clashes approved on Warnings in this period (not repeated in `warnings`). */
  approvedClashes: WeeklyReportApprovedClashRow[]
  projectGroups: WeeklyReportProjectGroup[]
  allProjectWorkTotal: number
  subContractorRows: WeeklyReportSubRow[]
  subContractorTotal: number
  annualLeaveRows: WeeklyReportLeaveRow[]
  annualLeaveTotal: number
  managerScheduleRows: WeeklyReportManagerScheduleRow[]
  managerScheduleTotal: number
  priceWorkRows: WeeklyReportMoneyRow[]
  priceWorkTotal: number
  expenseRows: WeeklyReportMoneyRow[]
  expenseTotal: number
  paySummary: WeeklyReportPayPerson[]
  grandTotal: number
}

export type SubcontractorBookingRow = {
  id: string
  subcontractorId: string
  projectId: string
  date: Date
  timeSlot: string
  workStartTime?: string
  workEndTime?: string
  isBreakRemoved?: boolean
  status?: string
  bookedContactIds?: string[]
  bookedOperativeNames?: string[]
}

/**
 * Rulebook 1.9.0 `leaveDaysInRange` (on `leaveRecordDayKeys`): the record's leave days inside the report period, in
 * the organisation zone — the same count on every platform.
 */
function leaveDaysInPeriod(booking: HolidayBooking, period: ReportPeriod, _standardHours: number): number {
  void _standardHours
  const zone = organizationZoneOr()
  const keys = holidayBookingDayKeys(booking, zone)
  return leaveDaysInRange(
    { ...keys, timeSlot: booking.timeSlot },
    { startDayKey: dayKeyInZone(period.start, zone), endDayKey: dayKeyInZone(period.end, zone) },
    zone
  )
}

function filterWarningsToPeriod<T extends { date: Date }>(warnings: T[], period: ReportPeriod): T[] {
  return warnings.filter((warning) => isDateWithinReportPeriod(warning.date, period))
}

export function buildWeeklyReportData({
  organizationName,
  companyLogoURL,
  period,
  bookings,
  managerSiteBookings,
  subcontractorBookings,
  subcontractors,
  operatives,
  users,
  projects,
  smallWorks,
  holidays,
  orgDetails,
  timesheetWeeks = [],
  history = emptyDayRateHistory(),
  userIdAliases = {},
  warningDecisions = null,
}: {
  organizationName: string
  companyLogoURL?: string
  period: ReportPeriod
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  subcontractorBookings: SubcontractorBookingRow[]
  subcontractors: Subcontractor[]
  operatives: Operative[]
  users: User[]
  projects: Project[]
  smallWorks: Project[]
  holidays: HolidayBooking[]
  orgDetails: OrganizationDetails | null
  timesheetWeeks?: ApprovedTimesheetWeek[]
  history?: OperativeDayRateHistoryCollection
  /** The roster's same-email profile map (`useOrgUserStore().userIdAliases`), the one Daily Overview uses. */
  userIdAliases?: Readonly<Record<string, string>>
  /** Clash approvals. Without them every clash in the period is listed as open. */
  warningDecisions?: WeeklyReportWarningDecisions | null
}): WeeklyReportData {
  const payroll = orgDetails?.payrollTimePolicy
  // Today's standard day: only the fallback for a slice that does not carry its own day's (1.19.0).
  const standardHours = orgDayHours(payroll ? weekdayPaidHours(payroll) : 8)
  const timeZone = ianaTimeZoneForCountry(orgDetails?.countryCode)
  // Rulebook §4.3 / §8 (1.19.0): each booking is paid under the working hours in effect on its own day — the history
  // first (`effectivePayrollTimePolicy` via `orgPayrollPolicyForDay` with the whole state), in the organisation zone.
  const policyOn = (date: Date) =>
    orgPayrollPolicyForDay(
      date,
      payroll ?? DEFAULT_PAYROLL_POLICY,
      orgDetails?.payrollTimePolicyPrior ?? null,
      orgDetails?.payrollTimePolicyEffectiveFrom ?? null,
      timeZone,
      orgDetails?.payrollTimePolicyScheduled ?? null,
      orgDetails?.payrollTimePolicyState ?? null
    )
  const mergedWorks = mergeProjectsAndSmallWorks(projects, smallWorks)
  const projectsById = new Map<string, Project>()
  mergedWorks.forEach((project) => projectsById.set(project.id, project))

  const invoicingPeriod = orgDetails?.invoicing
    ? computeInvoicingPeriod(period.end, orgDetails.invoicing, timeZone)
    : null

  // Cancelled bookings are not work: `bookingOccupiesDay`, the same rule iOS and the other screens use.
  const periodOperativeBookings = bookings.filter(
    (booking) => isDateWithinReportPeriod(booking.date, period) && bookingOccupiesDay(booking.status)
  )
  const periodManagerBookings = managerSiteBookings.filter((booking) => {
    if (!isDateWithinReportPeriod(booking.date, period)) return false
    const options = orgDetails?.myScheduleOptions
    return options ? includesManagerScheduleLocation(options, booking) : true
  })
  const periodSubBookings = subcontractorBookings.filter((booking) =>
    isDateWithinReportPeriod(booking.date, period)
  )

  const projectGroupsMap = new Map<string, WeeklyReportProjectGroup>()
  const payBuckets = new Map<
    string,
    {
      personKey: string
      person: string
      role: string
      slice: LabourPaySlice
    }
  >()

  const aliasIdsFor = (userId?: string): string[] => {
    if (!userId) return []
    const person = users.find((entry) => entry.id === userId)
    const email = person?.email.trim().toLowerCase()
    const sameEmail = email ? users.filter((entry) => entry.email.trim().toLowerCase() === email).map((entry) => entry.id) : []
    return Array.from(new Set([userId, ...sameEmail, ...rosterAliasIdsFor(userId, userIdAliases)]))
  }

  // Pay rows are grouped by the person's account (the roster's kept id), never by display name: two people
  // with the same name stay apart, and one person's same-email ids are one row.
  const keptUserId = (id: string): string => {
    const lower = id.trim().toLowerCase()
    const hit = Object.entries(userIdAliases).find(([alias]) => alias.trim().toLowerCase() === lower)
    return (hit ? hit[1] : id).trim().toLowerCase()
  }
  const payPersonKey = (user: User | undefined, operative: Operative | undefined, name: string): string => {
    if (user?.id) return `user:${keptUserId(user.id)}`
    if (operative?.id) return `operative:${operative.id.trim().toLowerCase()}`
    return `name:${name}`
  }

  const addPaySlice = (personKey: string, person: string, role: string, slice: LabourPaySlice) => {
    if (!(slice.paidHours > 0) && !(slice.pay > 0)) return
    const rateKey = slice.rate == null ? 'none' : slice.rate.toFixed(2)
    // 1.19.0: days under a different standard day or overtime rate are separate rows, never averaged.
    const key = `${personKey}|${role}|${slice.payBasis}|${slice.isOvertime ? 'ot' : 'std'}|${rateKey}|${slice.isPaye ? 'paye' : ''}|${slice.standardDayHours ?? ''}|${slice.otMultiplier ?? ''}`
    const existing = payBuckets.get(key)
    if (!existing) {
      payBuckets.set(key, { personKey, person, role, slice: { ...slice } })
      return
    }
    existing.slice.paidHours = roundPennies(existing.slice.paidHours + slice.paidHours)
    existing.slice.pay = roundPennies(existing.slice.pay + slice.pay)
  }

  const addBookingPay = (
    date: Date,
    timeSlot: string,
    workStartTime: string | undefined,
    workEndTime: string | undefined,
    isBreakRemoved: boolean | undefined,
    user: User | undefined,
    operative: Operative | undefined,
    otMultiplierOverride?: number | null
  ) => {
    const slices = labourPaySlices({
      date,
      timeSlot,
      workStartTime,
      workEndTime,
      isBreakRemoved,
      otMultiplierOverride,
      user,
      operative,
      history,
      aliasUserIds: user ? aliasIdsFor(user.id) : [],
      payroll: policyOn(date),
      timeZone,
    })
    const person = resolveDisplayName(user, operative)
    const role = resolvePersonRole(user, operative)
    const personKey = payPersonKey(user, operative, person)
    for (const slice of slices) addPaySlice(personKey, person, role, slice)
  }

  const addProjectRow = (
    projectId: string,
    userId: string | undefined,
    operativeId: string | undefined,
    days: number
  ) => {
    // A booking whose job was deleted still counts, under "Deleted job" (rulebook).
    const project = projectsById.get(projectId)
    const { user, operative } = findUserAndOperative(users, operatives, { userId, operativeId, aliases: userIdAliases })
    const person = resolveDisplayName(user, operative)
    const key = project?.id ?? `deleted:${projectId}`
    const group =
      projectGroupsMap.get(key) ||
      ({
        projectName: bookingJobLabel(project ? project.siteName || project.jobNumber : null),
        jobNumber: project?.jobNumber || '—',
        rows: [],
        projectTotal: 0,
      } satisfies WeeklyReportProjectGroup)

    const role = resolvePersonRole(user, operative)
    const trade = resolvePersonTrade(user, operative)
    const existing = group.rows.find((row) => row.person === person && row.role === role)
    if (existing) {
      existing.days = Math.round((existing.days + days) * 100) / 100
      if (existing.trade === 'General' && trade !== 'General') existing.trade = trade
    } else {
      group.rows.push({ person, trade, role, days })
    }
    group.projectTotal = Math.round((group.projectTotal + days) * 100) / 100
    projectGroupsMap.set(key, group)
  }

  const usersForOperative = (operativeId: string | undefined): string[] => {
    if (!operativeId) return []
    const operative = operatives.find((entry) => entry.id === operativeId)
    const linked = operative
      ? users.filter((user) => findOperativeForUser(user, [operative])?.id === operative.id)
      : []
    // A booking under a users id or former invite id has no catalogue row; its timesheet must still cover it.
    const { user } = findUserAndOperative(users, operatives, { operativeId, aliases: userIdAliases })
    if (user && !linked.some((row) => row.id === user.id)) linked.push(user)
    const ids = linked.flatMap((row) => aliasIdsFor(row.id))
    return Array.from(new Set(ids))
  }

  for (const booking of periodOperativeBookings) {
    if (timesheetFeedCovers(timesheetWeeks, usersForOperative(booking.operativeId), booking.date, timeZone)) {
      continue
    }
    const { user, operative } = findUserAndOperative(users, operatives, { operativeId: booking.operativeId, aliases: userIdAliases })
    addBookingPay(
      new Date(booking.date),
      String(booking.timeSlot),
      booking.workStartTime,
      booking.workEndTime,
      booking.isBreakRemoved,
      user,
      operative,
      booking.otMultiplierOverride
    )
    const days = bookingDayUnits(
      String(booking.timeSlot),
      booking.workStartTime,
      booking.workEndTime,
      policyOn(new Date(booking.date)),
      new Date(booking.date),
      booking.isBreakRemoved,
      booking.otMultiplierOverride,
      timeZone
    )
    addProjectRow(booking.projectId, undefined, booking.operativeId, days)
  }

  for (const booking of periodManagerBookings) {
    if (booking.locationType !== 'project' && booking.locationType !== 'small_work') continue
    if (!booking.locationId) continue
    if (timesheetFeedCovers(timesheetWeeks, aliasIdsFor(booking.userId), booking.date, timeZone)) continue
    const { user, operative } = findUserAndOperative(users, operatives, { userId: booking.userId, aliases: userIdAliases })
    addBookingPay(
      new Date(booking.date),
      String(booking.timeSlot),
      booking.workStartTime,
      booking.workEndTime,
      booking.isBreakRemoved,
      user,
      operative
    )
    const days = bookingDayUnits(
      String(booking.timeSlot),
      booking.workStartTime,
      booking.workEndTime,
      policyOn(new Date(booking.date)),
      new Date(booking.date),
      booking.isBreakRemoved,
      null,
      timeZone
    )
    addProjectRow(booking.locationId, booking.userId, undefined, days)
  }

  for (const { week, line } of timesheetLabourLines(timesheetWeeks, period.start, period.end, timeZone)) {
    if (line.isOvertime || !isProjectLocationKind(line.locationKind) || line.days <= 0.0001) continue
    const projectName = line.projectName || 'Unknown'
    const jobNumber = line.jobNumber || 'N/A'
    const matched = mergedWorks.find(
      (project) => project.jobNumber === line.jobNumber && (project.siteName || project.jobNumber) === projectName
    )
    const key = matched?.id || `timesheet|${projectName}|${jobNumber}`
    const group =
      projectGroupsMap.get(key) ||
      ({
        projectName: matched?.siteName || projectName,
        jobNumber: matched?.jobNumber || jobNumber,
        rows: [],
        projectTotal: 0,
      } satisfies WeeklyReportProjectGroup)
    const existing = group.rows.find((row) => row.person === week.personName && row.role === week.role)
    if (existing) {
      existing.days = Math.round((existing.days + line.days) * 100) / 100
    } else {
      group.rows.push({
        person: week.personName,
        trade: week.trade,
        role: week.role,
        days: Math.round(line.days * 100) / 100,
      })
    }
    group.projectTotal = Math.round((group.projectTotal + line.days) * 100) / 100
    projectGroupsMap.set(key, group)
  }

  const managerScheduleRows: WeeklyReportManagerScheduleRow[] = []
  let managerScheduleTotal = 0
  for (const booking of periodManagerBookings) {
    if (booking.locationType === 'project' || booking.locationType === 'small_work') continue
    if (timesheetFeedCovers(timesheetWeeks, aliasIdsFor(booking.userId), booking.date, timeZone)) continue
    const linked = findUserAndOperative(users, operatives, { userId: booking.userId, aliases: userIdAliases })
    addBookingPay(
      new Date(booking.date),
      String(booking.timeSlot),
      booking.workStartTime,
      booking.workEndTime,
      booking.isBreakRemoved,
      linked.user,
      linked.operative
    )
    const { user, operative } = findUserAndOperative(users, operatives, { userId: booking.userId, aliases: userIdAliases })
    const days = bookingDayUnits(
      String(booking.timeSlot),
      booking.workStartTime,
      booking.workEndTime,
      policyOn(new Date(booking.date)),
      new Date(booking.date),
      booking.isBreakRemoved,
      null,
      timeZone
    )
    const location = managerSiteBookingDisplayTitle(
      booking,
      new Map(Array.from(projectsById.entries()).map(([id, p]) => [id, p.siteName || p.jobNumber]))
    )
    managerScheduleRows.push({
      person: resolveDisplayName(user, operative),
      role: resolvePersonRole(user, operative),
      location,
      time: booking.workStartTime && booking.workEndTime
        ? `${booking.workStartTime} – ${booking.workEndTime}`
        : String(booking.timeSlot || 'Full Day'),
      days,
    })
    managerScheduleTotal += days
  }
  for (const { week, line } of timesheetLabourLines(timesheetWeeks, period.start, period.end, timeZone)) {
    if (line.isOvertime || !isAdditionalScheduleLocationKind(line.locationKind) || line.days <= 0.0001) continue
    managerScheduleRows.push({
      person: week.personName,
      role: week.role,
      location: additionalScheduleLocation(line),
      time: line.details || 'Timesheet',
      days: Math.round(line.days * 100) / 100,
    })
    managerScheduleTotal += line.days
  }
  managerScheduleRows.sort((a, b) => a.person.localeCompare(b.person) || a.location.localeCompare(b.location))
  managerScheduleTotal = Math.round(managerScheduleTotal * 100) / 100

  const priceWorkRows: WeeklyReportMoneyRow[] = timesheetMoneyLines(
    timesheetWeeks,
    'priceWork',
    period.start,
    period.end,
    timeZone
  )
    .map(({ week, line }) => ({
      person: week.personName,
      title: line.title,
      jobNumber: line.jobNumber,
      date: format(line.date, 'd MMM yyyy'),
      details: line.details,
      amount: line.amount,
    }))
    .sort((a, b) => a.person.localeCompare(b.person) || a.date.localeCompare(b.date))
  const priceWorkTotal = Math.round(priceWorkRows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100
  const expenseRows: WeeklyReportMoneyRow[] = timesheetMoneyLines(
    timesheetWeeks,
    'expenses',
    period.start,
    period.end,
    timeZone
  )
    .map(({ week, line }) => ({
      person: week.personName,
      title: line.title,
      jobNumber: line.jobNumber,
      date: format(line.date, 'd MMM yyyy'),
      details: line.details,
      amount: line.amount,
    }))
    .sort((a, b) => a.person.localeCompare(b.person) || a.date.localeCompare(b.date))
  const expenseTotal = Math.round(expenseRows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100

  const subContractorRows: WeeklyReportSubRow[] = periodSubBookings.map((booking) => {
    const project = projectsById.get(booking.projectId)
    const sub = subcontractors.find((entry) => entry.id === booking.subcontractorId)
    const people = resolveSubcontractorBookingPeople(booking, sub)
    const days = subcontractorDayValue(booking.timeSlot)
    return {
      projectName: bookingJobLabel(project?.siteName || project?.jobNumber),
      jobNumber: project?.jobNumber || '—',
      subContractor: formatSubcontractorBookingLabel(sub?.name || 'Sub contractor', []),
      people: people.join(', ') || '—',
      type: sub?.subcontractorType || '—',
      time: booking.workStartTime && booking.workEndTime
        ? `${booking.workStartTime} – ${booking.workEndTime}`
        : booking.timeSlot,
      days,
    }
  })
  const subContractorTotal = Math.round(
    subContractorRows.reduce((sum, row) => sum + row.days, 0) * 100
  ) / 100

  const annualLeaveRows: WeeklyReportLeaveRow[] = []
  const leavePeople = new Map<string, WeeklyReportLeaveRow>()
  for (const holiday of holidays.filter((entry) => entry.status === 'approved')) {
    const days = leaveDaysInPeriod(holiday, period, standardHours)
    if (days <= 0) continue
    const user = holiday.userId ? users.find((entry) => entry.id === holiday.userId) : undefined
    const operative = holiday.operativeId
      ? operatives.find((entry) => entry.id === holiday.operativeId)
      : user
        ? findOperativeForUser(user, operatives)
        : undefined
    const displayName = resolveDisplayName(user, operative)
    const existing = leavePeople.get(displayName)
    if (existing) {
      existing.days = Math.round((existing.days + days) * 100) / 100
    } else {
      leavePeople.set(displayName, {
        person: displayName,
        role: resolvePersonRole(user, operative),
        days,
        type: 'Approved',
      })
    }
  }
  annualLeaveRows.push(...Array.from(leavePeople.values()))
  const annualLeaveTotal = Math.round(
    annualLeaveRows.reduce((sum, row) => sum + row.days, 0) * 100
  ) / 100

  const warningDetection = orgDetails?.warningDetection
  const rosterOperatives = getActiveOperativesForScheduling(operatives)
  const warnings: WeeklyReportWarningRow[] = []
  const approvedClashes: WeeklyReportApprovedClashRow[] = []
  const decisions = warningDecisions
    ? {
        resolvedKeys: warningDecisions.resolvedKeys,
        // Only approvals count as approved (`approvedWarningKeys`); never fall back to dismissed keys.
        approvedKeys: warningDecisions.approvedKeys ?? [],
        acceptedClashes: warningDecisions.acceptedClashes,
      }
    : null
  const approvedRow = (
    clash: {
      date: Date
      bookingAId: string
      bookingBId: string
      message: string
      resolutionKey?: string
      pairs?: Array<{ bookingAId: string; bookingBId: string }>
    },
    person: string,
    kind: 'operative' | 'manager'
  ): WeeklyReportApprovedClashRow => {
    const dayKey = dayKeyInOrganizationZone(clash.date.toISOString(), timeZone)
    return {
      ...(clash.pairs ? { pairs: clash.pairs } : {}),
      dayKey,
      date: new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short', year: 'numeric' }).format(
        clash.date
      ),
      priority: kind === 'operative' ? 'High' : 'Medium',
      type: kind === 'operative' ? 'Booking clash' : 'Manager overlap',
      person,
      detail: clash.message,
      bookingAId: clash.bookingAId,
      bookingBId: clash.bookingBId,
      resolutionKey: clashResolutionKey(clash),
    }
  }

  // §5: a dismissed clash (`resolvedWarningKeys`) is no longer open (`isWarningActive`), and it is not approved
  // either, so it is in neither list. A cluster stays open while any of its pairs is still active.
  const clashStillOpen = (clash: {
    bookingAId: string
    bookingBId: string
    resolutionKey?: string
    pairs?: Array<{ bookingAId: string; bookingBId: string }>
  }): boolean => {
    if (!decisions) return true
    const rows = clash.pairs && clash.pairs.length > 0 ? clash.pairs : [clash]
    return rows.some((row) =>
      isWarningActive(
        { resolutionKey: clashResolutionKey(row), bookingAId: row.bookingAId, bookingBId: row.bookingBId },
        decisions
      )
    )
  }

  if (warningDetection?.detectClashes) {
    for (const clash of filterWarningsToPeriod(
      computeOperativeBookingClashWarnings(bookings, rosterOperatives, mergedWorks, {
        users,
        payrollPolicy: payroll,
        userIdAliases,
      }),
      period
    )) {
      if (isAnonymisedDeletedProfile({ name: clash.operativeName })) continue
      // A cluster is approved only when every overlapping pair is (`isClashGroupApproved`).
      if (decisions && isClashGroupApproved(clash, decisions)) {
        approvedClashes.push(approvedRow(clash, clash.operativeName, 'operative'))
        continue
      }
      if (!clashStillOpen(clash)) continue
      warnings.push({
        status: 'Open',
        priority: 'High',
        type: 'Booking clash',
        date: format(clash.date, 'd MMM yyyy'),
        description: clash.operativeName,
        detail: clash.message,
        forPerson: clash.operativeName,
      })
    }
    for (const clash of filterWarningsToPeriod(
      computeManagerBookingClashWarnings(managerSiteBookings, users, mergedWorks, {
        operativeBookings: bookings,
        operatives,
        payrollPolicy: payroll,
        userIdAliases,
      }),
      period
    )) {
      if (isAnonymisedDeletedProfile({ name: clash.personName })) continue
      if (decisions && isClashApproved(clash, decisions)) {
        approvedClashes.push(approvedRow(clash, clash.personName, 'manager'))
        continue
      }
      if (!clashStillOpen(clash)) continue
      warnings.push({
        status: 'Open',
        priority: 'Medium',
        type: 'Manager overlap',
        date: format(clash.date, 'd MMM yyyy'),
        description: clash.personName,
        detail: clash.message,
        forPerson: clash.personName,
      })
    }
  }

  if (warningDetection) {
    for (const warning of computeUnbookedLabourWarningsForDateRange({
      bookings,
      managerSiteBookings,
      operatives,
      users,
      holidays,
      warningDetection,
      payrollPolicy: payroll,
      payrollPolicyState: orgDetails?.payrollTimePolicyState ?? null,
      periodStart: period.start,
      periodEnd: period.end,
      timeZone,
    })) {
      warnings.push({
        status: 'Active',
        priority: 'High',
        type: 'Unbooked labour',
        date: format(warning.date, 'd MMM yyyy'),
        description: warning.operativeName,
        detail: warning.message,
        forPerson: warning.operativeName,
      })
    }
  }

  for (const { week, line } of timesheetLabourLines(timesheetWeeks, period.start, period.end, timeZone)) {
    const weekUser = users.find((entry) => entry.id === week.userId)
    const isPaye = Boolean(weekUser && employmentTypeOnDay(weekUser, line.date, timeZone) === 'paye')
    addPaySlice(
      `user:${keptUserId(week.userId)}`,
      week.personName,
      week.role,
      // 1.19.0: a signed line keeps its signed amount and multiplier (never re-priced); only its day units are read
      // against the standard day in effect on the line's own day.
      signedLabourSlice(line, orgDayHours(weekdayPaidHours(policyOn(line.date))), line.otMultiplier ?? null, isPaye)
    )
  }

  const paySummary: WeeklyReportPayPerson[] = []
  let grandTotal = 0
  const grouped = new Map<string, WeeklyReportPayPerson>()
  for (const bucket of payBuckets.values()) {
    const shown = paySliceDisplay(bucket.slice, standardHours)
    if (!bucket.slice.isPaye && bucket.slice.rate == null) continue
    const personKey = `${bucket.personKey}|${bucket.role}`
    let summary = grouped.get(personKey)
    if (!summary) {
      summary = { person: bucket.person, role: bucket.role, lines: [], personTotal: 0 }
      grouped.set(personKey, summary)
    }
    const cell = reportPayCell({ isPaye: bucket.slice.isPaye, pay: shown.pay })
    summary.lines.push({
      rateType: shown.rateType,
      days: roundPennies(shown.days),
      rate: shown.rate,
      pay: cell.pay ?? 0,
      quantityText: shown.quantityText,
      rateText: shown.rateText,
      isPaye: bucket.slice.isPaye,
      payLabel: cell.label,
    })
  }
  const settlePerson = (summary: WeeklyReportPayPerson) => {
    const cell = reportPersonPayCell(summary.lines.map((line) => ({ isPaye: line.isPaye === true, pay: line.pay })))
    summary.personTotal = cell.pay ?? 0
    summary.personTotalLabel = cell.label
  }
  for (const summary of grouped.values()) {
    settlePerson(summary)
    paySummary.push(summary)
  }

  const addMoneyPay = (person: string, role: string, rateType: string, pay: number) => {
    if (pay <= 0.0001) return
    let summary = paySummary.find((row) => row.person === person && row.role === role)
    if (!summary) {
      summary = { person, role, lines: [], personTotal: 0 }
      paySummary.push(summary)
    }
    summary.lines.push({
      rateType,
      days: 0,
      rate: 0,
      pay: roundPennies(pay),
      quantityText: '',
      rateText: '',
    })
    settlePerson(summary)
  }
  for (const { week, line } of timesheetMoneyLines(timesheetWeeks, 'priceWork', period.start, period.end, timeZone)) {
    addMoneyPay(week.personName, week.role, 'Price work', line.amount)
  }
  for (const { week, line } of timesheetMoneyLines(timesheetWeeks, 'expenses', period.start, period.end, timeZone)) {
    addMoneyPay(week.personName, week.role, 'Expenses', line.amount)
  }

  grandTotal = reportPayTotal(
    paySummary.flatMap((summary) => summary.lines.map((line) => ({ isPaye: line.isPaye === true, pay: line.pay })))
  )

  const projectGroups = Array.from(projectGroupsMap.values()).sort((a, b) =>
    a.projectName.localeCompare(b.projectName)
  )
  const allProjectWorkTotal = Math.round(
    projectGroups.reduce((sum, group) => sum + group.projectTotal, 0) * 100
  ) / 100

  return {
    organizationName,
    companyLogoURL,
    reportPeriod: period,
    invoicingPeriodLabel: invoicingPeriod
      ? formatReportPeriodLabel(invoicingPeriod.start, invoicingPeriod.end)
      : '—',
    generatedAt: new Date(),
    currencyCode: resolveOrganizationCurrency(orgDetails),
    warnings,
    approvedClashes: approvedClashes.sort(
      (a, b) => a.dayKey.localeCompare(b.dayKey) || a.person.localeCompare(b.person)
    ),
    projectGroups,
    allProjectWorkTotal,
    subContractorRows,
    subContractorTotal,
    annualLeaveRows,
    annualLeaveTotal,
    managerScheduleRows,
    managerScheduleTotal,
    priceWorkRows,
    priceWorkTotal,
    expenseRows,
    expenseTotal,
    paySummary: paySummary.sort((a, b) => a.person.localeCompare(b.person)),
    grandTotal: Math.round(grandTotal * 100) / 100,
  }
}
