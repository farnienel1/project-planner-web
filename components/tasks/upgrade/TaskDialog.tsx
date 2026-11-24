'use client'

/**
 * The task popup's frame (UI spec §1 TaskPopup): 760 px, sticky header and footer, the body scrolls, full screen under
 * 640 px, a 40 × 40 close button, focus kept inside, Esc closes (the caller asks to discard changes first) and focus
 * returns to what opened it. Also the small confirm dialog and the attachment viewer. Visual only.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { EllipsisHorizontalIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { ReportFileLink } from '@/components/fileReports/ReportFileLink'
import { safeExternalUrl, TASK_COPY } from '@/lib/canonical'
import '@/app/pages-ui.css'
import '@/app/tasks-ui.css'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function useFocusTrap(open: boolean, onEscape: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const escapeRef = useRef(onEscape)
  useEffect(() => {
    escapeRef.current = onEscape
  }, [onEscape])
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const node = ref.current
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (!node) return
      if (event.key === 'Escape') {
        event.stopPropagation()
        escapeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (items.length === 0) return
      const firstItem = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        firstItem.focus()
      }
    }
    node?.addEventListener('keydown', onKey)
    return () => {
      node?.removeEventListener('keydown', onKey)
      if (previous && document.contains(previous)) previous.focus()
    }
  }, [open])
  return ref
}

export function TaskDialog({
  open,
  title,
  subtitle,
  onClose,
  footer,
  children,
  narrow,
  role = 'dialog',
}: {
  open: boolean
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
  narrow?: boolean
  role?: 'dialog' | 'alertdialog'
}) {
  const labelId = useId()
  const ref = useFocusTrap(open, onClose)
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])
  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div
      className="tk-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div ref={ref} className={`tk-dialog${narrow ? ' narrow' : ''}`} role={role} aria-modal="true" aria-labelledby={labelId}>
        <div className="tk-dialog-h">
          <div className="grow">
            <h2 id={labelId}>{title}</h2>
            {subtitle ? <div style={{ marginTop: 6 }}>{subtitle}</div> : null}
          </div>
          <button type="button" className="tk-close" onClick={onClose} aria-label="Close">
            <XMarkIcon aria-hidden />
          </button>
        </div>
        <div className="tk-dialog-b">{children}</div>
        {footer ? <div className="tk-dialog-f">{footer}</div> : null}
      </div>
    </div>,
    document.body
  )
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirm,
  cancel = TASK_COPY.form.cancel,
  danger,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
  confirm: string
  cancel?: string
  danger?: boolean
  busy?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <TaskDialog
      open={open}
      title={title}
      onClose={onCancel}
      narrow
      role="alertdialog"
      footer={
        <>
          <span className="grow" />
          <button type="button" className="tk-btn" onClick={onCancel} data-autofocus>
            {cancel}
          </button>
          <button type="button" className={`tk-btn ${danger ? 'danger solid' : 'primary'}`} disabled={busy} onClick={onConfirm}>
            {busy ? '…' : confirm}
          </button>
        </>
      }
    >
      <p className="tk-text" style={{ margin: 0 }}>{body}</p>
      {error ? <p className="tk-banner red" role="alert">{error}</p> : null}
    </TaskDialog>
  )
}

export type ViewerFile = { url: string; name: string; isImage: boolean }

/** F17: files open inside the app (a lightbox); Download and Report a problem live in its ⋯ menu. */
export function AttachmentViewer({ file, taskId, onClose }: { file: ViewerFile | null; taskId: string; onClose: () => void }) {
  const [menu, setMenu] = useState(false)
  const ref = useFocusTrap(Boolean(file), onClose)
  if (!file || typeof document === 'undefined') return null
  const safe = safeExternalUrl(file.url)
  return createPortal(
    <div ref={ref} className="tk-viewer" role="dialog" aria-modal="true" aria-label={file.name}>
      <div className="tk-viewer-h">
        <span className="grow">{file.name}</span>
        <div className="tk-menu-wrap">
          <button type="button" className="tk-close" aria-label={`More actions for ${file.name}`} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            <EllipsisHorizontalIcon aria-hidden />
          </button>
          {menu ? (
            <div className="tk-menu" role="menu">
              {safe ? (
                <a href={safe} target="_blank" rel="noreferrer" download role="menuitem">
                  Download
                </a>
              ) : null}
              <div style={{ padding: '6px 12px' }}>
                <ReportFileLink fileRef={file.url} surface="task_attachment" parentId={taskId} fileName={file.isImage ? undefined : file.name} />
              </div>
            </div>
          ) : null}
        </div>
        <button type="button" className="tk-close" onClick={onClose} aria-label="Close">
          <XMarkIcon aria-hidden />
        </button>
      </div>
      <div className="tk-viewer-b">
        {!safe ? (
          <p style={{ color: '#fff' }}>This file can’t be opened.</p>
        ) : file.isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={safe} alt={file.name} />
        ) : (
          <iframe src={safe} title={file.name} />
        )}
      </div>
    </div>,
    document.body
  )
}
