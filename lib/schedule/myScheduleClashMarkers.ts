'use client'

/**
 * Web glue for the 1.39.0 My Schedule clash marker (`myScheduleClashMarkers`, rulebook §10). It loads the approvals
 * once for the open organisation (`warningResolutions` approved keys and `acceptedBookingClashes`; every member may
 * read both) and hands the viewer's own bookings to the rulebook. Approvals that fail to load are passed as null, so
 * nothing reads as approved (never a wrong grey triangle). No rule lives here.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  myScheduleClashMarkers,
  type AcceptedClashRecord,
  type MyScheduleClashMarker,
  type WarningDecisions,
} from '@/lib/canonical'
import { loadWarningResolutionKeys } from '@/lib/warnings/warningResolutionStorage'
import { loadAcceptedBookingClashes } from '@/lib/warnings/acceptedClashStorage'
import { bookingPeopleForRoster } from '@/lib/warnings/managerClashWarnings'
import { clashManagerIdsForUsers } from '@/lib/scheduling/bookingClashUtils'
import { bookingDayKey, livePayrollState } from '@/lib/scheduling/bookingSlotRules'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import type { Booking, Operative, User } from '@/types'

function clockText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** The approvals for the clash marker, loaded on open; null while loading or when either read failed. */
export function useClashDecisions(organizationId: string | null | undefined): WarningDecisions | null {
  const [decisions, setDecisions] = useState<WarningDecisions | null>(null)
  useEffect(() => {
    let live = true
    setDecisions(null)
    if (!organizationId) return
    void Promise.all([loadWarningResolutionKeys(organizationId), loadAcceptedBookingClashes(organizationId)])
      .then(([keys, accepted]) => {
        if (live) setDecisions({ approvedKeys: keys.approvedKeys, acceptedClashes: accepted as AcceptedClashRecord[] })
      })
      .catch(() => {
        if (live) setDecisions(null)
      })
    return () => {
      live = false
    }
  }, [organizationId])
  return decisions
}

/** The markers by booking id for the viewer's own labour and manager site bookings. */
export function useMyScheduleClashMarkers(input: {
  organizationId: string | null | undefined
  labourBookings: ReadonlyArray<Booking>
  managerBookings: ReadonlyArray<ManagerSiteBooking>
  users: ReadonlyArray<User>
  operatives: ReadonlyArray<Operative>
  userIdAliases?: Readonly<Record<string, string>> | null
  payrollPolicy?: OrgPayrollTimePolicy | null
  /** `canViewWarnings(viewer)`: admins and managers; never operatives. */
  canOpenWarnings: boolean
  viewerIds: ReadonlyArray<string>
  viewerEmail?: string | null
  placeLabel: (jobId: string | null | undefined) => string
  managerPlaceLabel: (booking: ManagerSiteBooking) => string
}): Map<string, MyScheduleClashMarker> {
  const decisions = useClashDecisions(input.organizationId)
  const { labourBookings, managerBookings, users, operatives, userIdAliases, payrollPolicy, canOpenWarnings, viewerIds, viewerEmail, placeLabel, managerPlaceLabel } = input
  return useMemo(() => {
    const markers = myScheduleClashMarkers({
      operativeBookings: labourBookings.map((booking) => ({
        id: booking.id,
        operativeId: booking.operativeId,
        dayKey: bookingDayKey(booking.date),
        timeSlot: String(booking.timeSlot ?? ''),
        workStartTime: clockText(booking.workStartTime),
        workEndTime: clockText(booking.workEndTime),
        status: String(booking.status ?? ''),
        placeLabel: placeLabel(booking.projectId),
        projectId: booking.projectId ?? null,
      })),
      managerBookings: managerBookings.map((booking) => ({
        id: booking.id,
        userId: booking.userId,
        dayKey: bookingDayKey(booking.date),
        timeSlot: String(booking.timeSlot ?? ''),
        workStartTime: clockText(booking.workStartTime),
        workEndTime: clockText(booking.workEndTime),
        placeLabel: managerPlaceLabel(booking),
        jobId: booking.locationType === 'project' || booking.locationType === 'small_work' ? booking.locationId ?? null : null,
      })),
      people: bookingPeopleForRoster(users as User[], operatives as Operative[], userIdAliases),
      managerIds: clashManagerIdsForUsers(users as User[]),
      day: livePayrollState() ?? payrollPolicy ?? null,
      decisions,
      canOpenWarnings,
      // The bookings are the viewer's own, so the clash is about them: in their own warning scope (§5 (a)).
      scope: null,
      viewerIds: [...viewerIds],
      viewerEmail: viewerEmail ?? null,
    })
    return new Map(markers.map((marker) => [marker.bookingId, marker]))
  }, [labourBookings, managerBookings, users, operatives, userIdAliases, payrollPolicy, decisions, canOpenWarnings, viewerIds, viewerEmail, placeLabel, managerPlaceLabel])
}
