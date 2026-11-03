'use client'

import { webJobAccessViewer } from '@/lib/access/readPlan'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { canViewWarnings, hasAdminAccess } from '@/lib/permissions'
import { BookingStatus } from '@/types'
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
  approveBookingClash,
  approveBookingClashPairs,
  loadAcceptedBookingClashes,
  watchAcceptedBookingClashes,
  type AcceptedBookingClash,
} from '@/lib/warnings/acceptedClashStorage'
import {
  dismissQualificationWarning,
  loadDismissedWarnings,
  watchDismissedWarnings,
  type DismissedWarning,
} from '@/lib/warnings/dismissedWarningStorage'
import {
  DEFAULT_WARNING_DETECTION,
  loadOrganizationDetails,
  type OrganizationDetails,
} from '@/lib/settings/organizationSettings'
import { organizationTimeZone } from '@/lib/canonical'
import { activePaymentRunSummary } from '@/lib/canonical'
import { useOrganizationDocument } from '@/lib/stores/organizationDocumentStore'
import { useOrganizationDayKey } from '@/lib/warnings/useOrganizationDayKey'
import { warningLookaheadFallbackNotice } from '@/lib/warnings/warningLookahead'
import {
  NO_WARNING_DECISION_FAILURES,
  WARNING_DECISIONS_FAILED_MESSAGE,
  warningDecisionsFailed,
  type WarningDecisionFailures,
} from '@/lib/warnings/warningDecisionsLoad'
import { activeOrgWarnings, generateOrgWarnings } from '@/lib/warnings/generateOrgWarnings'
import { loadResolvedWarningKeys, watchResolvedWarningKeys } from '@/lib/warnings/warningResolutionStorage'
import {
  partitionRowsByOrganization,
  publishReadyWarningLanes,
  warningDetectionForScan,
  warningScanInvoicingReady,
  warningScanLanes,
  warningScanUsers,
} from '@/lib/warnings/warningsScan'
import type { OrgWarningsResult } from '@/lib/warnings/generateOrgWarnings'
import { WarningsScreen } from '@/components/warnings/WarningsScreen'
import { useWarningsSortDirection } from '@/lib/warnings/useWarningsSortDirection'
import { ORG_DATA_REFRESHED_EVENT } from '@/lib/stores/refreshOrgData'

export default function WarningsPage() {
  const router = useRouter()
  const { user, organization, loading } = useAuthStore()
  const { sortDirection, setSortDirection } = useWarningsSortDirection(user?.id || '')

  useEffect(() => {
    if (user && !canViewWarnings(user)) router.replace('/dashboard')
  }, [user, router])
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, userIdAliases, loadUsers, rosterLoadedOrgId } = useOrgUserStore()
  const { bookings, loadBookings, deleteBooking, updateBooking, loading: bookingsLoading, ready: bookingsReady } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings, deleteManagerSiteBooking, loading: managerLoading } =
    useManagerScheduleStore()
  const { materials, sendRecords, loadAllMaterials, loadSendRecords } =
    useMaterialProjectStore()
  const { bookings: holidayBookings, loadBookings: loadHolidayBookings } = useHolidayStore()
  const [acceptedClashes, setAcceptedClashes] = useState<AcceptedBookingClash[]>([])
  const [dismissedWarnings, setDismissedWarnings] = useState<DismissedWarning[]>([])
  const [resolvedKeys, setResolvedKeys] = useState<string[]>([])
  // Approvals and removals from any device: the list waits for them so the total never shows rows they hide.
  const [decisionsOrgId, setDecisionsOrgId] = useState<string | null>(null)
  // Which approval sources failed to load. While any has, approved and dismissed warnings are never shown as open.
  const [decisionFailures, setDecisionFailures] = useState<WarningDecisionFailures>(NO_WARNING_DECISION_FAILURES)
  const [decisionsAttempt, setDecisionsAttempt] = useState(0)
  const markDecision = useCallback((source: keyof WarningDecisionFailures, failed: boolean) => {
    setDecisionFailures((current) => (current[source] === failed ? current : { ...current, [source]: failed }))
  }, [])
  const [orgDetails, setOrgDetails] = useState<OrganizationDetails | null>(null)
  const [detectionSettled, setDetectionSettled] = useState(false)
  const [liveOrgReadSettled, setLiveOrgReadSettled] = useState(false)
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
  const lastPublished = useRef<{ orgId: string; result: OrgWarningsResult } | null>(null)
  // Live `organizations/{orgId}`: a save on iOS or in Settings re-reads the details. Firebase always wins.
  const { data: liveOrgData, loaded: liveOrgLoaded } = useOrganizationDocument()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (organization?.id) {
      const orgId = organization.id
      let cancelled = false
      lastPublished.current = null
      setDetectionSettled(false)
      setLiveOrgReadSettled(false)
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
      void Promise.all([loadProjects(orgId), loadSmallWorks(orgId)]).finally(() => {
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
      let settled = false
      const settle = () => {
        if (cancelled || settled) return
        settled = true
        setDetectionSettled(true)
      }
      const applyDetails = (details: OrganizationDetails | null) => {
        if (cancelled || !details || details.id !== orgId) return
        setOrgDetails(details)
      }
      const timer = window.setTimeout(settle, 2500)
      void loadOrganizationDetails(orgId)
        .then((details) => {
          applyDetails(details)
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
          if (!cancelled) setLiveOrgReadSettled(true)
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

  // Approvals and removals (accepted clashes, dismissed warnings, resolutions). Retry re-runs only this load.
  useEffect(() => {
    const orgId = organization?.id
    if (!orgId) return
    let cancelled = false
    setDecisionsOrgId(null)
    setDecisionFailures(NO_WARNING_DECISION_FAILURES)
    void Promise.all([
      loadAcceptedBookingClashes(orgId)
        .then((rows) => {
          setAcceptedClashes(rows)
          markDecision('accepted', false)
        })
        .catch(() => markDecision('accepted', true)),
      loadDismissedWarnings(orgId)
        .then((rows) => {
          setDismissedWarnings(rows)
          markDecision('dismissed', false)
        })
        .catch(() => markDecision('dismissed', true)),
      loadResolvedWarningKeys(orgId)
        .then((keys) => {
          setResolvedKeys(keys)
          markDecision('resolved', false)
        })
        .catch(() => markDecision('resolved', true)),
    ]).finally(() => {
      if (!cancelled) setDecisionsOrgId(orgId)
    })
    return () => {
      cancelled = true
    }
  }, [organization?.id, decisionsAttempt, markDecision])

  // Rulebook 1.8.0 §5: an approval or removal on any device updates this page live.
  useEffect(() => {
    const orgId = organization?.id
    if (!orgId) return
    return watchResolvedWarningKeys(
      orgId,
      (keys) => {
        setResolvedKeys(keys)
        markDecision('resolved', false)
      },
      () => markDecision('resolved', true)
    )
  }, [organization?.id, decisionsAttempt, markDecision])

  // Rulebook 1.9.0 §1 (`LIVE_COLLECTIONS`): accepted clashes and dismissed warnings are live too, so an approval or a
  // dismissal on iOS clears the row here without reopening the page.
  useEffect(() => {
    const orgId = organization?.id
    if (!orgId) return
    const stopAccepted = watchAcceptedBookingClashes(
      orgId,
      (rows) => {
        setAcceptedClashes(rows)
        markDecision('accepted', false)
      },
      () => markDecision('accepted', true)
    )
    const stopDismissed = watchDismissedWarnings(
      orgId,
      (rows) => {
        setDismissedWarnings(rows)
        markDecision('dismissed', false)
      },
      () => markDecision('dismissed', true)
    )
    return () => {
      stopAccepted()
      stopDismissed()
    }
  }, [organization?.id, decisionsAttempt, markDecision])

  // Global Refresh: stores reload themselves; this page also re-reads what it keeps locally.
  useEffect(() => {
    const orgId = organization?.id
    if (!orgId) return
    const onRefreshed = () => {
      loadAcceptedBookingClashes(orgId).then(setAcceptedClashes).catch(() => {})
      loadDismissedWarnings(orgId).then(setDismissedWarnings).catch(() => {})
      loadResolvedWarningKeys(orgId).then(setResolvedKeys).catch(() => {})
      void loadOrganizationDetails(orgId, { fromServer: true, allowCacheFallback: true })
        .then((details) => {
          if (!details || details.id !== orgId) return
          setOrgDetails(details)
        })
        .catch(() => {})
    }
    window.addEventListener(ORG_DATA_REFRESHED_EVENT, onRefreshed)
    return () => window.removeEventListener(ORG_DATA_REFRESHED_EVENT, onRefreshed)
  }, [organization?.id])

  // Each snapshot of the organisation document (any device) re-reads the parsed details from it.
  useEffect(() => {
    const orgId = organization?.id
    if (!orgId || !liveOrgLoaded || !liveOrgData) return
    let cancelled = false
    void loadOrganizationDetails(orgId)
      .then((details) => {
        if (!cancelled && details && details.id === orgId) setOrgDetails(details)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [organization?.id, liveOrgLoaded, liveOrgData])

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
  const warningDetection = warningDetectionForScan(detailsForScan?.warningDetection, null, detectionSettled)
  // "Now" moves on at the organisation's midnight and when the tab is focused again, so a tab left open
  // overnight scans today's window, not yesterday's.
  const timeZone = organizationTimeZone(detailsForScan?.countryCode)
  const todayKey = useOrganizationDayKey(timeZone)
  const referenceDate = useMemo(() => new Date(), [todayKey]) // eslint-disable-line react-hooks/exhaustive-deps -- new instant per organisation day
  const invoicingReady =
    warningScanInvoicingReady(warningDetection, detailsForScan?.invoicing) &&
    (warningDetection?.clashLookaheadMode !== 'endOfInvoicingPeriod' || liveOrgReadSettled)
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
  const detectionReady = Boolean(warningDetection) && invoicingReady
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

  const scheduleReady = lanes.clashes && lanes.unbooked && lanes.qualifications && lanes.unverified
  // Nothing computed before the schedule lanes are ready is ever shown, so
  // skip the scan instead of re-running it as each source arrives.
  const generated = useMemo(
    () =>
      !scheduleReady
        ? null
        : generateOrgWarnings({
        // Rulebook 1.10.0 §17: restricted managers see only their jobs and people (`warningScopeFor`).
        viewer: webJobAccessViewer(useAuthStore.getState().user),
        bookings: bookingScope.foreign ? [] : bookingScope.rows,
        managerSiteBookings: managerScope.foreign ? [] : managerScope.rows,
        operatives: operativeScope.foreign ? [] : operativeScope.rows,
        users: userScope.foreign ? [] : userScope.rows,
        userIdAliases: userScope.foreign ? {} : userIdAliases,
        projects: projectScope.foreign ? [] : projectScope.rows,
        holidays: holidayBookings,
        materials,
        sendRecords,
        orgDetails: detailsForScan,
        warningDetection: warningDetection ?? DEFAULT_WARNING_DETECTION,
        referenceDate,
      }),
    [
      scheduleReady,
      referenceDate,
      warningDetection,
      bookingScope,
      managerScope,
      operativeScope,
      userScope,
      userIdAliases,
      projectScope,
      holidayBookings,
      materials,
      sendRecords,
      detailsForScan,
    ]
  )

  const visible = useMemo(() => {
    const previous = lastPublished.current && lastPublished.current.orgId === orgId ? lastPublished.current.result : null
    if (!scheduleReady || !generated) return previous
    const kept = publishReadyWarningLanes({
      previous,
      computed: generated,
      lanes,
      sameOrganization: !previous || lastPublished.current?.orgId === orgId,
    })
    if (orgId) lastPublished.current = { orgId, result: kept }
    return kept
  }, [generated, lanes, orgId, scheduleReady])

  const decisionsReady = Boolean(orgId) && decisionsOrgId === orgId
  const decisionsFailed = warningDecisionsFailed(decisionFailures)
  const dismissedKeys = useMemo(
    () => new Set(dismissedWarnings.map((warning) => warning.dismissKey)),
    [dismissedWarnings]
  )
  const active = useMemo(
    () =>
      visible && decisionsReady && !decisionsFailed
        ? activeOrgWarnings(visible, { resolvedKeys, acceptedClashes, dismissedQualificationKeys: dismissedKeys })
        : null,
    [visible, decisionsReady, decisionsFailed, resolvedKeys, acceptedClashes, dismissedKeys]
  )

  const shown = active ?? {
    clashWarnings: [],
    managerClashWarnings: [],
    unbookedWarnings: [],
    leaveWarnings: [],
    materialWarnings: [],
    qualificationWarnings: [],
    unverifiedWarnings: [],
    coreCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
  }
  const scanning = !active || (!scheduleReady && shown.coreCount === 0)

  const handleDismissQualification = useCallback(
    async (warning: { dismissKey: string; operativeId: string; qualificationId: string; dayKey: string }) => {
      if (!organization?.id || !user?.id) return
      await dismissQualificationWarning({
        organizationId: organization.id,
        dismissKey: warning.dismissKey,
        operativeId: warning.operativeId,
        qualificationId: warning.qualificationId,
        expiryDayKey: warning.dayKey,
        dismissedByUserId: user.id,
      })
      setDismissedWarnings((current) => [
        ...current.filter((entry) => entry.dismissKey !== warning.dismissKey),
        { dismissKey: warning.dismissKey, kind: 'qualification_expired', dismissedAt: new Date(), dismissedByUserId: user.id },
      ])
    },
    [organization?.id, user?.id]
  )

  const handleAcceptClash = useCallback(
    async (clash: {
      bookingAId: string
      bookingBId: string
      resolutionKey?: string
      pairs?: Array<{ bookingAId: string; bookingBId: string }>
    }) => {
      if (!organization?.id || !user?.id) return
      // Both `acceptedBookingClashes` and `warningResolutions` (`clashApprovalWrites`), so iOS sees it too.
      if (clash.pairs && clash.pairs.length > 0) {
        // Operative cluster (`operativeClashGroups`): approve every overlapping pair.
        await approveBookingClashPairs(organization.id, clash.pairs, user.id)
      } else {
        await approveBookingClash(
          organization.id,
          { bookingAId: clash.bookingAId, bookingBId: clash.bookingBId, resolutionKey: clash.resolutionKey },
          user.id
        )
      }
      const [accepted, resolved] = await Promise.all([
        loadAcceptedBookingClashes(organization.id),
        loadResolvedWarningKeys(organization.id),
      ])
      setAcceptedClashes(accepted)
      setResolvedKeys(resolved)
    },
    [organization?.id, user?.id]
  )

  const handleDeleteBooking = useCallback(
    async (bookingId: string) => {
      if (!organization?.id) return
      // Deleting a labour booking is admin only (rulebook §2, §16); a manager cancels it instead.
      if (hasAdminAccess(user)) await deleteBooking(bookingId, organization.id)
      else await updateBooking(bookingId, { status: BookingStatus.CANCELLED })
    },
    [deleteBooking, updateBooking, organization?.id, user]
  )

  const handleDeleteManagerBooking = useCallback(
    async (bookingId: string) => {
      if (!organization?.id) return
      await deleteManagerSiteBooking(organization.id, bookingId)
    },
    [deleteManagerSiteBooking, organization?.id]
  )

  if (loading || !user || !canViewWarnings(user)) return null

  const invoicingNotConfigured =
    warningDetection?.clashLookaheadMode === 'endOfInvoicingPeriod' &&
    liveOrgLoaded &&
    activePaymentRunSummary(
      liveOrgData?.invoicing && typeof liveOrgData.invoicing === 'object' ? (liveOrgData.invoicing as Record<string, unknown>) : null,
      referenceDate,
      timeZone
    ).notConfigured
  const scanNotice =
    warningLookaheadFallbackNotice(generated?.coverageFallbackReason) ??
    (invoicingNotConfigured
      ? 'Warnings are set to the invoicing period, but no payment runs are set up, so the scan uses the 1st–15th and 16th–end of the month. Set up payment runs in Settings.'
      : null)

  return (
    <>
    {scanNotice ? (
      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800" role="status">
        {scanNotice}
      </div>
    ) : null}
    {decisionsFailed ? (
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
        <p className="grow">{WARNING_DECISIONS_FAILED_MESSAGE}</p>
        <button type="button" className="btn" onClick={() => setDecisionsAttempt((value) => value + 1)}>
          Retry
        </button>
      </div>
    ) : null}
    {decisionsFailed ? null : (
    <WarningsScreen
      organizationName={organization?.name || 'your organisation'}
      clashWarnings={shown.clashWarnings}
      managerClashWarnings={shown.managerClashWarnings}
      unbookedWarnings={shown.unbookedWarnings}
      leaveWarnings={shown.leaveWarnings}
      materialWarnings={shown.materialWarnings}
      qualificationWarnings={shown.qualificationWarnings}
      unverifiedWarnings={shown.unverifiedWarnings}
      loading={scanning}
      user={user}
      operatives={rosterOperatives}
      users={userScope.foreign ? [] : userScope.rows}
      smallWorkIds={smallWorkIds}
      onAcceptClash={handleAcceptClash}
      onDismissQualification={handleDismissQualification}
      onDeleteBooking={handleDeleteBooking}
      onDeleteManagerBooking={handleDeleteManagerBooking}
      sortDirection={sortDirection}
      onSortDirectionChange={setSortDirection}
    />
    )}
    </>
  )
}
