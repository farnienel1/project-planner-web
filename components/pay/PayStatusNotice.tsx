'use client'

/**
 * Pay strip (review #342 items 3 and 7): shown in place of a screen that decides something from a person's pay
 * (employment type or rate) while that pay is still loading, or could not be read — never the answer the stripped
 * users document would give.
 */
import type { PayProfilesStatus } from '@/lib/pay/payProfileOverlay'

export const OWN_PAY_LOADING_MESSAGE = 'Loading your pay details…'
export const OWN_PAY_FAILED_MESSAGE = "Couldn't load your pay details, so this page can't be shown yet."
export const PERSON_PAY_LOADING_MESSAGE = 'Loading pay details…'
/** The chip / cell for one person whose pay could not be read. */
export const PAY_DETAILS_NOT_LOADED_LABEL = 'Pay details not loaded'

export function personPayFailedMessage(name: string): string {
  return `Couldn't load ${name ? `${name}'s` : 'this person’s'} pay details, so this can't be shown yet.`
}

export function PayStatusNotice({
  status,
  loadingMessage,
  failedMessage,
  onRetry,
}: {
  status: PayProfilesStatus
  loadingMessage: string
  failedMessage: string
  onRetry: () => void
}) {
  if (status === 'ready') return null
  if (status === 'loading') {
    return (
      <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700" role="status">
        {loadingMessage}
      </p>
    )
  }
  return (
    <div className="flex items-center gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
      <p className="grow">{failedMessage}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-red-800 shadow-[0_1px_2px_rgba(0,0,0,0.10)]"
      >
        Retry
      </button>
    </div>
  )
}
