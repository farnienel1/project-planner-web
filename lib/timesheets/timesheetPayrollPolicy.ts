/**
 * iOS parity: Core/TimesheetPayrollPolicy.swift canAccessMyTimesheets /
 * shouldAppearInOperativeTimesheetRoster
 */
import type { User } from '@/types'
import type { OrgInvoicingSettings } from '@/lib/settings/organizationSettings'
import { LONDON_TIME_ZONE, addLondonDays, dayKey, londonMidnight } from '@/lib/ios-parity/londonTime'
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

/** Pay runs whose calendar window overlaps a weekly-report range. iOS payPeriodsOverlapping. */
export function payPeriodsOverlapping(
  rangeStart: Date,
  rangeEnd: Date,
  invoicing: OrgInvoicingSettings,
  timeZone: string = LONDON_TIME_ZONE
): { start: Date; end: Date }[] {
  const periods: { start: Date; end: Date }[] = []
  let cursor = londonMidnight(rangeStart, timeZone)
  const endKey = dayKey(rangeEnd, timeZone)
  let guard = 0
  while (dayKey(cursor, timeZone) <= endKey && guard < 80) {
    const period = computeInvoicingPeriod(cursor, invoicing, timeZone)
    if (!periods.some((row) => dayKey(row.start, timeZone) === dayKey(period.start, timeZone))) {
      periods.push({ start: period.start, end: period.end })
    }
    const next = addLondonDays(londonMidnight(period.end, timeZone), 1, timeZone)
    if (dayKey(next, timeZone) <= dayKey(cursor, timeZone)) break
    cursor = next
    guard += 1
  }
  return periods
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
