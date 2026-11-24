'use client'

/**
 * The Daily Overview model for one day, from the stores the screen has loaded (owner decision 5, 5 Nov 2026).
 * Used by Daily Overview and by the admin team panels on Home, so both show the same people, hours and counts.
 * Loading stays with each screen: this hook reads stores and the live organisation document only, never Firestore.
 */

import { useMemo, useRef } from 'react'
import { webJobAccessViewer } from '@/lib/access/readPlan'
import { enforcedReadsFor } from '@/lib/access/securitySwitches'
import { useOrgBankHolidays } from '@/components/annual-leave/useOrgBankHolidays'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrganizationDocument } from '@/lib/stores/organizationDocumentStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { siteMapLeaveSummary, type SiteMapLeaveSummary } from '@/lib/canonical'
import { holidayBookingDayKeys } from '@/lib/annualLeave/holidayDayKeys'
import { dayKey as londonDayKey } from '@/lib/ios-parity/londonTime'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
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
}): {
  model: DailyOverviewModel | null
  settings: DailyOverviewSettings
  settingsLoaded: boolean
  /**
   * Rulebook 1.82.0 §21 (owner 24 Nov, item 1): the whole company's approved annual leave on `day`
   * (`siteMapLeaveSummary`), never the viewer's Daily Overview scope. The site map's "On annual leave".
   */
  companyLeave: SiteMapLeaveSummary | null
} {
  const organizationId = useAuthStore((state) => state.organization?.id)
  const { bookings } = useBookingStore()
  const { managerSiteBookings } = useManagerScheduleStore()
  const { operatives } = useOperativeStore()
  const { users, userIdAliases } = useOrgUserStore()
  const { projects, smallWorks } = useProjectStore()
  const { bookings: holidays } = useHolidayStore()
  const liveOrganization = useOrganizationDocument()
  const { day, today, timeZone, subcontractorBookings, subcontractors, enabled = true } = input
  // Rulebook 1.53.0 §6: the region's bank holidays, so a bank holiday inside a week of leave is not listed as leave.
  const bank = useOrgBankHolidays(day, day)
  const bankHolidayDayKeys = useMemo(() => bank.holidays.map((holiday) => holiday.date), [bank.holidays])

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
              bankHolidayDayKeys,
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
      bankHolidayDayKeys,
    ]
  )

  const companyLeave = useMemo(() => {
    if (!enabled) return null
    const zone = organizationZoneOr(timeZone)
    return siteMapLeaveSummary({
      dayKey: londonDayKey(day, zone),
      timeZone: zone,
      nonWorkingDayKeys: bankHolidayDayKeys,
      records: holidays.map((holiday) => ({
        id: holiday.id,
        userId: holiday.userId,
        operativeId: holiday.operativeId,
        status: holiday.status,
        timeSlot: holiday.timeSlot,
        ...holidayBookingDayKeys(holiday, zone),
      })),
      roster: users.map((user) => ({
        id: user.id,
        email: user.email,
        formerUserIds: user.formerUserIds,
        // The roster fold's same-email ids (`rosterPeople` → `userIdAliases`, alias → kept id).
        aliasIds: Object.entries(userIdAliases || {})
          .filter(([, kept]) => kept === user.id)
          .map(([alias]) => alias),
      })),
      operatives: operatives.map((row) => ({ id: row.id, email: row.email })),
    })
  }, [enabled, day, timeZone, bankHolidayDayKeys, holidays, users, userIdAliases, operatives])

  return { model, settings, settingsLoaded, companyLeave }
}
