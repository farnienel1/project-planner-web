/**
 * iOS parity: Core/WarningsComputation.swift generate()
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
import type { NotificationPreferences } from '@/lib/settings/notificationPreferences'
import { computeOperativeBookingClashWarnings, type OperativeBookingClashWarning } from '@/lib/scheduling/bookingClashUtils'
import { computeManagerBookingClashWarnings, type ManagerBookingClashWarning } from '@/lib/warnings/managerClashWarnings'
import {
  computeUnbookedLabourWarnings,
  filterWarningsByLookahead,
  type UnbookedLabourWarning,
} from '@/lib/warnings/unbookedLabourWarnings'
import { computeMissedMaterialOrderWarnings, type MissedMaterialOrderWarning } from '@/lib/warnings/materialOrderWarnings'
import { addLondonDays, dayKey, londonIsoWeekday, londonMidnight } from '@/lib/ios-parity/londonTime'

export type QualificationExpiryWarning = {
  id: string
  operativeId: string
  operativeName: string
  qualificationName: string
  date: Date
  daysUntilExpiry: number
  severity: 'high' | 'medium' | 'low'
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

function workingDaysBetween(start: Date, end: Date): number {
  let count = 0
  let cursor = londonMidnight(start)
  const last = londonMidnight(end)
  while (dayKey(cursor) <= dayKey(last)) {
    const iso = londonIsoWeekday(cursor)
    if (iso >= 1 && iso <= 5) count += 1
    cursor = addLondonDays(cursor, 1)
    if (count > 400) break
  }
  return count
}

export function computeQualificationExpiryWarnings(
  operatives: Operative[],
  referenceDate = new Date()
): QualificationExpiryWarning[] {
  const today = londonMidnight(referenceDate)
  const oneMonth = addLondonDays(today, 31)
  const todayKey = dayKey(today)
  const endKey = dayKey(oneMonth)
  const warnings: QualificationExpiryWarning[] = []

  for (const operative of operatives) {
    const names = new Map((operative.qualifications || []).map((q) => [q.id, q.name]))
    const expiries = operative.qualificationExpiryDates || {}
    for (const [qualificationId, expiry] of Object.entries(expiries)) {
      const name = names.get(qualificationId)
      if (!name || !(expiry instanceof Date) || Number.isNaN(expiry.getTime())) continue
      const expiryDay = londonMidnight(expiry)
      const expiryKey = dayKey(expiryDay)
      if (expiryKey < todayKey || expiryKey > endKey) continue
      const daysUntilExpiry = Math.max(
        0,
        Math.round((expiryDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      )
      const severity: QualificationExpiryWarning['severity'] =
        daysUntilExpiry <= 7 ? 'high' : daysUntilExpiry <= 14 ? 'medium' : 'low'
      warnings.push({
        id: `qual-${operative.id}-${qualificationId}`,
        operativeId: operative.id,
        operativeName: `${operative.firstName} ${operative.lastName}`.trim() || operative.email,
        qualificationName: name,
        date: expiryDay,
        daysUntilExpiry,
        severity,
        message: `${`${operative.firstName} ${operative.lastName}`.trim() || operative.email}'s ${name} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`,
      })
    }
  }
  return warnings
}

export function computeUnverifiedOperativeWarnings(
  operatives: Operative[],
  users: User[],
  referenceDate = new Date()
): UnverifiedOperativeWarning[] {
  const today = londonMidnight(referenceDate)
  const warnings: UnverifiedOperativeWarning[] = []
  for (const operative of operatives) {
    const email = operative.email.trim().toLowerCase()
    if (!email) continue
    const operativeUser = users.find(
      (user) => user.email.trim().toLowerCase() === email && user.permissions?.operativeMode
    )
    if (!operativeUser || operativeUser.passwordSet) continue
    if (workingDaysBetween(operativeUser.createdAt, today) < 3) continue
    warnings.push({
      id: `unverified-${operative.id}`,
      operativeId: operative.id,
      operativeName: `${operative.firstName} ${operative.lastName}`.trim() || operative.email,
      email,
      message: `${`${operative.firstName} ${operative.lastName}`.trim() || operative.email} has not verified their account`,
    })
  }
  return warnings
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

  const clashWarnings = warningDetection.detectClashes
    ? filterWarningsByLookahead(
        computeOperativeBookingClashWarnings(input.bookings, input.operatives, input.projects, {
          users: input.users,
          payrollPolicy,
        }),
        warningDetection,
        invoicing,
        now
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
        now
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

  const highCount = clashWarnings.length + managerClashWarnings.length + unbookedWarnings.length
  const lowCount = materialWarnings.length
  const coreCount = highCount + lowCount

  return {
    clashWarnings,
    managerClashWarnings,
    unbookedWarnings,
    materialWarnings,
    qualificationWarnings,
    unverifiedWarnings,
    coreCount,
    highCount,
    mediumCount: 0,
    lowCount,
  }
}
