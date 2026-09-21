/**
 * iOS parity source: Views/HomeView.swift, HomeQuickActionRegistry.swift, HomeUpNextSupport.swift
 * Spec: docs/ios-parity/IOS_APP_BLUEPRINT.md §3.4, §6.18
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CalendarDaysIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  PlusIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/solid'
import { QuickActionIcon } from '@/components/home/QuickActionIcon'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useMaterialProjectStore } from '@/lib/stores/materialProjectStore'
import { canBookWork, canViewDailyOverview, canViewWeeklyReports, hasAdminAccess, isOperativeMode } from '@/lib/permissions'
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
import { upcomingDaySections } from '@/lib/home/upNext'
import {
  allEligibleQuickActionIds,
  loadSavedQuickActionOrder,
  quickActionHintStorageKey,
  quickActionMeta,
  saveQuickActionOrder,
} from '@/lib/home/quickActions'
import { policyForDay } from '@/lib/payroll/policyCatalog'
import { type ChipTint } from '@/components/ios/IconChip'
import { Hero, StatCard } from '@/components/ui'
import { IosModal } from '@/components/ios/primitives'
import type { SectionHue } from '@/lib/ui/sectionHue'
import { generateOrgWarnings } from '@/lib/warnings/generateOrgWarnings'
import { loadOrganizationDetails, type OrganizationDetails } from '@/lib/settings/organizationSettings'
import { loadMaterialCutOffSettings, type NotificationPreferences } from '@/lib/settings/notificationPreferences'
import { mergeProjectsAndSmallWorks } from '@/lib/projects/workStatus'
import { shouldShowTeamOnboardingPrompt } from '@/lib/orgSetup/teamOnboarding'

function hueFromQuickChip(chip: ChipTint | string): SectionHue {
  switch (chip) {
    case 'green':
      return 'proj'
    case 'amber':
      return 'sw'
    case 'coral':
      return 'leave'
    case 'purple':
      return 'user'
    case 'rose':
      return 'sched'
    case 'grey':
      return 'lib'
    default:
      return 'blue'
  }
}

function greetingName(firstName: string, email: string): string {
  const name = firstName.trim()
  if (name) return name
  return email.split('@')[0] || 'there'
}

export function HomeScreen() {
  const router = useRouter()
  const { user, organization } = useAuthStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const { operatives, managers, loadOperatives, loadManagers } = useOperativeStore()
  const { users, loadUsers } = useOrgUserStore()
  const { bookings, loadBookings } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings } = useManagerScheduleStore()
  const { tasks, loadTasks } = useTaskStore()
  const { bookings: holidays, loadBookings: loadHolidays } = useHolidayStore()
  const { materials, sendRecords, loadAllMaterials, loadSendRecords } = useMaterialProjectStore()
  const [customise, setCustomise] = useState(false)
  const [metricsOpen, setMetricsOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [hint, setHint] = useState(false)
  const [metricIds, setMetricIds] = useState<HomeOverviewMetricID[]>(DEFAULT_ADMIN_OVERVIEW_METRICS)
  const [actionIds, setActionIds] = useState<string[]>([])
  const [now] = useState(() => new Date())
  const [orgDetails, setOrgDetails] = useState<OrganizationDetails | null>(null)
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences | null>(null)

  const displayUser = user
  const pauseHomeLoads = shouldShowTeamOnboardingPrompt(
    organization?.teamOnboarding,
    Boolean(displayUser?.permissions.adminAccess || displayUser?.isSuperAdmin),
    organization?.id
  )

  useEffect(() => {
    const orgId = organization?.id
    if (!orgId || pauseHomeLoads) return
    loadProjects(orgId, true)
    loadSmallWorks(orgId)
    loadOperatives(orgId)
    loadManagers(orgId)
    loadUsers(orgId)
    loadBookings(orgId)
    loadManagerSiteBookings(orgId)
    loadTasks(orgId)
    loadAllMaterials(orgId)
    loadSendRecords(orgId)
    loadOrganizationDetails(orgId).then(setOrgDetails).catch(() => setOrgDetails(null))
    const t = window.setTimeout(() => loadHolidays(orgId), 400)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- zustand loaders are stable
  }, [organization?.id, pauseHomeLoads])

  useEffect(() => {
    if (!user) return
    setMetricIds(loadSavedOverviewMetrics(user.id))
    setActionIds(loadSavedQuickActionOrder(user.id, displayUser || user, users))
    if (organization?.id && !pauseHomeLoads) {
      loadMaterialCutOffSettings(organization.id, user.id)
        .then(setNotificationPreferences)
        .catch(() => setNotificationPreferences(null))
    }
    try {
      setHint(!localStorage.getItem(quickActionHintStorageKey(user.id)))
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- displayUser is derived from user.id
  }, [user?.id, organization?.id, pauseHomeLoads, users])

  const merged = useMemo(() => mergeProjectsAndSmallWorks(projects, smallWorks), [projects, smallWorks])
  const liveCount = merged.filter((p) => p.isLive !== false).length
  const operative = isOperativeMode(displayUser)
  const admin = hasAdminAccess(displayUser)

  const metrics = useMemo(
    () =>
      computeHomeOverviewMetrics({
        tasks,
        userEmail: displayUser?.email,
        isOperativeMode: operative,
        operatives,
        managers: managers ?? [],
        bookings,
        managerBookings: managerSiteBookings,
        holidays,
        organizationUsers: users,
        liveProjectCount: liveCount,
        now,
      }),
    [tasks, displayUser?.email, operative, operatives, managers, bookings, managerSiteBookings, holidays, users, liveCount, now]
  )

  const warningCount = useMemo(() => {
    if (!admin) return 0
    return generateOrgWarnings({
      bookings,
      managerSiteBookings,
      operatives,
      users,
      projects: merged,
      holidays,
      materials,
      sendRecords,
      orgDetails,
      notificationPreferences,
      referenceDate: now,
    }).coreCount
  }, [
    admin,
    bookings,
    managerSiteBookings,
    operatives,
    users,
    merged,
    holidays,
    materials,
    sendRecords,
    orgDetails,
    notificationPreferences,
    now,
  ])

  const shownMetrics: HomeOverviewMetricID[] = operative
    ? ['tasksDueTodayPersonal', 'tasksDueWeekPersonal']
    : admin
      ? metricIds
      : ['tasksDueTodayPersonal', 'tasksDueWeekPersonal', 'outstandingTasksAllUsers']

  const pendingTasks = operative ? metrics.tasksOverdue + metrics.tasksDueToday : metrics.outstandingTasksAllUsers
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
        payrollTimePolicy: policyForDay(now, organization?.settings),
      }),
    [now, displayUser?.id, displayUser?.email, operatives, bookings, managerSiteBookings, merged, users, organization?.settings]
  )

  const taskLimitProjects = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of tasks) counts.set(t.projectId, (counts.get(t.projectId) || 0) + 1)
    return merged.filter((p) => (counts.get(p.id) || 0) >= 500)
  }, [tasks, merged])

  if (!displayUser || !user) return null

  const eligibleAdd = allEligibleQuickActionIds(displayUser, false, users).filter((id) => !actionIds.includes(id))

  const persistActions = (ids: string[]) => {
    setActionIds(ids)
    saveQuickActionOrder(user.id, ids)
  }

  const showBook = canBookWork(displayUser)
  const showDaily = canViewDailyOverview(displayUser)
  const showWeekly = canViewWeeklyReports(displayUser)

  return (
    <div className="stack">
      {admin && taskLimitProjects.length > 0 ? (
        <div className="banner" data-hue="red">
          <span className="ico-chip">
            <ExclamationTriangleIcon className="h-5 w-5" />
          </span>
          <div>
            <b>Task limit reached</b>
            {taskLimitProjects.slice(0, 3).map((p) => (
              <p key={p.id} className="small">
                {p.jobNumber}: Delete first 50 completed tasks to clear some space
              </p>
            ))}
            {taskLimitProjects.length > 3 ? (
              <p className="small">
                And {taskLimitProjects.length - 3} more project{taskLimitProjects.length - 3 === 1 ? '' : 's'}...
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gmain">
        <Hero
          eyebrow={formatHomeDateLine(now)}
          title={<h1>{`Hi, ${greetingName(displayUser.firstName, displayUser.email)}`}</h1>}
          subtitle={`${liveCount} active project${liveCount === 1 ? '' : 's'}`}
          stats={
            operative
              ? [
                  { label: 'Tasks Due Today', value: metrics.tasksDueToday, onClick: () => router.push('/dashboard/tasks') },
                  { label: 'Tasks Due This Week', value: metrics.tasksDueThisWeek, onClick: () => router.push('/dashboard/tasks') },
                  { label: 'My Tasks Overdue', value: metrics.tasksOverdue, onClick: () => router.push('/dashboard/tasks') },
                ]
              : shownMetrics.map((id) => ({
                  label: HOME_OVERVIEW_PILL_TITLES[id],
                  value: metricValue(id, metrics, warningCount),
                  onClick: () => {
                    const title = HOME_OVERVIEW_PILL_TITLES[id]
                    if (title.startsWith('Tasks') || title.startsWith('Open')) router.push('/dashboard/tasks')
                    else if (title === 'Warnings') router.push('/dashboard/warnings')
                    else if (title.includes('AL')) router.push('/dashboard/annual-leave')
                    else router.push('/dashboard/daily-overview')
                  },
                }))
          }
          actions={
            <div className="row wrap">
              {admin ? (
                <button
                  type="button"
                  onClick={() => setMetricsOpen(true)}
                  className="btn sm hbtn round"
                  aria-label="Choose dashboard metrics"
                >
                  <Cog6ToothIcon className="h-5 w-5" />
                </button>
              ) : null}
              {showBook ? (
                <button type="button" className="btn hbtn solid" onClick={() => router.push('/dashboard/book-labour')}>
                  <PlusIcon className="h-4 w-4" />
                  Book labour
                </button>
              ) : null}
              {showDaily ? (
                <button type="button" className="btn hbtn" onClick={() => router.push('/dashboard/daily-overview')}>
                  <CalendarDaysIcon className="h-4 w-4" />
                  Daily overview
                </button>
              ) : null}
              {showWeekly ? (
                <button type="button" className="btn hbtn" onClick={() => router.push('/dashboard/weekly-report')}>
                  <ChartBarIcon className="h-4 w-4" />
                  Weekly report
                </button>
              ) : null}
            </div>
          }
        />

        <div className="stack" style={{ gap: 16 }}>
          {admin ? (
            <StatCard
              hue="warn"
              label="Warnings"
              value={warningCount === 0 ? 'All clear' : `${warningCount} active`}
              icon={<ExclamationTriangleIcon className="h-6 w-6" />}
              onClick={() => router.push('/dashboard/warnings')}
            />
          ) : null}
          <StatCard
            hue="task"
            label="Tasks"
            value={`${pendingTasks} pending`}
            icon={<ClipboardDocumentCheckIcon className="h-6 w-6" />}
            onClick={() => router.push('/dashboard/tasks')}
          />
        </div>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <h2 className="h2">Quick actions</h2>
        <span className="grow" />
        <button type="button" className="link" onClick={() => setCustomise((v) => !v)}>
          {customise ? 'Done' : 'Customise'}
        </button>
      </div>
      {customise && hint ? (
        <div className="banner" data-hue="blue">
          <p className="small">
            Drag the icons to your desired layout.{' '}
            <button
              type="button"
              className="link"
              onClick={() => {
                localStorage.setItem(quickActionHintStorageKey(user.id), '1')
                setHint(false)
              }}
            >
              OK
            </button>
          </p>
        </div>
      ) : null}
      <div className="tiles">
        {actionIds
          .map((id) => quickActionMeta(id, organization?.settings))
          .filter((m): m is NonNullable<typeof m> => Boolean(m))
          .map((meta) => (
            <div key={meta.id} className="relative">
              <Link
                href={meta.href}
                data-hue={hueFromQuickChip(meta.chip)}
                className="tile"
              >
                <span className="ico-chip">
                  <QuickActionIcon name={meta.icon} className="h-6 w-6" />
                </span>
                {meta.title.replace(/\n/g, ' ')}
              </Link>
              {customise ? (
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => persistActions(actionIds.filter((id) => id !== meta.id))}
                  className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-[var(--red)] text-white"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
        {customise ? (
          <button type="button" onClick={() => setAddOpen(true)} className="tile" data-hue="lib" style={{ opacity: 0.7 }}>
            <span className="ico-chip">
              <PlusIcon className="h-6 w-6" />
            </span>
            Add
          </button>
        ) : null}
      </div>

      <div className="grid gmain">
        <section className="card" data-hue="sched">
          <div className="card-h">
            <div className="ico-chip sm">
              <CalendarDaysIcon className="h-[18px] w-[18px]" />
            </div>
            <h2 className="h2">Up next</h2>
            <div className="acts">
              <Link href="/dashboard/my-schedule" className="btn sm ghost">
                See all
              </Link>
            </div>
          </div>
          <div className="card-b rows">
            {upNext.length === 0 ? (
              <p className="muted small">No upcoming bookings on your schedule.</p>
            ) : (
              upNext.flatMap((day) =>
                day.rows.map((row) => (
                  <Link
                    key={row.id}
                    href="/dashboard/my-schedule"
                    className="ritem"
                    data-hue={row.accent === 'blue' ? 'blue' : 'daily'}
                  >
                    <span className="ico-chip" style={{ flexDirection: 'column', lineHeight: 1 }}>
                      <span className="xs" style={{ fontWeight: 700 }}>
                        {day.heading.slice(0, 3).toUpperCase()}
                      </span>
                    </span>
                    <span className="grow">
                      <span className="t">{row.title}</span>
                      <span className="s">{row.subtitle}</span>
                    </span>
                  </Link>
                ))
              )
            )}
          </div>
        </section>

        {!operative ? (
          <section className="card pad" data-hue="lib">
            <div className="row">
              <div className="ico-chip">
                <WrenchScrewdriverIcon className="h-5 w-5" />
              </div>
              <div className="grow">
                <b style={{ fontFamily: 'var(--head)' }}>Maintenance</b>{' '}
                <span className="pill" data-hue="warn">
                  Soon
                </span>
                <div className="muted small">Coming in a future update</div>
              </div>
            </div>
          </section>
        ) : null}
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
                  <span className="s">Current: {metricValue(id, metrics, warningCount)}</span>
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
                    data-hue={hueFromQuickChip(meta.chip)}
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
