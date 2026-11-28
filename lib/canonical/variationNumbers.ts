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

/** A number ever issued to a variation (1.96.0): its current `voNumber` and each `numberHistory` entry's from / to. */
export type VariationIssuedNumberRow = {
  voNumber?: string | null
  numberHistory?: ReadonlyArray<{ from?: unknown; to?: unknown } | null | undefined> | null
}

/**
 * Every VO number ever issued on a job (1.96.0): each variation's current number and every number its renumber history
 * (`numberHistory`) names, deleted variations included. A plain string is a current number.
 */
export function variationIssuedNumbers(
  rows: ReadonlyArray<string | VariationIssuedNumberRow | null | undefined> | null | undefined
): string[] {
  const out: string[] = []
  for (const row of rows || []) {
    if (row == null) continue
    if (typeof row === 'string') {
      out.push(row)
      continue
    }
    if (row.voNumber != null) out.push(String(row.voNumber))
    for (const entry of row.numberHistory || []) {
      if (!entry) continue
      if (entry.from != null) out.push(String(entry.from))
      if (entry.to != null) out.push(String(entry.to))
    }
  }
  return out
}

/**
 * The next VO number for a job: one higher than the highest trailing number ever issued on it, with the tracker's
 * `prefix` and `padding`. `existing` is every variation of the job, deleted included — current numbers as strings, or
 * rows with their `numberHistory` (1.96.0: a number freed by a renumber, VO-005 renumbered to VO-003, is never issued
 * again; `variationRenumberPlan` already counted it).
 */
export function nextVariationNumber(
  existing: ReadonlyArray<string | VariationIssuedNumberRow | null | undefined> | null | undefined,
  prefix: string = DEFAULT_VARIATION_PREFIX,
  padding: number = DEFAULT_VARIATION_PADDING
): string {
  const max = variationIssuedNumbers(existing).reduce<number>((highest, value) => Math.max(highest, variationNumberValue(value)), 0)
  return formatVariationNumber(max + 1, prefix, padding)
}

export type VariationNumberRow = VariationIssuedNumberRow & { id?: string | null; isDeleted?: boolean | null }

/**
 * Whether `voNumber` is already used on the job by a variation other than `exceptId` (ids compared without case).
 * Deleted variations count. A blank number is never taken. 1.96.0: a number another variation once had (its
 * `numberHistory`) is taken too — a number ever issued is never reused; the variation being edited (`exceptId`) may
 * keep its own.
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
    return variationIssuedNumbers([row]).some((value) => value.trim().toLowerCase() === needle)
  })
}
