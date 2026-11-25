'use client'

import { ErrorBanner } from '@/components/dashboard/PageShell'

/** Re-check of #459: a task load that failed or did not answer, with Retry (never an endless spinner). */
export function TaskLoadFailed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-2">
      <ErrorBanner message={message} />
      <button type="button" className="tk-btn" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}
