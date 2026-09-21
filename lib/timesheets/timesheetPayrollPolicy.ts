/**
 * iOS parity: Core/TimesheetPayrollPolicy.swift canAccessMyTimesheets /
 * shouldAppearInOperativeTimesheetRoster
 */
import type { User } from '@/types'
import type { OrgInvoicingSettings } from '@/lib/settings/organizationSettings'
import { LONDON_TIME_ZONE, dayKey, londonMidnight } from '@/lib/ios-parity/londonTime'
import { employmentTypeOnDay, isBillableSelfEmployedDay } from '@/lib/ios-parity/employmentType'
import { computeInvoicingPeriod, eachLondonDay } from '@/lib/warnings/warningLookahead'
import { payDateForPeriodEnd } from '@/lib/timesheets/paymentRunCopy'

export function canAccessMyTimesheetsWithPolicy(
  user: Pick<User, 'employmentType' | 'employmentTypeTransitionFrom' | 'employmentTypeEffectiveAt'>,
  invoicing: OrgInvoicingSettings,
  referenceDate: Date = new Date(),
  timeZone: string = LONDON_TIME_ZONE
): boolean {
  if (employmentTypeOnDay(user, referenceDate, timeZone) === 'self_employed') return true
  const period = computeInvoicingPeriod(referenceDate, invoicing, timeZone)
  const hasSelfEmployedDays = eachLondonDay(period.start, period.end, timeZone).some((day) =>
    isBillableSelfEmployedDay(user, day, timeZone)
  )
  if (!hasSelfEmployedDays) return false
  const payDate = payDateForPeriodEnd(period.end, invoicing, timeZone)
  if (!payDate) return true
  return dayKey(referenceDate, timeZone) <= dayKey(payDate, timeZone)
}

export function shouldAppearInOperativeTimesheetRoster(
  user: User,
  periodStart: Date,
  periodEnd: Date,
  invoicing: OrgInvoicingSettings,
  referenceDate: Date = new Date(),
  timeZone: string = LONDON_TIME_ZONE
): boolean {
  if (!user.isActive) return false
  const eligible =
    user.permissions.operativeMode ||
    user.permissions.manager ||
    user.permissions.adminAccess ||
    user.isSuperAdmin ||
    user.role === 'manager' ||
    user.role === 'admin'
  if (!eligible) return false
  if (employmentTypeOnDay(user, referenceDate, timeZone) === 'self_employed') return true
  const hasSelfEmployedDays = eachLondonDay(periodStart, periodEnd, timeZone).some((day) =>
    isBillableSelfEmployedDay(user, day, timeZone)
  )
  if (!hasSelfEmployedDays) return false
  const payDate = payDateForPeriodEnd(periodEnd, invoicing, timeZone)
  if (!payDate) return true
  return dayKey(londonMidnight(referenceDate, timeZone), timeZone) <= dayKey(payDate, timeZone)
}
