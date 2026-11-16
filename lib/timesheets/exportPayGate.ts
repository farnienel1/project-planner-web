/**
 * Pay strip (review #342 item 1, re-review item 1): Export and the Exported tab's Download PDF never build a PDF from a
 * person's record while their pay is not known — it would be the stripped users document (no employment type, no
 * rate). Display wording only; the status comes from `payProfilesStatusForPerson`.
 */
import type { PayProfilesStatus } from '@/lib/pay/payProfileOverlay'

export const EXPORT_PAY_UNKNOWN_SKIPPED_MESSAGE =
  "Not exported — their pay details couldn't be loaded; press Retry, then export again."

/** The message that refuses Download PDF for `name`, or null when their pay is known. */
export function exportedPdfPayRefusal(status: PayProfilesStatus, name: string): string | null {
  if (status === 'ready') return null
  if (status === 'loading') return `${name}'s pay details are still loading — try Download PDF again in a moment.`
  return `Couldn't load ${name}'s pay details, so their PDF can't be built yet. Press Retry, then download again.`
}
