/**
 * iOS parity: CompletedTaskDetailView / TaskCompletionPopupView / Carry out
 */
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Modal } from '@/components/ui'
import { useAuthStore } from '@/lib/stores/authStore'
import { taskAttachmentPath, uploadFile } from '@/lib/firebase/storageUtils'
import {
  allAssignedManagerIds,
  allAssignedOperativeIds,
  personDisplayName,
} from '@/lib/tasks/projectTaskFilters'
import type { Manager, Operative, ProjectTask, ProjectTaskStatus } from '@/types'

export function ProjectTaskDetailSheet({
  task,
  operatives,
  managers,
  siteAuditHref,
  onStatusChange,
  onToggleItem,
  onComplete,
  onDelete,
  onEdit,
  onClose,
  canEdit,
  canDelete,
}: {
  task: ProjectTask
  operatives: Operative[]
  managers: Manager[]
  siteAuditHref?: string | null
  onStatusChange: (status: ProjectTaskStatus) => void
  onToggleItem: (itemId: string) => void
  onComplete: (input: {
    completionNotes?: string
    completionImages: string[]
    completionFiles: { name: string; url: string }[]
  }) => Promise<void>
  onDelete: () => void
  onEdit?: () => void
  onClose: () => void
  canEdit: boolean
  canDelete: boolean
}) {
  const { organization } = useAuthStore()
  const [phase, setPhase] = useState<'detail' | 'complete'>('detail')
  const items = task.items || []
  const completed = new Set(task.completedItemIds || [])
  const allTicked = items.length === 0 || items.every((item) => completed.has(item.id))
  const operativeNames = namesFor(allAssignedOperativeIds(task), operatives)
  const managerNames = namesFor(allAssignedManagerIds(task), managers)
  const assigned = [...managerNames, ...operativeNames]
  const dueLabel = task.dueDate ? format(task.dueDate, 'd MMM yyyy') : 'No due date'
  const priorityHue =
    task.priority === 'Urgent' || task.priority === 'High' ? 'red' : task.priority === 'Low' ? 'lib' : 'task'

  return (
    <Modal
      open
      hue="task"
      title={task.title}
      subtitle={dueLabel}
      onClose={onClose}
      footer={
        phase === 'complete' ? (
          false
        ) : (
          <div className="flex w-full flex-wrap items-center gap-2">
            {task.status !== 'In Progress' && task.status !== 'Completed' ? (
              <button type="button" className="btn tint" onClick={() => onStatusChange('In Progress')}>
                Carry out
              </button>
            ) : null}
            {task.status !== 'Completed' ? (
              <button
                type="button"
                className="btn primary"
                disabled={!allTicked}
                onClick={() => setPhase('complete')}
              >
                Complete
              </button>
            ) : null}
            {task.status === 'Completed' ? (
              <button type="button" className="btn" onClick={() => onStatusChange('To Do')}>
                Reopen
              </button>
            ) : null}
            {canEdit && onEdit ? (
              <button type="button" className="btn" onClick={onEdit}>
                Edit task
              </button>
            ) : null}
            {canDelete ? (
              <button type="button" className="btn danger" onClick={onDelete}>
                Delete
              </button>
            ) : null}
          </div>
        )
      }
    >
      {phase === 'complete' ? (
        <CompleteTaskForm
          task={task}
          organizationId={organization?.id}
          allTicked={allTicked}
          onCancel={() => setPhase('detail')}
          onSave={async (input) => {
            await onComplete(input)
            setPhase('detail')
          }}
        />
      ) : (
        <div className="stack" style={{ gap: 14 }} data-hue="task">
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="pill" data-hue={task.status === 'Completed' ? 'green' : task.status === 'In Progress' ? 'daily' : 'lib'}>
              {task.status}
            </span>
            <span className="pill" data-hue={priorityHue}>
              {task.priority === 'Normal' ? 'Medium' : task.priority}
            </span>
            {task.dueDate ? <span className="pill" data-hue="lib">Due {dueLabel}</span> : null}
          </div>
          {task.details ? <p className="muted">{task.details}</p> : null}
          <p className="muted small">Created by {task.createdBy}</p>

          <section>
            <p className="eyebrow" style={{ marginBottom: 8 }}>
              Assigned to
            </p>
            {assigned.length === 0 ? (
              <p className="muted small">Nobody assigned</p>
            ) : (
              <div className="rows">
                {assigned.map((name) => (
                  <div key={name} className="ritem" style={{ cursor: 'default', boxShadow: 'none', background: 'var(--soft)' }}>
                    <span className="grow">
                      <span className="t">{name}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {items.length > 0 ? (
            <section>
              <p className="eyebrow" style={{ marginBottom: 8 }}>
                Checklist
              </p>
              <div className="rows">
                {items.map((item) => {
                  const ticked = completed.has(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onToggleItem(item.id)}
                      className="ritem"
                      style={{ boxShadow: 'none', background: 'var(--soft)' }}
                    >
                      <span
                        className="ico-chip sm"
                        data-hue={ticked ? 'green' : 'lib'}
                        style={{ borderRadius: 6 }}
                      >
                        {ticked ? '✓' : ''}
                      </span>
                      <span className="grow">
                        <span className={`t ${ticked ? 'muted' : ''}`} style={ticked ? { textDecoration: 'line-through' } : undefined}>
                          {item.title}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
              {!allTicked ? (
                <p className="muted small" style={{ marginTop: 8 }}>
                  Assignees must tick all items to complete the task.
                </p>
              ) : null}
            </section>
          ) : null}

          <section>
            <p className="eyebrow" style={{ marginBottom: 8 }}>
              Attachments
            </p>
            {task.attachedImageURLs && task.attachedImageURLs.length > 0 ? (
              <div className="grid g3" style={{ gap: 8, marginBottom: 8 }}>
                {task.attachedImageURLs.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt="" className="h-24 w-full rounded-xl object-cover" />
                ))}
              </div>
            ) : null}
            {task.attachedFileName && task.attachedFileURL ? (
              <a href={task.attachedFileURL} target="_blank" rel="noreferrer" className="ritem" data-hue="lib">
                <span className="grow">
                  <span className="t">{task.attachedFileName}</span>
                  <span className="s">File</span>
                </span>
              </a>
            ) : task.attachedFileName ? (
              <p className="muted small">File: {task.attachedFileName}</p>
            ) : null}
            {task.attachedSiteAuditTitle ? (
              siteAuditHref ? (
                <Link href={siteAuditHref} className="ritem" data-hue="hs" onClick={onClose}>
                  <span className="grow">
                    <span className="t">Site audit · {task.attachedSiteAuditTitle}</span>
                    <span className="s">Tap to open</span>
                  </span>
                </Link>
              ) : (
                <p className="muted small">Site audit: {task.attachedSiteAuditTitle}</p>
              )
            ) : null}
            {!task.attachedImageURLs?.length && !task.attachedFileName && !task.attachedSiteAuditTitle ? (
              <p className="muted small">No attachments</p>
            ) : null}
          </section>

          {task.status === 'Completed' ? (
            <section className="card pad" data-hue="green">
              <p className="eyebrow">Completed</p>
              <p className="t" style={{ marginTop: 6 }}>
                Completed by {task.completedBy || 'Unknown'}
                {task.completedAt ? ` · ${format(task.completedAt, 'd MMM yyyy')}` : ''}
              </p>
              {task.completionNotes ? <p className="muted" style={{ marginTop: 8 }}>{task.completionNotes}</p> : null}
              {task.completionImages && task.completionImages.length > 0 ? (
                <div className="grid g3" style={{ gap: 8, marginTop: 10 }}>
                  {task.completionImages.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={url} src={url} alt="" className="h-24 w-full rounded-xl object-cover" />
                  ))}
                </div>
              ) : null}
              {task.completionFiles?.map((file) => (
                <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="link" style={{ display: 'block', marginTop: 8 }}>
                  {file.name}
                </a>
              ))}
            </section>
          ) : null}
        </div>
      )}
    </Modal>
  )
}

function namesFor(
  ids: string[],
  people: { id: string; firstName: string; lastName: string; email: string }[]
): string[] {
  return ids
    .map((id) => people.find((row) => row.id === id))
    .filter((row): row is { id: string; firstName: string; lastName: string; email: string } => Boolean(row))
    .map((row) => personDisplayName(row))
}

function CompleteTaskForm({
  task,
  organizationId,
  allTicked,
  onCancel,
  onSave,
}: {
  task: ProjectTask
  organizationId?: string
  allTicked: boolean
  onCancel: () => void
  onSave: (input: {
    completionNotes?: string
    completionImages: string[]
    completionFiles: { name: string; url: string }[]
  }) => Promise<void>
}) {
  const [notes, setNotes] = useState(task.completionNotes || '')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [docFiles, setDocFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="stack"
      style={{ gap: 14 }}
      onSubmit={async (event) => {
        event.preventDefault()
        if (!allTicked) return
        setSaving(true)
        setError(null)
        try {
          const completionImages = [...(task.completionImages || [])]
          const completionFiles = [...(task.completionFiles || [])]
          if (organizationId) {
            for (const file of imageFiles) {
              const url = await uploadFile(
                taskAttachmentPath(organizationId, task.id, file.name),
                file,
                file.type || 'image/jpeg'
              )
              completionImages.push(url)
            }
            for (const file of docFiles) {
              const url = await uploadFile(
                taskAttachmentPath(organizationId, task.id, file.name),
                file,
                file.type || 'application/octet-stream'
              )
              completionFiles.push({ name: file.name, url })
            }
          }
          await onSave({
            completionNotes: notes.trim() || undefined,
            completionImages,
            completionFiles,
          })
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Cannot complete task')
        } finally {
          setSaving(false)
        }
      }}
    >
      <p className="eyebrow">Checklist</p>
      <p className="muted small">
        {allTicked ? 'All checklist items are ticked.' : 'Tick every checklist item before completing.'}
      </p>
      <p className="eyebrow">Proof of work</p>
      <label className="btn">
        Photos
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
        />
      </label>
      {imageFiles.length > 0 ? <p className="muted small">{imageFiles.length} photo(s) selected</p> : null}
      <label className="btn">
        Files
        <input
          type="file"
          multiple
          hidden
          onChange={(e) => setDocFiles(Array.from(e.target.files || []))}
        />
      </label>
      {docFiles.length > 0 ? <p className="muted small">{docFiles.length} file(s) selected</p> : null}
      <p className="eyebrow">Notes</p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Anything the manager should know about how the job went…"
        rows={4}
        className="in"
      />
      {error ? <p className="banner" data-hue="red">{error}</p> : null}
      <div className="row wrap">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Back
        </button>
        <button type="submit" className="btn primary" disabled={!allTicked || saving}>
          {saving ? 'Saving…' : 'Complete task'}
        </button>
      </div>
    </form>
  )
}
