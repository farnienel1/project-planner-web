'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore, useSiteAuditStore } from '@/lib/stores/siteAuditStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useDashboardStore } from '@/lib/stores/dashboardStore'
import { getPendingHolidayApprovalsForUser } from '@/lib/annualLeave/holidayApprovalUtils'
import { useMaterialProjectStore } from '@/lib/stores/materialProjectStore'
import { computeOperativeBookingClashWarnings } from '@/lib/scheduling/bookingClashUtils'
import { computeMissedMaterialOrderWarnings } from '@/lib/warnings/materialOrderWarnings'
import {
  computeUnbookedLabourWarnings,
  filterWarningsByLookahead,
} from '@/lib/warnings/unbookedLabourWarnings'
import {
  DEFAULT_WARNING_DETECTION,
  loadOrganizationDetails,
  type OrganizationDetails,
} from '@/lib/settings/organizationSettings'
import { countActiveOperativeUsers, getActiveOperativesForScheduling } from '@/lib/operatives/operativeRosterUtils'
import { mergeProjectsAndSmallWorks } from '@/lib/projects/workStatus'
import { getDashboardQuickActions } from '@/lib/navigation/dashboardQuickActions'
import { DashboardHero } from '@/components/dashboard/DashboardHero'
import { resolveHeroMetrics } from '@/lib/dashboard/heroMetrics'
import { DashboardWidgetGrid, type DashboardTileData } from '@/components/dashboard/DashboardTiles'

const PRIORITY_DOT: Record<string, string> = {
  Urgent: 'bg-red-500',
  High: 'bg-amber-500',
  Normal: 'bg-blue-500',
  Low: 'bg-slate-400',
}
const PRIORITY_TEXT: Record<string, string> = {
  Urgent: 'text-red-700',
  High: 'text-amber-700',
  Normal: 'text-blue-700',
  Low: 'text-slate-600',
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, organization, loading } = useAuthStore()
  const { projects, smallWorks, clients, loadProjects, loadSmallWorks, loadClients } = useProjectStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, loadUsers } = useOrgUserStore()
  const { audits, loadAudits } = useSiteAuditStore()
  const { bookings, loadBookings } = useBookingStore()
  const { materials, sendRecords, loadAllMaterials, loadSendRecords } = useMaterialProjectStore()
  const { tasks, loadTasks } = useTaskStore()
  const { bookings: holidayBookings, loadBookings: loadHolidayBookings } = useHolidayStore()
  const { layout, heroMetrics, loadLayout } = useDashboardStore()
  const [orgDetails, setOrgDetails] = useState<OrganizationDetails | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    const orgId = organization?.id
    if (!orgId) return

    // Critical path — hero, tasks, schedule tiles
    loadProjects(orgId, true)
    loadSmallWorks(orgId)
    loadOperatives(orgId)
    loadUsers(orgId)
    loadBookings(orgId)
    loadTasks(orgId)

    // Defer heavier collections so the dashboard shell paints first
    const defer = () => {
      loadClients(orgId)
      loadAllMaterials(orgId)
      loadSendRecords(orgId)
      loadHolidayBookings(orgId)
      loadAudits(orgId)
      loadOrganizationDetails(orgId).then(setOrgDetails).catch(() => setOrgDetails(null))
    }

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(defer, { timeout: 2000 })
      return () => window.cancelIdleCallback(idleId)
    }

    const timeoutId = setTimeout(defer, 120)
    return () => clearTimeout(timeoutId)
  }, [
    organization?.id,
    loadProjects,
    loadSmallWorks,
    loadClients,
    loadOperatives,
    loadUsers,
    loadBookings,
    loadAllMaterials,
    loadSendRecords,
    loadHolidayBookings,
    loadTasks,
    loadAudits,
  ])

  useEffect(() => {
    if (organization?.id && user?.id) {
      loadLayout(user.id, organization.id)
    }
  }, [organization?.id, user?.id, loadLayout])

  const rosterOperatives = useMemo(() => getActiveOperativesForScheduling(operatives), [operatives])

  const mergedWorks = useMemo(
    () => mergeProjectsAndSmallWorks(projects, smallWorks),
    [projects, smallWorks]
  )

  const warningDetection = orgDetails?.warningDetection ?? DEFAULT_WARNING_DETECTION
  const invoicing = orgDetails?.invoicing

  const bookingClashWarnings = useMemo(() => {
    if (!warningDetection.detectClashes) return []
    const all = computeOperativeBookingClashWarnings(bookings, rosterOperatives, mergedWorks)
    return filterWarningsByLookahead(all, warningDetection, invoicing)
  }, [bookings, rosterOperatives, mergedWorks, warningDetection, invoicing])

  const unbookedLabourWarnings = useMemo(
    () =>
      computeUnbookedLabourWarnings({
        bookings,
        operatives,
        users,
        holidays: holidayBookings,
        warningDetection,
        invoicing,
      }),
    [bookings, operatives, users, holidayBookings, warningDetection, invoicing]
  )

  const materialOrderWarnings = useMemo(
    () => computeMissedMaterialOrderWarnings(materials, sendRecords, mergedWorks),
    [materials, sendRecords, mergedWorks]
  )

  const totalWarningCount =
    bookingClashWarnings.length + unbookedLabourWarnings.length + materialOrderWarnings.length

  const pendingLeaveApprovals = useMemo(
    () => getPendingHolidayApprovalsForUser(holidayBookings, user, users, operatives),
    [holidayBookings, user, users, operatives]
  )

  const tileData: DashboardTileData = useMemo(
    () => ({
      tasks,
      projects,
      smallWorks,
      bookings,
      operatives: rosterOperatives,
      warnings: bookingClashWarnings,
      clients,
      audits,
      holidayBookings,
      pendingLeaveCount: pendingLeaveApprovals.length,
      user,
      activeOperativesCount: countActiveOperativeUsers(users),
    }),
    [
      tasks,
      projects,
      smallWorks,
      bookings,
      rosterOperatives,
      bookingClashWarnings,
      clients,
      audits,
      holidayBookings,
      pendingLeaveApprovals.length,
      user,
      users,
    ]
  )

  const openTasksByProject = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'Completed')
    const grouped: Record<
      string,
      { projectName: string; projectId: string; collection: string; tasks: typeof open }
    > = {}
    for (const task of open) {
      if (!grouped[task.projectId]) {
        const proj = mergedWorks.find((p) => p.id === task.projectId)
        if (!proj) continue
        const isSmallWork = smallWorks.some((sw) => sw.id === task.projectId)
        grouped[task.projectId] = {
          projectId: task.projectId,
          projectName: proj.siteName,
          collection: isSmallWork ? 'small-works' : 'projects',
          tasks: [],
        }
      }
      grouped[task.projectId].tasks.push(task)
    }
    return Object.values(grouped).sort((a, b) => b.tasks.length - a.tasks.length)
  }, [tasks, mergedWorks, smallWorks])

  const heroDisplay = useMemo(() => resolveHeroMetrics(heroMetrics, tileData), [heroMetrics, tileData])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!user) return null

  const quickActions = getDashboardQuickActions(user, organization).filter((item) => item.id !== 'dashboard_home')
  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="space-y-8">
      <DashboardHero
        userName={user.firstName || user.email}
        organizationName={organization?.name || 'your organisation'}
        dateLabel={dateLabel}
        metrics={heroDisplay}
        warningCount={totalWarningCount}
      />

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <DashboardWidgetGrid layout={layout} data={tileData} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        {openTasksByProject.length > 0 ? (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">Open tasks</h2>
              <Link href="/dashboard/tasks" className="text-[13px] font-medium text-slate-500 hover:text-slate-900">
                View all
              </Link>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {openTasksByProject.map((group, i) => (
                <div key={group.projectId}>
                  {i > 0 && <div className="border-t border-slate-100" />}
                  <div className="flex items-center justify-between px-5 py-2.5">
                    <Link
                      href={`/dashboard/${group.collection}/${group.projectId}/tasks`}
                      className="text-[13px] font-medium text-slate-800 hover:text-slate-950"
                    >
                      {group.projectName}
                    </Link>
                    <span className="text-[12px] tabular-nums text-slate-400">{group.tasks.length}</span>
                  </div>
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {group.tasks.slice(0, 3).map((task) => (
                      <Link
                        key={task.id}
                        href={`/dashboard/${group.collection}/${group.projectId}/tasks`}
                        className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50"
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority] || 'bg-slate-400'}`}
                        />
                        <span className="flex-1 truncate text-[13px] text-slate-700">{task.title}</span>
                        <span className={`text-[11px] font-medium ${PRIORITY_TEXT[task.priority] || 'text-slate-500'}`}>
                          {task.priority}
                        </span>
                        <span className="text-[11px] text-slate-400">{task.status}</span>
                      </Link>
                    ))}
                    {group.tasks.length > 3 && (
                      <Link
                        href={`/dashboard/${group.collection}/${group.projectId}/tasks`}
                        className="block px-5 py-2 text-[12px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                      >
                        {group.tasks.length - 3} more
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-6">
            <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">Open tasks</h2>
            <p className="mt-2 text-[13px] text-slate-500">No open tasks on live jobs.</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-5">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">Up next</h3>
              <Link href="/dashboard/my-schedule" className="text-[13px] font-medium text-slate-500 hover:text-slate-900">
                Schedule
              </Link>
            </div>
            <p className="text-[13px] leading-6 text-slate-500">
              {bookings.length === 0
                ? 'No upcoming bookings on your schedule.'
                : `${bookings.length} bookings scheduled. Open schedule for day-by-day detail.`}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-5 py-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">Quick actions</h3>
              <Link href="/dashboard/edit" className="text-[13px] font-medium text-slate-500 hover:text-slate-900">
                Customise
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {quickActions.slice(0, 6).map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.iconPath} />
                    </svg>
                    <span className="truncate text-[13px] font-medium text-slate-800">{item.label}</span>
                  </div>
                  <svg className="h-3.5 w-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
