/**
 * Warning rows for one organisation.
 * The scan window, qualification rows, unverified rows, and unbooked-labour rows come from lib/canonical.
 * Clash timelines and material cut-off copy stay in this app.
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
} from '@/lib/settings/organizationSettings'
import { qualificationExpiryRows, unverifiedOperativeRows } from '@/lib/canonical'
import { ianaTimeZoneForCountry } from '@/lib/orgTime/orgTimeZone'
import type { NotificationPreferences } from '@/lib/settings/notificationPreferences'
import { computeOperativeBookingClashWarnings, type OperativeBookingClashWarning } from '@/lib/scheduling/bookingClashUtils'
import { computeManagerBookingClashWarnings, type ManagerBookingClashWarning } from '@/lib/warnings/managerClashWarnings'
import {
  computeUnbookedLabourWarnings,
  filterWarningsByLookahead,
  type UnbookedLabourWarning,
} from '@/lib/warnings/unbookedLabourWarnings'
import { computeMissedMaterialOrderWarnings, type MissedMaterialOrderWarning } from '@/lib/warnings/materialOrderWarnings'
import { dateFromDayKey } from '@/lib/ios-parity/londonTime'

export type QualificationExpiryWarning = {
  id: string
  operativeId: string
  operativeName: string
  qualificationName: string
  date: Date
  daysUntilExpiry: number
  severity: 'low'
  title: 'Qualification expired' | 'Qualification expiry'
  message: string
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
  materialWarnings: MissedMaterialOrderWarning[]
  qualificationWarnings: QualificationExpiryWarning[]
  unverifiedWarnings: UnverifiedOperativeWarning[]
  coreCount: number
  highCount: number
  mediumCount: number
  lowCount: number
}

export function computeQualificationExpiryWarnings(
  operatives: Operative[],
  referenceDate = new Date()
): QualificationExpiryWarning[] {
  const rows = qualificationExpiryRows({
    referenceIso: referenceDate.toISOString(),
    timeZone: 'Europe/London',
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
        expiries,
      }
    }),
  })
  return rows.map((row) => ({
    id: row.id,
    operativeId: row.operativeId,
    operativeName: row.operativeName,
    qualificationName: row.qualificationName,
    date: dateFromDayKey(row.dayKey),
    daysUntilExpiry: row.daysUntilExpiry,
    severity: row.severity,
    title: row.title,
    message: row.message,
  }))
}

export function computeUnverifiedOperativeWarnings(
  operatives: Operative[],
  users: User[],
  referenceDate = new Date()
): UnverifiedOperativeWarning[] {
  const rows = unverifiedOperativeRows({
    referenceIso: referenceDate.toISOString(),
    timeZone: 'Europe/London',
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
  projects: Project[]
  holidays: HolidayBooking[]
  materials?: ProjectMaterialLine[]
  sendRecords?: MaterialSendRecord[]
  warningDetection?: OrgWarningDetectionSettings
  invoicing?: OrgInvoicingSettings
  payrollPolicy?: OrgPayrollTimePolicy
  notificationPreferences?: NotificationPreferences | null
  referenceDate?: Date
  orgDetails?: OrganizationDetails | null
}): OrgWarningsResult {
  const warningDetection = input.warningDetection ?? input.orgDetails?.warningDetection ?? DEFAULT_WARNING_DETECTION
  const invoicing = input.invoicing ?? input.orgDetails?.invoicing
  const payrollPolicy = input.payrollPolicy ?? input.orgDetails?.payrollTimePolicy ?? DEFAULT_PAYROLL_POLICY
  const now = input.referenceDate ?? new Date()
  const prefs = input.notificationPreferences ?? input.orgDetails?.materialCutOff ?? null
  const timeZone = ianaTimeZoneForCountry(input.orgDetails?.countryCode)

  const clashWarnings = warningDetection.detectClashes
    ? filterWarningsByLookahead(
        computeOperativeBookingClashWarnings(input.bookings, input.operatives, input.projects, {
          users: input.users,
          payrollPolicy,
        }),
        warningDetection,
        invoicing,
        now,
        timeZone
      )
    : []

  const managerClashWarnings = warningDetection.detectClashes
    ? filterWarningsByLookahead(
        computeManagerBookingClashWarnings(input.managerSiteBookings, input.users, input.projects, {
          operativeBookings: input.bookings,
          operatives: input.operatives,
          payrollPolicy,
        }),
        warningDetection,
        invoicing,
        now,
        timeZone
      )
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

  const materialWarnings = computeMissedMaterialOrderWarnings(
    input.materials || [],
    input.sendRecords || [],
    input.projects,
    input.bookings,
    {
      enabled: prefs ? prefs.materialOrderCutOff !== false : true,
      cutOffOnSaturday: prefs?.materialCutOffOnSaturday === true,
      cutOffOnSunday: prefs?.materialCutOffOnSunday === true,
      cutOffHour: prefs?.materialCutOffHour,
      cutOffMinute: prefs?.materialCutOffMinute,
      referenceDate: now,
    }
  )

  const qualificationWarnings = computeQualificationExpiryWarnings(input.operatives, now)
  const unverifiedWarnings = computeUnverifiedOperativeWarnings(input.operatives, input.users, now)

  const highCount = clashWarnings.length + unbookedWarnings.length
  const mediumCount = managerClashWarnings.length
  const lowCount = materialWarnings.length + qualificationWarnings.length + unverifiedWarnings.length
  const coreCount = highCount + mediumCount + lowCount

  return {
    clashWarnings,
    managerClashWarnings,
    unbookedWarnings,
    materialWarnings,
    qualificationWarnings,
    unverifiedWarnings,
    coreCount,
    highCount,
    mediumCount,
    lowCount,
  }
}
