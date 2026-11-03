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
import { bookingOccupiesDay, ORPHAN_BOOKING_LABEL } from '@/lib/canonical'
import { normalizeBookingStatus } from '@/lib/ios-parity/enums'
import { samePersonBookingIds } from '@/lib/bookings/bookingPeople'
import { intervalsOverlap, operativeClashInterval } from '@/lib/warnings/clashIntervals'
import { managerSiteBookingDisplayTitle } from '@/lib/scheduling/managerSiteBookingUtils'

export type LeaveCheckPerson = LeaveConflictPerson & { name: string }

export function useLeaveConflictCheck(payrollOverride?: OrgPayrollTimePolicy | null) {
  const organizationId = useAuthStore((state) => state.organization?.id)
  const holidays = useHolidayStore((state) => state.bookings)
  const loadHolidays = useHolidayStore((state) => state.loadBookings)
  const users = useOrgUserStore((state) => state.users)
  const bookings = useBookingStore((state) => state.bookings)
  const managerSiteBookings = useManagerScheduleStore((state) => state.managerSiteBookings)
  const operatives = useOperativeStore((state) => state.operatives)
  const projects = useProjectStore((state) => state.projects)
  const smallWorks = useProjectStore((state) => state.smallWorks)
  const [payroll, setPayroll] = useState<OrgPayrollTimePolicy>(DEFAULT_PAYROLL_POLICY)

  useEffect(() => {
    if (!organizationId) return
    void loadHolidays(organizationId)
    if (payrollOverride) return
    loadOrganizationDetails(organizationId)
      .then((details) => {
        if (details?.payrollTimePolicy) setPayroll(details.payrollTimePolicy)
      })
      .catch(() => {})
  }, [organizationId, loadHolidays, payrollOverride])

  const policy = payrollOverride ?? payroll

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
      const probe = operativeClashInterval(
        { timeSlot: slot.timeSlot, workStartTime: slot.workStartTime, workEndTime: slot.workEndTime } as Parameters<
          typeof operativeClashInterval
        >[0],
        policy
      )
      if (!probe) return []
      const excluded = new Set(excludeBookingIds.map((id) => String(id || '').toLowerCase()).filter(Boolean))
      const operativeIds = new Set<string>()
      for (const id of person.operativeIds ?? []) {
        if (!id) continue
        operativeIds.add(id.toLowerCase())
        for (const alias of samePersonBookingIds(id, users, operatives)) operativeIds.add(alias)
      }
      const userIds = new Set([person.userId, person.operativeIds?.length ? null : person.id].filter(Boolean).map((id) => String(id).toLowerCase()))
      const overlaps = (row: { timeSlot?: unknown; workStartTime?: string; workEndTime?: string }) => {
        const iv = operativeClashInterval(row as Parameters<typeof operativeClashInterval>[0], policy)
        return iv ? intervalsOverlap(probe, iv) : false
      }
      const titles = new Map(
        [...projects, ...smallWorks].map((work) => [work.id, `${work.jobNumber ?? ''} ${work.siteName ?? ''}`.trim() || work.id])
      )
      const lines: string[] = []
      for (const booking of bookings) {
        if (excluded.has(String(booking.id).toLowerCase())) continue
        if (!operativeIds.has(String(booking.operativeId || '').toLowerCase())) continue
        if (dayKey(new Date(booking.date), timeZone) !== key) continue
        if (!bookingOccupiesDay(normalizeBookingStatus(booking.status) ?? booking.status)) continue
        if (!overlaps(booking)) continue
        lines.push(`${booking.timeSlot} · ${titles.get(booking.projectId) ?? ORPHAN_BOOKING_LABEL}`)
      }
      for (const booking of managerSiteBookings) {
        if (excluded.has(String(booking.id).toLowerCase())) continue
        if (!userIds.has(String(booking.userId || '').toLowerCase())) continue
        if (dayKey(new Date(booking.date), timeZone) !== key) continue
        if (!overlaps(booking)) continue
        lines.push(`${booking.timeSlot} · ${managerSiteBookingDisplayTitle(booking, titles)}`)
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
