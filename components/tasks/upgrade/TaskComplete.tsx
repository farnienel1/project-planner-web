'use client'

/**
 * Complete step (F2, F25; issue 1, issue 2): Checklist (hidden when the task has none — never a row made from the
 * title) → Proof of work (Upload files; no camera on web) → Notes for the manager → hint · Save progress · Complete
 * task. Save progress keeps ticks, files and notes and leaves the status as it is; Complete task needs every item
 * ticked (`taskCompleteStep`) and writes Completed with who and when (`taskStatusChangeFields`).
 */

import { useMemo, useState } from 'react'
import { CheckIcon } from '@heroicons/react/24/outline'
import {
  TASK_COPY,
  TASK_FIELD_LIMITS,
  taskCompleteStep,
  taskItemTicked,
  taskStatusChangeFields,
  taskToggleChecklistItem,
  taskUploadProgressText,
} from '@/lib/canonical'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useTaskUploads } from '@/lib/tasks/useTaskUploads'
import { completionFileLabel } from '@/lib/tasks/completionFiles'
import type { ProjectTask, ProjectTaskStatus } from '@/types'
import { AttachmentViewer, ConfirmDialog, TaskDialog, type ViewerFile } from './TaskDialog'
import { TaskFilesField } from './TaskFilesField'
import { errorText, personDisplay } from './taskActions'
import type { TaskWorkspace } from './useTaskWorkspace'

export function TaskComplete({
  ws,
  task,
  locationText,
  onDone,
  onBack,
}: {
  ws: TaskWorkspace
  task: ProjectTask
  locationText: string
  onDone: (outcome: 'completed' | 'saved') => void
  onBack: () => void
}) {
  const [ticks, setTicks] = useState<string[]>(task.completedItemIds ?? [])
  const [notes, setNotes] = useState(task.completionNotes ?? '')
  const [saving, setSaving] = useState<null | 'progress' | 'complete'>(null)
  const [error, setError] = useState<string | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<ViewerFile | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const uploads = useTaskUploads()
  const [startTicks] = useState<string[]>(() => task.completedItemIds ?? [])
  const step = useMemo(() => taskCompleteStep({ items: task.items, completedItemIds: ticks }), [task.items, ticks])

  const existing: ViewerFile[] = [
    ...(task.completionImages ?? []).map((url, index) => ({ url, name: `Proof photo ${index + 1}`, isImage: true })),
    ...(task.completionFiles ?? []).map((url) => ({ url, name: completionFileLabel(url), isImage: false })),
  ]
  const dirty =
    ticks.join() !== startTicks.join() || notes.trim() !== (task.completionNotes ?? '').trim() || uploads.items.length > 0

  const close = () => {
    if (saving) return
    if (dirty) setConfirmDiscard(true)
    else onBack()
  }

  const run = async (kind: 'progress' | 'complete') => {
    if (saving || !ws.organization?.id) return
    if (kind === 'complete' && !step.completeEnabled) return
    setSaving(kind)
    setError(null)
    try {
      const up = await uploads.uploadAll(ws.organization.id, task.id)
      if (!up.ok) {
        setError('A file didn’t upload. Retry it or remove it, then try again.')
        return
      }
      const proof = {
        completionImages: [...(task.completionImages ?? []), ...up.images],
        completionFiles: [...(task.completionFiles ?? []), ...up.documents.map((doc) => doc.url)],
        completionNotes: notes.trim() || undefined,
        completedItemIds: ticks,
      }
      if (kind === 'complete') {
        const fields = taskStatusChangeFields(task, 'Completed', { completedBy: personDisplay(ws.user), now: new Date() })
        await useTaskStore.getState().saveTask({
          ...task,
          ...proof,
          status: fields.status as ProjectTaskStatus,
          completedAt: fields.completedAt ?? undefined,
          completedBy: fields.completedBy ?? undefined,
          updatedAt: new Date(),
        })
      } else {
        // F2: Save progress never changes the status.
        await useTaskStore.getState().saveTask({ ...task, ...proof, updatedAt: new Date() })
      }
      uploads.clear()
      onDone(kind === 'complete' ? 'completed' : 'saved')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSaving(null)
    }
  }

  const uploading = saving && uploads.items.length > 0 && uploads.progress.done < uploads.progress.total
  return (
    <>
      <TaskDialog
        open
        title={TASK_COPY.complete.title}
        subtitle={<span className="tk-muted">{[task.title, locationText].filter(Boolean).join(' · ')}</span>}
        onClose={close}
        footer={
          <>
            {error ? (
              <span className="tk-error" role="alert" style={{ flexBasis: '100%' }}>
                {error}
              </span>
            ) : null}
            <button type="button" className="tk-btn ghost" onClick={close} disabled={Boolean(saving)}>
              {TASK_COPY.complete.back}
            </button>
            <span className="grow" />
            {step.hint ? <span className="hint">{step.hint}</span> : null}
            <button type="button" className="tk-btn" onClick={() => void run('progress')} disabled={Boolean(saving)}>
              {saving === 'progress' ? (uploading ? taskUploadProgressText(uploads.progress.done, uploads.progress.total, uploads.progress.percent) : 'Saving…') : TASK_COPY.complete.saveProgress}
            </button>
            <button type="button" className="tk-btn primary" onClick={() => void run('complete')} disabled={Boolean(saving) || !step.completeEnabled}>
              {saving === 'complete' ? (uploading ? taskUploadProgressText(uploads.progress.done, uploads.progress.total, uploads.progress.percent) : 'Saving…') : TASK_COPY.complete.confirm}
            </button>
          </>
        }
      >
        {step.showChecklist ? (
          <section className="tk-section">
            <h3>
              {TASK_COPY.form.checklistLabel}
              <small>
                {step.done} of {step.total} done
              </small>
            </h3>
            <div className="tk-progress" aria-hidden style={{ marginBottom: 10 }}>
              <i style={{ width: `${step.total ? (step.done / step.total) * 100 : 0}%` }} />
            </div>
            <div className="tk-check-list">
              {(task.items ?? []).map((item) => {
                const ticked = taskItemTicked({ completedItemIds: ticks }, item.id)
                return (
                  <div key={item.id} className="tk-check">
                    <button
                      type="button"
                      className="tk-box"
                      role="checkbox"
                      aria-checked={ticked}
                      aria-label={item.title}
                      onClick={() => setTicks((prev) => taskToggleChecklistItem(prev, item.id))}
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
        <TaskFilesField
          label={TASK_COPY.complete.proofOfWork}
          existing={existing}
          onOpen={setViewing}
          uploads={uploads.items}
          onPick={(files) => setPickError(uploads.add(files, { files: existing.length, documents: 0 }))}
          onRetry={(key) => {
            uploads.retry(key)
            setError(null)
          }}
          onRemove={(key) => uploads.remove(key)}
          error={pickError}
          disabled={Boolean(saving)}
        />
        <div className="tk-field">
          <label className="tk-label" htmlFor="tk-notes">
            {TASK_COPY.complete.notesLabel}
            <small>optional</small>
          </label>
          <textarea
            id="tk-notes"
            className="tk-textarea"
            value={notes}
            maxLength={TASK_FIELD_LIMITS.completionNotesMax}
            placeholder={TASK_COPY.complete.notesPlaceholder}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
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
          onBack()
        }}
      />
      <AttachmentViewer file={viewing} taskId={task.id} onClose={() => setViewing(null)} />
    </>
  )
}
