'use client'

/**
 * Rulebook 1.35.0 §12: the My Profile "Your figures" card. This hook only loads the stores and maps them to the
 * rulebook's plain inputs; every figure is `myProfileSummary` (no calculation here). iOS:
 * `Core/Rulebook+MyProfile.swift` (`CanonicalBusinessEngine.myProfileSummary`).
 */

import { useEffect, useMemo } from 'react'
import { myProfileSummary, parseAnnualLeaveDefaults, type MyProfileSummary } from '@/lib/canonical'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrganizationDocument, useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { useOrgUserStore, useRosterDocuments } from '@/lib/stores/siteAuditStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import { holidayBookingDayKeys } from '@/lib/annualLeave/holidayDayKeys'
import { useOrgBankHolidays } from '@/components/annual-leave/useOrgBankHolidays'
import { qualificationExpiryOperatives } from '@/lib/warnings/generateOrgWarnings'
import { useOrganizationDayKey } from '@/lib/warnings/useOrganizationDayKey'

/** Bank holidays are fetched for last year to next year, so any leave year containing today is covered. */
function bankHolidayFetchRange(dayKey: string): { start: Date; end: Date } {
  const year = Number(dayKey.slice(0, 4)) || 1970
  return { start: new Date(year - 1, 0, 1), end: new Date(year + 1, 11, 31) }
}

export function useMyProfileSummary(): MyProfileSummary | null {
  const { user, organization } = useAuthStore()
  const orgId = organization?.id || ''
  const timeZone = useOrganizationTimeZone()
  const dayKey = useOrganizationDayKey(timeZone)
  const orgDocument = useOrganizationDocument()
  const { bookings, loadBookings } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings } = useManagerScheduleStore()
  const { bookings: holidays, loadBookings: loadHolidays } = useHolidayStore()
  const { tasks, loadTasks } = useTaskStore()
  const { operatives, managers, loadOperatives, loadManagers } = useOperativeStore()
  const loadUsers = useOrgUserStore((state) => state.loadUsers)
  const roster = useRosterDocuments(orgId)
  const range = bankHolidayFetchRange(dayKey)
  const bank = useOrgBankHolidays(range.start, range.end)

  useEffect(() => {
    if (!orgId) return
    loadBookings(orgId)
    loadManagerSiteBookings(orgId)
    loadHolidays(orgId)
    loadTasks(orgId)
    loadOperatives(orgId)
    loadManagers(orgId)
    void Promise.resolve(loadUsers(orgId)).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- zustand loaders are stable
  }, [orgId])

  const bankDayKeys = bank.holidays.map((holiday) => holiday.date).join(',')

  return useMemo(() => {
    if (!user || !orgId) return null
    const orgData = (orgDocument.data ?? {}) as Record<string, unknown>
    return myProfileSummary({
      nowMs: Date.now(),
      timeZone,
      viewer: { id: user.id, email: user.email },
      user: {
        ...user,
        id: user.id,
        email: user.email,
        formerUserIds: user.formerUserIds ?? [],
        employmentStartDate: user.employmentStartDate ?? null,
      } as never,
      roster: roster.map((row) => ({
        id: row.id,
        email: row.email,
        firstName: row.firstName,
        surname: row.surname,
        isActive: row.isActive,
        passwordSet: row.passwordSet,
        formerUserIds: row.formerUserIds ?? [],
      })),
      operatives: qualificationExpiryOperatives(operatives),
      managers: managers.map((row) => ({ id: row.id, email: row.email ?? null })),
      leaveDefaults: parseAnnualLeaveDefaults(orgData),
      holidays: holidays.map((holiday) => ({
        ...holidayBookingDayKeys(holiday, timeZone),
        userId: holiday.userId ?? null,
        operativeId: holiday.operativeId ?? null,
        timeSlot: holiday.timeSlot,
        status: holiday.status,
      })),
      nonWorkingDayKeys: bankDayKeys ? bankDayKeys.split(',') : [],
      tasks: tasks.map((task) => ({
        status: task.status,
        dueDate: task.dueDate ?? null,
        assignedOperativeId: task.assignedOperativeId ?? null,
        assignedOperativeIds: task.assignedOperativeIds ?? [],
        assignedManagerId: task.assignedManagerId ?? null,
        assignedManagerIds: task.assignedManagerIds ?? [],
      })),
      bookings: bookings.map((booking) => ({
        operativeId: booking.operativeId,
        date: booking.date,
        status: String(booking.status ?? ''),
        timeSlot: booking.timeSlot,
        workStartTime: booking.workStartTime ?? null,
        workEndTime: booking.workEndTime ?? null,
        isBreakRemoved: booking.isBreakRemoved === true,
      })),
      managerSiteBookings: managerSiteBookings.map((booking) => ({
        userId: booking.userId,
        date: booking.date,
        timeSlot: booking.timeSlot,
        workStartTime: booking.workStartTime ?? null,
        workEndTime: booking.workEndTime ?? null,
        isBreakRemoved: booking.isBreakRemoved === true,
      })),
      policyState: orgData,
    })
    // `dayKey` moves the figures on at the organisation's midnight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, orgId, timeZone, dayKey, orgDocument.data, roster, operatives, managers, holidays, bankDayKeys, tasks, bookings, managerSiteBookings])
}
