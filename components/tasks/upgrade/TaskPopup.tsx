'use client'

/**
 * The one task popup (F11) for view, new, edit and complete, on the main Tasks page and the Tasks tab of Projects and
 * Small works. It never navigates away: the URL carries `?task={id}` (`&mode=edit|complete`, `?task=new`) so links and
 * the browser's Back work. View order (§2.3): title → location link → status, priority, due → Assigned to → Details →
 * Checklist (tickable, F14) → Attachments (viewer, F17) → Completion → Activity. Actions: the main action (Start /
 * Complete / Reopen, `taskActions`), Edit, and ⋯ (Copy link, Open project or small works, Delete task — admins only,
 * `taskAccess`).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import {
  TASK_ACTION_LABELS,
  TASK_COPY,
  taskActions,
  taskCompleteStep,
  taskCopyText,
  taskDateText,
  taskDueLabel,
  taskItemTicked,
  taskPriorityLabel,
  taskPriorityTone,
  taskStatusLabel,
  taskStatusTone,
} from '@/lib/canonical'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { useToast } from '@/components/ui/ToastProvider'
import { allAssignedManagerIds, allAssignedOperativeIds } from '@/lib/tasks/projectTaskFilters'
import { completionFileLabel } from '@/lib/tasks/completionFiles'
import { taskAssigneeNames } from '@/lib/tasks/taskAssigneePeople'
import type { ProjectTask } from '@/types'
import { AttachmentViewer, ConfirmDialog, TaskDialog, type ViewerFile } from './TaskDialog'
import { TaskComplete } from './TaskComplete'
import { TaskForm } from './TaskForm'
import { initialsOf } from './TaskPeopleField'
import { deleteTaskById, personDisplay, runStatusAction, toggleTaskItem } from './taskActions'
import type { TaskLocation, TaskWorkspace } from './useTaskWorkspace'

export type TaskPopupMode = 'view' | 'edit' | 'complete'

function locationLine(location: TaskLocation | null): string {
  return location ? [location.code, location.name].filter(Boolean).join(' ') : ''
}

export function TaskPopup({
  ws,
  taskParam,
  mode,
  lockedLocation,
  showLocationLink,
  onNavigate,
  onClose,
}: {
  ws: TaskWorkspace
  /** A task id, or `new`. */
  taskParam: string
  mode: TaskPopupMode
  lockedLocation: TaskLocation | null
  /** The main page links each task to its project or small works. */
  showLocationLink: boolean
  /** Switch mode inside the popup (keeps the URL in step). */
  onNavigate: (next: { task: string; mode: TaskPopupMode }) => void
  onClose: () => void
}) {
  const toast = useToast()
  const [deleting, setDeleting] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (taskParam === 'new') {
    if (!ws.access.canCreate) return null
    return (
      <TaskForm
        ws={ws}
        task={null}
        lockedLocation={lockedLocation}
        onCancel={onClose}
        onDone={() => {
          toast(TASK_COPY.toasts.created)
          onClose()
        }}
      />
    )
  }

  const task = ws.tasks.find((row) => row.id === taskParam) ?? null
  if (!task) {
    return (
      <TaskDialog open title={ws.loading ? 'Loading…' : 'Task not found'} onClose={onClose} narrow>
        <p className="tk-text" style={{ margin: 0 }}>
          {ws.loading ? 'Loading the task…' : 'This task was deleted, or you don’t have access to it.'}
        </p>
      </TaskDialog>
    )
  }
  const access = ws.accessFor(task)
  const location = ws.locationOf(task)

  const del = (
    <ConfirmDialog
      open={deleting}
      title={taskCopyText(TASK_COPY.delete.title, { title: task.title })}
      body={TASK_COPY.delete.body}
      confirm={TASK_COPY.delete.confirm}
      danger
      busy={deleteBusy}
      error={deleteError}
      onCancel={() => {
        setDeleting(false)
        setDeleteError(null)
      }}
      onConfirm={async () => {
        if (!ws.organization?.id) return
        setDeleteBusy(true)
        const failed = await deleteTaskById(ws.organization.id, task.id)
        setDeleteBusy(false)
        if (failed) {
          setDeleteError(failed)
          return
        }
        setDeleting(false)
        toast(TASK_COPY.toasts.deleted)
        onClose()
      }}
    />
  )

  if (mode === 'edit' && access.canEdit) {
    return (
      <>
        <TaskForm
          ws={ws}
          task={task}
          lockedLocation={location}
          onCancel={() => onNavigate({ task: task.id, mode: 'view' })}
          onDeleteRequest={access.canDelete ? () => setDeleting(true) : undefined}
          onDone={() => {
            toast(TASK_COPY.toasts.saved)
            onNavigate({ task: task.id, mode: 'view' })
          }}
        />
        {del}
      </>
    )
  }
  if (mode === 'complete' && access.canAct && task.status !== 'Completed') {
    return (
      <TaskComplete
        ws={ws}
        task={task}
        locationText={locationLine(location)}
        onBack={() => onNavigate({ task: task.id, mode: 'view' })}
        onDone={(outcome) => {
          toast(outcome === 'completed' ? TASK_COPY.toasts.completed : TASK_COPY.toasts.progressSaved)
          onNavigate({ task: task.id, mode: 'view' })
        }}
      />
    )
  }
  return (
    <>
      <TaskView
        ws={ws}
        task={task}
        location={location}
        showLocationLink={showLocationLink}
        onClose={onClose}
        onEdit={access.canEdit ? () => onNavigate({ task: task.id, mode: 'edit' }) : undefined}
        onComplete={() => onNavigate({ task: task.id, mode: 'complete' })}
        onDelete={access.canDelete ? () => setDeleting(true) : undefined}
      />
      {del}
    </>
  )
}

function TaskView({
  ws,
  task,
  location,
  showLocationLink,
  onClose,
  onEdit,
  onComplete,
  onDelete,
}: {
  ws: TaskWorkspace
  task: ProjectTask
  location: TaskLocation | null
  showLocationLink: boolean
  onClose: () => void
  onEdit?: () => void
  onComplete: () => void
  onDelete?: () => void
}) {
  const toast = useToast()
  const [menu, setMenu] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<ViewerFile | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const access = ws.accessFor(task)
  const due = taskDueLabel(task, now, ws.timeZone)
  const actions = taskActions(task.status)
  const step = taskCompleteStep({ items: task.items, completedItemIds: task.completedItemIds })
  const people = taskAssigneeNames(
    { managerIds: allAssignedManagerIds(task), operativeIds: allAssignedOperativeIds(task) },
    { managers: ws.managers, operatives: ws.operatives, index: ws.personIndex }
  )
  const removedSomeone = people.some((entry) => entry.removed)
  const files: ViewerFile[] = [
    ...(task.attachedImageURLs ?? []).map((url, index) => ({ url, name: `Photo ${index + 1}`, isImage: true })),
    ...(task.attachedFileURL ? [{ url: task.attachedFileURL, name: task.attachedFileName || completionFileLabel(task.attachedFileURL), isImage: false }] : []),
  ]
  const proof: ViewerFile[] = [
    ...(task.completionImages ?? []).map((url, index) => ({ url, name: `Proof photo ${index + 1}`, isImage: true })),
    ...(task.completionFiles ?? []).map((url) => ({ url, name: completionFileLabel(url), isImage: false })),
  ]

  const runPrimary = async () => {
    if (actions.primary === 'complete') {
      onComplete()
      return
    }
    setBusy(true)
    setError(null)
    const failed = await runStatusAction(task, actions.primary, personDisplay(ws.user))
    setBusy(false)
    if (failed) setError(failed)
    else toast(actions.primary === 'start' ? TASK_COPY.toasts.started : TASK_COPY.toasts.reopened)
  }

  const tick = async (itemId: string) => {
    setError(null)
    const failed = await toggleTaskItem(task, itemId)
    if (failed) setError(failed)
  }

  const copyLink = async () => {
    setMenu(false)
    try {
      const url = new URL(location?.href ?? window.location.pathname, window.location.origin)
      url.searchParams.set('task', task.id)
      await navigator.clipboard.writeText(url.toString())
      toast(TASK_COPY.toasts.linkCopied)
    } catch {
      setError('The link couldn’t be copied.')
    }
  }

  const kindLabel = location?.kind === 'smallWorks' ? 'small works' : 'project'
  const dayText = (date: Date | undefined) => (date ? taskDateText(dayKeyInZone(date, ws.timeZone)) : '')

  return (
    <>
      <TaskDialog
        open
        title={task.title}
        subtitle={
          <div className="tk-chips" style={{ alignItems: 'center' }}>
            {location ? (
              showLocationLink ? (
                <Link href={location.href} className="tk-link" onClick={onClose}>
                  {locationLine(location)}
                </Link>
              ) : (
                <span className="tk-muted">{locationLine(location)}</span>
              )
            ) : null}
            <span className="tk-chip" data-tone={taskStatusTone(task.status)}>
              {taskStatusLabel(task.status)}
            </span>
            <span className="tk-chip" data-tone={taskPriorityTone(task.priority)}>
              <span className="dot" aria-hidden />
              {taskPriorityLabel(task.priority)}
            </span>
            <span className="tk-chip" data-tone={due.tone}>
              {due.label}
              {due.secondary ? ` · ${due.secondary}` : ''}
            </span>
          </div>
        }
        onClose={onClose}
        footer={
          <>
            {error ? (
              <span className="tk-error" role="alert" style={{ flexBasis: '100%' }}>
                {error}
              </span>
            ) : null}
            <div className="tk-menu-wrap">
              <button type="button" className="tk-icon-btn" aria-label={`More actions for ${task.title}`} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
                <EllipsisHorizontalIcon aria-hidden />
              </button>
              {menu ? (
                <div className="tk-menu" role="menu" style={{ left: 0, right: 'auto', top: 'auto', bottom: '100%' }}>
                  <button type="button" role="menuitem" onClick={() => void copyLink()}>
                    {TASK_COPY.detail.copyLink}
                  </button>
                  {location && showLocationLink ? (
                    <Link href={location.href} role="menuitem" onClick={onClose}>
                      Open {kindLabel}
                    </Link>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="danger"
                      onClick={() => {
                        setMenu(false)
                        onDelete()
                      }}
                    >
                      {TASK_COPY.detail.delete}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <span className="grow" />
            {onEdit ? (
              <button type="button" className="tk-btn" onClick={onEdit}>
                {TASK_COPY.detail.edit}
              </button>
            ) : null}
            {access.canAct && actions.primary !== 'complete' && actions.available.includes('complete') ? (
              <button type="button" className="tk-btn" onClick={onComplete} disabled={busy}>
                {TASK_ACTION_LABELS.complete}
              </button>
            ) : null}
            {access.canAct ? (
              <button type="button" className="tk-btn primary" onClick={() => void runPrimary()} disabled={busy}>
                {busy ? '…' : TASK_ACTION_LABELS[actions.primary]}
              </button>
            ) : null}
          </>
        }
      >
        {removedSomeone && access.canEdit ? <p className="tk-banner amber">{TASK_COPY.detail.reassign}</p> : null}
        <section className="tk-section">
          <h3>{TASK_COPY.detail.assigned}</h3>
          {people.length === 0 ? (
            <p className="tk-muted" style={{ margin: 0 }}>Nobody assigned</p>
          ) : (
            <div className="tk-people">
              {people.map((entry) => (
                <div key={`${entry.kind}:${entry.id}`} className="tk-person">
                  <span className={`tk-avatar${entry.removed ? ' removed' : ''}`} aria-hidden>
                    {entry.removed ? '?' : initialsOf(entry.name)}
                  </span>
                  <span>
                    {entry.name} <small>{entry.removed ? '' : entry.kind === 'manager' ? 'Manager' : 'Operative'}</small>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
        {task.details ? (
          <section className="tk-section">
            <h3>{TASK_COPY.detail.details}</h3>
            <p className="tk-text" style={{ margin: 0 }}>{task.details}</p>
          </section>
        ) : null}
        {step.showChecklist ? (
          <section className="tk-section">
            <h3>
              {TASK_COPY.form.checklistLabel}
              <small>
                {step.done} of {step.total} done
              </small>
            </h3>
            <div className="tk-check-list">
              {(task.items ?? []).map((item) => {
                const ticked = taskItemTicked(task, item.id)
                const canTick = access.canAct && task.status !== 'Completed'
                return (
                  <div key={item.id} className="tk-check">
                    <button
                      type="button"
                      className="tk-box"
                      role="checkbox"
                      aria-checked={ticked}
                      aria-label={item.title}
                      disabled={!canTick}
                      onClick={() => void tick(item.id)}
                    >
                      {ticked ? <CheckIcon aria-hidden /> : null}
                    </button>
                    <span className={`text${ticked ? ' done' : ''}`}>
                      {item.title}
                      {item.description ? <span className="tk-muted" style={{ display: 'block' }}>{item.description}</span> : null}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}
        <section className="tk-section">
          <h3>
            {TASK_COPY.form.attachmentsLabel}
            {files.length ? <small>{files.length}</small> : null}
          </h3>
          {files.length === 0 && !task.attachedSiteAuditTitle ? <p className="tk-muted" style={{ margin: 0 }}>No attachments</p> : null}
          {files.length > 0 ? (
            <div className="tk-files">
              {files.map((file) => (
                <button key={file.url} type="button" className="tk-file" onClick={() => setViewing(file)} aria-label={`Open ${file.name}`}>
                  {file.isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={file.url} alt="" />
                  ) : (
                    <span className="doc">PDF</span>
                  )}
                  <span style={{ overflowWrap: 'anywhere' }}>{file.name}</span>
                </button>
              ))}
            </div>
          ) : null}
          {task.attachedSiteAuditTitle ? (
            <p style={{ margin: '8px 0 0' }}>
              {location ? (
                <Link className="tk-link" href={location.href.replace(/\/tasks$/, '/site-audit')} onClick={onClose}>
                  Site audit · {task.attachedSiteAuditTitle}
                </Link>
              ) : (
                <span>Site audit · {task.attachedSiteAuditTitle}</span>
              )}
            </p>
          ) : null}
        </section>
        {task.status === 'Completed' ? (
          <section className="tk-section">
            <h3>{TASK_COPY.detail.completion}</h3>
            <p style={{ margin: 0 }}>
              Completed by {task.completedBy || 'Unknown'}
              {task.completedAt ? ` · ${dayText(task.completedAt)}` : ''}
            </p>
            {task.completionNotes ? <p className="tk-text" style={{ margin: '6px 0 0' }}>{task.completionNotes}</p> : null}
            {proof.length > 0 ? (
              <div className="tk-files" style={{ marginTop: 10 }}>
                {proof.map((file) => (
                  <button key={file.url} type="button" className="tk-file" onClick={() => setViewing(file)} aria-label={`Open ${file.name}`}>
                    {file.isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={file.url} alt="" />
                    ) : (
                      <span className="doc">PDF</span>
                    )}
                    <span style={{ overflowWrap: 'anywhere' }}>{file.name}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
        <section className="tk-section">
          <h3>{TASK_COPY.detail.activity}</h3>
          <div className="tk-activity">
            <div>
              <span className="tk-avatar" aria-hidden>
                {initialsOf(task.createdBy || '?')}
              </span>
              {task.createdBy || 'Someone'} created this task · {dayText(task.createdAt)}
            </div>
            {task.status === 'Completed' && task.completedAt ? (
              <div>
                <span className="tk-avatar" aria-hidden>
                  {initialsOf(task.completedBy || '?')}
                </span>
                {task.completedBy || 'Someone'} completed this task · {dayText(task.completedAt)}
              </div>
            ) : null}
          </div>
        </section>
      </TaskDialog>
      <AttachmentViewer file={viewing} taskId={task.id} onClose={() => setViewing(null)} />
    </>
  )
}
