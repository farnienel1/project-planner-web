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
const PRIORITY_BG: Record<string, string> = {
  Urgent: 'bg-red-50',
  High: 'bg-amber-50',
  Normal: 'bg-blue-50',
  Low: 'bg-slate-100',
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
    if (organization?.id) {
      loadProjects(organization.id, true)
      loadSmallWorks(organization.id)
      loadClients(organization.id)
      loadOperatives(organization.id)
      loadUsers(organization.id)
      loadBookings(organization.id)
      loadAllMaterials(organization.id)
      loadSendRecords(organization.id)
      loadHolidayBookings(organization.id)
      loadTasks(organization.id)
      loadAudits(organization.id)
      loadOrganizationDetails(organization.id).then(setOrgDetails).catch(() => setOrgDetails(null))
    }
  }, [
    organization,
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
    <div className="space-y-6">
      <DashboardHero
        userName={user.firstName || user.email}
        organizationName={organization?.name || 'your organisation'}
        dateLabel={dateLabel}
        metrics={heroDisplay}
        warningCount={totalWarningCount}
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DashboardWidgetGrid layout={layout} data={tileData} />
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Quick actions</h2>
        <Link href="/dashboard/edit" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
          Customise metrics
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {quickActions.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${item.tileClasses}`}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.iconPath} />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-900">{item.label}</h3>
            <p className="mt-1 text-sm text-slate-500">{item.subtitle}</p>
          </Link>
        ))}
      </div>

      {openTasksByProject.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Open tasks by project</h2>
            <Link href="/dashboard/tasks" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
              View all tasks
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {openTasksByProject.map((group, i) => (
              <div key={group.projectId}>
                {i > 0 && <div className="border-t border-slate-100" />}
                <div className="flex items-center justify-between bg-slate-50 px-5 py-2.5">
                  <Link
                    href={`/dashboard/${group.collection}/${group.projectId}/tasks`}
                    className="text-sm font-semibold text-slate-800 transition-colors hover:text-blue-600"
                  >
                    {group.projectName}
                  </Link>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {group.tasks.length}
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {group.tasks.slice(0, 3).map((task) => (
                    <Link
                      key={task.id}
                      href={`/dashboard/${group.collection}/${group.projectId}/tasks`}
                      className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-slate-50"
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority] || 'bg-slate-400'}`}
                      />
                      <span className="flex-1 truncate text-sm text-slate-700">{task.title}</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_BG[task.priority]} ${PRIORITY_TEXT[task.priority]}`}
                      >
                        {task.priority}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          task.status === 'In Progress' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {task.status}
                      </span>
                    </Link>
                  ))}
                  {group.tasks.length > 3 && (
                    <Link
                      href={`/dashboard/${group.collection}/${group.projectId}/tasks`}
                      className="block px-5 py-2 text-xs font-medium text-blue-600 transition-colors hover:bg-slate-50"
                    >
                      + {group.tasks.length - 3} more tasks →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Up next</h3>
          <Link href="/dashboard/my-schedule" className="text-sm font-semibold text-blue-600">
            See all
          </Link>
        </div>
        <p className="text-sm text-slate-500">
          {bookings.length === 0
            ? 'No upcoming bookings on your schedule.'
            : `${bookings.length} bookings scheduled. Open My Schedule for day-by-day detail.`}
        </p>
      </section>
    </div>
  )
}
