'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { canViewWarnings } from '@/lib/permissions'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useMaterialProjectStore } from '@/lib/stores/materialProjectStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { mergeProjectsAndSmallWorks } from '@/lib/projects/workStatus'
import { getActiveOperativesForScheduling } from '@/lib/operatives/operativeRosterUtils'
import {
  acceptBookingClash,
  isClashAccepted,
  loadAcceptedBookingClashes,
  type AcceptedBookingClash,
} from '@/lib/warnings/acceptedClashStorage'
import {
  DEFAULT_WARNING_DETECTION,
  loadOrganizationDetails,
  saveWarningDetection,
  type OrganizationDetails,
  warningDetectionLooksLikeFactoryDefault,
} from '@/lib/settings/organizationSettings'
import {
  readCachedWarningDetection,
  writeCachedWarningDetection,
} from '@/lib/settings/warningDetectionCache'
import { loadMaterialCutOffSettings, type NotificationPreferences } from '@/lib/settings/notificationPreferences'
import { generateOrgWarnings } from '@/lib/warnings/generateOrgWarnings'
import {
  countGeneratedWarnings,
  partitionRowsByOrganization,
  publishReadyWarningLanes,
  warningDetectionForScan,
  warningScanLanes,
  warningScanUsers,
} from '@/lib/warnings/warningsScan'
import type { OrgWarningsResult } from '@/lib/warnings/generateOrgWarnings'
import { WarningsScreen } from '@/components/warnings/WarningsScreen'

export default function WarningsPage() {
  const router = useRouter()
  const { user, organization, loading } = useAuthStore()

  useEffect(() => {
    if (user && !canViewWarnings(user)) router.replace('/dashboard')
  }, [user, router])
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, loadUsers, rosterLoadedOrgId } = useOrgUserStore()
  const { bookings, loadBookings, deleteBooking, loading: bookingsLoading, ready: bookingsReady } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings, deleteManagerSiteBooking, loading: managerLoading } =
    useManagerScheduleStore()
  const { materials, sendRecords, loadAllMaterials, loadSendRecords } =
    useMaterialProjectStore()
  const { bookings: holidayBookings, loadBookings: loadHolidayBookings } = useHolidayStore()
  const [acceptedClashes, setAcceptedClashes] = useState<AcceptedBookingClash[]>([])
  const [orgDetails, setOrgDetails] = useState<OrganizationDetails | null>(null)
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences | null>(null)
  const [detectionSettled, setDetectionSettled] = useState(false)
  const [rosterReady, setRosterReady] = useState(false)
  const [operativesReady, setOperativesReady] = useState(false)
  const [projectsReady, setProjectsReady] = useState(false)
  const [holidaysReady, setHolidaysReady] = useState(false)
  const [materialsReady, setMaterialsReady] = useState(false)
  const [sendRecordsReady, setSendRecordsReady] = useState(false)
  const [managerSettled, setManagerSettled] = useState(false)
  const [bookingsSettled, setBookingsSettled] = useState(false)
  const managerSawLoad = useRef(false)
  const bookingsSawLoad = useRef(false)
  const cachedDetection = organization?.id ? readCachedWarningDetection(organization.id) : null

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (organization?.id) {
      const orgId = organization.id
      let cancelled = false
      setDetectionSettled(false)
      setRosterReady(false)
      setOperativesReady(false)
      setProjectsReady(false)
      setHolidaysReady(false)
      setMaterialsReady(false)
      setSendRecordsReady(false)
      setManagerSettled(false)
      setBookingsSettled(false)
      void loadUsers(orgId).finally(() => {
        if (!cancelled) setRosterReady(true)
      })
      void loadOperatives(orgId).finally(() => {
        if (!cancelled) setOperativesReady(true)
      })
      void Promise.all([loadProjects(orgId, true), loadSmallWorks(orgId)]).finally(() => {
        if (!cancelled) setProjectsReady(true)
      })
      bookingsSawLoad.current = false
      loadBookings(orgId)
      const bookingState = useBookingStore.getState()
      bookingsSawLoad.current = bookingState.loading
      if (bookingState.ready || !bookingState.loading) setBookingsSettled(true)
      managerSawLoad.current = false
      loadManagerSiteBookings(orgId)
      const managerInFlight = useManagerScheduleStore.getState().loading
      managerSawLoad.current = managerInFlight
      if (!managerInFlight) setManagerSettled(true)
      void loadAllMaterials(orgId).finally(() => {
        if (!cancelled) setMaterialsReady(true)
      })
      void loadSendRecords(orgId).finally(() => {
        if (!cancelled) setSendRecordsReady(true)
      })
      void loadHolidayBookings(orgId).finally(() => {
        if (!cancelled) setHolidaysReady(true)
      })
      loadAcceptedBookingClashes(orgId).then(setAcceptedClashes).catch(() => setAcceptedClashes([]))
      const cached = readCachedWarningDetection(orgId)
      let settled = false
      const settle = () => {
        if (cancelled || settled) return
        settled = true
        setDetectionSettled(true)
      }
      const applyDetails = (details: OrganizationDetails | null) => {
        if (cancelled || !details || details.id !== orgId) return
        const loaded = details.warningDetection
        const latestCache = readCachedWarningDetection(orgId) ?? cached
        if (
          loaded &&
          latestCache &&
          warningDetectionLooksLikeFactoryDefault(loaded) &&
          !warningDetectionLooksLikeFactoryDefault(latestCache)
        ) {
          writeCachedWarningDetection(orgId, latestCache)
          setOrgDetails({ ...details, warningDetection: latestCache })
          void saveWarningDetection(orgId, latestCache).catch(() => {})
          return
        }
        if (loaded) writeCachedWarningDetection(orgId, loaded)
        setOrgDetails((current) => {
          if (
            current?.id === orgId &&
            current.warningDetection.clashLookaheadMode === 'endOfInvoicingPeriod' &&
            loaded.clashLookaheadMode !== 'endOfInvoicingPeriod' &&
            warningDetectionLooksLikeFactoryDefault(loaded)
          ) {
            return current
          }
          return details
        })
      }
      const timer = window.setTimeout(settle, 2500)
      void loadOrganizationDetails(orgId)
        .then((details) => {
          applyDetails(details)
          settle()
        })
        .catch(() => {
          /* The server read can still fill detection. */
        })
      void loadOrganizationDetails(orgId, { fromServer: true, allowCacheFallback: true })
        .then((details) => {
          applyDetails(details)
        })
        .catch(() => {
          /* A failed refresh must not clear warnings already computed. */
        })
        .finally(() => {
          window.clearTimeout(timer)
          settle()
        })
      return () => {
        cancelled = true
        window.clearTimeout(timer)
      }
    }
  }, [
    organization?.id,
    loadProjects,
    loadSmallWorks,
    loadOperatives,
    loadUsers,
    loadBookings,
    loadManagerSiteBookings,
    loadAllMaterials,
    loadSendRecords,
    loadHolidayBookings,
  ])

  useEffect(() => {
    if (!user?.id || !organization?.id) return
    loadMaterialCutOffSettings(organization.id, user.id)
      .then(setNotificationPreferences)
      .catch(() => setNotificationPreferences(null))
  }, [user?.id, organization?.id])

  useEffect(() => {
    const inFlight = useManagerScheduleStore.getState().loading
    if (inFlight) {
      managerSawLoad.current = true
      return
    }
    if (managerSawLoad.current) setManagerSettled(true)
  }, [managerLoading])

  useEffect(() => {
    const state = useBookingStore.getState()
    if (state.loading) {
      bookingsSawLoad.current = true
      return
    }
    if (state.ready || bookingsSawLoad.current) setBookingsSettled(true)
  }, [bookingsLoading, bookingsReady])

  const rosterOperatives = useMemo(() => getActiveOperativesForScheduling(operatives), [operatives])
  const smallWorkIds = useMemo(() => new Set(smallWorks.map((w) => w.id)), [smallWorks])

  const mergedWorks = useMemo(
    () => mergeProjectsAndSmallWorks(projects, smallWorks),
    [projects, smallWorks]
  )

  const orgId = organization?.id || ''
  const detailsForScan = orgDetails?.id === orgId ? orgDetails : null
  const warningDetection = warningDetectionForScan(
    detailsForScan?.warningDetection,
    orgId ? cachedDetection : null,
    detectionSettled
  )
  const bookingScope = useMemo(() => partitionRowsByOrganization(bookings, orgId), [bookings, orgId])
  const managerScope = useMemo(
    () => partitionRowsByOrganization(managerSiteBookings, orgId),
    [managerSiteBookings, orgId]
  )
  const userScope = useMemo(
    () => warningScanUsers(users, orgId, Boolean(orgId) && rosterLoadedOrgId === orgId),
    [users, orgId, rosterLoadedOrgId]
  )
  const operativeScope = useMemo(() => partitionRowsByOrganization(operatives, orgId), [operatives, orgId])
  const projectScope = useMemo(() => partitionRowsByOrganization(mergedWorks, orgId), [mergedWorks, orgId])
  const detectionReady = Boolean(warningDetection)
  const bookingsSourceReady =
    !bookingScope.foreign && !bookingsLoading && (bookingsReady || bookingsSettled)
  const managerSourceReady = !managerScope.foreign && !managerLoading && managerSettled
  const rosterSourceReady = !userScope.foreign && rosterReady
  const operativesSourceReady = !operativeScope.foreign && operativesReady
  const projectsSourceReady = !projectScope.foreign && projectsReady
  const lanes = useMemo(
    () =>
      warningScanLanes({
        detectionReady,
        bookingsReady: bookingsSourceReady,
        managerReady: managerSourceReady,
        rosterReady: rosterSourceReady,
        operativesReady: operativesSourceReady,
        projectsReady: projectsSourceReady,
        holidaysReady,
        materialsReady,
        sendRecordsReady,
      }),
    [
      detectionReady,
      bookingsSourceReady,
      managerSourceReady,
      rosterSourceReady,
      operativesSourceReady,
      projectsSourceReady,
      holidaysReady,
      materialsReady,
      sendRecordsReady,
    ]
  )

  const generated = useMemo(
    () =>
      generateOrgWarnings({
        bookings: bookingScope.foreign ? [] : bookingScope.rows,
        managerSiteBookings: managerScope.foreign ? [] : managerScope.rows,
        operatives: operativeScope.foreign ? [] : operativeScope.rows,
        users: userScope.foreign ? [] : userScope.rows,
        projects: projectScope.foreign ? [] : projectScope.rows,
        holidays: holidayBookings,
        materials,
        sendRecords,
        orgDetails: detailsForScan,
        warningDetection: warningDetection ?? DEFAULT_WARNING_DETECTION,
        notificationPreferences,
      }),
    [
      warningDetection,
      bookingScope,
      managerScope,
      operativeScope,
      userScope,
      projectScope,
      holidayBookings,
      materials,
      sendRecords,
      detailsForScan,
      notificationPreferences,
    ]
  )

  const lastPublished = useRef<{ orgId: string; result: OrgWarningsResult } | null>(null)
  const scheduleReady = lanes.clashes && lanes.unbooked && lanes.qualifications && lanes.unverified
  const visible = useMemo(() => {
    const previous = lastPublished.current && lastPublished.current.orgId === orgId ? lastPublished.current.result : null
    if (!scheduleReady) return previous
    const kept = publishReadyWarningLanes({
      previous,
      computed: generated,
      lanes,
      sameOrganization: !previous || lastPublished.current?.orgId === orgId,
    })
    if (orgId) lastPublished.current = { orgId, result: kept }
    return kept
  }, [generated, lanes, orgId, scheduleReady])

  const shown = visible ?? {
    clashWarnings: [],
    managerClashWarnings: [],
    unbookedWarnings: [],
    materialWarnings: [],
    qualificationWarnings: [],
    unverifiedWarnings: [],
    coreCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
  }
  const listedCount = countGeneratedWarnings(shown)
  const scanning = !scheduleReady && listedCount === 0

  const clashWarnings = useMemo(
    () => shown.clashWarnings.filter((w) => !isClashAccepted(w.bookingAId, w.bookingBId, acceptedClashes)),
    [shown.clashWarnings, acceptedClashes]
  )
  const managerClashWarnings = useMemo(
    () =>
      shown.managerClashWarnings.filter((w) => !isClashAccepted(w.bookingAId, w.bookingBId, acceptedClashes)),
    [shown.managerClashWarnings, acceptedClashes]
  )

  const handleAcceptClash = useCallback(
    async (clash: { bookingAId: string; bookingBId: string }) => {
      if (!organization?.id || !user?.id) return
      await acceptBookingClash(organization.id, clash.bookingAId, clash.bookingBId, user.id)
      const updated = await loadAcceptedBookingClashes(organization.id)
      setAcceptedClashes(updated)
    },
    [organization?.id, user?.id]
  )

  const handleDeleteBooking = useCallback(
    async (bookingId: string) => {
      if (!organization?.id) return
      await deleteBooking(bookingId, organization.id)
    },
    [deleteBooking, organization?.id]
  )

  const handleDeleteManagerBooking = useCallback(
    async (bookingId: string) => {
      if (!organization?.id) return
      await deleteManagerSiteBooking(organization.id, bookingId)
    },
    [deleteManagerSiteBooking, organization?.id]
  )

  if (loading || !user || !canViewWarnings(user)) return null

  return (
    <WarningsScreen
      organizationName={organization?.name || 'your organisation'}
      clashWarnings={clashWarnings}
      managerClashWarnings={managerClashWarnings}
      unbookedWarnings={shown.unbookedWarnings}
      materialWarnings={shown.materialWarnings}
      qualificationWarnings={shown.qualificationWarnings}
      unverifiedWarnings={shown.unverifiedWarnings}
      loading={scanning}
      user={user}
      operatives={rosterOperatives}
      smallWorkIds={smallWorkIds}
      onAcceptClash={handleAcceptClash}
      onDeleteBooking={handleDeleteBooking}
      onDeleteManagerBooking={handleDeleteManagerBooking}
    />
  )
}
