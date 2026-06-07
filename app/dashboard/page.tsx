'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import { computeOperativeBookingClashWarnings } from '@/lib/scheduling/bookingClashUtils'
import { countActiveOperativeUsers, getActiveOperativesForScheduling } from '@/lib/operatives/operativeRosterUtils'
import Link from 'next/link'
import { mergeProjectsAndSmallWorks } from '@/lib/projects/workStatus'
import { getDashboardQuickActions } from '@/lib/navigation/dashboardQuickActions'

const PRIORITY_DOT: Record<string, string> = {
  Urgent: 'bg-red-500',
  High:   'bg-amber-500',
  Normal: 'bg-blue-500',
  Low:    'bg-slate-400',
}
const PRIORITY_TEXT: Record<string, string> = {
  Urgent: 'text-red-700',
  High:   'text-amber-700',
  Normal: 'text-blue-700',
  Low:    'text-slate-600',
}
const PRIORITY_BG: Record<string, string> = {
  Urgent: 'bg-red-50',
  High:   'bg-amber-50',
  Normal: 'bg-blue-50',
  Low:    'bg-slate-100',
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, organization, loading } = useAuthStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, loadUsers } = useOrgUserStore()
  const { bookings, loadBookings } = useBookingStore()
  const { tasks, loadTasks } = useTaskStore()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (organization?.id) {
      loadProjects(organization.id, true)
      loadSmallWorks(organization.id)
      loadOperatives(organization.id)
      loadUsers(organization.id)
      loadBookings(organization.id)
      loadTasks(organization.id)
    }
  }, [organization, loadProjects, loadSmallWorks, loadOperatives, loadUsers, loadBookings, loadTasks])

  const rosterOperatives = useMemo(() => getActiveOperativesForScheduling(operatives), [operatives])

  const mergedWorks = useMemo(
    () => mergeProjectsAndSmallWorks(projects, smallWorks),
    [projects, smallWorks]
  )

  const bookingClashWarnings = useMemo(
    () => computeOperativeBookingClashWarnings(bookings, rosterOperatives, mergedWorks),
    [bookings, rosterOperatives, mergedWorks]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!user) return null

  const activeProjects = projects.filter((p) => p.isLive).length
  const activeOperatives = countActiveOperativeUsers(users)
  const quickActions = getDashboardQuickActions(user, organization).filter((item) => item.id !== 'dashboard_home')
  const pendingBookings = bookings.filter((b) => `${b.status}`.toLowerCase() === 'pending').length
  const warningCount = bookingClashWarnings.length

  // Tasks summary
  const todoTasks = tasks.filter((t) => t.status === 'To Do')
  const inProgressTasks = tasks.filter((t) => t.status === 'In Progress')
  const urgentTasks = tasks.filter((t) => t.priority === 'Urgent' && t.status !== 'Completed')

  // Group open tasks by project for the task widget
  const allProjects = mergedWorks
  const openTasksByProject = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'Completed')
    const grouped: Record<string, { projectName: string; projectId: string; collection: string; tasks: typeof open }> = {}
    for (const task of open) {
      if (!grouped[task.projectId]) {
        const proj = allProjects.find((p) => p.id === task.projectId)
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
  }, [tasks, allProjects, smallWorks])

  return (
    <div className="space-y-6">

      {/* ── Greeting ── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Hi, {user.firstName || user.email}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Project planning overview for {organization?.name || 'your organization'}.
          </p>
        </div>
      </div>

      {/* ── Hero stat card ── */}
      <section className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white shadow-[0_10px_30px_rgba(37,99,235,0.28)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-blue-200">Today's overview</p>
            <h2 className="mt-1 text-2xl font-extrabold">{activeProjects} active projects</h2>
          </div>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">On track</span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-white/15 p-4">
            <p className="text-2xl font-bold leading-none">{bookings.length}</p>
            <p className="mt-2 text-xs text-blue-100">Bookings this period</p>
          </div>
          <div className="rounded-xl bg-white/15 p-4">
            <p className="text-2xl font-bold leading-none">{activeOperatives}</p>
            <p className="mt-2 text-xs text-blue-100">Active operatives</p>
          </div>
          <div className="rounded-xl bg-white/15 p-4">
            <p className="text-2xl font-bold leading-none">{tasks.filter(t => t.status !== 'Completed').length}</p>
            <p className="mt-2 text-xs text-blue-100">Open tasks</p>
          </div>
        </div>
      </section>

      {/* ── Warnings + Tasks summary ── */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">

        {/* Warnings */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-500">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Warnings</p>
              <p className="text-lg font-semibold text-slate-900">{warningCount} active</p>
            </div>
          </div>
          {bookingClashWarnings.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Operative booking clashes</p>
              {bookingClashWarnings.slice(0, 3).map((warning) => (
                <div key={warning.id} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  <p className="font-medium">{warning.operativeName}</p>
                  <p className="text-xs text-amber-900">{format(warning.date, 'EEE d MMM yyyy')} · {warning.message}</p>
                </div>
              ))}
              {bookingClashWarnings.length > 3 && (
                <p className="text-xs text-slate-500">+ {bookingClashWarnings.length - 3} more clash warnings</p>
              )}
            </div>
          )}
        </div>

        {/* Tasks summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </span>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Tasks</p>
                <p className="text-lg font-semibold text-slate-900">
                  {todoTasks.length + inProgressTasks.length} open
                </p>
              </div>
            </div>
          </div>

          {/* Mini status pills */}
          <div className="flex gap-2 mb-4">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {todoTasks.length} to do
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              {inProgressTasks.length} in progress
            </span>
            {urgentTasks.length > 0 && (
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                {urgentTasks.length} urgent
              </span>
            )}
          </div>

          {/* Top open tasks */}
          {todoTasks.length + inProgressTasks.length === 0 ? (
            <p className="text-xs text-slate-400">No open tasks across your projects.</p>
          ) : (
            <div className="space-y-1.5">
              {[...inProgressTasks, ...todoTasks].slice(0, 4).map((task) => {
                const proj = allProjects.find((p) => p.id === task.projectId)
                const isSmallWork = smallWorks.some((sw) => sw.id === task.projectId)
                const href = proj
                  ? `/dashboard/${isSmallWork ? 'small-works' : 'projects'}/${task.projectId}/tasks`
                  : '#'
                return (
                  <Link
                    key={task.id}
                    href={href}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-50 transition-colors group/task"
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority] || 'bg-slate-400'}`} />
                    <span className="flex-1 truncate text-xs font-medium text-slate-800">{task.title}</span>
                    {proj && (
                      <span className="shrink-0 text-[11px] text-slate-400 group-hover/task:text-slate-600">
                        {proj.siteName.length > 18 ? proj.siteName.substring(0, 18) + '…' : proj.siteName}
                      </span>
                    )}
                  </Link>
                )
              })}
              {todoTasks.length + inProgressTasks.length > 4 && (
                <p className="pt-1 text-xs text-slate-400 px-3">
                  + {todoTasks.length + inProgressTasks.length - 4} more tasks
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Quick actions ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Quick actions</h2>
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

      {/* ── Tasks by project ── */}
      {openTasksByProject.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Open tasks by project</h2>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {openTasksByProject.map((group, i) => (
              <div key={group.projectId}>
                {i > 0 && <div className="border-t border-slate-100" />}
                <div className="flex items-center justify-between bg-slate-50 px-5 py-2.5">
                  <Link
                    href={`/dashboard/${group.collection}/${group.projectId}/tasks`}
                    className="text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors"
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
                      className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority] || 'bg-slate-400'}`} />
                      <span className="flex-1 truncate text-sm text-slate-700">{task.title}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_BG[task.priority]} ${PRIORITY_TEXT[task.priority]}`}>
                        {task.priority}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${task.status === 'In Progress' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {task.status}
                      </span>
                    </Link>
                  ))}
                  {group.tasks.length > 3 && (
                    <Link
                      href={`/dashboard/${group.collection}/${group.projectId}/tasks`}
                      className="block px-5 py-2 text-xs font-medium text-blue-600 hover:bg-slate-50 transition-colors"
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

      {/* ── Up next ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Up next</h3>
          <Link href="/dashboard/schedule" className="text-sm font-semibold text-blue-600">See all</Link>
        </div>
        <p className="text-sm text-slate-500">
          {bookings.length === 0
            ? 'No upcoming bookings on your schedule.'
            : `${bookings.length} bookings scheduled. Open Schedule for day-by-day detail.`}
        </p>
      </section>
    </div>
  )
}
