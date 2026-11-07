/**
 * My Timesheets and the User Timesheets roster for a payment run. Rulebook 1.11.0 (owner decisions round 3): a person
 * has a timesheet for a period only when they are self-employed on at least one day of it — canonical
 * `showsMyTimesheets` / `timesheetDaysForPerson`. A PAYE person never has My Timesheets; their PAYE days are not
 * timesheet lines.
 */
import type { User } from '@/types'
import type { OrgInvoicingSettings } from '@/lib/settings/organizationSettings'
import { addLondonDays, dayKey, londonMidnight } from '@/lib/ios-parity/londonTime'
import { computeInvoicingPeriod } from '@/lib/warnings/warningLookahead'
import { showsMyTimesheets, timesheetDaysForPerson, type TimesheetPerson } from '@/lib/canonical/peopleDocuments'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'

function timesheetPerson(
  user: Pick<User, 'employmentType' | 'employmentTypeTransitionFrom' | 'employmentTypeEffectiveAt'> &
    Partial<Pick<User, 'isActive' | 'email' | 'firstName' | 'surname' | 'ghost'>>
): TimesheetPerson {
  return {
    // Rulebook 1.34.0: a ghost operative never has a timesheet (`timesheetDaysForPerson`).
    ghost: user.ghost === true,
    isActive: user.isActive,
    email: user.email,
    name: `${user.firstName ?? ''} ${user.surname ?? ''}`.trim(),
    employmentType: user.employmentType,
    employmentTypeTransitionFrom: user.employmentTypeTransitionFrom,
    employmentTypeEffectiveAt: user.employmentTypeEffectiveAt,
  }
}

function periodDays(start: Date, end: Date, timeZone: string) {
  return { startDayKey: dayKey(start, timeZone), endDayKey: dayKey(end, timeZone) }
}

/** My Timesheets for the active payment run (canonical `showsMyTimesheets`). */
export function canAccessMyTimesheetsWithPolicy(
  user: Pick<User, 'employmentType' | 'employmentTypeTransitionFrom' | 'employmentTypeEffectiveAt'> &
    Partial<Pick<User, 'isActive' | 'email' | 'firstName' | 'surname'>>,
  invoicing: OrgInvoicingSettings,
  referenceDate: Date = new Date(),
  timeZone: string = organizationZoneOr()
): boolean {
  const period = computeInvoicingPeriod(referenceDate, invoicing, timeZone)
  return showsMyTimesheets(timesheetPerson(user), periodDays(period.start, period.end, timeZone), timeZone)
}

/** The days of a period that count on the person's sheet (canonical `timesheetDaysForPerson`). */
export function timesheetDayKeysForPeriod(
  user: Pick<User, 'employmentType' | 'employmentTypeTransitionFrom' | 'employmentTypeEffectiveAt'> &
    Partial<Pick<User, 'isActive' | 'email' | 'firstName' | 'surname'>>,
  periodStart: Date,
  periodEnd: Date,
  timeZone: string = organizationZoneOr()
): string[] {
  return timesheetDaysForPerson(timesheetPerson(user), periodDays(periodStart, periodEnd, timeZone), timeZone)
}

/** Pay runs whose calendar window overlaps a weekly-report range. iOS payPeriodsOverlapping. */
export function payPeriodsOverlapping(
  rangeStart: Date,
  rangeEnd: Date,
  invoicing: OrgInvoicingSettings,
  timeZone: string = organizationZoneOr()
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

/** A row on User Timesheets for this period (canonical `showsMyTimesheets`; PAYE for the whole period: no row). */
export function shouldAppearInOperativeTimesheetRoster(
  user: User,
  periodStart: Date,
  periodEnd: Date,
  _invoicing: OrgInvoicingSettings,
  _referenceDate: Date = new Date(),
  timeZone: string = organizationZoneOr()
): boolean {
  return showsMyTimesheets(timesheetPerson(user), periodDays(periodStart, periodEnd, timeZone), timeZone)
}
