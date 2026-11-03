'use client'

/**
 * Rulebook 1.16.0 §5: annual leave rows for a booking flow, from the live leave listener (`useHolidayStore`), the
 * roster and the organisation's standard day. The rule is `bookingLeaveConflicts` (via `leaveConflictsForBooking`).
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
import { leaveConflictRows, type BookingConflictRow, type BookingSlotConflictCheck } from '@/components/scheduling/BookingConflictRows'

export type LeaveCheckPerson = LeaveConflictPerson & { name: string }

export function useLeaveConflictCheck(payrollOverride?: OrgPayrollTimePolicy | null) {
  const organizationId = useAuthStore((state) => state.organization?.id)
  const holidays = useHolidayStore((state) => state.bookings)
  const loadHolidays = useHolidayStore((state) => state.loadBookings)
  const users = useOrgUserStore((state) => state.users)
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

  /** A `BookingSlotConflictCheck` for one person on one day (single-booking sheets). */
  const checkFor = useCallback(
    (person: LeaveCheckPerson, date: Date): BookingSlotConflictCheck =>
      (slot) =>
        rowsFor([person], [dayKey(date, organizationZoneOr())], slot),
    [rowsFor]
  )

  return { rowsFor, checkFor }
}
