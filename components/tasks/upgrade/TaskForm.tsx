'use client'

/**
 * New task / Edit task in the one popup (F9, F12, F13, F21, F23, F24; bugs B3, B4, B5, B10; issue 1, issue 2). Field
 * order is the rulebook's (`TASK_FORM_ORDER`): Task → Project or small works → Assign to → Due date + Priority →
 * Checklist → Attachments → Status (Edit only). Errors show under their own field when Create / Save is pressed
 * (`taskFormErrors`). The task id exists before any upload; files upload in parallel with progress and a stall stop;
 * the task is written once, after every file is up. Edit keeps every tick (`taskChecklistAfterEdit`), offers To do /
 * In progress only (`taskEditStatus`) and asks before discarding changes.
 */

import { useEffect, useMemo, useState } from 'react'
import { Bars3Icon, CheckIcon, LockClosedIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import {
  TASK_COPY,
  TASK_DEFAULT_PRIORITY,
  TASK_EDIT_STATUS_OPTIONS,
  TASK_FIELD_LIMITS,
  TASK_PRIORITY_OPTIONS,
  taskChecklistAfterEdit,
  taskEditStatus,
  taskFormErrors,
  taskItemTicked,
  taskStatusLabel,
  taskToggleChecklistItem,
  taskUploadProgressText,
} from '@/lib/canonical'
import { dateFromDayKeyInZone, dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useSiteAuditStore } from '@/lib/stores/siteAuditStore'
import { useTaskUploads } from '@/lib/tasks/useTaskUploads'
import { allAssignedManagerIds, allAssignedOperativeIds } from '@/lib/tasks/projectTaskFilters'
import { completionFileLabel } from '@/lib/tasks/completionFiles'
import type { ProjectTask, ProjectTaskPriority, ProjectTaskStatus } from '@/types'
import { AttachmentViewer, ConfirmDialog, TaskDialog, type ViewerFile } from './TaskDialog'
import { TaskFilesField } from './TaskFilesField'
import { TaskPeopleField } from './TaskPeopleField'
import { errorText, personDisplay } from './taskActions'
import type { TaskLocation, TaskWorkspace } from './useTaskWorkspace'

type Row = { id: string; title: string; description?: string }

export function TaskForm({
  ws,
  task,
  lockedLocation,
  onDone,
  onCancel,
  onDeleteRequest,
}: {
  ws: TaskWorkspace
  /** The task being edited; none for a new task. */
  task: ProjectTask | null
  /** Set when opened from a project or small works page (filled in and locked, F12). */
  lockedLocation: TaskLocation | null
  onDone: (saved: { id: string; created: boolean }) => void
  onCancel: () => void
  onDeleteRequest?: () => void
}) {
  const editing = Boolean(task)
  const zone = ws.timeZone
  const initial = useMemo(
    () => ({
      title: task?.title ?? '',
      details: task?.details ?? '',
      locationId: lockedLocation?.id ?? task?.projectId ?? '',
      managers: new Set(allAssignedManagerIds(task ?? ({} as ProjectTask))),
      operatives: new Set(allAssignedOperativeIds(task ?? ({} as ProjectTask))),
      due: task ? (task.dueDate ? dayKeyInZone(task.dueDate, zone) : '') : dayKeyInZone(new Date(), zone),
      priority: (task?.priority ?? TASK_DEFAULT_PRIORITY) as ProjectTaskPriority,
      rows: (task?.items ?? []).map((item) => ({ id: item.id, title: item.title, description: item.description })) as Row[],
      ticks: task?.completedItemIds ?? [],
      status: (task?.status ?? 'To Do') as ProjectTaskStatus,
      images: task?.attachedImageURLs ?? [],
      fileUrl: task?.attachedFileURL ?? '',
      fileName: task?.attachedFileName ?? '',
      auditId: task?.attachedSiteAuditId ?? '',
      auditTitle: task?.attachedSiteAuditTitle ?? '',
    }),
    // The form starts from the task as opened; later live updates do not reset what the person typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const [title, setTitle] = useState(initial.title)
  const [details, setDetails] = useState(initial.details)
  const [locationId, setLocationId] = useState(initial.locationId)
  const [managers, setManagers] = useState(initial.managers)
  const [operatives, setOperatives] = useState(initial.operatives)
  const [due, setDue] = useState(initial.due)
  const [priority, setPriority] = useState<ProjectTaskPriority>(initial.priority)
  const [rows, setRows] = useState<Row[]>(initial.rows)
  const [ticks, setTicks] = useState<string[]>(initial.ticks)
  const [status, setStatus] = useState<ProjectTaskStatus>(initial.status)
  const [images, setImages] = useState<string[]>(initial.images)
  const [file, setFile] = useState({ url: initial.fileUrl, name: initial.fileName })
  const [audit, setAudit] = useState({ id: initial.auditId, title: initial.auditTitle })
  const [showAudits, setShowAudits] = useState(false)
  const [errors, setErrors] = useState<ReturnType<typeof taskFormErrors>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [viewing, setViewing] = useState<ViewerFile | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [taskIdValue] = useState(() => task?.id || newUuid())
  const uploads = useTaskUploads()
  const { audits, loadAudits } = useSiteAuditStore()

  useEffect(() => {
    if (showAudits && ws.organization?.id) void loadAudits(ws.organization.id)
  }, [showAudits, ws.organization?.id, loadAudits])

  const location = lockedLocation ?? ws.locations.find((row) => row.id === locationId) ?? null
  const locationAudits = audits.filter((row) => row.projectId.toLowerCase() === (location?.id || '').toLowerCase())

  const dirty =
    title !== initial.title ||
    details !== initial.details ||
    locationId !== initial.locationId ||
    due !== initial.due ||
    priority !== initial.priority ||
    status !== initial.status ||
    JSON.stringify(rows) !== JSON.stringify(initial.rows) ||
    JSON.stringify(ticks) !== JSON.stringify(initial.ticks) ||
    [...managers].join() !== [...initial.managers].join() ||
    [...operatives].join() !== [...initial.operatives].join() ||
    images.join() !== initial.images.join() ||
    file.url !== initial.fileUrl ||
    audit.id !== initial.auditId ||
    uploads.items.length > 0

  const close = () => {
    if (saving) return
    if (dirty) setConfirmDiscard(true)
    else onCancel()
  }

  const existingFiles: ViewerFile[] = [
    ...images.map((url, index) => ({ url, name: `Photo ${index + 1}`, isImage: true })),
    ...(file.url ? [{ url: file.url, name: file.name || completionFileLabel(file.url), isImage: false }] : []),
  ]

  const pick = (files: File[]) => {
    const refusal = uploads.add(files, { files: existingFiles.length, documents: file.url ? 1 : 0 })
    setPickError(refusal)
  }

  const save = async () => {
    if (saving || !ws.organization?.id || !ws.user) return
    const cleanRows = rows.map((row) => ({ ...row, title: row.title.trim() })).filter((row) => row.title)
    const nextErrors = taskFormErrors({
      title,
      locationId: location?.id ?? '',
      assigneeCount: managers.size + operatives.size,
      dueDate: due,
      checklistCount: cleanRows.length,
    })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setSaving(true)
    setSaveError(null)
    try {
      const up = await uploads.uploadAll(ws.organization.id, taskIdValue)
      if (!up.ok) {
        setSaveError('A file didn’t upload. Retry it or remove it. The task is saved once every file is up.')
        return
      }
      const document = up.documents[0]
      const nextTicks = taskChecklistAfterEdit({ items: cleanRows, completedItemIds: ticks })
      const managerIds = [...managers]
      const operativeIds = [...operatives]
      const now = new Date()
      const base: ProjectTask = task ?? {
        id: taskIdValue,
        organizationId: ws.organization.id,
        projectId: location!.id,
        title: '',
        createdBy: personDisplay(ws.user),
        createdByUserId: ws.user.id,
        status: 'To Do',
        priority: TASK_DEFAULT_PRIORITY,
        createdAt: now,
        updatedAt: now,
      }
      await useTaskStore.getState().saveTask({
        ...base,
        id: taskIdValue,
        organizationId: ws.organization.id,
        projectId: task ? task.projectId : location!.id,
        title: title.trim(),
        details: details.trim() || undefined,
        priority,
        dueDate: dateFromDayKeyInZone(due, zone),
        status: task ? (taskEditStatus(task.status, status) as ProjectTaskStatus) : 'To Do',
        assignedManagerIds: managerIds,
        assignedOperativeIds: operativeIds,
        assignedManagerId: managerIds[0],
        assignedOperativeId: operativeIds[0],
        items: cleanRows.map((row) => ({ id: row.id, title: row.title, description: row.description })),
        completedItemIds: nextTicks,
        attachedImageURLs: [...images, ...up.images],
        attachedFileURL: document ? document.url : file.url || undefined,
        attachedFileName: document ? document.name : file.url ? file.name || undefined : undefined,
        attachedSiteAuditId: audit.id || undefined,
        attachedSiteAuditTitle: audit.id ? audit.title || undefined : undefined,
        updatedAt: now,
      })
      uploads.clear()
      onDone({ id: taskIdValue, created: !task })
    } catch (error) {
      setSaveError(errorText(error))
    } finally {
      setSaving(false)
    }
  }

  const footer = (
    <>
      {editing && onDeleteRequest ? (
        <button type="button" className="tk-btn danger" onClick={onDeleteRequest} disabled={saving}>
          <TrashIcon width={18} height={18} aria-hidden />
          {TASK_COPY.detail.delete}
        </button>
      ) : null}
      <span className="grow" />
      {saveError ? (
        <span className="tk-error" role="alert" style={{ flexBasis: '100%', order: -1 }}>
          {saveError}
        </span>
      ) : null}
      <button
        type="button"
        className="tk-btn"
        onClick={() => {
          if (saving) {
            uploads.cancelAll()
            setSaving(false)
            onCancel()
            return
          }
          close()
        }}
      >
        {TASK_COPY.form.cancel}
      </button>
      <button type="button" className="tk-btn primary" onClick={() => void save()} disabled={saving}>
        {saving && uploads.items.length > 0 && uploads.progress.done < uploads.progress.total
          ? taskUploadProgressText(uploads.progress.done, uploads.progress.total, uploads.progress.percent)
          : saving
            ? 'Saving…'
            : editing
              ? TASK_COPY.form.save
              : TASK_COPY.form.create}
      </button>
    </>
  )

  return (
    <>
      <TaskDialog
        open
        title={editing ? TASK_COPY.form.titleEdit : TASK_COPY.form.titleNew}
        subtitle={editing && location ? <span className="tk-muted">{[location.code, location.name].filter(Boolean).join(' ')}</span> : undefined}
        onClose={close}
        footer={footer}
      >
        <div className="tk-field">
          <label className="tk-label" htmlFor="tk-title">
            {TASK_COPY.form.titleLabel}
          </label>
          <input
            id="tk-title"
            className="tk-input big"
            value={title}
            maxLength={TASK_FIELD_LIMITS.titleMax}
            placeholder={TASK_COPY.form.titlePlaceholder}
            onChange={(e) => setTitle(e.target.value)}
            data-autofocus
          />
          {errors.title ? <span className="tk-error" role="alert">{errors.title}</span> : null}
        </div>
        <div className="tk-field">
          <label className="tk-label" htmlFor="tk-details">
            {TASK_COPY.form.descriptionLabel}
            <small>optional</small>
          </label>
          <textarea
            id="tk-details"
            className="tk-textarea"
            value={details}
            maxLength={TASK_FIELD_LIMITS.descriptionMax}
            placeholder={TASK_COPY.form.descriptionPlaceholder}
            onChange={(e) => setDetails(e.target.value)}
          />
        </div>

        <div className="tk-field">
          <label className="tk-label" htmlFor="tk-location">
            {TASK_COPY.form.locationLabel}
          </label>
          {lockedLocation || editing ? (
            <div className="tk-input" style={{ display: 'flex', alignItems: 'center', gap: 8 }} id="tk-location">
              <LockClosedIcon width={16} height={16} aria-hidden />
              <span>{location ? [location.code, location.name].filter(Boolean).join(' ') : task?.projectId || '—'}</span>
              <span className="tk-muted" style={{ marginLeft: 'auto' }}>
                {editing ? 'Set when the task was created' : 'Set by this page'}
              </span>
            </div>
          ) : (
            <select id="tk-location" className="tk-select" style={{ maxWidth: 'none', width: '100%' }} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">Choose a project or small works</option>
              {ws.liveLocations.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.kind === 'smallWorks' ? 'Small works' : 'Project'} · {[row.code, row.name].filter(Boolean).join(' ')}
                </option>
              ))}
            </select>
          )}
          {errors.location ? <span className="tk-error" role="alert">{errors.location}</span> : null}
        </div>

        <TaskPeopleField
          managers={ws.assignableManagers}
          allManagers={ws.managers}
          operatives={ws.operatives}
          index={ws.personIndex}
          selectedManagers={managers}
          selectedOperatives={operatives}
          onChange={(next) => {
            setManagers(next.managers)
            setOperatives(next.operatives)
          }}
          me={ws.me}
          error={errors.assignees}
        />

        <div className="tk-two">
          <div className="tk-field">
            <label className="tk-label" htmlFor="tk-due">
              {TASK_COPY.form.dueDateLabel}
            </label>
            <input id="tk-due" type="date" className="tk-input" value={due} onChange={(e) => setDue(e.target.value)} />
            {errors.dueDate ? <span className="tk-error" role="alert">{errors.dueDate}</span> : null}
          </div>
          <div className="tk-field">
            <span className="tk-label" id="tk-priority-label">
              {TASK_COPY.form.priorityLabel}
            </span>
            <div className="tk-priority" role="group" aria-labelledby="tk-priority-label">
              {TASK_PRIORITY_OPTIONS.map((option) => (
                <button key={option.token} type="button" aria-pressed={priority === option.token} onClick={() => setPriority(option.token)}>
                  <span className="dot" data-tone={option.tone} aria-hidden />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="tk-field">
          <span className="tk-label">
            {TASK_COPY.form.checklistLabel}
            <small>optional</small>
          </span>
          {rows.length > 0 ? (
            <div className="tk-check-list">
              {rows.map((row, index) => {
                const ticked = editing && taskItemTicked({ completedItemIds: ticks }, row.id)
                return (
                  <div
                    key={row.id}
                    className={`tk-check${dragIndex === index ? ' dragging' : ''}`}
                    draggable
                    onDragStart={() => setDragIndex(index)}
                    onDragEnd={() => setDragIndex(null)}
                    onDragOver={(event) => {
                      event.preventDefault()
                      if (dragIndex == null || dragIndex === index) return
                      setRows((prev) => {
                        const next = [...prev]
                        const [moved] = next.splice(dragIndex, 1)
                        next.splice(index, 0, moved)
                        return next
                      })
                      setDragIndex(index)
                    }}
                  >
                    <button
                      type="button"
                      className="tk-handle"
                      aria-label={`Move ${row.title || 'item'} (use the arrow keys)`}
                      onKeyDown={(event) => {
                        const to = event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1 : -1
                        if (to < 0 || to >= rows.length) return
                        event.preventDefault()
                        setRows((prev) => {
                          const next = [...prev]
                          const [moved] = next.splice(index, 1)
                          next.splice(to, 0, moved)
                          return next
                        })
                      }}
                    >
                      <Bars3Icon width={18} height={18} aria-hidden />
                    </button>
                    {editing ? (
                      <button
                        type="button"
                        className="tk-box"
                        role="checkbox"
                        aria-checked={ticked}
                        aria-label={`${row.title || 'Item'} ticked`}
                        onClick={() => setTicks((prev) => taskToggleChecklistItem(prev, row.id))}
                      >
                        {ticked ? <CheckIcon aria-hidden /> : null}
                      </button>
                    ) : null}
                    <input
                      className="tk-input"
                      value={row.title}
                      maxLength={TASK_FIELD_LIMITS.itemMax}
                      placeholder="Checklist item"
                      aria-label={`Checklist item ${index + 1}`}
                      onChange={(e) => setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, title: e.target.value } : item)))}
                    />
                    <button
                      type="button"
                      className="tk-icon-btn"
                      aria-label={`Remove ${row.title || 'checklist item'}`}
                      onClick={() => setRows((prev) => prev.filter((item) => item.id !== row.id))}
                    >
                      <TrashIcon aria-hidden />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : null}
          <div>
            <button
              type="button"
              className="tk-btn sm"
              disabled={rows.length >= TASK_FIELD_LIMITS.checklistMaxItems}
              onClick={() => setRows((prev) => [...prev, { id: newUuid(), title: '' }])}
            >
              <PlusIcon width={16} height={16} aria-hidden />
              {TASK_COPY.form.addChecklistItem}
            </button>
          </div>
          <span className="tk-help">{TASK_COPY.form.checklistHelper}</span>
          {editing && rows.length > 0 ? <span className="tk-help">{TASK_COPY.form.checklistEditHelper}</span> : null}
          {errors.checklist ? <span className="tk-error" role="alert">{errors.checklist}</span> : null}
        </div>

        <TaskFilesField
          label={TASK_COPY.form.attachmentsLabel}
          existing={existingFiles}
          onRemoveExisting={(target) => {
            if (target.isImage) setImages((prev) => prev.filter((url) => url !== target.url))
            else setFile({ url: '', name: '' })
          }}
          onOpen={setViewing}
          uploads={uploads.items}
          onPick={pick}
          onRetry={(key) => {
            uploads.retry(key)
            setSaveError(null)
            // The task is saved once every file is up: retrying a file carries on with the save.
            void save()
          }}
          onRemove={(key) => uploads.remove(key)}
          error={pickError}
          disabled={saving}
          siteAudit={
            <div className="tk-menu-wrap">
              <button type="button" className="tk-btn sm" disabled={!location || saving} onClick={() => setShowAudits((v) => !v)} aria-expanded={showAudits}>
                {audit.id ? `Site audit · ${audit.title || 'attached'}` : 'Site audit'}
              </button>
              {showAudits ? (
                <div className="tk-menu" role="menu" style={{ left: 0, right: 'auto' }}>
                  {locationAudits.length === 0 ? <p className="tk-muted" style={{ padding: 10 }}>No site audits for this job.</p> : null}
                  {locationAudits.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAudit({ id: row.id, title: row.customTitle || row.type })
                        setShowAudits(false)
                      }}
                    >
                      {row.customTitle || row.type}
                    </button>
                  ))}
                  {audit.id ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="danger"
                      onClick={() => {
                        setAudit({ id: '', title: '' })
                        setShowAudits(false)
                      }}
                    >
                      Remove site audit
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          }
        />

        {editing ? (
          <div className="tk-field">
            <span className="tk-label" id="tk-status-label">
              {TASK_COPY.form.statusLabel}
            </span>
            <div className="tk-seg" role="group" aria-labelledby="tk-status-label" style={{ alignSelf: 'flex-start' }}>
              {TASK_EDIT_STATUS_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={status === option}
                  disabled={task?.status === 'Completed'}
                  onClick={() => setStatus(option as ProjectTaskStatus)}
                >
                  {taskStatusLabel(option)}
                </button>
              ))}
              <button type="button" aria-pressed={task?.status === 'Completed'} disabled>
                {taskStatusLabel('Completed')}
              </button>
            </div>
            <span className="tk-help">{TASK_COPY.form.statusCompletedHint}</span>
          </div>
        ) : null}
      </TaskDialog>
      <ConfirmDialog
        open={confirmDiscard}
        title={TASK_COPY.form.unsavedTitle}
        body={TASK_COPY.form.unsavedBody}
        confirm={TASK_COPY.form.discard}
        cancel={TASK_COPY.form.keepEditing}
        danger
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false)
          uploads.cancelAll()
          onCancel()
        }}
      />
      <AttachmentViewer file={viewing} taskId={taskIdValue} onClose={() => setViewing(null)} />
    </>
  )
}
