'use client'

/**
 * The Daily Overview model for one day, from the stores the screen has loaded (owner decision 5, 5 Nov 2026).
 * Used by Daily Overview and by the admin team panels on Home, so both show the same people, hours and counts.
 * Loading stays with each screen: this hook reads stores and the live organisation document only, never Firestore.
 */

import { useMemo, useRef } from 'react'
import { webJobAccessViewer } from '@/lib/access/readPlan'
import { enforcedReadsFor } from '@/lib/access/securitySwitches'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrganizationDocument } from '@/lib/stores/organizationDocumentStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { buildDailyOverview, type DailyOverviewModel, type OverviewSubcontractorBooking } from './buildDailyOverview'
import {
  DEFAULT_DAILY_OVERVIEW_SETTINGS,
  dailyOverviewInput,
  dailyOverviewSettings,
  type DailyOverviewSettings,
} from './dailyOverviewToday'

export function useDailyOverviewModel(input: {
  day: Date
  today: Date
  timeZone: string
  subcontractorBookings: OverviewSubcontractorBooking[]
  subcontractors: { id: string; name: string; contacts?: { id: string; name: string }[] }[]
  /** False skips the build (a viewer who never sees the panel). */
  enabled?: boolean
}): { model: DailyOverviewModel | null; settings: DailyOverviewSettings; settingsLoaded: boolean } {
  const organizationId = useAuthStore((state) => state.organization?.id)
  const { bookings } = useBookingStore()
  const { managerSiteBookings } = useManagerScheduleStore()
  const { operatives } = useOperativeStore()
  const { users, userIdAliases } = useOrgUserStore()
  const { projects, smallWorks } = useProjectStore()
  const { bookings: holidays } = useHolidayStore()
  const liveOrganization = useOrganizationDocument()
  const { day, today, timeZone, subcontractorBookings, subcontractors, enabled = true } = input

  // Rulebook 1.10.0: settings come from the one live organisations/{orgId} listener, so a working-hours or
  // warning-settings save on another device re-draws the day without a reload. Until this organisation's document
  // arrives the last settings stay (the defaults on first paint), as Daily Overview always did.
  const lastSettings = useRef<DailyOverviewSettings>(DEFAULT_DAILY_OVERVIEW_SETTINGS)
  const settings = useMemo(() => {
    const next = dailyOverviewSettings({
      organizationId,
      liveOrganizationId: liveOrganization.organizationId,
      data: liveOrganization.data,
      day,
      timeZone,
    })
    if (next) lastSettings.current = next
    return lastSettings.current
  }, [organizationId, liveOrganization.organizationId, liveOrganization.data, day, timeZone])
  const settingsLoaded = Boolean(organizationId) && liveOrganization.organizationId === organizationId && liveOrganization.loaded

  const model = useMemo(
    () =>
      enabled
        ? buildDailyOverview(
            dailyOverviewInput({
              viewer: webJobAccessViewer(useAuthStore.getState().user),
              enforcedReads: enforcedReadsFor(),
              day,
              today,
              projects,
              smallWorks,
              bookings,
              managerSiteBookings,
              holidays,
              users,
              userIdAliases,
              operatives,
              subcontractorBookings,
              subcontractors,
              settings,
              timeZone,
            })
          )
        : null,
    [
      enabled,
      settings,
      day,
      today,
      projects,
      smallWorks,
      bookings,
      managerSiteBookings,
      holidays,
      users,
      userIdAliases,
      operatives,
      subcontractorBookings,
      subcontractors,
      timeZone,
    ]
  )

  return { model, settings, settingsLoaded }
}
