'use client'

/**
 * Rulebook 1.16.0 §5: annual leave rows for a booking flow, from the live leave listener (`useHolidayStore`), the
 * roster and the organisation's standard day. The rule is `bookingLeaveConflicts` (via `leaveConflictsForBooking`).
 * `checkFor` also lists the person's other bookings that overlap the slot that day (orange double-booking rows,
 * `slotInterval` via `operativeClashInterval`), so every single-booking sheet shows clashes in the same list.
 */
import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { DEFAULT_PAYROLL_POLICY, loadOrganizationDetails, type OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { dateFromDayKey, dayKey } from '@/lib/ios-parity/londonTime'
import { leaveConflictsForBooking, type LeaveConflictPerson } from '@/lib/scheduling/leaveConflicts'
import {
  conflictRowKey,
  leaveConflictRows,
  type BookingConflictRow,
  type BookingSlotConflictCheck,
} from '@/components/scheduling/BookingConflictRows'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { bookingRequestClashIds, ORPHAN_BOOKING_LABEL, type PayrollTimePolicyState } from '@/lib/canonical'
import { samePersonBookingIds } from '@/lib/bookings/bookingPeople'
import { clockText } from '@/lib/warnings/clashIntervals'
import { managerSiteBookingDisplayTitle } from '@/lib/scheduling/managerSiteBookingUtils'

export type LeaveCheckPerson = LeaveConflictPerson & { name: string }

/**
 * Rulebook 1.23.1 §5: clashes and leave on a booked day are read under the working hours in effect on THAT day
 * (`bookingRequestClashIds`, `bookingLeaveConflicts` with the organisation's working-hours state), never today's.
 * `payrollOverride` (a screen's single loaded policy) is only the fallback until the state has loaded.
 */
export function useLeaveConflictCheck(payrollOverride?: OrgPayrollTimePolicy | PayrollTimePolicyState | null) {
  const organizationId = useAuthStore((state) => state.organization?.id)
  const holidays = useHolidayStore((state) => state.bookings)
  const loadHolidays = useHolidayStore((state) => state.loadBookings)
  const users = useOrgUserStore((state) => state.users)
  const bookings = useBookingStore((state) => state.bookings)
  const managerSiteBookings = useManagerScheduleStore((state) => state.managerSiteBookings)
  const operatives = useOperativeStore((state) => state.operatives)
  const projects = useProjectStore((state) => state.projects)
  const smallWorks = useProjectStore((state) => state.smallWorks)
  const [payroll, setPayroll] = useState<OrgPayrollTimePolicy | PayrollTimePolicyState | null>(null)

  useEffect(() => {
    if (!organizationId) return
    void loadHolidays(organizationId)
    loadOrganizationDetails(organizationId)
      .then((details) => {
        const next = details?.payrollTimePolicyState ?? details?.payrollTimePolicy
        if (next) setPayroll(next)
      })
      .catch(() => {})
  }, [organizationId, loadHolidays])

  const policy: OrgPayrollTimePolicy | PayrollTimePolicyState = payroll ?? payrollOverride ?? DEFAULT_PAYROLL_POLICY

  /** Leave rows for these people on these day keys, for one slot. */
  const rowsFor = useCallback(
    (
      people: ReadonlyArray<LeaveCheckPerson>,
      dayKeys: ReadonlyArray<string>,
      slot: { timeSlot: string; workStartTime?: string; workEndTime?: string }
    ): BookingConflictRow[] => {
      const timeZone = organizationZoneOr()
      const conflicts = leaveConflictsForBooking({
        people,
        dayKeys,
        holidays,
        users,
        payrollPolicy: policy,
        timeZone,
        timeSlot: slot.timeSlot,
        workStartTime: slot.workStartTime ?? null,
        workEndTime: slot.workEndTime ?? null,
      })
      const names = new Map(people.map((person) => [person.id, person.name]))
      return leaveConflictRows(
        conflicts,
        (id) => names.get(id) || 'This person',
        (key) => format(dateFromDayKey(key, timeZone), 'EEE d MMM yyyy')
      )
    },
    [holidays, users, policy]
  )

  /**
   * Orange double-booking rows: the person's other live bookings (operative bookings under any of their ids, and their
   * manager site bookings) that day whose clock interval overlaps the slot. `excludeBookingIds` leaves out the booking
   * being edited or moved. Touching times do not clash.
   */
  const clashRowsFor = useCallback(
    (
      person: LeaveCheckPerson,
      key: string,
      slot: { timeSlot: string; workStartTime?: string; workEndTime?: string },
      excludeBookingIds: ReadonlyArray<string> = []
    ): BookingConflictRow[] => {
      const timeZone = organizationZoneOr()
      const excluded = new Set(excludeBookingIds.map((id) => String(id || '').toLowerCase()).filter(Boolean))
      const operativeIds = new Set<string>()
      for (const id of person.operativeIds ?? []) {
        if (!id) continue
        operativeIds.add(id.toLowerCase())
        for (const alias of samePersonBookingIds(id, users, operatives)) operativeIds.add(alias)
      }
      const userIds = new Set([person.userId, person.operativeIds?.length ? null : person.id].filter(Boolean).map((id) => String(id).toLowerCase()))
      const titles = new Map(
        [...projects, ...smallWorks].map((work) => [work.id, `${work.jobNumber ?? ''} ${work.siteName ?? ''}`.trim() || work.id])
      )
      // The person's labour and manager schedule bookings (any of their ids), less the one being edited.
      const labour = bookings.filter(
        (booking) =>
          !excluded.has(String(booking.id).toLowerCase()) && operativeIds.has(String(booking.operativeId || '').toLowerCase())
      )
      const manager = managerSiteBookings.filter(
        (booking) => !excluded.has(String(booking.id).toLowerCase()) && userIds.has(String(booking.userId || '').toLowerCase())
      )
      const existing = [
        ...labour.map((booking) => ({
          id: `o:${booking.id}`,
          dayKey: dayKey(new Date(booking.date), timeZone),
          timeSlot: String(booking.timeSlot ?? ''),
          workStartTime: clockText(booking.workStartTime),
          workEndTime: clockText(booking.workEndTime),
          status: String(booking.status ?? ''),
        })),
        ...manager.map((booking) => ({
          id: `m:${booking.id}`,
          dayKey: dayKey(new Date(booking.date), timeZone),
          timeSlot: String(booking.timeSlot ?? ''),
          workStartTime: clockText(booking.workStartTime),
          workEndTime: clockText(booking.workEndTime),
        })),
      ]
      const clashing = new Set(
        bookingRequestClashIds({
          request: { dayKey: key, timeSlot: slot.timeSlot, workStartTime: slot.workStartTime ?? null, workEndTime: slot.workEndTime ?? null },
          existing,
          day: policy,
        })
      )
      const lines: string[] = []
      for (const booking of labour) {
        if (clashing.has(`o:${booking.id}`)) lines.push(`${booking.timeSlot} · ${titles.get(booking.projectId) ?? ORPHAN_BOOKING_LABEL}`)
      }
      for (const booking of manager) {
        if (clashing.has(`m:${booking.id}`)) lines.push(`${booking.timeSlot} · ${managerSiteBookingDisplayTitle(booking, titles)}`)
      }
      if (lines.length === 0) return []
      return [
        {
          key: conflictRowKey(person.id, key, 'double_booking'),
          personId: person.id,
          dayKey: key,
          kind: 'double_booking',
          personName: person.name,
          dayLabel: format(dateFromDayKey(key, timeZone), 'EEE d MMM yyyy'),
          detail: `Already booked · ${lines.join(', ')}`,
        },
      ]
    },
    [bookings, managerSiteBookings, operatives, projects, smallWorks, users, policy]
  )

  /**
   * A `BookingSlotConflictCheck` for one person on one day (single-booking sheets): the orange double-booking row
   * (`clashRowsFor`) and the purple annual-leave rows, in one list. `excludeBookingIds`: the booking being edited.
   */
  const checkFor = useCallback(
    (person: LeaveCheckPerson, date: Date, excludeBookingIds: ReadonlyArray<string> = []): BookingSlotConflictCheck =>
      (slot) => {
        const key = dayKey(date, organizationZoneOr())
        return [...clashRowsFor(person, key, slot, excludeBookingIds), ...rowsFor([person], [key], slot)]
      },
    [rowsFor, clashRowsFor]
  )

  return { rowsFor, clashRowsFor, checkFor }
}
