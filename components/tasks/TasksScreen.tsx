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
  getTaskDetailHref,
  isTaskAssignedToUser,
  isTaskOverdue,
  resolveProjectName,
  type TaskListFilter,
} from '@/lib/tasks/taskUtils'
import { hasAdminAccess, isOperativeMode } from '@/lib/navigation/menuPermissions'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import type { HolidayBooking, ProjectTask, ProjectTaskStatus } from '@/types'

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
    <div className="card pad" data-hue="leave">
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
          <p className="mt-0.5 text-sm font-medium">{requesterName}</p>
          <p className="mt-0.5 muted small">{formatDateRange(request.startDate, request.endDate, request.timeSlot)}</p>
          <span className="pill" data-hue="warn" style={{ marginTop: 8 }}>
            {isCancellation ? 'Cancellation pending' : 'Pending approval'}
          </span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onApprove}
          className="btn hue"
          data-hue="green"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDecline}
          className="btn danger"
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
  const hue = priority === 'Urgent' ? 'red' : 'task'

  const inner = (
    <>
      <span className="ico-chip">
        <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </span>
      <span className="grow">
        <span className="t">{task.title}</span>
        <span className="s">
          {projectName}
          {task.details ? ` · ${task.details}` : ''}
        </span>
      </span>
      <span className="row hide-sm" style={{ gap: 6 }}>
        <span className="pill" data-hue={task.status === 'Completed' ? 'green' : task.status === 'In Progress' ? 'daily' : 'lib'}>
          {status.label}
        </span>
        <span className="pill" data-hue={priority === 'Urgent' || priority === 'High' ? 'red' : 'lib'}>
          {priority}
        </span>
        {overdue ? (
          <span className="pill" data-hue="red">
            Overdue
          </span>
        ) : null}
        {task.dueDate ? (
          <span className="pill" data-hue="lib">
            Due {format(task.dueDate, 'd MMM yyyy')}
          </span>
        ) : null}
      </span>
    </>
  )

  if (href) {
    return (
      <Link href={href} className="ritem accent" data-hue={hue}>
        {inner}
      </Link>
    )
  }

  return (
    <div className="ritem accent" data-hue={hue} style={{ cursor: 'default' }}>
      {inner}
    </div>
  )
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
    <div className="stack" data-hue="task">
      <div className="phead" data-hue="task">
        <div className="badge-ico">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <div>
          <h1>Tasks</h1>
          <div className="sub">
            {showAllTasks
              ? `All project tasks and pending approvals for ${organization?.name || 'your organisation'}.`
              : 'Your assigned tasks and updates.'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {statTiles.map((tile) => {
          const isActive = tile.key !== 'approvals' && statusFilter === tile.key
          const hue = tile.key === 'overdue' ? 'red' : tile.key === 'inProgress' ? 'daily' : tile.key === 'completed' ? 'green' : tile.key === 'approvals' ? 'warn' : 'task'
          return (
            <button
              key={tile.key}
              type="button"
              data-hue={hue}
              onClick={() => {
                if (tile.key === 'approvals') {
                  scrollToApprovals()
                } else {
                  setStatusFilter(tile.key)
                }
              }}
              className={`stat ${isActive ? 'on' : ''}`}
            >
              <div>
                <b>{tile.count}</b>
                <span>{tile.label}</span>
              </div>
            </button>
          )
        })}
      </div>

      {pendingApprovals.length > 0 && (
        <section ref={approvalsRef} className="scroll-mt-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="h2">Holiday approvals</h2>
            {(hasAdminAccess(user) || user?.permissions.manager) && (
              <Link href="/dashboard/annual-leave/operatives" className="link">
                Manage all leave
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
            className="in"
            style={{ maxWidth: 420 }}
            aria-label="Search tasks or projects"
          />
        </div>

        {searchedTasks.length === 0 ? (
          <div className="empty card pad">
            <h3>
              {statusFilter === 'todo'
                ? 'No to do tasks — nice work!'
                : statusFilter === 'inProgress'
                  ? 'No tasks in progress.'
                  : statusFilter === 'completed'
                    ? 'No completed tasks yet.'
                    : statusFilter === 'overdue'
                      ? 'No overdue tasks.'
                      : 'No tasks match this filter.'}
            </h3>
            {tasks.length === 0 ? (
              <p>Tasks are created from a project&apos;s hub. Existing tasks keep their original editor when you open them.</p>
            ) : (
              <button type="button" className="btn" onClick={() => setStatusFilter('todo')}>
                Show open tasks
              </button>
            )}
            {tasks.length === 0 ? (
              <Link href="/dashboard/projects" className="btn primary">
                Go to projects
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {groupedTasks.map((group) => {
              const firstTask = group.tasks[0]
              const groupHref = firstTask ? getTaskProjectHref(firstTask, projects, smallWorks) : null
              return (
                <section key={group.projectId} className="card">
                  <div className="card-h" data-hue="proj">
                    <div className="ico-chip sm">
                      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h18M3 12h18M3 16.5h18" />
                      </svg>
                    </div>
                    <div className="grow">
                      <div className="eyebrow">Project</div>
                      {groupHref ? (
                        <Link href={groupHref} className="h2" style={{ fontSize: 17 }}>
                          {group.projectName}
                        </Link>
                      ) : (
                        <h2 className="h2" style={{ fontSize: 17 }}>{group.projectName}</h2>
                      )}
                    </div>
                    <span className="count soft">
                      {group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''}
                    </span>
                    {groupHref ? (
                      <Link href={groupHref} className="btn sm ghost">
                        Open project
                      </Link>
                    ) : null}
                  </div>
                  <div className="card-b rows">
                    {group.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        projectName={group.projectName}
                        href={getTaskDetailHref(task, projects, smallWorks)}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
