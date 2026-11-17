'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { WARNING_DISMISS_COPY, type WarningDismissRequest } from '@/lib/warnings/warningDismissRequest'

/**
 * Owner request 17 Nov: one action pattern on every Warnings card — one full-width primary action coloured by its
 * intent, then the secondary navigation actions as an equal-width row, and Dismiss as a quiet control in the header
 * beside the severity chip (`WarningDismissButton`). UI only.
 */
export function WarningCardActions({ primary, secondary = [] }: { primary?: ReactNode; secondary?: ReactNode[] }) {
  const shown = secondary.filter(Boolean)
  if (!primary && shown.length === 0) return null
  return (
    <div className="wd-acts">
      {primary}
      {shown.length > 0 ? <div className="wd-sec">{shown}</div> : null}
    </div>
  )
}

/** The quiet header Dismiss. `label` names the warning for screen readers ("Dismiss … warning"). */
export function WarningDismissButton({
  onClick,
  label,
  busy,
  text = WARNING_DISMISS_COPY.button,
}: {
  onClick: () => void
  label: string
  busy?: boolean
  text?: string
}) {
  return (
    <button type="button" className="wd-quiet" onClick={onClick} disabled={busy} aria-label={`${text}: ${label}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
      {text}
    </button>
  )
}

/**
 * The iOS `WarningDismissConfirmationSheet`, word for word: red warning icon, "Dismiss this warning?", the body, a
 * summary box (the warning, then its detail) with the admins-notice note, "Dismiss permanently" (red) and
 * "Keep warning". Focus starts on "Keep warning" (the safe choice), Escape keeps the warning, focus stays in the sheet
 * and returns to the control that opened it. A refused write keeps the sheet open with the error.
 */
export function WarningDismissDialog({
  request,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  request: WarningDismissRequest
  busy: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const titleId = useId()
  const bodyId = useId()
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const keepRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    keepRef.current?.focus()
    return () => {
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault()
        onCancel()
        return
      }
      if (event.key !== 'Tab' || !sheetRef.current) return
      const focusable = Array.from(sheetRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  if (typeof document === 'undefined') return null
  return createPortal(
    <>
      <button
        type="button"
        className="wd-backdrop"
        aria-label={WARNING_DISMISS_COPY.cancel}
        tabIndex={-1}
        onClick={() => (busy ? undefined : onCancel())}
      />
      <div
        ref={sheetRef}
        className="wd-sheet"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
      >
        <div className="wd-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h2 id={titleId}>{WARNING_DISMISS_COPY.title}</h2>
        <p id={bodyId} className="wd-body">
          {WARNING_DISMISS_COPY.body}
        </p>
        <div className="wd-summary">
          <b>{request.title}</b>
          <p>{request.detail}</p>
          <div className="wd-note">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M5.85 3.5a.75.75 0 0 0-1.117-1 9.719 9.719 0 0 0-2.348 4.876.75.75 0 0 0 1.479.248A8.219 8.219 0 0 1 5.85 3.5zM19.267 2.5a.75.75 0 1 0-1.118 1 8.22 8.22 0 0 1 1.987 4.124.75.75 0 0 0 1.48-.248A9.72 9.72 0 0 0 19.266 2.5zM12 2.25A6.75 6.75 0 0 0 5.25 9v.75a8.217 8.217 0 0 1-2.119 5.52.75.75 0 0 0 .298 1.206c1.544.57 3.16.99 4.831 1.243a3.75 3.75 0 1 0 7.48 0 24.583 24.583 0 0 0 4.83-1.244.75.75 0 0 0 .298-1.205 8.217 8.217 0 0 1-2.118-5.52V9A6.75 6.75 0 0 0 12 2.25zM9.75 18c0-.034 0-.067.002-.1a25.05 25.05 0 0 0 4.496 0l.002.1a2.25 2.25 0 1 1-4.5 0z" />
            </svg>
            <span>{WARNING_DISMISS_COPY.notice}</span>
          </div>
        </div>
        {error ? (
          <p className="wd-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="wd-buttons">
          <button type="button" className="btn block wd-danger" onClick={onConfirm} disabled={busy}>
            {busy ? WARNING_DISMISS_COPY.confirming : WARNING_DISMISS_COPY.confirm}
          </button>
          <button ref={keepRef} type="button" className="btn block" onClick={onCancel} disabled={busy}>
            {WARNING_DISMISS_COPY.cancel}
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}
