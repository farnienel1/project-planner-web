'use client'

/**
 * Attachments and proof of work (issue 1, issue 2, F13, F16, F17): the files already on the task (open in the viewer,
 * removable in Edit), a drop zone with "Upload files" (never a camera button and never a `capture` input on web —
 * `taskAttachmentSources('web')`), "Site audit" where offered, and one row per picked file with its progress, error,
 * Retry and Remove. Visual only; the pipeline is `useTaskUploads`.
 */

import { useRef, useState, type ReactNode } from 'react'
import { ArrowPathIcon, DocumentIcon, PaperClipIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { TASK_ATTACHMENT_HELP, TASK_ATTACHMENT_SOURCE_LABELS, TASK_COPY, taskAttachmentSources } from '@/lib/canonical'
import type { TaskUploadItem } from '@/lib/tasks/useTaskUploads'
import type { ViewerFile } from './TaskDialog'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf,.pdf'

function mb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusText(item: TaskUploadItem): string {
  if (item.state === 'failed') return item.error || TASK_COPY.attachments.failed.replace('{name}', item.name)
  if (item.state === 'preparing') return 'Preparing…'
  if (item.state === 'uploading') return `Uploading · ${mb(item.sent)} of ${mb(item.total)}`
  if (item.state === 'uploaded') {
    const from = item.preparedBytes != null && item.preparedBytes < item.originalBytes ? ` (from ${mb(item.originalBytes)})` : ''
    return `Uploaded · ${mb(item.preparedBytes ?? item.total)}${from}`
  }
  return `Ready to upload · ${mb(item.originalBytes)}`
}

export function TaskFilesField({
  label,
  optional = true,
  existing,
  onRemoveExisting,
  onOpen,
  uploads,
  onPick,
  onRetry,
  onRemove,
  siteAudit,
  error,
  disabled,
}: {
  label: string
  optional?: boolean
  existing: ViewerFile[]
  onRemoveExisting?: (file: ViewerFile) => void
  onOpen: (file: ViewerFile) => void
  uploads: TaskUploadItem[]
  onPick: (files: File[]) => void
  onRetry: (key: string) => void
  onRemove: (key: string) => void
  /** The site audit control (form only). */
  siteAudit?: ReactNode
  error?: string | null
  disabled?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const sources = taskAttachmentSources('web')
  return (
    <div className="tk-field">
      <span className="tk-label">
        {label}
        {optional ? <small>optional</small> : null}
      </span>
      {existing.length > 0 ? (
        <div className="tk-files">
          {existing.map((file) => (
            <div key={file.url} style={{ position: 'relative' }}>
              <button type="button" className="tk-file" onClick={() => onOpen(file)} aria-label={`Open ${file.name}`} style={{ width: '100%' }}>
                {file.isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.url} alt="" />
                ) : (
                  <span className="doc">PDF</span>
                )}
                <span style={{ overflowWrap: 'anywhere' }}>{file.name}</span>
              </button>
              {onRemoveExisting ? (
                <button type="button" className="tk-file rm" style={{ padding: 0 }} aria-label={`Remove ${file.name}`} onClick={() => onRemoveExisting(file)}>
                  <XMarkIcon width={16} height={16} aria-hidden />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      <div
        className={`tk-drop${over ? ' over' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setOver(false)
          if (disabled) return
          onPick(Array.from(event.dataTransfer.files || []))
        }}
      >
        <span className="tk-muted">{TASK_COPY.attachments.dropHint}</span>
        <div className="actions">
          {sources.includes('files') ? (
            <button type="button" className="tk-btn sm" disabled={disabled} onClick={() => input.current?.click()}>
              <PaperClipIcon width={18} height={18} aria-hidden />
              {TASK_ATTACHMENT_SOURCE_LABELS.files_web}
            </button>
          ) : null}
          {sources.includes('site_audit') && siteAudit ? siteAudit : null}
        </div>
        <span className="tk-help">{TASK_ATTACHMENT_HELP}</span>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(event) => {
            const picked = Array.from(event.target.files || [])
            event.target.value = ''
            if (picked.length) onPick(picked)
          }}
        />
      </div>
      {uploads.length > 0 ? (
        <div className="tk-uploads">
          {uploads.map((item) => (
            <div key={item.key} className="tk-upload">
              {item.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="thumb" src={item.preview} alt="" />
              ) : (
                <span className="thumb">
                  <DocumentIcon width={20} height={20} aria-hidden />
                </span>
              )}
              <div style={{ minWidth: 0 }}>
                <div className="name">{item.name}</div>
                <div className={`st${item.state === 'failed' ? ' err' : ''}`} role={item.state === 'failed' ? 'alert' : undefined}>
                  {statusText(item)}
                </div>
                {item.state === 'uploading' ? (
                  <div className="tk-progress" style={{ marginTop: 4 }} aria-hidden>
                    <i style={{ width: `${item.total ? Math.round((item.sent / item.total) * 100) : 0}%` }} />
                  </div>
                ) : null}
              </div>
              <div className="acts">
                {item.state === 'failed' ? (
                  <button type="button" className="tk-btn sm" onClick={() => onRetry(item.key)}>
                    <ArrowPathIcon width={16} height={16} aria-hidden />
                    {TASK_COPY.attachments.retry}
                  </button>
                ) : null}
                <button type="button" className="tk-icon-btn" aria-label={`${TASK_COPY.attachments.remove} ${item.name}`} onClick={() => onRemove(item.key)}>
                  <TrashIcon aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {error ? <span className="tk-error" role="alert">{error}</span> : null}
    </div>
  )
}
