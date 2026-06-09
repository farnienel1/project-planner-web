'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export function AppTopNotice({
  message,
  onDismiss,
  autoHideMs = 3500,
}: {
  message: string | null
  onDismiss: () => void
  autoHideMs?: number
}) {
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(onDismiss, autoHideMs)
    return () => window.clearTimeout(timer)
  }, [message, onDismiss, autoHideMs])

  if (!message || typeof document === 'undefined') return null

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex justify-center px-4 pt-4">
      <div
        role="alert"
        className="pointer-events-auto flex max-w-lg items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg"
      >
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="flex-1 font-medium">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-1 text-amber-700 transition hover:bg-amber-100"
          aria-label="Dismiss"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>,
    document.body
  )
}
