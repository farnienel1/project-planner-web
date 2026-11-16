import { personRateHistoryIds } from '@/lib/pay/personRateHistoryIds'
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
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import { mergeProjectsAndSmallWorks } from '@/lib/projects/workStatus'
import { computeOperativeBookingClashWarnings } from '@/lib/scheduling/bookingClashUtils'
import { managerSiteBookingDisplayTitle } from '@/lib/scheduling/managerSiteBookingUtils'
import { getActiveOperativesForScheduling } from '@/lib/operatives/operativeRosterUtils'
import type { OrganizationDetails } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY, orgPayrollPolicyForDay } from '@/lib/settings/organizationSettings'
import { ORPHAN_BOOKING_LABEL, organizationTimeZone } from '@/lib/canonical'
import { computeManagerBookingClashWarnings } from '@/lib/warnings/managerClashWarnings'
import {
  claimEvidenceCountText,
  hasActiveLineManager,
  isAnonymisedDeletedProfile,
  payrollHoursResult,
  priceWorkJobNumberText,
  subcontractorDayValue,
  weeklyReportClashDetail,
  weeklyReportLeaveRows,
  weeklyReportPayRows,
  WEEKLY_REPORT_WARNING_OPEN,
  type WeeklyReportLeavePerson,
  type WeeklyReportPayBooking,
  type WeeklyReportPayPerson as CanonicalPayPerson,
  type WeeklyReportPayPersonRow,
  type WeeklyReportPaySheet,
} from '@/lib/canonical'
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
  findUserAndOperative,
  resolveDisplayName,
  resolvePersonRole,
  resolvePersonTrade,
} from '@/lib/weekly-report/weeklyReportPayroll'
import { emptyDayRateHistory, type OperativeDayRateHistoryCollection } from '@/lib/timesheets/dayRateHistoryStorage'
import {
  isAdditionalScheduleLocationKind,
  isProjectLocationKind,
  timesheetMoneyLines,
  type ApprovedTimesheetWeek,
} from '@/lib/weekly-report/timesheetFeed'
import {
  formatSubcontractorBookingLabel,
  resolveSubcontractorBookingPeople,
} from '@/lib/subcontractors/bookingPeople'
import { bookingJobLabel, weekdayPaidHours, weeklyReportPayeOvertime, OVERTIME_RATE_CHANGED_MARK, overtimePersonIds, type OvertimeBookingInput, type PayrollTimePolicyState } from '@/lib/canonical'
import { catalogueOperativePaySubjects, normalizeDocumentId } from '@/lib/canonical'

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

/**
 * Rulebook 1.51.0 §7 (Q4a): a person's paid hours and paid days on a job (`weeklyReportPayRows` `paidDays`, the same
 * pricing as the Pay Summary — paid hours ÷ the day-rate divisor, uncapped), so the Project Breakdown ties to it.
 */
export type WeeklyReportProjectRow = {
  person: string
  trade: string
  role: string
  hours: number
  days: number
}

export type WeeklyReportProjectGroup = {
  projectName: string
  jobNumber: string
  rows: WeeklyReportProjectRow[]
  projectTotal: number
  projectHours: number
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
  /** 1.51.0 (Q4a): paid hours and paid days (`weeklyReportPayRows` `paidDays`). */
  hours: number
  days: number
}

/**
 * Rulebook 1.51.0 §7 (Q1–Q3): one person's Pay Summary rows, total and invoice check line — `weeklyReportPayRows`
 * (rate and pay already shown per `reportPayForViewer`). Columns: `WEEKLY_REPORT_PAY_COLUMNS`.
 */
export type WeeklyReportPayPerson = WeeklyReportPayPersonRow

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
  /** Rulebook 1.53.0 (B9): the organisation zone, so "Generated" is written in it. */
  timeZone?: string
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
  allProjectHoursTotal?: number
  /** Rulebook 1.51.0 (Q4b): approved leave records that match no person (also listed in Data health). */
  unmatchedLeave?: Array<{ recordId: string; userId: string | null; operativeId: string | null }>
  /** Rulebook 1.32.0: people whose rate and pay were hidden for this viewer (`reportPayForViewer`); exports add the note. */
  payHiddenPeople?: number
  /**
   * Rulebook 1.29.0 §7: PAYE people are not in the hours and pay rows; this section lists their overtime per job,
   * always live (`weeklyReportPayeOvertime`). Hours only.
   */
  payeOvertimeRows: WeeklyReportPayeOvertimeRow[]
  payeOvertimeTotal: number
  /**
   * Pay strip (review #342): the users documents whose pay (rate, employment type) this report reads — the people of its
   * bookings, approved timesheet weeks and timesheets in the range. The screen waits for exactly these people's pay.
   */
  pricedUserIds: string[]
  /**
   * 16 Nov scan (rulebook §8, `catalogueOperativePaySubjects`): the catalogue `operatives` rows (no app account) this
   * report prices — their pay is read from `payProfiles/{rowId}` while `privatePay` is on, so the screen waits for it too.
   */
  pricedCatalogueOperativeIds: string[]
}

/** 1.32.0: `hoursCell` is the multiplier figure ("2h at ×1.5 = 3h"), with the changed-rate mark on an edited row. */
export type WeeklyReportPayeOvertimeRow = { person: string; jobNumber: string; jobName: string; overtimeHours: number; label: string; hoursCell?: string; changedFromOrganization?: boolean }

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
  timesheetSheets = [],
  viewer = null,
  showAllPay = false,
  bankHolidayDayKeys = [],
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
  /** Rulebook 1.51.0 (Q2): each self-employed person's payment runs in the range (`loadWeeklyReportTimesheetFeed`). */
  timesheetSheets?: WeeklyReportPaySheet[]
  /**
   * Rulebook 1.32.0 / 1.51.0: the viewer; rates and pay are shown per `canViewPersonPay` (`reportPayForViewer`, applied
   * inside `weeklyReportPayRows`). Null shows every figure (tests).
   */
  viewer?: Record<string, unknown> | null
  /** Show every rate and pay figure whoever views (tests only). Without it and with no viewer, pay is hidden. */
  showAllPay?: boolean
  /** Rulebook 1.53.0 (B7): the region's bank holidays (day keys); a bank holiday inside a leave record is not leave. */
  bankHolidayDayKeys?: readonly string[]
}): WeeklyReportData {
  const payroll = orgDetails?.payrollTimePolicy
  const timeZone = organizationTimeZone(orgDetails?.countryCode)
  // Rulebook 1.53.0 (B9): every date on the report is written in the organisation zone, never the browser's.
  const zoneDayText = (date: Date) =>
    new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short', year: 'numeric' }).format(date)
  const mergedWorks = mergeProjectsAndSmallWorks(projects, smallWorks)
  const projectsById = new Map<string, Project>()
  mergedWorks.forEach((project) => projectsById.set(project.id, project))

  const invoicingPeriod = orgDetails?.invoicing
    ? computeInvoicingPeriod(period.end, orgDetails.invoicing, timeZone)
    : null
  const range = { start: dayKeyInZone(period.start, timeZone), end: dayKeyInZone(period.end, timeZone) }
  // Rulebook §4.3 / §8 (1.19.0): the whole working-hours state; each day is priced under the rules in effect on it.
  const policyState: PayrollTimePolicyState = orgDetails?.payrollTimePolicyState ?? {
    current: payroll ?? DEFAULT_PAYROLL_POLICY,
    prior: orgDetails?.payrollTimePolicyPrior ?? null,
    effectiveFrom: orgDetails?.payrollTimePolicyEffectiveFrom ?? null,
    scheduled: orgDetails?.payrollTimePolicyScheduled ?? null,
  }
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

  const periodOperativeBookings = bookings.filter((booking) => isDateWithinReportPeriod(booking.date, period))
  // Rulebook 1.54.0 (owner decision 16 Nov): a switched-off schedule option never takes a booking off the report — it
  // only hides the option from pickers (§4.8), as on Daily Overview (1.53.0 A10) and the timesheets.
  const periodManagerBookings = managerSiteBookings.filter((booking) => isDateWithinReportPeriod(booking.date, period))
  const periodSubBookings = subcontractorBookings.filter((booking) =>
    isDateWithinReportPeriod(booking.date, period)
  )

  const aliasIdsFor = (userId?: string): string[] => {
    if (!userId) return []
    const person = users.find((entry) => entry.id === userId)
    const email = person?.email.trim().toLowerCase()
    const sameEmail = email ? users.filter((entry) => entry.email.trim().toLowerCase() === email).map((entry) => entry.id) : []
    return Array.from(new Set([userId, ...sameEmail, ...rosterAliasIdsFor(userId, userIdAliases)]))
  }
  // The roster's kept id for a same-email profile (pay rows are per person, never per display name).
  const keptUserId = (id: string): string => {
    const lower = id.trim().toLowerCase()
    const hit = Object.entries(userIdAliases).find(([alias]) => alias.trim().toLowerCase() === lower)
    return hit ? hit[1] : id
  }

  // Rulebook 1.51.0 §7: the people of the report as `weeklyReportPayRows` reads them — every id each person goes by
  // (`overtimePersonIds`: own, former and same-email ids, `operatives` rows on their email) plus the roster fold's ids.
  const people: CanonicalPayPerson[] = []
  const linked = new Map<string, { user?: User; operative?: Operative }>()
  const personByKey = new Map<string, CanonicalPayPerson>()
  const roster = users as unknown as Array<Record<string, unknown>>
  for (const user of users) {
    if (keptUserId(user.id).trim().toLowerCase() !== user.id.trim().toLowerCase()) continue
    const operative = findOperativeForUser(user, operatives)
    const aliases = aliasIdsFor(user.id)
    const person: CanonicalPayPerson = {
      id: user.id,
      name: resolveDisplayName(user, operative),
      role: resolvePersonRole(user, operative),
      ids: Array.from(new Set([...overtimePersonIds({ person: user, roster: users as never, operatives }), ...aliases])),
      operativeIds: personRateHistoryIds(user, operatives, { aliasUserIds: aliases, extraOperativeIds: [operative?.id] }).operativeIds,
      user: user as never,
      operative: operative ?? null,
      ghost: (user as { ghost?: unknown }).ghost === true,
      hasLineManager: hasActiveLineManager(user as never, roster as never),
      paySubject: user as unknown as Record<string, unknown>,
    }
    people.push(person)
    personByKey.set(user.id, person)
    linked.set(user.id, { user, operative })
  }
  const personForBooking = (input: { userId?: string; operativeId?: string }): CanonicalPayPerson | null => {
    const { user, operative } = findUserAndOperative(users, operatives, { ...input, aliases: userIdAliases })
    if (user) {
      const found = personByKey.get(keptUserId(user.id)) ?? personByKey.get(user.id)
      if (found) return found
    }
    if (!operative) return null
    // A catalogue `operatives` row with no account is its own person.
    let person = personByKey.get(`operative:${operative.id}`)
    if (!person) {
      person = {
        id: operative.id,
        name: resolveDisplayName(undefined, operative),
        role: resolvePersonRole(undefined, operative),
        ids: [operative.id],
        operativeIds: [operative.id],
        user: null,
        operative,
        paySubject: { id: operative.id, email: operative.email ?? '', role: 'operative', operativeMode: true, catalogueOperative: true },
      }
      people.push(person)
      personByKey.set(`operative:${operative.id}`, person)
      linked.set(operative.id, { operative })
    }
    return person
  }
  // Each booking's person exactly as before (`findUserAndOperative`): its stored id joins that person's ids.
  const claim = (personId: string | undefined, person: CanonicalPayPerson | null) => {
    if (!personId || !person) return
    if (!(person.ids ?? []).some((id) => normalizeDocumentId(id) === normalizeDocumentId(personId))) {
      person.ids = [...(person.ids ?? []), personId]
    }
  }

  const payBookings: WeeklyReportPayBooking[] = []
  for (const booking of periodOperativeBookings) {
    claim(booking.operativeId, personForBooking({ operativeId: booking.operativeId }))
    const project = projectsById.get(booking.projectId)
    payBookings.push({
      id: booking.id,
      collection: 'bookings',
      personId: booking.operativeId,
      dayKey: dayKeyInZone(new Date(booking.date), timeZone),
      timeSlot: String(booking.timeSlot),
      workStartTime: booking.workStartTime ?? null,
      workEndTime: booking.workEndTime ?? null,
      isBreakRemoved: booking.isBreakRemoved === true,
      otMultiplierOverride: booking.otMultiplierOverride ?? null,
      // Cancelled bookings are not work (`bookingOccupiesDay`, inside the rule).
      status: String(booking.status ?? ''),
      jobId: booking.projectId,
      jobNumber: project?.jobNumber ?? '',
      jobName: project?.siteName ?? '',
      locationKind: project?.jobType === 'Small Works' ? 'small_work' : 'project',
    })
  }
  for (const booking of periodManagerBookings) {
    const job = booking.locationType === 'project' || booking.locationType === 'small_work'
    // Rulebook 1.53.0 (B8): a job booking with no `locationId` (its job deleted) is still worked and paid, as on the
    // timesheet; it reads "Deleted job" (`ORPHAN_BOOKING_LABEL`).
    claim(booking.userId, personForBooking({ userId: booking.userId }))
    const project = job && booking.locationId ? projectsById.get(String(booking.locationId)) : undefined
    payBookings.push({
      id: booking.id,
      collection: 'managerSiteBookings',
      personId: booking.userId,
      dayKey: dayKeyInZone(new Date(booking.date), timeZone),
      timeSlot: String(booking.timeSlot),
      workStartTime: booking.workStartTime ?? null,
      workEndTime: booking.workEndTime ?? null,
      isBreakRemoved: booking.isBreakRemoved === true,
      otMultiplierOverride: booking.otMultiplierOverride ?? null,
      jobId: job && booking.locationId ? String(booking.locationId) : null,
      jobNumber: project?.jobNumber ?? '',
      jobName: project?.siteName ?? (job ? ORPHAN_BOOKING_LABEL : ''),
      locationKind: booking.locationType,
    })
  }
  for (const week of timesheetWeeks) claim(week.userId, personForBooking({ userId: week.userId }))
  // Pay strip (review #342): the users whose pay the Pay Summary reads, matched exactly as `weeklyReportPayRows` matches
  // them — every id each person goes by (`person.ids`), without case (`normalizeDocumentId`), first person wins — for
  // every booking, approved timesheet week and timesheet (the invoice check line) in the range.
  const pricedUserIds = new Set<string>()
  const pricedCatalogueOperativeIds = new Set<string>()
  const pricedOwner = new Map<string, CanonicalPayPerson>()
  for (const person of people) {
    for (const id of [person.id, ...(person.ids ?? [])]) {
      const key = normalizeDocumentId(id)
      if (key && !pricedOwner.has(key)) pricedOwner.set(key, person)
    }
  }
  const notePriced = (id: string | null | undefined) => {
    const person = pricedOwner.get(normalizeDocumentId(id))
    if (person?.user) pricedUserIds.add(person.id)
    else if (person?.operative && catalogueSubjectKeys.has(normalizeDocumentId(person.id))) pricedCatalogueOperativeIds.add(person.id)
  }
  // Review of #347: only the rows the rulebook reads pay for as catalogue operatives (`catalogueOperativePaySubjects`: no
  // stored account link, not a roster id or email) are waited for — a row linked to a missing account is never read.
  const catalogueSubjectKeys = new Set(
    catalogueOperativePaySubjects(
      operatives.map((row) => ({ id: row.id, email: row.email ?? '', linkedUserId: row.linkedUserId ?? '' })),
      users as never
    ).map((subject) => normalizeDocumentId(subject.id))
  )
  payBookings.forEach((booking) => notePriced(booking.personId))
  timesheetWeeks.forEach((week) => notePriced(week.userId))
  timesheetSheets.forEach((sheet) => notePriced(sheet.personId))

  // Rulebook 1.51.0 §7 (Q1–Q3): the Pay Summary, check lines and every booking's paid hours and days.
  const history2 = [...Object.values(history.byUserId).flat(), ...Object.values(history.byOperativeId).flat()]
  const pay = weeklyReportPayRows({
    people,
    bookings: payBookings,
    timesheetWeeks: timesheetWeeks as never,
    sheets: timesheetSheets,
    roster,
    organization: policyState,
    payRateHistory: history2 as never,
    range,
    timeZone,
    viewer,
    showAllPay,
    currency: resolveOrganizationCurrency(orgDetails),
  })
  const bookingById = new Map<string, ManagerSiteBooking>(periodManagerBookings.map((booking) => [booking.id, booking]))

  const projectGroupsMap = new Map<string, WeeklyReportProjectGroup>()
  const projectRowByPerson = new Map<string, WeeklyReportProjectGroup['rows'][number]>()
  const addProjectRow = (key: string, projectName: string, jobNumber: string, personId: string | null, bookingPersonId: string, hours: number, days: number) => {
    const owner = personId ? linked.get(personId) : undefined
    const fallback = owner ? undefined : findUserAndOperative(users, operatives, { operativeId: bookingPersonId, userId: bookingPersonId, aliases: userIdAliases })
    const user = owner?.user ?? fallback?.user
    const operative = owner?.operative ?? fallback?.operative
    const person = personId ? personByKey.get(personId)?.name ?? personByKey.get(`operative:${personId}`)?.name ?? resolveDisplayName(user, operative) : resolveDisplayName(user, operative)
    const role = resolvePersonRole(user, operative)
    const trade = resolvePersonTrade(user, operative)
    const group =
      projectGroupsMap.get(key) ||
      ({ projectName, jobNumber, rows: [], projectTotal: 0, projectHours: 0 } satisfies WeeklyReportProjectGroup)
    // Rulebook 1.53.0 (B14): one row per person (their id), never per name and role — two people with the same name
    // are two rows, and one person under two ids (matched to the same person) is one.
    const personKey = personId ? `person:${normalizeDocumentId(personId)}` : `booking:${normalizeDocumentId(bookingPersonId)}`
    const rowKey = `${key}|${personKey}`
    const existing = projectRowByPerson.get(rowKey)
    if (existing) {
      existing.days += days
      existing.hours += hours
      if (existing.trade === 'General' && trade !== 'General') existing.trade = trade
    } else {
      const row = { person, trade, role, hours, days }
      projectRowByPerson.set(rowKey, row)
      group.rows.push(row)
    }
    group.projectTotal += days
    group.projectHours += hours
    projectGroupsMap.set(key, group)
  }

  const managerScheduleRows: WeeklyReportManagerScheduleRow[] = []
  let managerScheduleTotal = 0
  const projectNames = new Map(Array.from(projectsById.entries()).map(([id, p]) => [id, p.siteName || p.jobNumber]))
  for (const row of pay.paidDays) {
    if (isProjectLocationKind(row.locationKind)) {
      if (row.source === 'live') {
        const project = row.jobId ? projectsById.get(row.jobId) : undefined
        // A booking whose job was deleted still counts, under "Deleted job" (rulebook).
        addProjectRow(
          project?.id ?? `deleted:${row.jobId}`,
          bookingJobLabel(project ? project.siteName || project.jobNumber : null),
          project?.jobNumber || '—',
          row.personId,
          row.bookingPersonId,
          row.hours,
          row.days
        )
      } else {
        const projectName = row.jobName || 'Unknown'
        const jobNumber = row.jobNumber || 'N/A'
        const matched = mergedWorks.find((project) => project.jobNumber === row.jobNumber && (project.siteName || project.jobNumber) === projectName)
        addProjectRow(matched?.id || `timesheet|${projectName}|${jobNumber}`, matched?.siteName || projectName, matched?.jobNumber || jobNumber, row.personId, row.bookingPersonId, row.hours, row.days)
      }
      continue
    }
    if (!isAdditionalScheduleLocationKind(row.locationKind)) continue
    const owner = row.personId ? personByKey.get(row.personId) ?? null : null
    const booking = bookingById.get(row.bookingId)
    const location =
      row.source === 'live' && booking
        ? managerSiteBookingDisplayTitle(booking, projectNames)
        : row.locationKind === 'custom'
          ? row.jobName.trim() && row.jobName.trim() !== '—' ? row.jobName.trim() : 'Custom'
          : row.locationKind === 'office'
            ? 'Office'
            : row.locationKind === 'working_from_home'
              ? 'Working from home'
              : 'Site survey'
    managerScheduleRows.push({
      person: owner?.name ?? 'Unknown',
      role: owner?.role ?? 'User',
      location,
      time: row.time,
      hours: Math.round(row.hours * 100) / 100,
      days: Math.round(row.days * 100) / 100,
    })
    managerScheduleTotal += row.days
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
    // Rulebook 1.53.0 (B9): sorted by the real organisation day, the date written in the organisation zone.
    .map(({ week, line }) => ({
      sortKey: dayKeyInZone(line.date, timeZone),
      person: week.personName,
      title: line.title,
      jobNumber: priceWorkJobNumberText(line.jobNumber),
      date: zoneDayText(line.date),
      // Rulebook 1.45.0: the entry's evidence count (`claimEvidenceCountText`) beside its description.
      details: [line.details, claimEvidenceCountText(week.evidenceCounts?.[normalizeDocumentId(line.id)])].filter(Boolean).join(' · '),
      amount: line.amount,
    }))
    .sort((a, b) => a.person.localeCompare(b.person) || a.sortKey.localeCompare(b.sortKey))
    .map(({ sortKey: _sortKey, ...row }) => row)
  const priceWorkTotal = Math.round(priceWorkRows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100
  const expenseRows: WeeklyReportMoneyRow[] = timesheetMoneyLines(
    timesheetWeeks,
    'expenses',
    period.start,
    period.end,
    timeZone
  )
    .map(({ week, line }) => ({
      sortKey: dayKeyInZone(line.date, timeZone),
      person: week.personName,
      title: line.title,
      jobNumber: line.jobNumber,
      date: zoneDayText(line.date),
      details: [line.details, claimEvidenceCountText(week.evidenceCounts?.[normalizeDocumentId(line.id)])].filter(Boolean).join(' · '),
      amount: line.amount,
    }))
    .sort((a, b) => a.person.localeCompare(b.person) || a.sortKey.localeCompare(b.sortKey))
    .map(({ sortKey: _sortKey, ...row }) => row)
  const expenseTotal = Math.round(expenseRows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100

  const subContractorRows: WeeklyReportSubRow[] = periodSubBookings.map((booking) => {
    const project = projectsById.get(booking.projectId)
    const sub = subcontractors.find((entry) => entry.id === booking.subcontractorId)
    const people = resolveSubcontractorBookingPeople(booking, sub)
    // Rulebook 1.51.0 §7 (Q4c): custom hours are hours worked ÷ that day's paid day (`subcontractorDayValue`).
    const dayKey = dayKeyInZone(new Date(booking.date), timeZone)
    const dayPolicy = policyOn(new Date(booking.date))
    const hours = payrollHoursResult({
      booking: {
        timeSlot: booking.timeSlot,
        workStartTime: booking.workStartTime,
        workEndTime: booking.workEndTime,
        isBreakRemoved: booking.isBreakRemoved === true,
      } as never,
      dayKey,
      policy: dayPolicy,
      timeZone,
    })
    const days = subcontractorDayValue(booking.timeSlot, { hours, standardDayHours: weekdayPaidHours(dayPolicy) })
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

  // Rulebook 1.51.0 §7 (Q4b): leave matched to a person under every id and email (`weeklyReportLeaveRows`).
  const leave = weeklyReportLeaveRows({
    records: holidays.map((holiday) => {
      const keys = holidayBookingDayKeys(holiday, timeZone)
      return {
        id: holiday.id,
        userId: holiday.userId ?? null,
        operativeId: holiday.operativeId ?? null,
        startDayKey: keys.startDayKey,
        endDayKey: keys.endDayKey,
        timeSlot: holiday.timeSlot,
        status: holiday.status,
      }
    }),
    people: weeklyReportLeavePeople(users, operatives, userIdAliases),
    range,
    timeZone,
    nonWorkingDayKeys: bankHolidayDayKeys,
  })
  const annualLeaveRows: WeeklyReportLeaveRow[] = leave.rows.map((row) => ({ person: row.person, role: row.role, days: row.days, type: row.type }))
  const annualLeaveTotal = leave.total

  // Rulebook 1.51.0 §7 (Q4d): a clash row states facts only (`weeklyReportClashDetail`), never an app instruction.
  const clashDetail = (clash: { date: Date; entries?: Array<{ locationLabel: string; timeLabel: string }> }) =>
    weeklyReportClashDetail({
      dayText: zoneDayText(clash.date),
      places: (clash.entries ?? []).map((entry) => ({ label: entry.locationLabel, time: entry.timeLabel })),
    })
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
      detail: string
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
      detail: clash.detail,
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
        payrollPolicyState: orgDetails?.payrollTimePolicyState ?? null,
        userIdAliases,
        timeZone,
      }),
      period
    )) {
      if (isAnonymisedDeletedProfile({ name: clash.operativeName })) continue
      // A cluster is approved only when every overlapping pair is (`isClashGroupApproved`).
      if (decisions && isClashGroupApproved(clash, decisions)) {
        approvedClashes.push(approvedRow({ ...clash, detail: clashDetail(clash) }, clash.operativeName, 'operative'))
        continue
      }
      if (!clashStillOpen(clash)) continue
      warnings.push({
        status: WEEKLY_REPORT_WARNING_OPEN,
        priority: 'High',
        type: 'Booking clash',
        date: zoneDayText(clash.date),
        description: clash.operativeName,
        detail: clashDetail(clash),
        forPerson: clash.operativeName,
      })
    }
    for (const clash of filterWarningsToPeriod(
      computeManagerBookingClashWarnings(managerSiteBookings, users, mergedWorks, {
        operativeBookings: bookings,
        operatives,
        payrollPolicy: payroll,
        payrollPolicyState: orgDetails?.payrollTimePolicyState ?? null,
        userIdAliases,
        timeZone,
      }),
      period
    )) {
      if (isAnonymisedDeletedProfile({ name: clash.personName })) continue
      if (decisions && isClashApproved(clash, decisions)) {
        approvedClashes.push(approvedRow({ ...clash, detail: clashDetail(clash) }, clash.personName, 'manager'))
        continue
      }
      if (!clashStillOpen(clash)) continue
      warnings.push({
        status: WEEKLY_REPORT_WARNING_OPEN,
        priority: 'Medium',
        type: 'Manager overlap',
        date: zoneDayText(clash.date),
        description: clash.personName,
        detail: clashDetail(clash),
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
      // Rulebook 1.53.0 (B6): every id a person goes by, as on the Warnings page.
      userIdAliases,
    })) {
      // Rulebook 1.53.0 (B6): a dismissed or approved unbooked row is not open (`isWarningActive`), as on Warnings.
      if (decisions && !isWarningActive({ resolutionKey: warning.id }, decisions)) continue
      warnings.push({
        status: WEEKLY_REPORT_WARNING_OPEN,
        priority: 'High',
        type: 'Unbooked labour',
        date: zoneDayText(warning.date),
        description: warning.operativeName,
        detail: warning.message,
        forPerson: warning.operativeName,
      })
    }
  }

  const round2 = (value: number) => Math.round(value * 100) / 100
  const projectGroups = Array.from(projectGroupsMap.values())
    .map((group) => ({
      ...group,
      rows: group.rows.map((row) => ({ ...row, hours: round2(row.hours), days: round2(row.days) })),
      projectTotal: round2(group.projectTotal),
      projectHours: round2(group.projectHours),
    }))
    .sort((a, b) => a.projectName.localeCompare(b.projectName))
  const allProjectWorkTotal = round2(projectGroups.reduce((sum, group) => sum + group.projectTotal, 0))
  const allProjectHoursTotal = round2(projectGroups.reduce((sum, group) => sum + group.projectHours, 0))

  // Rulebook 1.29.0 §7: the PAYE overtime section, live from the bookings (labour and job-linked manager site).
  const jobFor = (id: string | undefined) => (id ? projectsById.get(id) : undefined)
  const overtimeBookings: OvertimeBookingInput[] = [
    ...periodOperativeBookings.filter((booking) => bookingOccupiesDay(booking.status)).map((booking) => ({
      id: booking.id,
      collection: 'bookings',
      personId: booking.operativeId,
      dayKey: dayKeyInZone(new Date(booking.date), timeZone),
      timeSlot: String(booking.timeSlot),
      workStartTime: booking.workStartTime ?? null,
      workEndTime: booking.workEndTime ?? null,
      isBreakRemoved: booking.isBreakRemoved === true,
      otMultiplierOverride: booking.otMultiplierOverride ?? null,
      status: String(booking.status),
      jobId: booking.projectId,
      jobNumber: jobFor(booking.projectId)?.jobNumber ?? '',
      jobName: jobFor(booking.projectId)?.siteName ?? '',
    })),
    ...periodManagerBookings
      .filter((booking) => (booking.locationType === 'project' || booking.locationType === 'small_work') && booking.locationId)
      .map((booking) => ({
        id: booking.id,
        collection: 'managerSiteBookings',
        personId: booking.userId,
        dayKey: dayKeyInZone(new Date(booking.date), timeZone),
        timeSlot: String(booking.timeSlot),
        workStartTime: booking.workStartTime ?? null,
        workEndTime: booking.workEndTime ?? null,
        isBreakRemoved: booking.isBreakRemoved === true,
        otMultiplierOverride: booking.otMultiplierOverride ?? null,
        jobId: booking.locationId ?? null,
        jobNumber: jobFor(booking.locationId)?.jobNumber ?? '',
        jobName: jobFor(booking.locationId)?.siteName ?? '',
      })),
  ]
  const payePeople = users
    .filter((user) => !isAnonymisedDeletedProfile(user))
    .map((user) => {
      const operative = findOperativeForUser(user, operatives)
      return {
        id: user.id,
        name: resolveDisplayName(user, operative),
        // 1.32.0: the one all-records-per-person rule (`overtimePersonIds`), plus the roster fold's aliases.
        ids: [...overtimePersonIds({ person: user, roster: users as never, operatives }), ...aliasIdsFor(user.id)],
        employmentType: user.employmentType ?? null,
        employmentTypeTransitionFrom: user.employmentTypeTransitionFrom ?? null,
        employmentTypeEffectiveAt: user.employmentTypeEffectiveAt ?? null,
      }
    })
  // Pay strip (review #342): the PAYE overtime section reads the employment type of every person with a booking in the
  // range (matched by their `ids`, without case, as `payeOvertimeLines` does), so their pay is waited for too.
  const overtimeBookingKeys = new Set(overtimeBookings.map((booking) => normalizeDocumentId(booking.personId)).filter(Boolean))
  for (const person of payePeople) {
    if (person.ids.some((id) => overtimeBookingKeys.has(normalizeDocumentId(id)))) pricedUserIds.add(person.id)
  }
  const payeOvertimeRows: WeeklyReportPayeOvertimeRow[] = weeklyReportPayeOvertime({
    people: payePeople,
    bookings: overtimeBookings,
    organization: policyState,
    timeZone,
    range: { start: dayKeyInZone(period.start, timeZone), end: dayKeyInZone(period.end, timeZone) },
  }).map((row) => ({
    person: row.name,
    jobNumber: row.jobNumber,
    jobName: row.jobName,
    overtimeHours: row.overtimeHours,
    label: row.label,
    hoursCell: row.changedFromOrganization ? `${row.multiplierText} (${OVERTIME_RATE_CHANGED_MARK}, ×${row.organizationMultiplier})` : row.multiplierText,
    changedFromOrganization: row.changedFromOrganization,
  }))
  const payeOvertimeTotal = Math.round(payeOvertimeRows.reduce((sum, row) => sum + row.overtimeHours, 0) * 100) / 100

  return {
    payeOvertimeRows,
    payeOvertimeTotal,
    pricedUserIds: [...pricedUserIds].sort(),
    pricedCatalogueOperativeIds: [...pricedCatalogueOperativeIds].sort(),
    organizationName,
    companyLogoURL,
    reportPeriod: period,
    invoicingPeriodLabel: invoicingPeriod
      ? formatReportPeriodLabel(invoicingPeriod.start, invoicingPeriod.end)
      : '—',
    generatedAt: new Date(),
    timeZone,
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
    paySummary: pay.people,
    grandTotal: pay.grandTotal,
    payHiddenPeople: pay.hiddenPeople,
    allProjectHoursTotal,
    unmatchedLeave: leave.unmatched,
  }
}

/**
 * Rulebook 1.51.0 (Q4b): the people annual leave is matched to — each kept users document with every id it goes by
 * (`overtimePersonIds`, the roster fold's ids) and its email, and each `operatives` row with no account.
 */
export function weeklyReportLeavePeople(
  users: User[],
  operatives: Operative[],
  userIdAliases: Readonly<Record<string, string>> = {}
): WeeklyReportLeavePerson[] {
  const out: WeeklyReportLeavePerson[] = []
  const claimed = new Set<string>()
  const aliasesOf = (id: string) => rosterAliasIdsFor(id, userIdAliases)
  // Review of #329: only the kept users document of each person (`userIdAliases`), so a row is named from the live
  // record, never a same-email duplicate; the duplicate's ids are in the kept person's ids.
  const kept = (id: string) => {
    const lower = id.trim().toLowerCase()
    const hit = Object.entries(userIdAliases).find(([alias]) => alias.trim().toLowerCase() === lower)
    return !hit || hit[1].trim().toLowerCase() === lower
  }
  for (const user of users) {
    if (!kept(user.id)) continue
    const operative = findOperativeForUser(user, operatives)
    const ids = Array.from(new Set([...overtimePersonIds({ person: user, roster: users as never, operatives }), ...aliasesOf(user.id)]))
    ids.forEach((id) => claimed.add(normalizeDocumentId(id)))
    out.push({ id: user.id, name: resolveDisplayName(user, operative), role: resolvePersonRole(user, operative), ids, email: user.email || null })
  }
  for (const operative of operatives) {
    if (claimed.has(normalizeDocumentId(operative.id))) continue
    out.push({ id: operative.id, name: resolveDisplayName(undefined, operative), role: resolvePersonRole(undefined, operative), ids: [operative.id], email: operative.email || null })
  }
  return out
}
