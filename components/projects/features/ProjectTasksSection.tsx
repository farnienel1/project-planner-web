/**
 * iOS parity source: Views/ProjectDetailView.swift tasksContent ~L2299–2462, Models/ProjectTask.swift
 * Spec: docs/ios-parity/sections/16-job-tiles.md
 */
'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { isOperativeMode } from '@/lib/navigation/menuPermissions'
import { canManageWorkCatalogue } from '@/lib/permissions'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { ErrorBanner, LoadingSpinner } from '@/components/dashboard/PageShell'
import { FormInput, FormLabel, FormSelect, FormTextarea } from '@/components/forms/FormShell'
import {
  FeatureCard,
  FeatureScreen,
  FilterChipsRow,
} from '@/components/projects/features/featureUi'
import {
  PROJECT_TASK_SCOPES,
  emptyCopyForScope,
  filterTasksForScope,
  isTaskOverdue,
  taskScopeCounts,
  taskStatCounts,
  type ProjectTaskListScope,
} from '@/lib/tasks/projectTaskFilters'
import type { Project, ProjectTask, ProjectTaskPriority, ProjectTaskStatus } from '@/types'

const PRIORITY_CONFIG: Record<ProjectTaskPriority, { label: string; bg: string; text: string }> = {
  Low: { label: 'Low', bg: 'bg-slate-100', text: 'text-slate-600' },
  Normal: { label: 'Normal', bg: 'bg-blue-50', text: 'text-blue-700' },
  High: { label: 'High', bg: 'bg-amber-50', text: 'text-amber-700' },
  Urgent: { label: 'Urgent', bg: 'bg-red-50', text: 'text-red-700' },
}

function TaskRow({
  task,
  onStatusChange,
  onDelete,
}: {
  task: ProjectTask
  onStatusChange: (task: ProjectTask, status: ProjectTaskStatus) => void
  onDelete: (task: ProjectTask) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.Normal
  const overdue = isTaskOverdue(task)

  return (
    <FeatureCard className="overflow-hidden">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full px-4 py-3 text-left">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">{task.title}</p>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${priority.bg} ${priority.text}`}>
            {priority.label}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
          {task.dueDate && (
            <span className={overdue ? 'font-semibold text-red-600' : ''}>{format(task.dueDate, 'd MMM')}</span>
          )}
          <span>{task.status}</span>
        </div>
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3">
          {task.details && <p className="text-sm text-slate-600">{task.details}</p>}
          <div className="flex flex-wrap gap-1.5">
            {(['To Do', 'In Progress', 'Completed'] as ProjectTaskStatus[])
              .filter((status) => status !== task.status)
              .map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => onStatusChange(task, status)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  {status === 'Completed' ? 'Complete' : status}
                </button>
              ))}
            <button
              type="button"
              onClick={() => onDelete(task)}
              className="ml-auto rounded-lg border border-red-100 px-2.5 py-1 text-xs font-medium text-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </FeatureCard>
  )
}

function AddTaskForm({
  people,
  onAdd,
  onCancel,
}: {
  people: { id: string; label: string; kind: 'operative' | 'manager' }[]
  onAdd: (input: {
    title: string
    details: string
    priority: ProjectTaskPriority
    dueDate: Date
    assigneeId: string
    assigneeKind: 'operative' | 'manager'
  }) => Promise<void>
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [priority, setPriority] = useState<ProjectTaskPriority>('Normal')
  const [dueDate, setDueDate] = useState('')
  const [assignee, setAssignee] = useState('')
  const [saving, setSaving] = useState(false)
  const selected = people.find((row) => `${row.kind}:${row.id}` === assignee)
  const canSubmit = Boolean(title.trim() && selected && dueDate)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selected || !dueDate) return
    setSaving(true)
    await onAdd({
      title,
      details,
      priority,
      dueDate: new Date(`${dueDate}T00:00:00`),
      assigneeId: selected.id,
      assigneeKind: selected.kind,
    })
    setSaving(false)
  }

  return (
    <FeatureCard className="p-5">
      <h3 className="text-sm font-semibold text-slate-900">Create a new task</h3>
      <p className="mt-1 text-xs text-slate-500">Assign to a manager or operative</p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <FormLabel>Title</FormLabel>
          <FormInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Replace fuse board"
            required
            autoFocus
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Keep titles short and action-led — &quot;Replace fuse board&quot; not &quot;Some work to do&quot;.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FormLabel>Assignee</FormLabel>
            <FormSelect value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Select person</option>
              {people.map((row) => (
                <option key={`${row.kind}:${row.id}`} value={`${row.kind}:${row.id}`}>
                  {row.label}
                </option>
              ))}
            </FormSelect>
          </div>
          <div>
            <FormLabel>Due date</FormLabel>
            <FormInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            <p className="mt-1 text-[11px] text-slate-400">Every task must have a due date.</p>
          </div>
          <div>
            <FormLabel>Priority</FormLabel>
            <FormSelect value={priority} onChange={(e) => setPriority(e.target.value as ProjectTaskPriority)}>
              {(['Low', 'Normal', 'High', 'Urgent'] as ProjectTaskPriority[]).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </FormSelect>
          </div>
        </div>
        <div>
          <FormLabel>Details (optional)</FormLabel>
          <FormTextarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} />
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || !canSubmit}
            className="rounded-xl bg-[#185FA5] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : canSubmit ? 'Create task' : 'Add a title and assignee to continue'}
          </button>
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-5 py-2 text-sm">
            Cancel
          </button>
        </div>
      </form>
    </FeatureCard>
  )
}

export function ProjectTasksSection({ project }: { project: Project }) {
  const { organization, user } = useAuthStore()
  const { tasks, loading, error, loadTasks, saveTask, deleteTask } = useTaskStore()
  const { operatives, managers, loadOperatives, loadManagers } = useOperativeStore()
  const [showForm, setShowForm] = useState(false)
  const [scope, setScope] = useState<ProjectTaskListScope>('assignedToMe')
  const [search, setSearch] = useState('')
  const isOperative = isOperativeMode(user)
  const canViewAll = canManageWorkCatalogue(user, 'projects') || canManageWorkCatalogue(user, 'smallWorks')

  useEffect(() => {
    if (organization?.id) {
      loadTasks(organization.id)
      loadOperatives(organization.id)
      loadManagers(organization.id)
    }
  }, [organization, loadTasks, loadOperatives, loadManagers])

  const projectTasks = useMemo(
    () => tasks.filter((t) => t.projectId.toLowerCase() === project.id.toLowerCase()),
    [tasks, project.id]
  )

  const filterOpts = {
    userEmail: user?.email,
    user: user ? { email: user.email, firstName: user.firstName, surname: user.surname } : null,
    operatives,
    managers,
    operativeMode: isOperative,
  }

  const visibleBase = useMemo(() => {
    if (canViewAll) return projectTasks
    return projectTasks.filter((task) =>
      filterTasksForScope([task], 'assignedToMe', filterOpts).length > 0
    )
  }, [canViewAll, projectTasks, filterOpts.userEmail, filterOpts.operativeMode, operatives, managers, user])

  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase()
    return filterTasksForScope(visibleBase, scope, filterOpts).filter((task) => {
      if (!q) return true
      return task.title.toLowerCase().includes(q) || (task.details || '').toLowerCase().includes(q)
    })
  }, [visibleBase, scope, search, filterOpts.userEmail, filterOpts.operativeMode, operatives, managers])

  const counts = taskScopeCounts(visibleBase, filterOpts)
  const stats = taskStatCounts(visibleBase)
  const empty = emptyCopyForScope(scope)

  const people = useMemo(() => {
    const ops = operatives.map((row) => ({
      id: row.id,
      label: `${row.firstName} ${row.lastName}`.trim() || row.email,
      kind: 'operative' as const,
    }))
    const mgrs = managers.map((row) => ({
      id: row.id,
      label: `${row.firstName} ${row.lastName}`.trim() || row.email,
      kind: 'manager' as const,
    }))
    return [...mgrs, ...ops]
  }, [operatives, managers])

  const handleAdd = async (input: {
    title: string
    details: string
    priority: ProjectTaskPriority
    dueDate: Date
    assigneeId: string
    assigneeKind: 'operative' | 'manager'
  }) => {
    if (!organization?.id || !user) return
    await saveTask({
      id: newUuid(),
      organizationId: organization.id,
      projectId: project.id,
      title: input.title.trim(),
      details: input.details.trim() || undefined,
      createdBy: `${user.firstName} ${user.surname}`.trim() || user.email,
      status: 'To Do',
      priority: input.priority,
      dueDate: input.dueDate,
      assignedOperativeId: input.assigneeKind === 'operative' ? input.assigneeId : undefined,
      assignedManagerId: input.assigneeKind === 'manager' ? input.assigneeId : undefined,
      assignedOperativeIds: input.assigneeKind === 'operative' ? [input.assigneeId] : [],
      assignedManagerIds: input.assigneeKind === 'manager' ? [input.assigneeId] : [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    setShowForm(false)
  }

  const handleStatusChange = async (task: ProjectTask, status: ProjectTaskStatus) => {
    await saveTask({
      ...task,
      status,
      completedAt: status === 'Completed' ? new Date() : undefined,
      completedBy: status === 'Completed' ? user?.email : undefined,
      updatedAt: new Date(),
    })
  }

  const handleDelete = async (task: ProjectTask) => {
    if (!organization?.id) return
    if (!window.confirm(`Delete "${task.title}"?`)) return
    await deleteTask(organization.id, task.id)
  }

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBanner message={error} />

  const chips = PROJECT_TASK_SCOPES.map((item) => ({
    id: item.id,
    label: item.label,
    count: item.id === 'assignedToMe' ? undefined : counts[item.id],
  }))

  return (
    <FeatureScreen>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#185FA5] text-white shadow-md"
          aria-label="Create a task"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'To do', count: stats.todo, color: 'text-slate-800' },
          { label: 'In progress', count: stats.inProgress, color: 'text-blue-800' },
          { label: 'Overdue', count: stats.overdue, color: 'text-red-700' },
          { label: 'Done', count: stats.done, color: 'text-emerald-800' },
        ].map((item) => (
          <FeatureCard key={item.label} className="px-3 py-3 text-center">
            <p className={`text-[18px] font-medium ${item.color}`}>{item.count}</p>
            <p className="text-[10px] text-slate-500">{item.label}</p>
          </FeatureCard>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks…"
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none"
        />
      </div>

      <div className="mt-3">
        <FilterChipsRow chips={chips} selected={scope} onSelect={setScope} />
      </div>

      {showForm && (
        <div className="mt-4">
          <AddTaskForm people={people} onAdd={handleAdd} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div className="mt-4 space-y-2">
        {scoped.length === 0 && !showForm ? (
          <FeatureCard className="py-12 text-center">
            <p className="text-sm font-semibold text-slate-800">{empty.title}</p>
            <p className="mt-1 px-6 text-xs text-slate-500">{empty.subtitle}</p>
            {scope === 'active' && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-4 text-sm font-semibold text-[#185FA5]"
              >
                Create a task
              </button>
            )}
          </FeatureCard>
        ) : (
          scoped.map((task) => (
            <TaskRow key={task.id} task={task} onStatusChange={handleStatusChange} onDelete={handleDelete} />
          ))
        )}
      </div>
    </FeatureScreen>
  )
}
