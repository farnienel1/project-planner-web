/**
 * iOS parity source: Views/HomeView.swift, HomeQuickActionRegistry.swift, HomeUpNextSupport.swift
 * Spec: docs/ios-parity/IOS_APP_BLUEPRINT.md §3.4, §6.18
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronRightIcon,
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
import { hasAdminAccess, isOperativeMode } from '@/lib/permissions'
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
import { IconChip, type ChipTint } from '@/components/ios/IconChip'
import { Hero, StatCard } from '@/components/ui'
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

  return (
    <div className="space-y-5">
      {admin && taskLimitProjects.length > 0 ? (
        <div className="rounded-2xl border border-[#FCEBEB] bg-[#FCEBEB] px-4 py-3 text-sm text-[#A32D2D]">
          <p className="font-semibold">Warning: Task limit reached</p>
          {taskLimitProjects.slice(0, 3).map((p) => (
            <p key={p.id}>
              {p.jobNumber}: Delete first 50 completed tasks to clear some space
            </p>
          ))}
          {taskLimitProjects.length > 3 ? (
            <p>And {taskLimitProjects.length - 3} more project{taskLimitProjects.length - 3 === 1 ? '' : 's'}...</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5 min-[1100px]:grid-cols-[minmax(0,1fr)_380px]">
        <Hero
          eyebrow={formatHomeDateLine(now)}
            title={<h1>{`Hi, ${greetingName(displayUser.firstName, displayUser.email)}`}</h1>}
            subtitle={`${liveCount} active project${liveCount === 1 ? '' : 's'}`}
          stats={
            operative
              ? [
                  { label: 'Tasks Due Today', value: metrics.tasksDueToday },
                  { label: 'Tasks Due This Week', value: metrics.tasksDueThisWeek },
                  { label: 'My Tasks Overdue', value: metrics.tasksOverdue },
                ]
              : shownMetrics.map((id) => ({
                  label: HOME_OVERVIEW_PILL_TITLES[id],
                  value: metricValue(id, metrics, warningCount),
                }))
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {admin ? (
                <button
                  type="button"
                  onClick={() => setMetricsOpen(true)}
                  className="btn sm h-9 w-9 rounded-[11px] border border-white/20 bg-white/16 text-white"
                  aria-label="Choose dashboard metrics"
                >
                  <Cog6ToothIcon className="h-5 w-5" />
                </button>
              ) : null}
              <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-[12px] font-medium">
                {warningCount > 0 ? 'Heads up' : 'On track'}
              </span>
            </div>
          }
        />

        <div className="flex flex-col gap-4">
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

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-semibold lg:text-[18px]">Quick actions</h2>
          <div className="flex items-center gap-3 text-[14px] font-medium text-[var(--blue)]">
            <span>Main menu</span>
            <button type="button" onClick={() => setCustomise((v) => !v)}>
              {customise ? 'Done' : 'Customise'}
            </button>
          </div>
        </div>
        {customise && hint ? (
          <p className="mb-3 rounded-xl bg-ios-chip-blue px-3 py-2 text-sm text-[#185FA5]">
            Drag the icons to your desired layout.
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => {
                localStorage.setItem(quickActionHintStorageKey(user.id), '1')
                setHint(false)
              }}
            >
              OK
            </button>
          </p>
        ) : null}
        <div className="grid grid-cols-3 gap-3 lg:grid-cols-4 xl:grid-cols-6">
          {actionIds
            .map((id) => quickActionMeta(id, organization?.settings))
            .filter((m): m is NonNullable<typeof m> => Boolean(m))
            .map((meta) => (
              <div key={meta.id} className="relative">
                <Link
                  href={meta.href}
                  data-hue={hueFromQuickChip(meta.chip)}
                  className="tile min-h-[128px] w-full text-center"
                >
                  <IconChip tint={meta.chip as ChipTint} size="lg">
                    <QuickActionIcon name={meta.icon} className="h-6 w-6" />
                  </IconChip>
                  <span className="line-clamp-2 text-[16px] font-medium leading-tight">{meta.title.replace(/\n/g, ' ')}</span>
                </Link>
                {customise ? (
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => persistActions(actionIds.filter((id) => id !== meta.id))}
                    className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#A32D2D] text-white"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))}
          {customise ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="ios-card flex min-h-[128px] flex-col items-center justify-center gap-2 border-dashed p-4 text-ios-muted"
            >
              <PlusIcon className="h-8 w-8" />
              Add
            </button>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-12">
        <section className="xl:col-span-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[20px] font-semibold">Up next</h2>
            <Link href="/dashboard/my-schedule" className="text-[14px] font-medium text-[#185FA5]">
              See all
            </Link>
          </div>
          {upNext.length === 0 ? (
            <p className="ios-card p-6 text-sm text-ios-muted">No upcoming bookings on your schedule.</p>
          ) : (
            <div className="space-y-4">
              {upNext.map((day) => (
                <div key={day.id}>
                  <p className="mb-2 text-[13px] font-semibold text-ios-muted">{day.heading}</p>
                  <div className="space-y-2">
                    {day.rows.map((row) => (
                      <Link
                        key={row.id}
                        href="/dashboard/my-schedule"
                        className="ios-card flex items-center gap-3 overflow-hidden hover:border-ios-search-border"
                      >
                        <span className={`h-full w-[5px] self-stretch ${row.accent === 'blue' ? 'bg-[#185FA5]' : 'bg-[#534AB7]'}`} />
                        <div className="min-w-0 flex-1 py-3 pr-2">
                          <p className="truncate text-[17px] font-semibold">{row.title}</p>
                          <p className="truncate text-[14px] text-ios-muted">{row.subtitle}</p>
                        </div>
                        <ChevronRightIcon className="mr-3 h-5 w-5 text-[#C5C9D2]" />
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {!operative ? (
          <aside className="xl:col-span-4">
            <div className="ios-card p-5">
              <div className="flex items-center gap-3">
                <IconChip tint="amber">
                  <WrenchScrewdriverIcon className="h-5 w-5" />
                </IconChip>
                <div>
                  <p className="font-semibold">Maintenance</p>
                  <span className="mt-1 inline-block rounded-full bg-ios-chip-amber px-2 py-0.5 text-[12px] font-medium text-ios-icon-amber">
                    Soon
                  </span>
                </div>
              </div>
              <p className="mt-3 text-sm text-ios-muted">Coming in a future update</p>
            </div>
          </aside>
        ) : null}
      </div>

      {metricsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-[640px] overflow-y-auto rounded-2xl bg-ios-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Dashboard metrics</h3>
              <button type="button" onClick={() => setMetricsOpen(false)} className="text-[#185FA5]">
                Done
              </button>
            </div>
            <p className="mb-3 text-[13px] font-semibold">Shown on home (up to 3)</p>
            <div className="mb-4 flex gap-2">
              {metricIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="rounded-xl bg-[#185FA5] px-3 py-2 text-xs text-white"
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
            <p className="mb-3 text-[12px] text-ios-muted">These are just organisation metrics.</p>
            <p className="mb-2 text-[13px] font-semibold">Add metrics</p>
            {HOME_OVERVIEW_METRIC_IDS.filter((id) => !metricIds.includes(id)).map((id) => (
              <button
                key={id}
                type="button"
                disabled={metricIds.length >= 3}
                className="flex w-full items-center justify-between border-b border-ios-border py-3 text-left disabled:opacity-40"
                onClick={() => {
                  const next = [...metricIds, id].slice(0, 3)
                  setMetricIds(next)
                  saveOverviewMetrics(user.id, next)
                }}
              >
                <span>
                  <span className="block text-[15px] font-medium">{HOME_OVERVIEW_CATALOG_TITLES[id]}</span>
                  <span className="text-[12px] text-ios-muted">Current: {metricValue(id, metrics, warningCount)}</span>
                </span>
                <PlusIcon className="h-5 w-5 text-[#185FA5]" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-[640px] overflow-y-auto rounded-2xl bg-ios-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add quick action</h3>
              <button type="button" onClick={() => setAddOpen(false)} className="text-[#185FA5]">
                Done
              </button>
            </div>
            {eligibleAdd.length === 0 ? (
              <p className="text-sm text-ios-muted">
                No more actions. All available quick actions are already on your home screen.
              </p>
            ) : (
              eligibleAdd.map((id) => {
                const meta = quickActionMeta(id, organization?.settings)
                if (!meta) return null
                return (
                  <button
                    key={id}
                    type="button"
                    className="flex w-full items-center justify-between border-b border-ios-border py-3 text-left"
                    onClick={() => {
                      persistActions([...actionIds, id])
                      setAddOpen(false)
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <IconChip tint={meta.chip as ChipTint} size="sm">
                        <QuickActionIcon name={meta.icon} className="h-4 w-4" />
                      </IconChip>
                      <span className="font-medium">{meta.title.replace(/\n/g, ' ')}</span>
                    </span>
                    <PlusIcon className="h-5 w-5 text-[#185FA5]" />
                  </button>
                )
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
