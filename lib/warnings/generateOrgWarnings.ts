/**
 * Warning rows for one organisation.
 * The scan window (`coverageWindow`), clash days (`clashScanDays`), qualification rows, unverified rows,
 * unbooked-labour rows and material cut-off rows (`materialCutOffWarningRows`) come from lib/canonical.
 * Clash timelines stay in this app. Days use the organisation zone (`organizationTimeZone`).
 */

import type { Booking, HolidayBooking, Operative, Project, ProjectMaterialLine, MaterialSendRecord, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type {
  OrganizationDetails,
  OrgPayrollTimePolicy,
  OrgWarningDetectionSettings,
  OrgInvoicingSettings,
} from '@/lib/settings/organizationSettings'
import {
  DEFAULT_PAYROLL_POLICY,
  DEFAULT_WARNING_DETECTION,
  parseInvoicing,
} from '@/lib/settings/organizationSettings'
import { isActiveBookingStatus } from '@/lib/ios-parity/enums'
import {
  clashPairKey,
  dayKeyInOrganizationZone,
  isAnonymisedDeletedProfile,
  isWarningActive,
  organizationTimeZone,
  qualificationExpiryRows,
  resolveMaterialCutOffClock,
  unverifiedOperativeRows,
  withoutDismissedQualificationRows,
  type AcceptedClashRecord,
  type CoverageFallbackReason,
} from '@/lib/canonical'
import type { NotificationPreferences } from '@/lib/settings/notificationPreferences'
import { computeOperativeBookingClashWarnings, type OperativeBookingClashWarning } from '@/lib/scheduling/bookingClashUtils'
import { computeManagerBookingClashWarnings, type ManagerBookingClashWarning } from '@/lib/warnings/managerClashWarnings'
import { computeUnbookedLabourWarnings, type UnbookedLabourWarning } from '@/lib/warnings/unbookedLabourWarnings'
import { computeClashScanDayKeys, computeWarningCoverageWindow } from '@/lib/warnings/warningLookahead'
import { computeMissedMaterialOrderWarnings, type MissedMaterialOrderWarning } from '@/lib/warnings/materialOrderWarnings'
import { computeLeaveCoverageWarnings, type LeaveCoverageWarning } from '@/lib/warnings/leaveCoverageWarnings'
import { dateFromDayKey } from '@/lib/ios-parity/londonTime'

export type QualificationExpiryWarning = {
  id: string
  operativeId: string
  operativeName: string
  qualificationId: string
  qualificationName: string
  date: Date
  /** Expiry day in the organisation zone. */
  dayKey: string
  daysUntilExpiry: number
  severity: 'low'
  title: 'Qualification expired' | 'Qualification expiry'
  message: string
  /** Shared dismiss key; see lib/canonical/warningRows.ts. */
  dismissKey: string
}

export type UnverifiedOperativeWarning = {
  id: string
  operativeId: string
  operativeName: string
  email: string
  message: string
}

export type OrgWarningsResult = {
  clashWarnings: OperativeBookingClashWarning[]
  managerClashWarnings: ManagerBookingClashWarning[]
  unbookedWarnings: UnbookedLabourWarning[]
  /** Approved annual leave with a booking inside it, or a half day whose other half is not covered. */
  leaveWarnings: LeaveCoverageWarning[]
  materialWarnings: MissedMaterialOrderWarning[]
  qualificationWarnings: QualificationExpiryWarning[]
  unverifiedWarnings: UnverifiedOperativeWarning[]
  coreCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  /** Set when the saved "Set number of days" could not be used and 7 days were scanned. */
  coverageFallbackReason?: CoverageFallbackReason
}

export function computeQualificationExpiryWarnings(
  operatives: Operative[],
  referenceDate = new Date(),
  timeZone: string = organizationTimeZone(null)
): QualificationExpiryWarning[] {
  const rows = qualificationExpiryRows({
    referenceIso: referenceDate.toISOString(),
    timeZone,
    operatives: operatives.map((operative) => {
      const names = new Map((operative.qualifications || []).map((qualification) => [qualification.id, qualification.name]))
      const expiries = Object.entries(operative.qualificationExpiryDates || []).flatMap(([qualificationId, expiry]) => {
        const name = names.get(qualificationId)
        if (!name || !(expiry instanceof Date) || Number.isNaN(expiry.getTime())) return []
        return [{ qualificationId, name, expiryIso: expiry.toISOString() }]
      })
      return {
        id: operative.id,
        isActive: Boolean(operative.isActive),
        name: `${operative.firstName} ${operative.lastName}`.trim() || operative.email,
        email: operative.email,
        expiries,
      }
    }),
  })
  return rows.map((row) => ({
    id: row.id,
    operativeId: row.operativeId,
    operativeName: row.operativeName,
    qualificationId: row.qualificationId,
    qualificationName: row.qualificationName,
    date: dateFromDayKey(row.dayKey, timeZone),
    dayKey: row.dayKey,
    daysUntilExpiry: row.daysUntilExpiry,
    severity: row.severity,
    title: row.title,
    message: row.message,
    dismissKey: row.dismissKey,
  }))
}

function isAnonymisedWarningSubject(name: string, email?: string): boolean {
  return isAnonymisedDeletedProfile({ email: email || '', name })
}

export function computeUnverifiedOperativeWarnings(
  operatives: Operative[],
  users: User[],
  referenceDate = new Date(),
  timeZone: string = organizationTimeZone(null)
): UnverifiedOperativeWarning[] {
  const rows = unverifiedOperativeRows({
    referenceIso: referenceDate.toISOString(),
    timeZone,
    operatives: operatives.map((operative) => ({
      id: operative.id,
      email: operative.email,
      name: `${operative.firstName} ${operative.lastName}`.trim() || operative.email,
    })),
    people: users.map((user) => ({
      email: user.email,
      passwordSet: user.passwordSet === true,
      createdAtIso: user.createdAt instanceof Date ? user.createdAt.toISOString() : '',
      isOperativeMode: Boolean(user.permissions?.operativeMode),
    })),
  })
  return rows.map((row) => ({
    id: row.id,
    operativeId: row.operativeId,
    operativeName: row.operativeName,
    email: row.email,
    message: row.message,
  }))
}

export function generateOrgWarnings(input: {
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  operatives: Operative[]
  users: User[]
  /** Folded same-email `users` id → the id the roster kept (org user store `userIdAliases`). */
  userIdAliases?: Readonly<Record<string, string>> | null
  projects: Project[]
  holidays: HolidayBooking[]
  materials?: ProjectMaterialLine[]
  sendRecords?: MaterialSendRecord[]
  warningDetection?: OrgWarningDetectionSettings
  invoicing?: OrgInvoicingSettings
  payrollPolicy?: OrgPayrollTimePolicy
  /** Ignored for the clock. Organisation `settings.materialCutOff` is the only time. */
  notificationPreferences?: NotificationPreferences | null
  referenceDate?: Date
  orgDetails?: OrganizationDetails | null
}): OrgWarningsResult {
  const warningDetection = input.warningDetection ?? input.orgDetails?.warningDetection ?? DEFAULT_WARNING_DETECTION
  const invoicing = parseInvoicing(
    (input.invoicing ?? input.orgDetails?.invoicing) as Record<string, unknown> | undefined
  )
  const payrollPolicy = input.payrollPolicy ?? input.orgDetails?.payrollTimePolicy ?? DEFAULT_PAYROLL_POLICY
  const now = input.referenceDate ?? new Date()
  const cutOff = resolveMaterialCutOffClock({
    organizationMaterialCutOff: input.orgDetails?.materialCutOff ?? null,
    userNotificationPreferences: input.notificationPreferences ?? null,
  })
  const timeZone = organizationTimeZone(input.orgDetails?.countryCode)
  const coverage = computeWarningCoverageWindow(now, warningDetection, invoicing, timeZone)

  // Clashes follow the scan window; in Full week a Saturday or Sunday of this week is checked when it has a booking.
  const clashDayKeys = warningDetection.detectClashes
    ? computeClashScanDayKeys(now, warningDetection, invoicing, timeZone, bookedDayKeys(input, timeZone))
    : new Set<string>()
  const onClashDay = (warning: { date: Date }) => clashDayKeys.has(dayKeyInOrganizationZone(warning.date.toISOString(), timeZone))

  const clashWarnings = warningDetection.detectClashes
    ? computeOperativeBookingClashWarnings(input.bookings, input.operatives, input.projects, {
        users: input.users,
        payrollPolicy,
        userIdAliases: input.userIdAliases,
      }).filter((warning) => onClashDay(warning) && !isAnonymisedWarningSubject(warning.operativeName))
    : []

  const managerClashWarnings = warningDetection.detectClashes
    ? computeManagerBookingClashWarnings(input.managerSiteBookings, input.users, input.projects, {
        operativeBookings: input.bookings,
        operatives: input.operatives,
        payrollPolicy,
        userIdAliases: input.userIdAliases,
      }).filter((warning) => onClashDay(warning) && !isAnonymisedWarningSubject(warning.personName))
    : []

  const unbookedWarnings = computeUnbookedLabourWarnings({
    bookings: input.bookings,
    managerSiteBookings: input.managerSiteBookings,
    operatives: input.operatives,
    users: input.users,
    holidays: input.holidays,
    warningDetection,
    invoicing,
    payrollPolicy,
    referenceDate: now,
    timeZone,
  })

  const leaveWarnings = computeLeaveCoverageWarnings({
    bookings: input.bookings,
    managerSiteBookings: input.managerSiteBookings,
    operatives: input.operatives,
    users: input.users,
    projects: input.projects,
    holidays: input.holidays,
    warningDetection,
    invoicing,
    payrollPolicy,
    referenceDate: now,
    timeZone,
  }).filter((warning) => !isAnonymisedWarningSubject(warning.personName))

  const materialWarnings = computeMissedMaterialOrderWarnings(
    input.materials || [],
    input.sendRecords || [],
    input.projects,
    input.bookings,
    {
      enabled: cutOff.materialOrderCutOff !== false,
      cutOffOnSaturday: cutOff.materialCutOffOnSaturday,
      cutOffOnSunday: cutOff.materialCutOffOnSunday,
      cutOffHour: cutOff.materialCutOffHour,
      cutOffMinute: cutOff.materialCutOffMinute,
      referenceDate: now,
      timeZone,
    }
  )

  const qualificationWarnings = computeQualificationExpiryWarnings(input.operatives, now, timeZone)
  const unverifiedWarnings = computeUnverifiedOperativeWarnings(input.operatives, input.users, now, timeZone)

  const result = withWarningCounts({
    clashWarnings,
    managerClashWarnings,
    unbookedWarnings,
    leaveWarnings,
    materialWarnings,
    qualificationWarnings,
    unverifiedWarnings,
  })
  const fallback = coverage.fallbackReason ?? warningDetection.clashLookaheadDaysFallback
  if (fallback && warningDetection.clashLookaheadMode === 'numberOfDays') result.coverageFallbackReason = fallback
  return result
}

/** Organisation day keys that hold a booking that occupies the day (operative or manager). */
function bookedDayKeys(
  input: { bookings: Booking[]; managerSiteBookings: ManagerSiteBooking[] },
  timeZone: string
): string[] {
  const keys = new Set<string>()
  const add = (date: Date) => {
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      keys.add(dayKeyInOrganizationZone(date.toISOString(), timeZone))
    }
  }
  for (const booking of input.bookings) if (isActiveBookingStatus(booking.status)) add(booking.date)
  for (const booking of input.managerSiteBookings) add(booking.date)
  return [...keys]
}

type WarningRows = Omit<OrgWarningsResult, 'coreCount' | 'highCount' | 'mediumCount' | 'lowCount'>

function withWarningCounts(rows: WarningRows & { coverageFallbackReason?: CoverageFallbackReason }): OrgWarningsResult {
  const leaveClashCount = rows.leaveWarnings.filter((warning) => warning.kind === 'leave_clash').length
  const leaveCoverCount = rows.leaveWarnings.length - leaveClashCount
  const highCount = rows.clashWarnings.length + rows.unbookedWarnings.length + leaveClashCount
  const mediumCount = rows.managerClashWarnings.length + leaveCoverCount
  const lowCount = rows.materialWarnings.length + rows.qualificationWarnings.length + rows.unverifiedWarnings.length
  return { ...rows, coreCount: highCount + mediumCount + lowCount, highCount, mediumCount, lowCount }
}

export type WarningDecisionInputs = {
  /** `organizations/{orgId}/warningResolutions`, through `resolvedWarningKeys`. */
  resolvedKeys: readonly string[]
  /** `organizations/{orgId}/acceptedBookingClashes`. */
  acceptedClashes: readonly AcceptedClashRecord[]
  /** `organizations/{orgId}/dismissedWarnings` keys (expired qualifications). */
  dismissedQualificationKeys: ReadonlySet<string>
}

/**
 * The rows that still count, and their totals: the rulebook's `isWarningActive` (approved, removed or
 * accepted on any device) and `withoutDismissedQualificationRows`. The Warnings page and the Home tile
 * both show this, so they give the same number as each other and as iOS.
 */
export function activeOrgWarnings(result: OrgWarningsResult, decisions: WarningDecisionInputs): OrgWarningsResult {
  const active = (row: { resolutionKey?: string; bookingAId?: string; bookingBId?: string }) =>
    isWarningActive(row, decisions)
  return withWarningCounts({
    // Operative clashes are keyed by their booking pair (`clashPairKey`) in `warningResolutions` too.
    clashWarnings: result.clashWarnings.filter((w) =>
      active({ resolutionKey: clashPairKey(w.bookingAId, w.bookingBId), bookingAId: w.bookingAId, bookingBId: w.bookingBId })
    ),
    managerClashWarnings: result.managerClashWarnings.filter((w) =>
      active({ resolutionKey: w.resolutionKey, bookingAId: w.bookingAId, bookingBId: w.bookingBId })
    ),
    unbookedWarnings: result.unbookedWarnings.filter((w) => active({ resolutionKey: w.id })),
    leaveWarnings: result.leaveWarnings.filter((w) => active({ resolutionKey: w.id })),
    materialWarnings: result.materialWarnings.filter((w) => active({ resolutionKey: w.id })),
    qualificationWarnings: withoutDismissedQualificationRows(
      result.qualificationWarnings,
      decisions.dismissedQualificationKeys
    ).filter((w) => active({ resolutionKey: w.id })),
    unverifiedWarnings: result.unverifiedWarnings.filter((w) => active({ resolutionKey: w.id })),
    coverageFallbackReason: result.coverageFallbackReason,
  })
}
