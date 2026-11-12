'use client'

/**
 * Web glue for the 1.39.0 My Schedule clash marker (`myScheduleClashMarkers`, rulebook §10). It listens to the
 * approvals for the open organisation (`warningResolutions` resolved and approved keys, `acceptedBookingClashes`;
 * every member may read both; §1 live rule — an approval or dismissal on another device changes the marker at once)
 * and hands the viewer's own bookings to the rulebook with the viewer's real warning scope (`orgWarningScope` →
 * `warningScopeFor`) and today's Warnings clash days (`clashScanDays`). Until both listeners have answered the
 * approvals are null, so nothing reads as approved and "Open Warnings" is not offered. No rule lives here.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  myScheduleClashMarkers,
  type AcceptedClashRecord,
  type JobAccessViewer,
  type MyScheduleClashMarker,
  type WarningDecisions,
} from '@/lib/canonical'
import { watchWarningResolutionKeys } from '@/lib/warnings/warningResolutionStorage'
import { watchAcceptedBookingClashes } from '@/lib/warnings/acceptedClashStorage'
import { bookingPeopleForRoster } from '@/lib/warnings/managerClashWarnings'
import { clashManagerIdsForUsers } from '@/lib/scheduling/bookingClashUtils'
import { bookingDayKey, livePayrollState } from '@/lib/scheduling/bookingSlotRules'
import { computeClashScanDayKeys } from '@/lib/warnings/warningLookahead'
import { orgWarningScope } from '@/lib/warnings/warningScopeRoster'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { OrgInvoicingSettings, OrgPayrollTimePolicy, OrgWarningDetectionSettings } from '@/lib/settings/organizationSettings'
import type { Booking, Operative, Project, User } from '@/types'

function clockText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** The approvals for the clash marker, live for the open organisation; null until both listeners have answered. */
export function useClashDecisions(organizationId: string | null | undefined): WarningDecisions | null {
  const [keys, setKeys] = useState<{ org: string; resolvedKeys: string[]; approvedKeys: string[] } | null>(null)
  const [accepted, setAccepted] = useState<{ org: string; rows: AcceptedClashRecord[] } | null>(null)
  useEffect(() => {
    setKeys(null)
    setAccepted(null)
    if (!organizationId) return
    const org = organizationId
    const stopKeys = watchWarningResolutionKeys(org, (next) => setKeys({ org, ...next }))
    const stopAccepted = watchAcceptedBookingClashes(org, (rows) => setAccepted({ org, rows: rows as AcceptedClashRecord[] }))
    return () => {
      stopKeys()
      stopAccepted()
    }
  }, [organizationId])
  return useMemo(() => {
    if (!organizationId || keys?.org !== organizationId || accepted?.org !== organizationId) return null
    return { resolvedKeys: keys.resolvedKeys, approvedKeys: keys.approvedKeys, acceptedClashes: accepted.rows }
  }, [organizationId, keys, accepted])
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
  /** The viewer as the warning scope reads them (`webJobAccessViewer`); null → no scope (nothing offered). */
  viewer: JobAccessViewer | null
  projects: ReadonlyArray<Project>
  managers?: ReadonlyArray<{ id: string; email?: string | null }> | null
  enforcedReads: boolean
  /** The organisation's warning settings and payment runs, for today's Warnings clash days. Null while loading. */
  warningDetection: OrgWarningDetectionSettings | null
  invoicing: OrgInvoicingSettings | null
  viewerIds: ReadonlyArray<string>
  viewerEmail?: string | null
  placeLabel: (jobId: string | null | undefined) => string
  managerPlaceLabel: (booking: ManagerSiteBooking) => string
}): Map<string, MyScheduleClashMarker> {
  const decisions = useClashDecisions(input.organizationId)
  const {
    labourBookings,
    managerBookings,
    users,
    operatives,
    userIdAliases,
    payrollPolicy,
    canOpenWarnings,
    viewer,
    projects,
    managers,
    enforcedReads,
    warningDetection,
    invoicing,
    viewerIds,
    viewerEmail,
    placeLabel,
    managerPlaceLabel,
  } = input
  const scope = useMemo(
    () =>
      viewer
        ? orgWarningScope({ viewer, projects, managers, users: users as User[], userIdAliases, operatives, enforcedReads })
        : null,
    [viewer, projects, managers, users, userIdAliases, operatives, enforcedReads]
  )
  return useMemo(() => {
    const zone = organizationZoneOr()
    const ownDayKeys = [...labourBookings.map((b) => bookingDayKey(b.date)), ...managerBookings.map((b) => bookingDayKey(b.date))]
    // Rulebook §5 (`clashScanDays`): the days Warnings checks clashes on today; a weekend day of the week counts when
    // it holds a booking — the viewer's own bookings are the ones a marker can be on.
    const scanDayKeys = warningDetection ? [...computeClashScanDayKeys(new Date(), warningDetection, invoicing ?? undefined, zone, ownDayKeys)] : null
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
      canOpenWarnings: canOpenWarnings && scope != null,
      // The viewer's real warning scope (`warningScopeFor`): "Open Warnings" only for a clash Warnings shows them.
      scope,
      scanDayKeys,
      viewerIds: [...viewerIds],
      viewerEmail: viewerEmail ?? null,
    })
    return new Map(markers.map((marker) => [marker.bookingId, marker]))
  }, [
    labourBookings,
    managerBookings,
    users,
    operatives,
    userIdAliases,
    payrollPolicy,
    decisions,
    canOpenWarnings,
    scope,
    warningDetection,
    invoicing,
    viewerIds,
    viewerEmail,
    placeLabel,
    managerPlaceLabel,
  ])
}
