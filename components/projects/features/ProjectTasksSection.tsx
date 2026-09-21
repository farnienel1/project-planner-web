/**
 * iOS parity source: Views/ProjectDetailView.swift tasksContent ~L2299–2462, Models/ProjectTask.swift
 * Spec: docs/ios-parity/sections/16-job-tiles.md
 */
'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FunnelIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/solid'
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/lib/stores/authStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { isOperativeMode } from '@/lib/navigation/menuPermissions'
import { canManageWorkCatalogue, hasAdminAccess } from '@/lib/permissions'
import { ErrorBanner, LoadingSpinner } from '@/components/dashboard/PageShell'
import { FeatureCard, FeatureScreen, FilterChipsRow } from '@/components/projects/features/featureUi'
import { AddProjectTaskSheet } from '@/components/projects/tasks/AddProjectTaskSheet'
import { ProjectTaskDetailSheet } from '@/components/projects/tasks/ProjectTaskDetailSheet'
import { ProjectTaskFilterSheet } from '@/components/projects/tasks/ProjectTaskFilterSheet'
import { ProjectTaskRow } from '@/components/projects/tasks/ProjectTaskRow'
import {
  EMPTY_JOB_TASK_FILTER,
  PROJECT_TASK_SCOPES,
  applyJobTaskFilter,
  emptyCopyForScope,
  filterTasksForScope,
  isAssignedToUser,
  jobTaskFilterDescription,
  taskScopeCounts,
  taskStatCounts,
  type JobTaskFilter,
  type ProjectTaskListScope,
} from '@/lib/tasks/projectTaskFilters'
import type { Project, ProjectTask, ProjectTaskStatus } from '@/types'

export function ProjectTasksSection({ project }: { project: Project }) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ProjectTasksSectionInner project={project} />
    </Suspense>
  )
}

function ProjectTasksSectionInner({ project }: { project: Project }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const taskParam = searchParams.get('task')
  const { organization, user } = useAuthStore()
  const { tasks, loading, error, loadTasks, saveTask, deleteTask } = useTaskStore()
  const { operatives, managers, loadOperatives, loadManagers } = useOperativeStore()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ProjectTask | null>(null)
  const [openTask, setOpenTask] = useState<ProjectTask | null>(null)
  const [showFilter, setShowFilter] = useState(false)
  const [taskFilter, setTaskFilter] = useState<JobTaskFilter>(EMPTY_JOB_TASK_FILTER)
  const [scope, setScope] = useState<ProjectTaskListScope>('assignedToMe')
  const [search, setSearch] = useState('')
  const isOperative = isOperativeMode(user)
  const canViewAll = canManageWorkCatalogue(user, 'projects') || canManageWorkCatalogue(user, 'smallWorks')
  const canEdit = Boolean(user && (hasAdminAccess(user) || user.permissions.manager) && !isOperative)

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

  useEffect(() => {
    if (!taskParam) return
    const match = projectTasks.find((task) => task.id === taskParam)
    if (match) setOpenTask(match)
  }, [taskParam, projectTasks])

  const closeOpenTask = () => {
    setOpenTask(null)
    if (!taskParam) return
    router.replace(pathname, { scroll: false })
  }

  const filterOpts = {
    userEmail: user?.email,
    user: user ? { email: user.email, firstName: user.firstName, surname: user.surname } : null,
    operatives,
    managers,
    operativeMode: isOperative,
  }

  const visibleBase = useMemo(() => {
    const filtered = applyJobTaskFilter(projectTasks, taskFilter)
    if (canViewAll) return filtered
    return filtered.filter((task) =>
      isAssignedToUser(task, filterOpts.userEmail, operatives, managers, isOperative)
    )
  }, [canViewAll, projectTasks, taskFilter, filterOpts.userEmail, filterOpts.operativeMode, operatives, managers, user, isOperative])

  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase()
    return filterTasksForScope(visibleBase, scope, filterOpts)
      .filter((task) => {
        if (!q) return true
        return task.title.toLowerCase().includes(q) || (task.details || '').toLowerCase().includes(q)
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }, [visibleBase, scope, search, filterOpts.userEmail, filterOpts.operativeMode, operatives, managers, isOperative])

  const counts = taskScopeCounts(visibleBase, filterOpts)
  const stats = taskStatCounts(visibleBase)
  const empty = emptyCopyForScope(scope)
  const liveOpenTask = openTask ? scoped.find((row) => row.id === openTask.id) || projectTasks.find((row) => row.id === openTask.id) || openTask : null

  const handleSaveForm = async (input: {
    id: string
    title: string
    details?: string
    priority: ProjectTask['priority']
    dueDate: Date
    assignedManagerIds: string[]
    assignedOperativeIds: string[]
    items: NonNullable<ProjectTask['items']>
    attachedImageURLs: string[]
    attachedFileURL?: string
    attachedFileName?: string
    attachedSiteAuditId?: string
    attachedSiteAuditTitle?: string
  }) => {
    if (!organization?.id || !user) return
    const existing = editing
    await saveTask({
      id: input.id,
      organizationId: organization.id,
      projectId: project.id,
      title: input.title,
      details: input.details,
      createdBy: existing?.createdBy || `${user.firstName} ${user.surname}`.trim() || user.email,
      status: existing?.status || 'To Do',
      priority: input.priority,
      dueDate: input.dueDate,
      assignedOperativeId: input.assignedOperativeIds[0],
      assignedManagerId: input.assignedManagerIds[0],
      assignedOperativeIds: input.assignedOperativeIds,
      assignedManagerIds: input.assignedManagerIds,
      items: input.items,
      completedItemIds: existing?.completedItemIds || [],
      attachedImageURLs: input.attachedImageURLs,
      attachedFileURL: input.attachedFileURL,
      attachedFileName: input.attachedFileName,
      attachedSiteAuditId: input.attachedSiteAuditId,
      attachedSiteAuditTitle: input.attachedSiteAuditTitle,
      completedBy: existing?.completedBy,
      completedAt: existing?.completedAt,
      completionNotes: existing?.completionNotes,
      completionImages: existing?.completionImages,
      completionFiles: existing?.completionFiles,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    })
    setShowForm(false)
    setEditing(null)
  }

  const handleStatusChange = async (task: ProjectTask, status: ProjectTaskStatus) => {
    await saveTask({
      ...task,
      status,
      completedAt: status === 'Completed' ? task.completedAt || new Date() : undefined,
      completedBy: status === 'Completed' ? task.completedBy || user?.email : undefined,
      updatedAt: new Date(),
    })
  }

  const handleComplete = async (
    task: ProjectTask,
    input: {
      completionNotes?: string
      completionImages: string[]
      completionFiles: { name: string; url: string }[]
    }
  ) => {
    const display = user ? `${user.firstName} ${user.surname}`.trim() || user.email : 'Unknown'
    await saveTask({
      ...task,
      status: 'Completed',
      completedAt: new Date(),
      completedBy: display,
      completionNotes: input.completionNotes,
      completionImages: input.completionImages,
      completionFiles: input.completionFiles,
      updatedAt: new Date(),
    })
  }

  const handleToggleItem = async (task: ProjectTask, itemId: string) => {
    const current = new Set(task.completedItemIds || [])
    if (current.has(itemId)) current.delete(itemId)
    else current.add(itemId)
    await saveTask({ ...task, completedItemIds: [...current], updatedAt: new Date() })
  }

  const handleDelete = async (task: ProjectTask) => {
    if (!organization?.id) return
    if (!window.confirm(`Delete "${task.title}"?`)) return
    await deleteTask(organization.id, task.id)
    closeOpenTask()
  }

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBanner message={error} />

  const chips = PROJECT_TASK_SCOPES.map((item) => {
    if (item.id === 'assignedToMe') return { id: item.id, label: item.label }
    if (item.id === 'active') return { id: item.id, label: item.label, count: counts.active }
    if ((item.id === 'overdue' || item.id === 'completed') && counts[item.id] > 0) {
      return { id: item.id, label: item.label, count: counts[item.id] }
    }
    return { id: item.id, label: item.label }
  })

  return (
    <FeatureScreen>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--blue)] text-white shadow-md"
          aria-label="Create a task"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'To do', count: stats.todo, color: 'text-[#6B7280]' },
          { label: 'In progress', count: stats.inProgress, color: 'text-[#854F0B]' },
          { label: 'Overdue', count: stats.overdue, color: 'text-[#A32D2D]' },
          { label: 'Done', count: stats.done, color: 'text-[#0F6E56]' },
        ].map((item) => (
          <FeatureCard key={item.label} className="px-3 py-2.5 text-center">
            <p className={`text-[18px] font-medium ${item.color}`}>{item.count}</p>
            <p className="text-[10px] text-[#6B7280]">{item.label}</p>
          </FeatureCard>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2">
        <MagnifyingGlassIcon className="h-4 w-4 text-[#6B7280]" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks…"
          className="flex-1 bg-transparent text-xs outline-none"
        />
        <button
          type="button"
          disabled={isOperative}
          onClick={() => setShowFilter(true)}
          className={`text-[var(--blue)] ${isOperative ? 'opacity-35' : ''}`}
          aria-label="Task filters"
        >
          <FunnelIcon className="h-[15px] w-[15px]" />
        </button>
      </div>

      {!isOperative && (
        <p className="mt-2 text-[10px] text-[#6B7280]">{jobTaskFilterDescription(taskFilter, operatives, managers)}</p>
      )}

      <div className="mt-3">
        <FilterChipsRow chips={chips} selected={scope} onSelect={setScope} />
      </div>

      <div className="mt-4 space-y-2.5">
        {scoped.length === 0 && !showForm ? (
          <FeatureCard className="py-8 text-center">
            <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-[18px] bg-[var(--blue-t)]">
              <ClipboardDocumentListIcon className="h-7 w-7 text-[var(--blue)]" />
            </div>
            <p className="text-[15px] font-medium text-[#0B1020]">{empty.title}</p>
            <p className="mt-1 px-6 text-xs text-[#6B7280]">{empty.subtitle}</p>
            {scope === 'active' && (
              <button
                type="button"
                onClick={() => {
                  setEditing(null)
                  setShowForm(true)
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--blue)] px-[18px] py-2.5 text-[13px] font-medium text-white"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Create a task
              </button>
            )}
          </FeatureCard>
        ) : (
          scoped.map((task) => (
            <ProjectTaskRow
              key={task.id}
              task={task}
              operatives={operatives}
              managers={managers}
              canEdit={canEdit}
              onOpen={() => setOpenTask(task)}
              onEdit={() => {
                setEditing(task)
                setShowForm(true)
              }}
            />
          ))
        )}
      </div>

      {showForm && (
        <AddProjectTaskSheet
          project={project}
          people={{ operatives, managers }}
          existing={editing}
          onSave={handleSaveForm}
          onClose={() => {
            setShowForm(false)
            setEditing(null)
          }}
        />
      )}

      {showFilter && (
        <ProjectTaskFilterSheet
          filter={taskFilter}
          operatives={operatives}
          managers={managers}
          onApply={(next) => {
            if (next.type === 'operative' && !next.operativeId) next.operativeId = operatives[0]?.id
            if (next.type === 'manager' && !next.managerId) next.managerId = managers[0]?.id
            setTaskFilter(next)
          }}
          onClose={() => setShowFilter(false)}
        />
      )}

      {liveOpenTask && (
        <ProjectTaskDetailSheet
          task={liveOpenTask}
          operatives={operatives}
          managers={managers}
          canEdit={canEdit}
          canDelete={canEdit}
          siteAuditHref={
            liveOpenTask.attachedSiteAuditId
              ? pathname.replace(/\/tasks\/?$/, '/site-audit')
              : null
          }
          onClose={closeOpenTask}
          onStatusChange={(status) => void handleStatusChange(liveOpenTask, status)}
          onToggleItem={(itemId) => void handleToggleItem(liveOpenTask, itemId)}
          onComplete={(input) => handleComplete(liveOpenTask, input)}
          onEdit={
            canEdit
              ? () => {
                  closeOpenTask()
                  setEditing(liveOpenTask)
                  setShowForm(true)
                }
              : undefined
          }
          onDelete={() => void handleDelete(liveOpenTask)}
        />
      )}
    </FeatureScreen>
  )
}
