/**
 * The rows of Home's "Who's on today" (admins; owner decisions 3 and 4, 5 Nov 2026): Daily Overview's own model for
 * today, laid out as one table. Display mapping only — every name, job, time and hours label is what Daily Overview
 * shows for the same day (`buildDailyOverview` → `projectCards[].people`, office / WFH / custom / site survey
 * bookings, `unbookedNames`, approved leave with `leaveHalfDayLabel`).
 */

import { leaveHalfDayLabel } from '@/lib/canonical'
import type { DailyOverviewModel } from '@/lib/daily-overview/buildDailyOverview'
import { overviewHolidayName, overviewPersonName } from '@/lib/daily-overview/dailyOverviewToday'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { Operative, User } from '@/types'

export type WhosOnTone = 'blue' | 'teal' | 'red' | 'amber' | 'grey'
export type WhosOnKind = 'booked' | 'subcontractor' | 'other' | 'unbooked' | 'leave'

export type WhosOnRow = {
  key: string
  name: string
  booking: string
  kind: WhosOnKind
  typeLabel: string
  tone: WhosOnTone
  hours: string
  time: string
}

export const WHOS_ON_KIND_LABELS: Record<WhosOnKind, string> = {
  booked: 'Booked',
  subcontractor: 'Subcontractor',
  other: 'Office and other',
  unbooked: 'Unbooked',
  leave: 'Annual leave',
}

export function whosOnRows(input: {
  model: DailyOverviewModel
  /** Unbooked names are listed only once Daily Overview may publish them (`dailyOverviewMayPublish`). */
  unbookedReady: boolean
  users: User[]
  operatives: Operative[]
  userIdAliases?: Record<string, string>
  payrollPolicy: OrgPayrollTimePolicy
}): WhosOnRow[] {
  const { model, users, operatives, userIdAliases } = input
  const rows: WhosOnRow[] = []
  for (const card of model.projectCards) {
    const job = [card.project.jobNumber, card.project.siteName].filter(Boolean).join(' · ')
    for (const person of card.people) {
      const subcontractor = person.kind === 'subcontractor'
      rows.push({
        key: `job-${card.project.id}-${person.personKey}-${person.id}`,
        name: person.name,
        booking: job,
        kind: subcontractor ? 'subcontractor' : 'booked',
        typeLabel: subcontractor ? 'Subcontractor' : 'Booked',
        tone: subcontractor ? 'teal' : 'blue',
        hours: person.pillText,
        time: person.subtitle,
      })
    }
  }
  const other = (title: string, bookings: ManagerSiteBooking[]) => {
    for (const booking of bookings) {
      const name = overviewPersonName(booking.userId, users, userIdAliases)
      if (!name) continue
      rows.push({
        key: `other-${booking.id}`,
        name,
        booking: title,
        kind: 'other',
        typeLabel: title,
        tone: 'grey',
        hours: '—',
        time: booking.timeSlot,
      })
    }
  }
  other('Office', model.officeBookings)
  other('Working from home', model.wfhBookings)
  for (const group of model.customGroups) other(group.name, group.bookings)
  other('Site survey', model.siteSurveyBookings)
  if (input.unbookedReady) {
    for (const name of model.unbookedNames) {
      rows.push({
        key: `unbooked-${name}`,
        name,
        booking: 'Nothing booked',
        kind: 'unbooked',
        typeLabel: 'Unbooked',
        tone: 'red',
        hours: '—',
        time: '—',
      })
    }
  }
  for (const holiday of model.holidays) {
    rows.push({
      key: `leave-${holiday.id}`,
      name: overviewHolidayName(holiday, users, operatives, userIdAliases),
      // Rulebook 1.20.0 §9: a leave half is the exact middle of the day (`leaveHalfDayWindows`).
      booking: `Annual leave · ${leaveHalfDayLabel(holiday.timeSlot, input.payrollPolicy)}`,
      kind: 'leave',
      typeLabel: 'Leave',
      tone: 'amber',
      hours: '—',
      time: '—',
    })
  }
  return rows
}
