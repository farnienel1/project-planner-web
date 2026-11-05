/**
 * iOS parity source: Views/HomeView.swift, HomeQuickActionRegistry.swift, HomeUpNextSupport.swift
 * Spec: docs/ios-parity/IOS_APP_BLUEPRINT.md §3.4, §6.18
 */

'use client'

import { webJobAccessViewer } from '@/lib/access/readPlan'
import { enforcedReadsFor } from '@/lib/access/securitySwitches'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { useOrganizationDayKey } from '@/lib/warnings/useOrganizationDayKey'
import { useRouter } from 'next/navigation'
import { ExclamationTriangleIcon, PlusIcon } from '@heroicons/react/24/solid'
import { QuickActionIcon } from '@/components/home/QuickActionIcon'
import { HomeHeader } from '@/components/home/dashboard/HomeHeader'
import { HomeStatStrip, type HomeStatTile } from '@/components/home/dashboard/HomeStatStrip'
import { LabourSummaryCard } from '@/components/home/dashboard/LabourSummaryCard'
import { UnbookedBanner } from '@/components/home/dashboard/UnbookedBanner'
import { WhosOnTodayCard } from '@/components/home/dashboard/WhosOnTodayCard'
import { whosOnRows } from '@/components/home/dashboard/whosOnRows'
import { TasksToDoCard } from '@/components/home/dashboard/TasksToDoCard'
import { WaitingForYouCard, type WaitingItem } from '@/components/home/dashboard/WaitingForYouCard'
import { QuickActionsCard } from '@/components/home/dashboard/QuickActionsCard'
import { UpNextCard } from '@/components/home/dashboard/UpNextCard'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useMaterialProjectStore } from '@/lib/stores/materialProjectStore'
import {
  canAccessOperativeAnnualLeaveDirectory,
  canBookWork,
  canManageOperativesOnly,
  canManageUsers,
  canViewDailyOverview,
  canViewWarnings,
  canViewWeeklyReports,
  hasAdminAccess,
  isAnnualLeaveFeatureEnabled,
  isOperativeMode,
} from '@/lib/permissions'
import { activeJobsCount } from '@/lib/canonical'
import { jobAccessViewer } from '@/lib/access/bookingAccess'
import { worksListContext } from '@/lib/access/workAccess'
import { useDeadlineAssignedProjectIds } from '@/lib/deadlines/useDeadlineAssignedProjectIds'
import {
  activeProjectSubtitle,
  readRememberedHomeCount,
  shownHomeCount,
  writeRememberedHomeCount,
  type HomeCountKind,
} from '@/lib/home/homeLoadDisplay'
import { formatHomeDateLine } from '@/lib/ios-parity/londonTime'
import {
  computeHomeOverviewMetrics,
  DEFAULT_ADMIN_OVERVIEW_METRICS,
  HOME_OVERVIEW_CATALOG_TITLES,
  HOME_OVERVIEW_METRIC_IDS,
  HOME_OVERVIEW_PILL_TITLES,
  loadSavedOverviewMetrics,
  metricValue,
  saveOverviewMetrics,
  type HomeOverviewMetricID,
} from '@/lib/home/overviewMetrics'
import { DEFAULT_PAYROLL_TIME_POLICY, upcomingDaySections } from '@/lib/home/upNext'
import { organizationTimeZone, payrollTimePolicyForDayFromState } from '@/lib/canonical'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import {
  allEligibleQuickActionIds,
  loadSavedQuickActionOrder,
  quickActionHintStorageKey,
  quickActionMeta,
  saveQuickActionOrder,
} from '@/lib/home/quickActions'
import { IosModal } from '@/components/ios/primitives'
import { activeOrgWarnings, generateOrgWarnings, type WarningDecisionInputs } from '@/lib/warnings/generateOrgWarnings'
import { watchAcceptedBookingClashes, type AcceptedBookingClash } from '@/lib/warnings/acceptedClashStorage'
import { watchDismissedWarnings, type DismissedWarning } from '@/lib/warnings/dismissedWarningStorage'
import { watchResolvedWarningKeys } from '@/lib/warnings/warningResolutionStorage'
import { ORG_DATA_REFRESHED_EVENT } from '@/lib/stores/refreshOrgData'
import { warningScanLanes } from '@/lib/warnings/warningsScan'
import { loadOrganizationDetails, type OrganizationDetails } from '@/lib/settings/organizationSettings'
import { mergeProjectsAndSmallWorks } from '@/lib/projects/workStatus'
import { shouldShowTeamOnboardingPrompt } from '@/lib/orgSetup/teamOnboarding'
import { useOrganizationDocument } from '@/lib/stores/organizationDocumentStore'
import { useSubcontractorStore } from '@/lib/stores/subcontractorStore'
import { organizationDetailsFromData } from '@/lib/settings/organizationSettings'
import { watchSubcontractorBookings } from '@/lib/weekly-report/loadSubcontractorBookings'
import type { SubcontractorBookingRow } from '@/lib/weekly-report/weeklyReportData'
import { useDailyOverviewModel } from '@/lib/daily-overview/useDailyOverviewModel'
import { dailyOverviewMayPublish, overviewFormatHours } from '@/lib/daily-overview/buildDailyOverview'
import { bookLabourList } from '@/lib/book-labour/bookLabourList'
import { dateFromDayKey } from '@/lib/ios-parity/londonTime'
import { filterTasksForView, getTaskDetailHref, resolveProjectName } from '@/lib/tasks/taskUtils'
import { teamLeaveBookings, teamLeaveDecisionQueue, teamLeavePeople } from '@/lib/annualLeave/teamLeaveQueue'
import { usersWithoutRequiredLineManager } from '@/lib/annualLeave/holidayApprovalUtils'
import { matchesRosterSegment } from '@/lib/staff/userRosterUtils'
import { countUsersForTab, type ManageUsersTab } from '@/lib/staff/manageUsersUtils'
import { payePaydayBanner } from '@/lib/canonical'

/** The stat-strip icon for a hero metric (the tile's look only; values and links are the hero's). */
function metricTileKind(id: HomeOverviewMetricID): HomeStatTile['kind'] {
  if (id === 'warnings') return 'warnings'
  if (id === 'tasksDueWeekPersonal') return 'tasksWeek'
  if (id === 'operativesOnSite' || id === 'managersOnSite') return 'people'
  if (id === 'operativesOnAL' || id === 'managersOnAL') return 'leave'
  return 'tasks'
}

function greetingName(firstName: string, email: string): string {
  const name = firstName.trim()
  if (name) return name
  return email.split('@')[0] || 'there'
}

export function HomeScreen() {
  const router = useRouter()
  const { user, organization } = useAuthStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks, projectsLoadedOrgId, smallWorksLoadedOrgId } =
    useProjectStore()
  const { operatives, managers, loadOperatives, loadManagers, operativesLoadedOrgId, error: operativesError } = useOperativeStore()
  const { users, userIdAliases, loadUsers, rosterLoadedOrgId, claimedEmails, error: usersError } = useOrgUserStore()
  const { bookings, loadBookings, loading: bookingsLoading, ready: bookingsReady, error: bookingsError } = useBookingStore()
  const {
    managerSiteBookings,
    loadManagerSiteBookings,
    loading: managerBookingsLoading,
    error: managerBookingsError,
  } = useManagerScheduleStore()
  const { tasks, loadTasks, tasksLoadedOrgId } = useTaskStore()
  const {
    bookings: holidays,
    loadBookings: loadHolidays,
    loadedOrgId: holidaysLoadedOrgId,
    loading: holidaysLoading,
    error: holidaysError,
  } = useHolidayStore()
  const { subcontractors, loadSubcontractors, loading: subcontractorsLoading } = useSubcontractorStore()
  const { materials, sendRecords, loadAllMaterials, loadSendRecords } = useMaterialProjectStore()
  const [customise, setCustomise] = useState(false)
  const [metricsOpen, setMetricsOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [hint, setHint] = useState(false)
  const [metricIds, setMetricIds] = useState<HomeOverviewMetricID[]>(DEFAULT_ADMIN_OVERVIEW_METRICS)
  const [actionIds, setActionIds] = useState<string[]>([])
  // Moves on at the organisation's midnight and on tab focus, so a tab left open overnight counts today.
  const homeTimeZone = useOrganizationTimeZone()
  const homeDayKey = useOrganizationDayKey(homeTimeZone)
  const deadlineAssignedProjectIds = useDeadlineAssignedProjectIds()
  const now = useMemo(() => new Date(), [homeDayKey]) // eslint-disable-line react-hooks/exhaustive-deps -- new instant per organisation day
  const [orgDetails, setOrgDetails] = useState<OrganizationDetails | null>(null)
  const [managerBookingsSettled, setManagerBookingsSettled] = useState(false)
  const [materialsSettled, setMaterialsSettled] = useState(false)
  const [sendRecordsSettled, setSendRecordsSettled] = useState(false)
  // Approvals and removals from any device, so the tile counts what the Warnings page lists.
  const [warningDecisions, setWarningDecisions] = useState<(WarningDecisionInputs & { orgId: string }) | null>(null)
  const managerSawLoad = useRef(false)

  const displayUser = user
  const pauseHomeLoads = shouldShowTeamOnboardingPrompt(
    organization?.teamOnboarding,
    Boolean(displayUser?.permissions.adminAccess || displayUser?.isSuperAdmin),
    organization?.id
  )

  const seeWarningsTile = canViewWarnings(displayUser)
  // Owner decisions 3 and 4 (5 Nov 2026): the team panels (ring, Who's on today, today's hours) are for admins only,
  // and only admins load subcontractor bookings on Home. Paused with the other Home loads during team onboarding.
  const teamPanels = hasAdminAccess(displayUser) && !isOperativeMode(displayUser) && !pauseHomeLoads
  const [subcontractorBookings, setSubcontractorBookings] = useState<SubcontractorBookingRow[]>([])
  const [subcontractorBookingsOrgId, setSubcontractorBookingsOrgId] = useState('')

  // First paint: the collections the tiles and quick actions read.
  useEffect(() => {
    const orgId = organization?.id
    if (!orgId || pauseHomeLoads) return
    let cancelled = false
    loadProjects(orgId)
    loadSmallWorks(orgId)
    loadOperatives(orgId)
    loadManagers(orgId)
    loadUsers(orgId)
    loadBookings(orgId)
    setManagerBookingsSettled(false)
    managerSawLoad.current = false
    loadManagerSiteBookings(orgId)
    const managerInFlight = useManagerScheduleStore.getState().loading
    managerSawLoad.current = managerInFlight
    if (!managerInFlight) setManagerBookingsSettled(true)
    loadTasks(orgId)
    loadOrganizationDetails(orgId).then(setOrgDetails).catch(() => setOrgDetails(null))
    const t = window.setTimeout(() => loadHolidays(orgId), 400)
    const onRefreshed = () => {
      loadOrganizationDetails(orgId, { fromServer: true, allowCacheFallback: true })
        .then((details) => {
          if (!cancelled && details) setOrgDetails(details)
        })
        .catch(() => {})
    }
    window.addEventListener(ORG_DATA_REFRESHED_EVENT, onRefreshed)
    return () => {
      cancelled = true
      window.clearTimeout(t)
      window.removeEventListener(ORG_DATA_REFRESHED_EVENT, onRefreshed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- zustand loaders are stable
  }, [organization?.id, pauseHomeLoads])

  // The warnings tile only: materials, send records and warning decisions. Someone who cannot
  // see warnings never downloads them; everyone else gets them after first paint.
  useEffect(() => {
    const orgId = organization?.id
    if (!orgId || pauseHomeLoads || !seeWarningsTile) return
    let cancelled = false
    setMaterialsSettled(false)
    setSendRecordsSettled(false)
    // Rulebook 1.9.0 §1 (`LIVE_COLLECTIONS`): the warning count listens to resolutions, accepted clashes and dismissed
    // warnings, so an approval or dismissal on any platform updates the tile without reopening Home.
    let resolvedKeys: string[] | null = null
    let acceptedClashes: AcceptedBookingClash[] | null = null
    let dismissed: DismissedWarning[] | null = null
    const publish = () => {
      if (cancelled || !resolvedKeys || !acceptedClashes || !dismissed) return
      setWarningDecisions({
        orgId,
        resolvedKeys,
        acceptedClashes,
        dismissedQualificationKeys: new Set(dismissed.map((warning) => warning.dismissKey)),
      })
    }
    const stops: Array<() => void> = []
    const deferred = window.setTimeout(() => {
      if (cancelled) return
      void loadAllMaterials(orgId).finally(() => {
        if (!cancelled) setMaterialsSettled(true)
      })
      void loadSendRecords(orgId).finally(() => {
        if (!cancelled) setSendRecordsSettled(true)
      })
      stops.push(
        watchResolvedWarningKeys(orgId, (keys) => {
          resolvedKeys = keys
          publish()
        }),
        watchAcceptedBookingClashes(orgId, (rows) => {
          acceptedClashes = rows
          publish()
        }),
        watchDismissedWarnings(orgId, (rows) => {
          dismissed = rows
          publish()
        })
      )
    }, 600)
    return () => {
      cancelled = true
      window.clearTimeout(deferred)
      for (const stop of stops) stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- zustand loaders are stable
  }, [organization?.id, pauseHomeLoads, seeWarningsTile])

  // Admins only (owner decision 4): the existing subcontractor listeners Daily Overview uses (rulebook 1.9.0 §1), so
  // "Who's on today" and today's hours include subcontractors exactly as Daily Overview does.
  useEffect(() => {
    const orgId = organization?.id
    if (!orgId || !teamPanels) return
    void loadSubcontractors(orgId)
    setSubcontractorBookings([])
    setSubcontractorBookingsOrgId('')
    const stop = watchSubcontractorBookings(
      orgId,
      (rows) => {
        setSubcontractorBookings(rows)
        setSubcontractorBookingsOrgId(orgId)
      },
      () => {
        setSubcontractorBookings([])
        setSubcontractorBookingsOrgId(orgId)
      }
    )
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps -- zustand loaders are stable
  }, [organization?.id, teamPanels])

  useEffect(() => {
    if (managerBookingsLoading) {
      managerSawLoad.current = true
      return
    }
    if (managerSawLoad.current) setManagerBookingsSettled(true)
  }, [managerBookingsLoading])

  useEffect(() => {
    if (!user) return
    setMetricIds(loadSavedOverviewMetrics(user.id))
    setActionIds(loadSavedQuickActionOrder(user.id, displayUser || user, users))
    try {
      setHint(!localStorage.getItem(quickActionHintStorageKey(user.id)))
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- displayUser is derived from user.id
  }, [user?.id, users])

  const merged = useMemo(() => mergeProjectsAndSmallWorks(projects, smallWorks), [projects, smallWorks])
  // Rulebook 1.21.0 §21 (`activeJobsCount`): the jobs the Projects and Small works lists show under Active for this
  // viewer (`visibleJobs`, hide lists applied; operatives: bookings, tasks and deadlines), on the organisation's day.
  const liveCount = activeJobsCount(
    merged,
    jobAccessViewer(displayUser),
    worksListContext({
      operatives,
      managers: managers ?? [],
      bookings,
      managerBookings: managerSiteBookings,
      tasks,
      deadlineAssignedProjectIds,
    }),
    homeDayKey,
    homeTimeZone
  )
  const operative = isOperativeMode(displayUser)
  const admin = hasAdminAccess(displayUser)
  const seeWarnings = canViewWarnings(displayUser)

  const metrics = useMemo(
    () =>
      computeHomeOverviewMetrics({
        tasks,
        userId: displayUser?.id,
        userEmail: displayUser?.email,
        operatives,
        managers: managers ?? [],
        bookings,
        managerBookings: managerSiteBookings,
        holidays,
        organizationUsers: users,
        liveProjectCount: liveCount,
        timeZone: homeTimeZone,
        now,
      }),
    [tasks, displayUser?.id, displayUser?.email, operatives, managers, bookings, managerSiteBookings, holidays, users, liveCount, homeTimeZone, now]
  )

  const orgId = organization?.id || ''
  const projectsReady = Boolean(orgId) && projectsLoadedOrgId === orgId && smallWorksLoadedOrgId === orgId
  const tasksReady = Boolean(orgId) && tasksLoadedOrgId === orgId
  const warningLanes = warningScanLanes({
    detectionReady: Boolean(orgId) && orgDetails?.id === orgId,
    bookingsReady: bookingsReady && !bookingsLoading,
    managerReady: managerBookingsSettled && !managerBookingsLoading,
    rosterReady: Boolean(orgId) && rosterLoadedOrgId === orgId,
    operativesReady: Boolean(orgId) && operativesLoadedOrgId === orgId,
    projectsReady,
    holidaysReady: Boolean(orgId) && holidaysLoadedOrgId === orgId,
    materialsReady: materialsSettled,
    sendRecordsReady: sendRecordsSettled,
  })
  const warningInputsReady = warningLanes.unbooked
  const materialWarningsReady = warningLanes.materials
  const countStorage = typeof sessionStorage === 'undefined' ? null : sessionStorage
  const remembered = (kind: HomeCountKind) => readRememberedHomeCount(countStorage, kind, orgId)

  const decisions = warningDecisions?.orgId === orgId ? warningDecisions : null
  const liveWarningCount = useMemo(() => {
    if (!seeWarnings || !warningInputsReady || !decisions) return null
    try {
      const generated = generateOrgWarnings({
        // Rulebook 1.10.0 §17: restricted managers see only their jobs and people (`warningScopeFor`).
        viewer: webJobAccessViewer(useAuthStore.getState().user),
        enforcedReads: enforcedReadsFor(),
        bookings,
        managerSiteBookings,
        operatives,
        users,
        userIdAliases,
        projects: merged,
        holidays,
        materials: materialWarningsReady ? materials : [],
        sendRecords: materialWarningsReady ? sendRecords : [],
        orgDetails,
        referenceDate: now,
      })
      return activeOrgWarnings(generated, decisions).coreCount
    } catch {
      return null
    }
  }, [
    seeWarnings,
    warningInputsReady,
    decisions,
    userIdAliases,
    materialWarningsReady,
    bookings,
    managerSiteBookings,
    operatives,
    users,
    merged,
    holidays,
    materials,
    sendRecords,
    orgDetails,
    now,
  ])

  const shownMetrics: HomeOverviewMetricID[] = operative
    ? ['tasksDueTodayPersonal', 'tasksDueWeekPersonal']
    : admin
      ? metricIds
      : ['tasksDueTodayPersonal', 'tasksDueWeekPersonal', 'outstandingTasksAllUsers']

  const pendingTasks = operative ? metrics.tasksOverdue + metrics.tasksDueToday : metrics.outstandingTasksAllUsers
  const warningCount = shownHomeCount(liveWarningCount, remembered('warnings'))
  const projectCount = shownHomeCount(projectsReady ? liveCount : null, remembered('projects'))
  const tasksToday = shownHomeCount(tasksReady ? metrics.tasksDueToday : null, remembered('tasksToday'))
  const tasksWeek = shownHomeCount(tasksReady ? metrics.tasksDueThisWeek : null, remembered('tasksWeek'))
  const tasksPending = shownHomeCount(tasksReady ? pendingTasks : null, remembered('tasksPending'))

  useEffect(() => {
    if (!orgId || liveWarningCount == null) return
    writeRememberedHomeCount(countStorage, 'warnings', orgId, liveWarningCount)
  }, [orgId, liveWarningCount, countStorage])

  useEffect(() => {
    if (!orgId || !projectsReady) return
    writeRememberedHomeCount(countStorage, 'projects', orgId, liveCount)
  }, [orgId, projectsReady, liveCount, countStorage])

  useEffect(() => {
    if (!orgId || !tasksReady) return
    writeRememberedHomeCount(countStorage, 'tasksToday', orgId, metrics.tasksDueToday)
    writeRememberedHomeCount(countStorage, 'tasksWeek', orgId, metrics.tasksDueThisWeek)
    writeRememberedHomeCount(countStorage, 'tasksPending', orgId, pendingTasks)
  }, [orgId, tasksReady, metrics.tasksDueToday, metrics.tasksDueThisWeek, pendingTasks, countStorage])

  const metricDisplay = (id: HomeOverviewMetricID) => {
    if (id === 'warnings') return warningCount == null ? '…' : warningCount
    if (id === 'tasksDueTodayPersonal') return tasksToday == null ? '…' : tasksToday
    if (id === 'tasksDueWeekPersonal') return tasksWeek == null ? '…' : tasksWeek
    if (id === 'outstandingTasksAllUsers') return tasksReady ? metrics.outstandingTasksAllUsers : '…'
    if (!bookingsReady || bookingsLoading) return '…'
    return metricValue(id, metrics, warningCount ?? 0)
  }
  const upNext = useMemo(
    () =>
      upcomingDaySections({
        now,
        authUserId: displayUser?.id,
        currentUserEmail: displayUser?.email,
        operatives,
        bookings,
        managerBookings: managerSiteBookings,
        allProjects: merged,
        organizationUsers: users,
        // Rulebook 1.19.0: each booking's start is read under the working hours in effect on its own day
        // (canonical `payrollTimePolicyForDayFromState` over the whole state), never today's rules for every day.
        payrollPolicyForDay: (day: Date) =>
          orgDetails?.id === orgId
            ? payrollTimePolicyForDayFromState(
                orgDetails.payrollTimePolicyState,
                dayKeyInZone(day, organizationTimeZone(orgDetails.countryCode))
              )
            : DEFAULT_PAYROLL_TIME_POLICY,
      }),
    [now, displayUser?.id, displayUser?.email, operatives, bookings, managerSiteBookings, merged, users, orgDetails, orgId]
  )

  const taskLimitProjects = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of tasks) counts.set(t.projectId, (counts.get(t.projectId) || 0) + 1)
    return merged.filter((p) => (counts.get(p.id) || 0) >= 500)
  }, [tasks, merged])


  // ---- Team panels (admins): Daily Overview's own model for today (owner decisions 3, 5, 7, 10). ----
  const todayStart = useMemo(() => dateFromDayKey(homeDayKey, homeTimeZone), [homeDayKey, homeTimeZone])
  const { model: todayModel, settings: todaySettings, settingsLoaded } = useDailyOverviewModel({
    day: todayStart,
    today: now,
    timeZone: homeTimeZone,
    subcontractorBookings,
    subcontractors,
    enabled: teamPanels,
  })
  const holidaysReady = Boolean(orgId) && holidaysLoadedOrgId === orgId && !holidaysLoading
  const rosterReady = Boolean(orgId) && rosterLoadedOrgId === orgId
  const operativesReady = Boolean(orgId) && operativesLoadedOrgId === orgId
  const bookingsSettled = bookingsReady && !bookingsLoading
  const managerSettled = managerBookingsSettled && !managerBookingsLoading
  // Like Daily Overview's first paint: nothing is shown until every source it reads has loaded for this organisation,
  // so the ring and table never flash a half-loaded day (subcontractors included for admins).
  const teamReady =
    teamPanels &&
    settingsLoaded &&
    bookingsSettled &&
    managerSettled &&
    holidaysReady &&
    rosterReady &&
    operativesReady &&
    projectsReady &&
    subcontractorBookingsOrgId === orgId &&
    !subcontractorsLoading
  const unbookedReady =
    teamReady &&
    dailyOverviewMayPublish({
      bookingsLoading,
      bookingCount: bookings.length,
      managerLoading: managerBookingsLoading,
      managerBookingCount: managerSiteBookings.length,
    })
  const shownToday = teamReady && todayModel ? todayModel : null
  const whosOn = useMemo(
    () =>
      shownToday
        ? whosOnRows({
            model: shownToday,
            unbookedReady,
            users,
            operatives,
            userIdAliases,
            payrollPolicy: todaySettings.payrollPolicy,
          })
        : null,
    [shownToday, unbookedReady, users, operatives, userIdAliases, todaySettings.payrollPolicy]
  )

  // ---- Unbooked banner (admins and managers): the Book labour list itself (owner decision 3). ----
  const liveOrganization = useOrganizationDocument()
  const liveDetails = useMemo(
    () =>
      orgId && liveOrganization.organizationId === orgId && liveOrganization.data
        ? organizationDetailsFromData(orgId, liveOrganization.data)
        : null,
    [orgId, liveOrganization.organizationId, liveOrganization.data]
  )
  const bannerViewer = canBookWork(displayUser) && !pauseHomeLoads
  const bookLabour = useMemo(
    () =>
      bannerViewer
        ? bookLabourList({
            organizationId: orgId,
            viewer: useAuthStore.getState().user,
            enforcedReads: enforcedReadsFor(),
            dayKey: homeDayKey,
            timeZone: homeTimeZone,
            users,
            rosterLoadedOrgId,
            usersError,
            userIdAliases,
            operatives,
            bookings,
            managerSiteBookings,
            holidays,
            projects,
            smallWorks,
            liveDetails,
            sources: {
              organization: {
                ready: Boolean(liveDetails) && liveOrganization.loaded,
                error: liveOrganization.organizationId === orgId ? liveOrganization.error : null,
              },
              operatives: { ready: operativesReady, error: operativesError },
              bookings: { ready: bookingsSettled, error: bookingsError },
              managerBookings: { ready: managerSettled, error: managerBookingsError },
              holidays: { ready: holidaysReady, error: holidaysError },
              jobs: { ready: projectsReady },
            },
          })
        : null,
    [
      bannerViewer,
      orgId,
      homeDayKey,
      homeTimeZone,
      users,
      rosterLoadedOrgId,
      usersError,
      userIdAliases,
      operatives,
      bookings,
      managerSiteBookings,
      holidays,
      projects,
      smallWorks,
      liveDetails,
      liveOrganization.loaded,
      liveOrganization.organizationId,
      liveOrganization.error,
      operativesReady,
      operativesError,
      bookingsSettled,
      bookingsError,
      managerSettled,
      managerBookingsError,
      holidaysReady,
      holidaysError,
      projectsReady,
    ]
  )
  const unbookedCount = bookLabour && bookLabour.phase === 'ready' ? bookLabour.candidates.length : 0

  // ---- Tasks: the Tasks page's "To do" list (owner decision 9). ----
  const taskRows = useMemo(() => {
    if (!tasksReady) return null
    const list = filterTasksForView(tasks, 'todo', displayUser, operatives, managers ?? [], !operative)
    return list.map((task) => {
      const projectName = resolveProjectName(task, projects, smallWorks)
      return {
        id: task.id,
        title: task.title,
        subtitle: `${projectName}${task.details ? ` · ${task.details}` : ''}`,
        status: task.status,
        href: getTaskDetailHref(task, projects, smallWorks),
      }
    })
  }, [tasksReady, tasks, displayUser, operatives, managers, operative, projects, smallWorks])

  // ---- Waiting for you (owner decision 12): only items whose data Home already has. ----
  const waitingItems = useMemo<WaitingItem[]>(() => {
    if (!displayUser || pauseHomeLoads) return []
    const items: WaitingItem[] = []
    const adminViewer = hasAdminAccess(displayUser) && !isOperativeMode(displayUser)
    if (
      !isOperativeMode(displayUser) &&
      isAnnualLeaveFeatureEnabled(displayUser) &&
      canAccessOperativeAnnualLeaveDirectory(displayUser) &&
      holidaysReady &&
      rosterReady &&
      operativesReady
    ) {
      const people = teamLeavePeople(displayUser, users, operatives)
      const queue = teamLeaveDecisionQueue(teamLeaveBookings(holidays, people), displayUser, users, operatives)
      if (queue.length > 0) {
        items.push({
          key: 'leave',
          label: queue.length === 1 ? 'Leave request to decide' : 'Leave requests to decide',
          detail: 'Annual leave → Team',
          count: queue.length,
          href: '/dashboard/annual-leave?tab=team',
        })
      }
    }
    if (adminViewer && rosterReady) {
      const missing = usersWithoutRequiredLineManager(users).filter((member) => matchesRosterSegment(member, 'active'))
      if (missing.length > 0) {
        items.push({
          key: 'line-manager',
          label: missing.length === 1 ? 'Person missing a line manager' : 'People missing a line manager',
          detail: 'Manage users',
          count: missing.length,
          href: '/dashboard/settings/users',
        })
      }
    }
    if (adminViewer) {
      const payday = payePaydayBanner({
        organization: liveOrganization.organizationId === orgId ? liveOrganization.data : null,
        loaded: liveOrganization.organizationId === orgId && liveOrganization.loaded && !liveOrganization.error,
        viewerIsAdmin: true,
      })
      if (payday) {
        items.push({ key: 'paye-payday', label: 'PAYE payday not set', detail: payday, count: null, href: '/dashboard/settings/payment-runs' })
      }
    }
    if ((canManageUsers(displayUser) || canManageOperativesOnly(displayUser)) && rosterReady) {
      // The tabs Manage Users shows this viewer (operatives managers: Operatives only), Pending segment.
      const tabs: ManageUsersTab[] = canManageUsers(displayUser) ? ['admins', 'managers', 'operatives'] : ['operatives']
      const pending = tabs.reduce((sum, tab) => sum + countUsersForTab(users, tab, 'pending', claimedEmails), 0)
      if (pending > 0) {
        items.push({
          key: 'invites',
          label: pending === 1 ? 'Pending invite' : 'Pending invites',
          detail: 'Not signed up yet · Manage users → Pending',
          count: pending,
          href: '/dashboard/settings/users',
        })
      }
    }
    return items
  }, [
    displayUser,
    pauseHomeLoads,
    holidaysReady,
    rosterReady,
    operativesReady,
    users,
    operatives,
    holidays,
    liveOrganization.organizationId,
    liveOrganization.data,
    liveOrganization.loaded,
    liveOrganization.error,
    orgId,
    claimedEmails,
  ])

  if (!displayUser || !user) return null

  const eligibleAdd = allEligibleQuickActionIds(displayUser, false, users).filter((id) => !actionIds.includes(id))

  const persistActions = (ids: string[]) => {
    setActionIds(ids)
    saveQuickActionOrder(user.id, ids)
  }

  const showBook = canBookWork(displayUser)
  const showDaily = canViewDailyOverview(displayUser)
  const showWeekly = canViewWeeklyReports(displayUser)

  // The stat strip is the old hero's tiles (same metrics, values and links per role), plus the old Warnings card when
  // the viewer sees warnings and it is not already one of their metrics.
  const metricRoute = (id: HomeOverviewMetricID) => {
    const title = HOME_OVERVIEW_PILL_TITLES[id]
    if (title.startsWith('Tasks') || title.startsWith('Open')) router.push('/dashboard/tasks')
    else if (title === 'Warnings') router.push('/dashboard/warnings')
    else if (title.includes('AL')) router.push('/dashboard/annual-leave')
    else router.push('/dashboard/daily-overview')
  }
  const statTiles: HomeStatTile[] = operative
    ? [
        { id: 'today', label: 'Tasks Due Today', value: tasksToday == null ? '…' : tasksToday, kind: 'tasks', onClick: () => router.push('/dashboard/tasks') },
        { id: 'week', label: 'Tasks Due This Week', value: tasksWeek == null ? '…' : tasksWeek, kind: 'tasksWeek', onClick: () => router.push('/dashboard/tasks') },
        { id: 'overdue', label: 'My Tasks Overdue', value: tasksReady ? metrics.tasksOverdue : '…', kind: 'tasks', onClick: () => router.push('/dashboard/tasks') },
      ]
    : shownMetrics.map((id) => ({
        id,
        label: HOME_OVERVIEW_PILL_TITLES[id],
        value: metricDisplay(id),
        kind: metricTileKind(id),
        onClick: () => metricRoute(id),
      }))
  if (seeWarnings && !(!operative && shownMetrics.includes('warnings'))) {
    statTiles.push({
      id: 'warnings-card',
      label: warningCount == null ? 'Warnings' : 'Active warnings',
      value: warningCount == null ? 'Scanning…' : warningCount === 0 ? 'All clear' : warningCount,
      kind: 'warnings',
      onClick: () => router.push('/dashboard/warnings'),
    })
  }

  const quickActions = actionIds
    .map((id) => quickActionMeta(id, organization?.settings))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .map((meta) => ({ id: meta.id, title: meta.title.replace(/\n/g, ' '), href: meta.href, icon: meta.icon }))

  const banner = bannerViewer ? <UnbookedBanner count={unbookedCount} standalone={!teamPanels} /> : null
  const hoursLabel = shownToday
    ? `Overtime ${shownToday.overtimeMultiplier}×${
        shownToday.overtimeBreakHours > 0 ? ` − ${overviewFormatHours(shownToday.overtimeBreakHours)}h break` : ''
      }`
    : 'Overtime'

  return (
    <div className="dash-home">
      <HomeHeader
        greeting={`Hi, ${greetingName(displayUser.firstName, displayUser.email)}`}
        dateLine={formatHomeDateLine(now)}
        subtitle={activeProjectSubtitle(projectCount)}
        onCustomise={admin ? () => setMetricsOpen(true) : undefined}
        onDailyOverview={showDaily ? () => router.push('/dashboard/daily-overview') : undefined}
        onWeeklyReport={showWeekly ? () => router.push('/dashboard/weekly-report') : undefined}
        onBookLabour={showBook ? () => router.push('/dashboard/book-labour') : undefined}
      />

      {admin && taskLimitProjects.length > 0 ? (
        <div className="dash-alert" role="alert">
          <ExclamationTriangleIcon aria-hidden />
          <div>
            <b>Task limit reached</b>
            {taskLimitProjects.slice(0, 3).map((p) => (
              <p key={p.id}>{p.jobNumber}: Delete first 50 completed tasks to clear some space</p>
            ))}
            {taskLimitProjects.length > 3 ? (
              <p>
                And {taskLimitProjects.length - 3} more project{taskLimitProjects.length - 3 === 1 ? '' : 's'}...
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {teamPanels ? (
        <div className="dash-row">
          <LabourSummaryCard
            activeProjects={projectCount == null ? '…' : String(projectCount)}
            hoursBooked={shownToday ? `${overviewFormatHours(shownToday.labourHours)}h` : '…'}
            overtimeHours={shownToday ? `${overviewFormatHours(shownToday.overtimeWorkedHours)}h` : '…'}
            overtimeLabel={hoursLabel}
            counts={
              shownToday && unbookedReady
                ? { booked: shownToday.bookedPeopleCount, unbooked: shownToday.unbookedCount, onLeave: shownToday.holidays.length }
                : null
            }
            banner={banner}
          />
          <div className="dash-col">
            <HomeStatStrip tiles={statTiles} />
            <WhosOnTodayCard rows={whosOn} />
          </div>
        </div>
      ) : (
        <div className="dash-col">
          <HomeStatStrip tiles={statTiles} />
          {banner}
        </div>
      )}

      <div className={waitingItems.length > 0 ? 'dash-row' : 'dash-row single'}>
        <TasksToDoCard pending={tasksPending == null ? '…' : String(tasksPending)} rows={taskRows} total={taskRows?.length ?? 0} />
        <WaitingForYouCard items={waitingItems} />
      </div>

      <div className="dash-row bottom">
        <QuickActionsCard
          actions={quickActions}
          customise={customise}
          showHint={hint}
          onToggleCustomise={() => setCustomise((v) => !v)}
          onDismissHint={() => {
            localStorage.setItem(quickActionHintStorageKey(user.id), '1')
            setHint(false)
          }}
          onRemove={(id) => persistActions(actionIds.filter((x) => x !== id))}
          onAdd={() => setAddOpen(true)}
        />
        <UpNextCard sections={upNext} showMaintenance={!operative} />
      </div>

      {metricsOpen ? (
        <IosModal title="Dashboard metrics" onDone={() => setMetricsOpen(false)}>
          <p className="mb-3 text-[13px] font-semibold">Shown on home (up to 3)</p>
          <div className="chips" style={{ marginBottom: 18 }}>
            {metricIds.map((id) => (
              <button
                key={id}
                type="button"
                className="chip on"
                data-hue="blue"
                onClick={() => {
                  if (metricIds.length <= 1) return
                  const next = metricIds.filter((x) => x !== id)
                  setMetricIds(next)
                  saveOverviewMetrics(user.id, next)
                }}
              >
                {HOME_OVERVIEW_PILL_TITLES[id]} ×
              </button>
            ))}
          </div>
          <p className="eyebrow" style={{ marginBottom: 8 }}>
            Add metrics
          </p>
          <p className="muted small mb-3">These are organisation metrics.</p>
          <div className="rows">
            {HOME_OVERVIEW_METRIC_IDS.filter((id) => !metricIds.includes(id)).map((id) => (
              <button
                key={id}
                type="button"
                disabled={metricIds.length >= 3}
                className="ritem"
                style={metricIds.length >= 3 ? { opacity: 0.5 } : undefined}
                onClick={() => {
                  const next = [...metricIds, id].slice(0, 3)
                  setMetricIds(next)
                  saveOverviewMetrics(user.id, next)
                }}
              >
                <span className="grow">
                  <span className="t">{HOME_OVERVIEW_CATALOG_TITLES[id]}</span>
                  <span className="s">Current: {metricDisplay(id)}</span>
                </span>
                <PlusIcon className="h-5 w-5 text-[var(--blue)]" />
              </button>
            ))}
          </div>
        </IosModal>
      ) : null}

      {addOpen ? (
        <IosModal title="Add quick action" onDone={() => setAddOpen(false)}>
          {eligibleAdd.length === 0 ? (
            <p className="muted small">
              No more actions. All available quick actions are already on your home screen.
            </p>
          ) : (
            <div className="rows">
              {eligibleAdd.map((id) => {
                const meta = quickActionMeta(id, organization?.settings)
                if (!meta) return null
                return (
                  <button
                    key={id}
                    type="button"
                    className="ritem"
                    data-hue="blue"
                    onClick={() => {
                      persistActions([...actionIds, id])
                      setAddOpen(false)
                    }}
                  >
                    <span className="ico-chip">
                      <QuickActionIcon name={meta.icon} className="h-4 w-4" />
                    </span>
                    <span className="grow">
                      <span className="t">{meta.title.replace(/\n/g, ' ')}</span>
                    </span>
                    <PlusIcon className="h-5 w-5 text-[var(--blue)]" />
                  </button>
                )
              })}
            </div>
          )}
        </IosModal>
      ) : null}
    </div>
  )
}
