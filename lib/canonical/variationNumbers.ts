/**
 * Rulebook 1.22.0 (§22, audit finding 8): variation (VO) numbers on every platform.
 *
 * - **The number of a label is its trailing digits only** (owner decision): "VO-003" → 3, "V2-003" → 3, "VO-12a" → 0.
 *   Before 1.22.0 iOS joined every digit ("V2-003" → 2003) and wrote "V2-2004" where web wrote "V2-004".
 * - **The next number** is one higher than any number already issued on the job — open, submitted, closed and
 *   deleted variations all count, so a number is never reused — formatted with the tracker prefix and padding
 *   (`variationTrackers/{parentId}` `prefix`, `padding`; default "VO-", 3). Gaps stay empty.
 * - **A number is taken** when another variation of the job — deleted ones included — already has it, compared
 *   trimmed and without case (owner decision: never reuse a number that was ever issued; iOS skipped deleted ones).
 *
 * Plain inputs only, so iOS calls it through JavaScriptCore.
 */

import { normalizeDocumentId } from './scheduleSources'

export const DEFAULT_VARIATION_PREFIX = 'VO-'
export const DEFAULT_VARIATION_PADDING = 3

/** The trailing digits of a VO label as a number; 0 when it does not end in digits. */
export function variationNumberValue(voNumber: unknown): number {
  const match = /(\d+)\s*$/.exec(String(voNumber ?? '').trim())
  return match ? Number(match[1]) : 0
}

/** `prefix` + the sequence padded with zeros to `padding` digits (at least 1). */
export function formatVariationNumber(sequence: number, prefix: string = DEFAULT_VARIATION_PREFIX, padding: number = DEFAULT_VARIATION_PADDING): string {
  const safe = Math.max(0, Math.floor(Number(sequence) || 0))
  const raw = Number(padding)
  const width = Math.max(1, Math.floor(Number.isFinite(raw) ? raw : DEFAULT_VARIATION_PADDING))
  return `${prefix ?? DEFAULT_VARIATION_PREFIX}${String(safe).padStart(width, '0')}`
}

/**
 * The next VO number for a job: one higher than the highest trailing number in `existingNumbers` (every variation of
 * the job, deleted included), with the tracker's `prefix` and `padding`.
 */
export function nextVariationNumber(
  existingNumbers: ReadonlyArray<string | null | undefined> | null | undefined,
  prefix: string = DEFAULT_VARIATION_PREFIX,
  padding: number = DEFAULT_VARIATION_PADDING
): string {
  const max = (existingNumbers || []).reduce<number>((highest, value) => Math.max(highest, variationNumberValue(value)), 0)
  return formatVariationNumber(max + 1, prefix, padding)
}

export type VariationNumberRow = { id?: string | null; voNumber?: string | null; isDeleted?: boolean | null }

/**
 * Whether `voNumber` is already used on the job by a variation other than `exceptId` (ids compared without case).
 * Deleted variations count. A blank number is never taken.
 */
export function variationNumberTaken(
  existing: ReadonlyArray<VariationNumberRow> | null | undefined,
  voNumber: string | null | undefined,
  exceptId?: string | null
): boolean {
  const needle = String(voNumber ?? '').trim().toLowerCase()
  if (!needle) return false
  const skip = exceptId ? normalizeDocumentId(exceptId) : ''
  return (existing || []).some((row) => {
    if (!row) return false
    if (skip && row.id != null && normalizeDocumentId(row.id) === skip) return false
    return String(row.voNumber ?? '').trim().toLowerCase() === needle
  })
}
