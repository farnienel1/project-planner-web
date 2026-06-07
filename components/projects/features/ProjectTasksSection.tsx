'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useMaterialProjectStore } from '@/lib/stores/materialProjectStore'
import { useWholesalerStore } from '@/lib/stores/wholesalerStore'
import { useSiteAuditStore } from '@/lib/stores/siteAuditStore'
import { useHealthSafetyStore } from '@/lib/stores/healthSafetyStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { EmptyState, ErrorBanner, LoadingSpinner } from '@/components/dashboard/PageShell'
import { FormInput, FormLabel, FormSelect, FormTextarea } from '@/components/forms/FormShell'
import { uploadFile, healthSafetyFilePath, siteAuditImagePath } from '@/lib/firebase/storageUtils'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import type { Project, ProjectTask, ProjectTaskPriority, ProjectTaskStatus } from '@/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<ProjectTaskPriority, { label: string; bg: string; text: string; dot: string }> = {
  Low:    { label: 'Low',    bg: 'bg-slate-100',   text: 'text-slate-600',  dot: 'bg-slate-400' },
  Normal: { label: 'Normal', bg: 'bg-blue-50',     text: 'text-blue-700',   dot: 'bg-blue-500' },
  High:   { label: 'High',   bg: 'bg-amber-50',    text: 'text-amber-700',  dot: 'bg-amber-500' },
  Urgent: { label: 'Urgent', bg: 'bg-red-50',      text: 'text-red-700',    dot: 'bg-red-500' },
}

const STATUS_COLUMNS: { status: ProjectTaskStatus; label: string; icon: string; headerBg: string; headerText: string }[] = [
  { status: 'To Do',       label: 'To Do',       icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',                                          headerBg: 'bg-slate-100',  headerText: 'text-slate-700' },
  { status: 'In Progress', label: 'In Progress', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', headerBg: 'bg-blue-100',   headerText: 'text-blue-800' },
  { status: 'Completed',   label: 'Completed',   icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',                                         headerBg: 'bg-emerald-100', headerText: 'text-emerald-800' },
]

// ─── Task Card ───────────────────────────────────────────────────────────────

function TaskCard({
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

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Card header */}
      <div
        className="cursor-pointer px-4 py-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="flex-1 text-sm font-semibold text-slate-900 leading-snug">{task.title}</p>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${priority.bg} ${priority.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} />
            {priority.label}
          </span>
        </div>
        {task.details && !expanded && (
          <p className="mt-1 line-clamp-1 text-xs text-slate-500">{task.details}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {task.dueDate && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-500">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {format(task.dueDate, 'd MMM')}
            </span>
          )}
          <span className="text-[11px] text-slate-400">by {task.createdBy.split('@')[0]}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3">
          {task.details && (
            <p className="text-sm text-slate-600 leading-relaxed">{task.details}</p>
          )}
          {task.completionNotes && (
            <div className="rounded-lg bg-emerald-50 px-3 py-2">
              <p className="text-xs font-semibold text-emerald-700 mb-0.5">Completion notes</p>
              <p className="text-xs text-emerald-800">{task.completionNotes}</p>
            </div>
          )}
          {task.completedAt && (
            <p className="text-xs text-slate-400">
              Completed {format(task.completedAt, 'd MMM yyyy')}
              {task.completedBy ? ` · ${task.completedBy.split('@')[0]}` : ''}
            </p>
          )}

          {/* Status change buttons */}
          <div className="flex flex-wrap gap-1.5">
            {STATUS_COLUMNS.filter((c) => c.status !== task.status).map((col) => (
              <button
                key={col.status}
                type="button"
                onClick={() => onStatusChange(task, col.status)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                → {col.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onDelete(task)}
              className="ml-auto rounded-lg border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Kanban Column ───────────────────────────────────────────────────────────

function KanbanColumn({
  column,
  tasks,
  onStatusChange,
  onDelete,
}: {
  column: typeof STATUS_COLUMNS[number]
  tasks: ProjectTask[]
  onStatusChange: (task: ProjectTask, status: ProjectTaskStatus) => void
  onDelete: (task: ProjectTask) => void
}) {
  return (
    <div className="flex flex-col min-w-0">
      {/* Column header */}
      <div className={`mb-3 flex items-center justify-between rounded-xl px-3 py-2 ${column.headerBg}`}>
        <div className="flex items-center gap-2">
          <svg className={`h-4 w-4 ${column.headerText}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={column.icon} />
          </svg>
          <span className={`text-xs font-bold uppercase tracking-wide ${column.headerText}`}>{column.label}</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${column.headerBg} ${column.headerText}`}>
          {tasks.length}
        </span>
      </div>

      {/* Task cards */}
      <div className="flex flex-col gap-2.5 flex-1">
        {tasks.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 px-4 py-6 text-center">
            <p className="text-xs text-slate-400">No tasks</p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Add Task Form ────────────────────────────────────────────────────────────

function AddTaskForm({
  onAdd,
  onCancel,
}: {
  onAdd: (title: string, details: string, priority: ProjectTaskPriority) => Promise<void>
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [priority, setPriority] = useState<ProjectTaskPriority>('Normal')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    await onAdd(title, details, priority)
    setSaving(false)
    setTitle('')
    setDetails('')
    setPriority('Normal')
    onCancel()
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5">
        <h3 className="text-sm font-semibold text-slate-900">New task</h3>
      </div>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormLabel>Task title</FormLabel>
            <FormInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
              autoFocus
            />
          </div>
          <div>
            <FormLabel>Priority</FormLabel>
            <FormSelect
              value={priority}
              onChange={(e) => setPriority(e.target.value as ProjectTaskPriority)}
            >
              {(['Low', 'Normal', 'High', 'Urgent'] as ProjectTaskPriority[]).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </FormSelect>
          </div>
        </div>
        <div>
          <FormLabel>Details (optional)</FormLabel>
          <FormTextarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Add more context or instructions…"
            rows={3}
          />
        </div>
        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
          >
            {saving ? 'Adding…' : 'Add task'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Main Tasks Section ───────────────────────────────────────────────────────

export function ProjectTasksSection({ project }: { project: Project }) {
  const { organization, user } = useAuthStore()
  const { tasks, loading, error, loadTasks, saveTask, deleteTask } = useTaskStore()
  const [showForm, setShowForm] = useState(false)
  const [view, setView] = useState<'board' | 'list'>('board')

  useEffect(() => {
    if (organization?.id) loadTasks(organization.id)
  }, [organization, loadTasks])

  const projectTasks = useMemo(
    () => tasks.filter((t) => t.projectId === project.id),
    [tasks, project.id]
  )

  const tasksByStatus = useMemo(() => {
    const grouped: Record<ProjectTaskStatus, ProjectTask[]> = { 'To Do': [], 'In Progress': [], Completed: [] }
    projectTasks.forEach((t) => { grouped[t.status]?.push(t) })
    return grouped
  }, [projectTasks])

  const counts = {
    total: projectTasks.length,
    todo: tasksByStatus['To Do'].length,
    inProgress: tasksByStatus['In Progress'].length,
    done: tasksByStatus['Completed'].length,
  }

  const handleAdd = async (title: string, details: string, priority: ProjectTaskPriority) => {
    if (!organization?.id || !user) return
    await saveTask({
      id: newUuid(),
      organizationId: organization.id,
      projectId: project.id,
      title: title.trim(),
      details: details.trim() || undefined,
      createdBy: user.email,
      status: 'To Do',
      priority,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
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

  return (
    <div className="space-y-5">

      {/* Summary bar */}
      {counts.total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'To do',      count: counts.todo,       bg: 'bg-slate-100',   text: 'text-slate-700' },
            { label: 'In progress', count: counts.inProgress, bg: 'bg-blue-50',    text: 'text-blue-800' },
            { label: 'Completed',  count: counts.done,        bg: 'bg-emerald-50', text: 'text-emerald-800' },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl px-4 py-3 ${s.bg}`}>
              <p className={`text-2xl font-bold leading-none ${s.text}`}>{s.count}</p>
              <p className={`mt-1 text-xs font-medium ${s.text} opacity-75`}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        {/* View toggle */}
        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
          {(['board', 'list'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all capitalize ${
                view === v
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {v === 'board' ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              )}
              {v}
            </button>
          ))}
        </div>

        {/* Add task button */}
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add task
          </button>
        )}
      </div>

      {/* Add task form */}
      {showForm && (
        <AddTaskForm onAdd={handleAdd} onCancel={() => setShowForm(false)} />
      )}

      {/* Empty state */}
      {counts.total === 0 && !showForm && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 px-8 py-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">No tasks yet</p>
          <p className="mt-1 text-xs text-slate-400">Add tasks to track work for this project.</p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create first task
          </button>
        </div>
      )}

      {/* Board view */}
      {view === 'board' && counts.total > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STATUS_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.status}
              column={col}
              tasks={tasksByStatus[col.status]}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* List view */}
      {view === 'list' && counts.total > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {STATUS_COLUMNS.map((col, ci) => (
            tasksByStatus[col.status].length > 0 && (
              <div key={col.status}>
                {ci > 0 && <div className="border-t border-slate-100" />}
                <div className={`px-5 py-2.5 ${col.headerBg}`}>
                  <span className={`text-[11px] font-bold uppercase tracking-widest ${col.headerText}`}>{col.label} · {tasksByStatus[col.status].length}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {tasksByStatus[col.status].map((task) => {
                    const pr = PRIORITY_CONFIG[task.priority]
                    return (
                      <div key={task.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{task.title}</p>
                          {task.details && <p className="mt-0.5 text-xs text-slate-500 truncate">{task.details}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {task.dueDate && (
                            <span className="text-[11px] text-slate-400">{format(task.dueDate, 'd MMM')}</span>
                          )}
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${pr.bg} ${pr.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${pr.dot}`} />
                            {pr.label}
                          </span>
                          <div className="flex gap-1">
                            {STATUS_COLUMNS.filter((c) => c.status !== task.status).map((c) => (
                              <button
                                key={c.status}
                                type="button"
                                onClick={() => handleStatusChange(task, c.status)}
                                className="rounded-lg border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 transition-colors"
                              >
                                {c.status === 'To Do' ? 'Reopen' : c.status === 'In Progress' ? 'Start' : 'Complete'}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => handleDelete(task)}
                              className="rounded-lg border border-red-100 px-2 py-0.5 text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}
