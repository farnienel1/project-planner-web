/**
 * iOS parity source: CompletedTaskDetailView / ProjectTaskRow tap
 */
'use client'

import { format } from 'date-fns'
import { FeatureCard, StatusPill } from '@/components/projects/features/featureUi'
import type { ProjectTask, ProjectTaskStatus } from '@/types'

export function ProjectTaskDetailSheet({
  task,
  onStatusChange,
  onToggleItem,
  onDelete,
  onClose,
  canDelete,
}: {
  task: ProjectTask
  onStatusChange: (status: ProjectTaskStatus) => void
  onToggleItem: (itemId: string) => void
  onDelete: () => void
  onClose: () => void
  canDelete: boolean
}) {
  const items = task.items || []
  const completed = new Set(task.completedItemIds || [])
  const allTicked = items.length === 0 || items.every((item) => completed.has(item.id))

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[#F7F8FA] shadow-xl">
        <header className="flex items-center justify-between bg-white px-4 py-3">
          <button type="button" onClick={onClose} className="text-sm font-medium text-[#185FA5]">
            Close
          </button>
          <p className="text-sm font-semibold text-slate-900">Task</p>
          <span className="w-10" />
        </header>
        <div className="space-y-3 overflow-y-auto p-4">
          <FeatureCard className="p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-base font-semibold text-slate-900">{task.title}</p>
              <StatusPill
                label={task.status}
                tone={task.status === 'Completed' ? 'green' : task.status === 'In Progress' ? 'blue' : 'amber'}
              />
            </div>
            {task.details && <p className="mt-2 text-sm text-slate-600">{task.details}</p>}
            {task.dueDate && (
              <p className="mt-2 text-xs text-slate-500">Due {format(task.dueDate, 'd MMM yyyy')}</p>
            )}
            <p className="mt-2 text-xs text-slate-400">Created by {task.createdBy}</p>
          </FeatureCard>

          {items.length > 0 && (
            <FeatureCard className="divide-y divide-slate-100">
              {items.map((item) => {
                const ticked = completed.has(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onToggleItem(item.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span
                      className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border ${
                        ticked ? 'border-[#185FA5] bg-[#185FA5] text-white' : 'border-slate-300'
                      }`}
                    >
                      {ticked ? '✓' : ''}
                    </span>
                    <span className={`text-sm ${ticked ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {item.title}
                    </span>
                  </button>
                )
              })}
            </FeatureCard>
          )}

          {task.attachedImageURLs && task.attachedImageURLs.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {task.attachedImageURLs.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="" className="h-24 w-full rounded-xl object-cover" />
              ))}
            </div>
          )}
          {task.attachedFileName && (
            <p className="text-xs text-slate-500">File: {task.attachedFileName}</p>
          )}
          {task.attachedSiteAuditTitle && (
            <p className="text-xs text-slate-500">Site audit: {task.attachedSiteAuditTitle}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {(['To Do', 'In Progress', 'Completed'] as ProjectTaskStatus[])
              .filter((status) => status !== task.status)
              .map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={status === 'Completed' && !allTicked}
                  onClick={() => onStatusChange(status)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-40"
                >
                  {status === 'Completed' ? 'Complete' : status}
                </button>
              ))}
            {canDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="ml-auto rounded-lg border border-red-100 px-3 py-1.5 text-xs font-medium text-red-600"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
