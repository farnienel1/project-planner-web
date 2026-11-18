/**
 * iOS parity source: Views/ProjectDetailView.swift ProjectTaskRow ~L2699
 */
'use client'

import { format } from 'date-fns'
import {
  CalendarDaysIcon,
  Cog6ToothIcon,
  IdentificationIcon,
  UserIcon,
} from '@heroicons/react/24/solid'
import { FeatureCard, StatusPill } from '@/components/projects/features/featureUi'
import { allAssignedManagerIds, allAssignedOperativeIds, isTaskOverdue } from '@/lib/tasks/projectTaskFilters'
import { taskAssigneeNames, taskPersonIndex, type TaskPersonIndex } from '@/lib/tasks/taskAssigneePeople'
import type { Manager, Operative, ProjectTask, ProjectTaskPriority, ProjectTaskStatus } from '@/types'

const PRIORITY_BG: Record<ProjectTaskPriority, string> = {
  Low: 'bg-slate-400',
  Normal: 'bg-[#3373F2]',
  High: 'bg-orange-500',
  Urgent: 'bg-red-500',
}

const STATUS_TONE: Record<ProjectTaskStatus, 'amber' | 'blue' | 'green'> = {
  'To Do': 'amber',
  'In Progress': 'blue',
  Completed: 'green',
}


export function ProjectTaskRow({
  task,
  operatives,
  managers,
  personIndex,
  canEdit,
  onOpen,
  onEdit,
}: {
  task: ProjectTask
  operatives: Operative[]
  managers: Manager[]
  /** One index for the list (`taskPersonIndex` with the organisation's users documents). */
  personIndex?: TaskPersonIndex
  canEdit: boolean
  onOpen: () => void
  onEdit: () => void
}) {
  // Owner decision 17 Nov: one name per person, however many of their records the task names (`taskAssigneeNames`).
  const assignedNames = taskAssigneeNames(
    { managerIds: allAssignedManagerIds(task), operativeIds: allAssignedOperativeIds(task) },
    { managers, operatives, index: personIndex ?? taskPersonIndex({ managers, operatives }) }
  )
  const operativeNames = assignedNames.filter((entry) => entry.kind === 'operative').map((entry) => entry.name)
  const managerNames = assignedNames.filter((entry) => entry.kind === 'manager').map((entry) => entry.name)
  const overdue = isTaskOverdue(task)

  return (
    <FeatureCard className="p-4">
      <div className="flex items-start gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="text-[15px] font-semibold text-slate-900">{task.title}</p>
        </button>
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white ${PRIORITY_BG[task.priority] || PRIORITY_BG.Normal}`}
        >
          {task.priority}
        </span>
        {canEdit && (
          <button type="button" onClick={onEdit} className="shrink-0 text-[var(--blue)]" aria-label="Edit task">
            <Cog6ToothIcon className="h-4 w-4" />
          </button>
        )}
        <StatusPill label={task.status} tone={STATUS_TONE[task.status] || 'grey'} />
      </div>
      <button type="button" onClick={onOpen} className="mt-1 w-full text-left">
        {task.details && <p className="text-[13px] text-slate-500">{task.details}</p>}
        <div className="mt-2 space-y-1 text-[11px] text-slate-500">
          {operativeNames.length > 0 && (
            <p className="flex items-center gap-1">
              <UserIcon className="h-3 w-3" />
              {operativeNames.join(', ')}
            </p>
          )}
          {managerNames.length > 0 && (
            <p className="flex items-center gap-1">
              <IdentificationIcon className="h-3 w-3" />
              {managerNames.join(', ')}
            </p>
          )}
          {task.dueDate && (
            <p className={`flex items-center gap-1 ${overdue ? 'font-semibold text-red-600' : ''}`}>
              <CalendarDaysIcon className="h-3 w-3" />
              {format(task.dueDate, 'd MMM yyyy')}
            </p>
          )}
        </div>
        <div className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-500">Created by {task.createdBy}</div>
      </button>
    </FeatureCard>
  )
}
