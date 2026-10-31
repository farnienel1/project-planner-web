/**
 * Manager decisions on a timesheet's price work and expense entries, and which
 * parts of `organizations/{orgId}/settings/timesheet_*` the person whose sheet
 * it is may write.
 *
 * Rule (both apps, enforced by firestore.rules):
 *   - A person never decides their own pay. `payrollLineReviews` and
 *     `extraEntryReviews` are written only by the person's line manager or an
 *     admin. `weeklyReportOverride` (the approved snapshot invoices and weekly
 *     reports read) is written by the owner only when they have no line manager
 *     (a self-signed sheet). Once the line manager has signed, the owner cannot
 *     change `expenseEntries` or `priceWorkEntries`.
 *   - `managerNote` is the owner's "Note to manager". It stays owner-written.
 *   - The authoritative decision for an entry is `extraEntryReviews[entryId]`
 *     `{ decision, revisedAmount, reviewedAmount, reviewedByUserId, reviewedAtMs }`.
 *     A review made against a different amount than the entry now has is stale:
 *     the entry is `pending` again until the manager reviews it.
 *   - The inline `managerDecision` / `managerRevisedAmount` on each entry is
 *     still written (old builds read it) but the owner can write it too, so it
 *     is trusted only when it lowers the amount paid, or on a legacy sheet
 *     (no `extraEntryReviews` field) that the line manager has already signed,
 *     where the rules stop the owner changing the entries.
 *   - An entry nobody has reviewed counts as `approved` at its own amount, as
 *     both apps create entries today.
 *
 * Plain data only; each app converts its own document shape.
 */

import { parseTimesheetStatusFields } from './timesheetPeriod'

export type TimesheetEntryDecision = 'pending' | 'approved' | 'declined' | 'edited'

export const TIMESHEET_ENTRY_DECISIONS: readonly TimesheetEntryDecision[] = ['pending', 'approved', 'declined', 'edited']

/** Manager-only map: entry id → review. */
export const TIMESHEET_ENTRY_REVIEWS_FIELD = 'extraEntryReviews'

/** Written only by the line manager or an admin. */
export const TIMESHEET_REVIEWER_ONLY_FIELDS = ['payrollLineReviews', 'extraEntryReviews'] as const

/** The owner writes it only when they have no line manager (self-signed). */
export const TIMESHEET_SELF_SIGNED_OWNER_FIELDS = ['weeklyReportOverride'] as const

/** Frozen for the owner once the line manager has signed. */
export const TIMESHEET_ENTRY_ARRAY_FIELDS = ['expenseEntries', 'priceWorkEntries'] as const

const AMOUNT_EPSILON = 0.005

export type TimesheetEntryReview = {
  decision: TimesheetEntryDecision
  revisedAmount: number | null
  /** The entry amount the decision was made against. Missing on a review that predates it. */
  reviewedAmount: number | null
  reviewedByUserId: string
  reviewedAtMs: number | null
}

export type TimesheetEntryDecisionSource =
  | 'review'
  | 'stale-review'
  | 'unreviewed'
  | 'legacy-inline'
  | 'inline-lower'

export type TimesheetEntryDecisionResult = {
  decision: TimesheetEntryDecision
  revisedAmount: number | null
  source: TimesheetEntryDecisionSource
}

function finite(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  return Number.isFinite(number) ? number : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Unknown or missing is `approved`, as both apps decode it today. */
export function parseTimesheetEntryDecision(raw: unknown): TimesheetEntryDecision {
  return (TIMESHEET_ENTRY_DECISIONS as readonly unknown[]).includes(raw) ? (raw as TimesheetEntryDecision) : 'approved'
}

function parseReview(raw: unknown): TimesheetEntryReview | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const decision = parseTimesheetEntryDecision(row.decision)
  return {
    decision,
    revisedAmount: decision === 'edited' ? finite(row.revisedAmount) : null,
    reviewedAmount: finite(row.reviewedAmount),
    reviewedByUserId: text(row.reviewedByUserId),
    reviewedAtMs: finite(row.reviewedAtMs),
  }
}

/** The stored map, or null when the sheet has no `extraEntryReviews` field (a legacy sheet). */
export function parseTimesheetEntryReviews(
  sheet: Record<string, unknown> | null | undefined
): Record<string, TimesheetEntryReview> | null {
  const raw = sheet ? sheet[TIMESHEET_ENTRY_REVIEWS_FIELD] : undefined
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const output: Record<string, TimesheetEntryReview> = {}
  for (const [entryId, value] of Object.entries(raw as Record<string, unknown>)) {
    const review = parseReview(value)
    if (review && entryId.trim()) output[entryId] = review
  }
  return output
}

/** Amount paid for an entry under a decision. */
export function timesheetEntryEffectiveAmount(
  decision: TimesheetEntryDecision,
  revisedAmount: number | null | undefined,
  amount: number
): number {
  if (decision === 'declined') return 0
  if (decision === 'edited') return finite(revisedAmount) ?? amount
  return amount
}

/**
 * The decision in effect for one price work or expense entry. `sheet` is the
 * stored timesheet document (its `extraEntryReviews` and `managerSignedAt`),
 * `entry` the stored entry row (`id`, `amount`, inline `managerDecision`,
 * `managerRevisedAmount`).
 */
export function timesheetEntryDecision(
  sheet: Record<string, unknown> | null | undefined,
  entry: Record<string, unknown> | null | undefined
): TimesheetEntryDecisionResult {
  const row = entry || {}
  const id = text(row.id)
  const amount = finite(row.amount) ?? 0
  const inlineDecision = parseTimesheetEntryDecision(row.managerDecision)
  const inline: TimesheetEntryDecisionResult = {
    decision: inlineDecision,
    revisedAmount: inlineDecision === 'edited' ? finite(row.managerRevisedAmount) : null,
    source: 'legacy-inline',
  }
  const reviews = parseTimesheetEntryReviews(sheet)

  let base: TimesheetEntryDecisionResult
  if (reviews == null) {
    // Legacy sheet. Inline values are trusted once the line manager has signed: the rules then
    // stop the owner changing the entries, and the manager signed with these decisions on screen.
    const managerSigned = parseTimesheetStatusFields(sheet || {}).managerSignedAtMs != null
    if (managerSigned) return inline
    base = { decision: 'approved', revisedAmount: null, source: 'unreviewed' }
  } else {
    const review = id ? reviews[id] : undefined
    if (!review) {
      base = { decision: 'approved', revisedAmount: null, source: 'unreviewed' }
    } else if (review.reviewedAmount != null && Math.abs(review.reviewedAmount - amount) >= AMOUNT_EPSILON) {
      base = { decision: 'pending', revisedAmount: null, source: 'stale-review' }
    } else {
      base = { decision: review.decision, revisedAmount: review.revisedAmount, source: 'review' }
    }
  }

  // The owner can write the inline value, so it only ever lowers what is paid.
  const inlinePaid = timesheetEntryEffectiveAmount(inline.decision, inline.revisedAmount, amount)
  const basePaid = timesheetEntryEffectiveAmount(base.decision, base.revisedAmount, amount)
  if (inlinePaid < basePaid - AMOUNT_EPSILON) return { ...inline, source: 'inline-lower' }
  return base
}

export type TimesheetEntryReviewInput = {
  id: string
  amount: number
  managerDecision: TimesheetEntryDecision
  managerRevisedAmount?: number | null
}

function sameNumber(a: number | null | undefined, b: number | null | undefined): boolean {
  const left = finite(a)
  const right = finite(b)
  if (left == null || right == null) return left == null && right == null
  return Math.abs(left - right) < AMOUNT_EPSILON
}

/**
 * Dotted update fields (`extraEntryReviews.{entryId}`) for every entry whose
 * decision, revised amount, or reviewed amount differs from the stored review.
 * Line manager and admin writes only. Pass `stored` as parsed from the sheet
 * (null for a legacy sheet: every entry is written, which moves it to the map).
 * Empty when nothing changed. Use with `updateDoc` (web) / `updateData` (iOS).
 */
export function timesheetEntryReviewWriteFields(input: {
  stored: Record<string, TimesheetEntryReview> | null | undefined
  entries: readonly TimesheetEntryReviewInput[]
  reviewedByUserId: string
  reviewedAtMs: number
}): Record<string, Record<string, unknown>> {
  const stored = input.stored || {}
  const reviewer = text(input.reviewedByUserId)
  const output: Record<string, Record<string, unknown>> = {}
  for (const entry of input.entries) {
    const id = text(entry.id)
    if (!id || /[.`~*/[\]]/.test(id)) continue
    const decision = parseTimesheetEntryDecision(entry.managerDecision)
    const revisedAmount = decision === 'edited' ? finite(entry.managerRevisedAmount) : null
    const amount = finite(entry.amount) ?? 0
    const prior = stored[id]
    if (
      input.stored &&
      prior &&
      prior.decision === decision &&
      sameNumber(prior.revisedAmount, revisedAmount) &&
      sameNumber(prior.reviewedAmount, amount)
    ) {
      continue
    }
    output[`${TIMESHEET_ENTRY_REVIEWS_FIELD}.${id}`] = {
      decision,
      revisedAmount,
      reviewedAmount: amount,
      reviewedByUserId: reviewer,
      reviewedAtMs: Math.round(Number(input.reviewedAtMs) || 0),
    }
  }
  return output
}

/** Stored review map after applying `timesheetEntryReviewWriteFields` output. */
export function timesheetEntryReviewsAfterWrite(
  stored: Record<string, TimesheetEntryReview> | null | undefined,
  written: Record<string, Record<string, unknown>>
): Record<string, TimesheetEntryReview> | null {
  const keys = Object.keys(written)
  if (keys.length === 0) return stored ?? null
  const output: Record<string, TimesheetEntryReview> = { ...(stored || {}) }
  const prefix = `${TIMESHEET_ENTRY_REVIEWS_FIELD}.`
  for (const key of keys) {
    const review = parseReview(written[key])
    if (review && key.startsWith(prefix)) output[key.slice(prefix.length)] = review
  }
  return output
}

/**
 * Whether a timesheet write counts as the reviewer's (line manager or admin) — the
 * same test as firestore.rules `isTimesheetReviewer`. Admins always; otherwise
 * someone other than the subject whose own id or former invite id is one of the
 * subject's line managers (`lineManagerIds`).
 */
export function timesheetWriterIsReviewer(input: {
  writerUserId: string | null | undefined
  subjectUserId: string | null | undefined
  writerIsAdmin?: boolean | null
  writerFormerIds?: readonly string[] | null
  subjectLineManagerIds?: readonly string[] | null
}): boolean {
  const writer = text(input.writerUserId).toLowerCase()
  if (!writer) return false
  if (input.writerIsAdmin === true) return true
  if (writer === text(input.subjectUserId).toLowerCase()) return false
  const keys = new Set([writer, ...(input.writerFormerIds ?? []).map((id) => text(id).toLowerCase())].filter(Boolean))
  return (input.subjectLineManagerIds ?? []).some((id) => keys.has(text(id).toLowerCase()))
}

/**
 * The owner's save without the parts only a reviewer writes. Drops
 * `payrollLineReviews` and `extraEntryReviews`; drops `weeklyReportOverride`
 * when the owner has a line manager; drops the entry arrays once the sheet
 * carries a manager sign-off (`managerSignedAt` / `approvedAt`). Both apps merge (`setDoc` merge / `setData(merge: true)`),
 * so the stored values stay. Owner-only fields such as `managerNote` are kept.
 */
export function timesheetOwnerWriteFields<T extends Record<string, unknown>>(
  fields: T,
  input: { subjectHasLineManager: boolean; managerSigned: boolean }
): Partial<T> {
  const output: Record<string, unknown> = { ...fields }
  for (const key of TIMESHEET_REVIEWER_ONLY_FIELDS) delete output[key]
  for (const key of Object.keys(output)) {
    if (key.startsWith(`${TIMESHEET_ENTRY_REVIEWS_FIELD}.`)) delete output[key]
  }
  if (input.subjectHasLineManager) {
    for (const key of TIMESHEET_SELF_SIGNED_OWNER_FIELDS) delete output[key]
  }
  if (input.managerSigned) {
    for (const key of TIMESHEET_ENTRY_ARRAY_FIELDS) delete output[key]
  }
  return output as Partial<T>
}
