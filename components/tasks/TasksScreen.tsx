'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import {
  getPendingHolidayApprovalsForUser,
  isCancellationRequest,
} from '@/lib/annualLeave/holidayApprovalUtils'
import { resolvePersonName } from '@/lib/annualLeave/annualLeavePerson'
import {
  filterTasksForView,
  getTaskProjectHref,
  isTaskAssignedToUser,
  isTaskOverdue,
  resolveProjectName,
  type TaskListFilter,
} from '@/lib/tasks/taskUtils'
import { hasAdminAccess, isOperativeMode } from '@/lib/navigation/menuPermissions'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import type { HolidayBooking, ProjectTask, ProjectTaskPriority, ProjectTaskStatus } from '@/types'

const PRIORITY_DOT: Record<ProjectTaskPriority, string> = {
  Urgent: 'bg-red-500',
  High: 'bg-amber-500',
  Normal: 'bg-blue-500',
  Low: 'bg-slate-400',
}

const PRIORITY_TEXT: Record<ProjectTaskPriority, string> = {
  Urgent: 'text-red-700',
  High: 'text-amber-700',
  Normal: 'text-blue-700',
  Low: 'text-slate-600',
}

const PRIORITY_BG: Record<ProjectTaskPriority, string> = {
  Urgent: 'bg-red-50',
  High: 'bg-amber-50',
  Normal: 'bg-blue-50',
  Low: 'bg-slate-100',
}

const STATUS_STYLES: Record<ProjectTaskStatus, { badge: string; label: string }> = {
  'To Do': { badge: 'bg-slate-100 text-slate-700', label: 'To Do' },
  'In Progress': { badge: 'bg-blue-50 text-blue-700', label: 'In Progress' },
  Completed: { badge: 'bg-green-50 text-green-700', label: 'Completed' },
}

function formatDateRange(start: Date, end: Date, timeSlot: string): string {
  const sameDay = start.toDateString() === end.toDateString()
  const startLabel = format(start, 'd MMM yyyy')
  const endLabel = format(end, 'd MMM yyyy')
  const slot = timeSlot === 'FULL DAY' ? 'Full day' : timeSlot
  return sameDay ? `${startLabel} · ${slot}` : `${startLabel} – ${endLabel} · ${slot}`
}

function HolidayApprovalCard({
  request,
  requesterName,
  onApprove,
  onDecline,
  busy,
}: {
  request: HolidayBooking
  requesterName: string
  onApprove: () => void
  onDecline: () => void
  busy: boolean
}) {
  const isCancellation = isCancellationRequest(request)

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            {isCancellation ? 'Holiday cancellation request' : 'Annual leave request'}
          </p>
          <p className="mt-0.5 text-sm font-medium text-slate-800">{requesterName}</p>
          <p className="mt-0.5 text-xs text-slate-600">{formatDateRange(request.startDate, request.endDate, request.timeSlot)}</p>
          <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            {isCancellation ? 'Cancellation pending' : 'Pending approval'}
          </span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onApprove}
          className="rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDecline}
          className="rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          Decline
        </button>
      </div>
    </div>
  )
}

function TaskRow({
  task,
  projectName,
  href,
}: {
  task: ProjectTask
  projectName: string
  href: string | null
}) {
  const status = STATUS_STYLES[task.status] ?? STATUS_STYLES['To Do']
  const priority = task.priority ?? 'Normal'
  const overdue = isTaskOverdue(task)

  const inner = (
    <>
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${PRIORITY_DOT[priority] ?? 'bg-slate-400'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 truncate">{task.title}</p>
        <p className="mt-0.5 text-xs text-slate-500 truncate">{projectName}</p>
        {task.details && <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{task.details}</p>}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.badge}`}>{status.label}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_BG[priority]} ${PRIORITY_TEXT[priority]}`}
          >
            {priority}
          </span>
          {overdue && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Overdue</span>
          )}
          {task.dueDate && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              Due {format(task.dueDate, 'd MMM yyyy')}
            </span>
          )}
        </div>
      </div>
      {href && (
        <svg className="mt-1 h-4 w-4 shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </>
  )

  if (href) {
    return (
      <Link href={href} className="flex items-start gap-4 px-5 py-3.5 transition hover:bg-slate-50">
        {inner}
      </Link>
    )
  }

  return <div className="flex items-start gap-4 px-5 py-3.5">{inner}</div>
}

export function TasksScreen() {
  const { user, organization } = useAuthStore()
  const { tasks, loading: tasksLoading } = useTaskStore()
  const { bookings, saveBooking, deleteBooking } = useHolidayStore()
  const { projects, smallWorks } = useProjectStore()
  const { operatives, managers } = useOperativeStore()
  const { users } = useOrgUserStore()

  const [statusFilter, setStatusFilter] = useState<TaskListFilter>('todo')
  const [search, setSearch] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)
  const approvalsRef = useRef<HTMLElement>(null)

  const showAllTasks = !isOperativeMode(user)

  const pendingApprovals = useMemo(
    () => getPendingHolidayApprovalsForUser(bookings, user, users, operatives),
    [bookings, user, users, operatives]
  )

  const scopedTasks = useMemo(
    () => filterTasksForView(tasks, statusFilter, user, operatives, managers, showAllTasks),
    [tasks, statusFilter, user, operatives, managers, showAllTasks]
  )

  const searchedTasks = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return scopedTasks
    return scopedTasks.filter((task) => {
      if (task.title.toLowerCase().includes(q)) return true
      if ((task.details ?? '').toLowerCase().includes(q)) return true
      const projectName = resolveProjectName(task, projects, smallWorks).toLowerCase()
      return projectName.includes(q)
    })
  }, [scopedTasks, search, projects, smallWorks])

  const groupedTasks = useMemo(() => {
    const groups: Record<string, { projectId: string; projectName: string; tasks: ProjectTask[] }> = {}
    for (const task of searchedTasks) {
      const key = task.projectId || '__none__'
      if (!groups[key]) {
        groups[key] = {
          projectId: key,
          projectName: resolveProjectName(task, projects, smallWorks),
          tasks: [],
        }
      }
      groups[key].tasks.push(task)
    }
    return Object.values(groups).sort((a, b) => b.tasks.length - a.tasks.length)
  }, [searchedTasks, projects, smallWorks])

  const myTasks = useMemo(
    () => tasks.filter((t) => isTaskAssignedToUser(t, user, operatives, managers)),
    [tasks, user, operatives, managers]
  )

  const stats = useMemo(() => {
    const base = showAllTasks ? tasks : myTasks
    const incomplete = base.filter((t) => t.status !== 'Completed')
    return {
      todo: incomplete.filter((t) => t.status === 'To Do').length,
      inProgress: incomplete.filter((t) => t.status === 'In Progress').length,
      overdue: incomplete.filter((t) => isTaskOverdue(t)).length,
      completed: base.filter((t) => t.status === 'Completed').length,
      approvals: pendingApprovals.length,
    }
  }, [tasks, myTasks, showAllTasks, pendingApprovals.length])

  const approveHoliday = async (request: HolidayBooking) => {
    if (!organization?.id || !user) return
    setActionId(request.id)
    try {
      if (isCancellationRequest(request)) {
        await deleteBooking(organization.id, request.id)
      } else {
        await saveBooking(organization.id, {
          ...request,
          status: 'approved',
          approvedByUserId: user.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
      }
    } finally {
      setActionId(null)
    }
  }

  const declineHoliday = async (request: HolidayBooking) => {
    if (!organization?.id || !user) return
    setActionId(request.id)
    try {
      if (isCancellationRequest(request)) {
        await saveBooking(organization.id, {
          ...request,
          cancellationRequestedAt: undefined,
          cancellationRequestedByUserId: undefined,
          updatedAt: new Date(),
        })
      } else {
        await saveBooking(organization.id, {
          ...request,
          status: 'rejected',
          approvedByUserId: user.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
      }
    } finally {
      setActionId(null)
    }
  }

  if (tasksLoading && tasks.length === 0) {
    return <LoadingSpinner label="Loading tasks…" />
  }

  const statTiles: {
    key: TaskListFilter | 'approvals'
    label: string
    count: number
    color: string
    activeRing: string
  }[] = [
    { key: 'todo', label: 'To do', count: stats.todo, color: 'text-slate-700', activeRing: 'ring-slate-400' },
    { key: 'inProgress', label: 'In progress', count: stats.inProgress, color: stats.inProgress > 0 ? 'text-blue-700' : 'text-slate-500', activeRing: 'ring-blue-400' },
    { key: 'overdue', label: 'Overdue', count: stats.overdue, color: stats.overdue > 0 ? 'text-red-700' : 'text-slate-500', activeRing: 'ring-red-400' },
    { key: 'completed', label: 'Completed', count: stats.completed, color: stats.completed > 0 ? 'text-green-700' : 'text-slate-500', activeRing: 'ring-green-400' },
    { key: 'approvals', label: 'Approvals', count: stats.approvals, color: stats.approvals > 0 ? 'text-amber-700' : 'text-slate-500', activeRing: 'ring-amber-400' },
  ]

  const scrollToApprovals = () => {
    approvalsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tasks</h1>
        <p className="mt-1 text-sm text-slate-500">
          {showAllTasks
            ? `All project tasks and pending approvals for ${organization?.name || 'your organisation'}.`
            : 'Your assigned tasks and updates.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {statTiles.map((tile) => {
          const isActive = tile.key !== 'approvals' && statusFilter === tile.key
          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => {
                if (tile.key === 'approvals') {
                  scrollToApprovals()
                } else {
                  setStatusFilter(tile.key)
                }
              }}
              className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md ${
                isActive ? `border-slate-300 ring-2 ${tile.activeRing}` : 'border-slate-200'
              }`}
            >
              <p className={`text-xl font-bold ${tile.color}`}>{tile.count}</p>
              <p className="mt-0.5 text-xs text-slate-500">{tile.label}</p>
            </button>
          )
        })}
      </div>

      {pendingApprovals.length > 0 && (
        <section ref={approvalsRef} className="scroll-mt-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Holiday approvals</h2>
            {(hasAdminAccess(user) || user?.permissions.manager) && (
              <Link
                href="/dashboard/annual-leave/operatives"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Manage all leave →
              </Link>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {pendingApprovals.map((request) => (
              <HolidayApprovalCard
                key={request.id}
                request={request}
                requesterName={resolvePersonName(request, users, operatives)}
                onApprove={() => approveHoliday(request)}
                onDecline={() => declineHoliday(request)}
                busy={actionId === request.id}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks or projects…"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:max-w-md"
          />
        </div>

        {searchedTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-sm font-medium text-slate-500">
              {statusFilter === 'todo'
                ? 'No to do tasks — nice work!'
                : statusFilter === 'inProgress'
                  ? 'No tasks in progress.'
                  : statusFilter === 'completed'
                    ? 'No completed tasks yet.'
                    : statusFilter === 'overdue'
                      ? 'No overdue tasks.'
                      : 'No tasks match this filter.'}
            </p>
            {tasks.length === 0 && (
              <p className="mt-3 text-sm text-slate-500">
                Tasks are created from a project&apos;s hub in the iOS app or web project detail page.
              </p>
            )}
            {tasks.length === 0 && (
              <Link
                href="/dashboard/projects"
                className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Go to projects
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {groupedTasks.map((group) => {
              const firstTask = group.tasks[0]
              const groupHref = firstTask ? getTaskProjectHref(firstTask, projects, smallWorks) : null
              return (
                <div
                  key={group.projectId}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Project</p>
                      {groupHref ? (
                        <Link href={groupHref} className="text-sm font-semibold text-slate-900 hover:text-blue-600">
                          {group.projectName}
                        </Link>
                      ) : (
                        <p className="text-sm font-semibold text-slate-900">{group.projectName}</p>
                      )}
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      {group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {group.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        projectName={group.projectName}
                        href={getTaskProjectHref(task, projects, smallWorks)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
