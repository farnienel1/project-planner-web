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
 *     the entry is `pending` again until the manager reviews it. 1.45.0: a review
 *     written from 1.45.0 also stores `reviewedFingerprint`
 *     (`timesheetEntryFingerprint`: the entry's own fields and evidence), and is
 *     stale when the entry's fingerprint differs — any owner change reopens it, as
 *     PAYE does. A review stored before 1.45.0 (no fingerprint) keeps the
 *     amount-only rule, so no older decision is reopened.
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

import { normalizeDocumentId } from './scheduleSources'
import { personIdSet, type PersonRosterRow } from './personIds'
import { parseTimesheetStatusFields } from './timesheetPeriod'
import { documentInstantMs, documentWriteFields, type DocumentWriteFields } from './peopleDocuments'
import { roundPennies } from './payRate'
import { overtimeFingerprintKey, overtimeFingerprintsMatch } from './bookingFingerprint'

export type TimesheetEntryDecision = 'pending' | 'approved' | 'declined' | 'edited'

export const TIMESHEET_ENTRY_DECISIONS: readonly TimesheetEntryDecision[] = ['pending', 'approved', 'declined', 'edited']

/** Manager-only map: entry id → review. */
export const TIMESHEET_ENTRY_REVIEWS_FIELD = 'extraEntryReviews'

/** Written only by the line manager or an admin. */
export const TIMESHEET_REVIEWER_ONLY_FIELDS = ['payrollLineReviews', 'extraEntryReviews'] as const

/** The owner writes it only when they have no line manager (self-signed). */
export const TIMESHEET_SELF_SIGNED_OWNER_FIELDS = ['weeklyReportOverride'] as const

/**
 * The manager counter-sign and export fields (`timesheetSignOffWriteFields` role `manager`,
 * `timesheetExportWriteFields`), under their stored names and the `…Ms` names those builders return. Only the
 * line manager or an admin writes them; `timesheetOwnerWriteFields` always drops them.
 */
export const TIMESHEET_MANAGER_SIGN_OFF_FIELDS = [
  'managerSignedAt',
  'managerSignedAtMs',
  'managerSignedByName',
  'managerSignedByUserId',
  'managerSignatureImageBase64',
  'approvedAt',
  'approvedAtMs',
  'approvedByName',
  'exportedAt',
  'exportedAtMs',
] as const

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
  /** 1.45.0: `timesheetEntryFingerprint` of the entry the decision was made against; null on older reviews. */
  reviewedFingerprint: string | null
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
    reviewedFingerprint: text(row.reviewedFingerprint) || null,
  }
}

function fingerprintText(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof value === 'string' ? value.trim() : ''
}

export type TimesheetFingerprintKind = 'priceWork' | 'expense'

/**
 * Rulebook 1.45.0 §8 (review #322): the fingerprint of a timesheet price work or expense entry **as stored** — the
 * row's own name, description, job number, agreed manager (price work), dates, amount (to the penny) and evidence
 * paths (as stored, all of them, sorted, so a reorder never reopens a review). Nothing is defaulted: a missing date or
 * agreed manager fingerprints as missing. `kind` is the array the row is in (`priceWorkEntries` / `expenseEntries`),
 * never guessed from its fields. Decisions and revised amounts are not part of it.
 *
 * One input everywhere: the reader (`parseTimesheetEntries`) computes it from the stored row and returns it as each
 * entry's `reviewFingerprint`; an app keeps that value on its loaded copy, and `timesheetEntryDecision` /
 * `timesheetEntryReviewWriteFields` use a row's `reviewFingerprint` when it carries one, so a display copy (dates
 * filled in, evidence filtered to the owner's files) never decides. A line manager's review stores it
 * (`reviewedFingerprint`); when the stored entry's fingerprint later differs, the review is stale.
 */
export function timesheetEntryFingerprint(entry: Record<string, unknown> | null | undefined, kind: TimesheetFingerprintKind): string {
  const row = entry || {}
  const when = (value: unknown) => {
    const ms = documentInstantMs(value)
    return ms == null ? '' : String(ms)
  }
  const amount = finite(row.amount)
  const evidence = (Array.isArray(row.evidence) ? row.evidence : [])
    .map((item) => (item && typeof item === 'object' ? fingerprintText((item as Record<string, unknown>).path) : ''))
    .filter(Boolean)
    .sort()
  return JSON.stringify([
    kind,
    fingerprintText(row.title),
    fingerprintText(row.details),
    fingerprintText(row.jobNumber),
    kind === 'priceWork' ? fingerprintText(row.agreedManagerName) : '',
    kind === 'expense' ? when(row.date) : '',
    kind === 'priceWork' ? when(row.startDate ?? row.date) : '',
    kind === 'priceWork' ? when(row.endDate) : '',
    amount == null ? '' : (Math.round(amount * 100) / 100).toFixed(2),
    evidence,
  ])
}

/** The array a stored entry id is in (`priceWorkEntries` first), else `fallback`. */
function entryKindInSheet(sheet: Record<string, unknown> | null | undefined, id: string, fallback: TimesheetFingerprintKind): TimesheetFingerprintKind {
  const key = normalizeDocumentId(id)
  if (!key || !sheet) return fallback
  const has = (field: string) =>
    Array.isArray(sheet[field]) &&
    (sheet[field] as unknown[]).some((row) => row && typeof row === 'object' && normalizeDocumentId((row as Record<string, unknown>).id) === key)
  if (has('priceWorkEntries')) return 'priceWork'
  if (has('expenseEntries')) return 'expense'
  return fallback
}

/**
 * The fingerprint a row stands for (review #322 hardening): the value the app computed with the reader for its loaded
 * copy (`trusted`, from `parseTimesheetEntries` → `reviewFingerprint`, passed as an argument), else the row's own
 * fingerprint — it is then the stored row. A `reviewFingerprint` field on the row itself is never read: stored data
 * could carry a forged one.
 */
function rowFingerprint(row: Record<string, unknown>, kind: TimesheetFingerprintKind, trusted?: string | null): string {
  return text(trusted) || timesheetEntryFingerprint(row, kind)
}

/**
 * Rulebook 1.45.0 (review #322): the fingerprints an app computed with `parseTimesheetEntries` for its loaded copy,
 * by entry id, to pass as `entryFingerprints` to `timesheetInvoiceRows` / `timesheetTotals` when the sheet it passes
 * is a display copy (dates filled in, evidence filtered). Never built from stored data.
 */
export function timesheetEntryFingerprintMap(
  entries: ReadonlyArray<{ id?: unknown; reviewFingerprint?: unknown } | null | undefined> | null | undefined
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const entry of entries || []) {
    const id = text(entry?.id)
    const fingerprint = text(entry?.reviewFingerprint)
    if (id && fingerprint) out[normalizeDocumentId(id)] = fingerprint
  }
  return out
}

/** The trusted fingerprint for an entry id from such a map (ids without case). */
export function timesheetTrustedFingerprint(map: Record<string, string> | null | undefined, id: unknown): string | null {
  if (!map) return null
  return map[normalizeDocumentId(id)] ?? null
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

/**
 * The review stored for an entry id. The exact key first; otherwise a key that differs only by letter case
 * (`normalizeDocumentId`), so an upper-case iOS entry id finds a review a web device wrote under lower case.
 */
function reviewFor(
  reviews: Record<string, TimesheetEntryReview>,
  entryId: string
): TimesheetEntryReview | undefined {
  const key = reviewKeyFor(reviews, entryId)
  return key == null ? undefined : reviews[key]
}

/** The stored key of an entry's review: the exact id, else one that differs only by letter case. */
function reviewKeyFor(reviews: Record<string, TimesheetEntryReview>, entryId: string): string | undefined {
  if (Object.prototype.hasOwnProperty.call(reviews, entryId)) return entryId
  const needle = normalizeDocumentId(entryId)
  return Object.keys(reviews).find((candidate) => normalizeDocumentId(candidate) === needle)
}

/** Amount paid for an entry under a decision. */
export function timesheetEntryEffectiveAmount(
  decision: TimesheetEntryDecision,
  revisedAmount: number | null | undefined,
  amount: number
): number {
  if (decision === 'declined') return 0
  // 1.46.0: a revised amount is money and counts in pennies (`roundPennies`), whatever was stored (older saves kept
  // the unrounded hours-ratio result, e.g. 176.47058823529).
  if (decision === 'edited') {
    const revised = finite(revisedAmount)
    return revised == null ? amount : roundPennies(revised)
  }
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
  entry: Record<string, unknown> | null | undefined,
  /** 1.45.0: the array the entry is in; found in `sheet` by id when not given. */
  kind?: TimesheetFingerprintKind | null,
  /**
   * 1.45.0: the entry's fingerprint as the reader computed it for the app's loaded copy (`reviewFingerprint` of
   * `parseTimesheetEntries`), when `entry` is that copy rather than the stored row. Never taken from the row.
   */
  trustedFingerprint?: string | null
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
    const review = id ? reviewFor(reviews, id) : undefined
    if (!review) {
      base = { decision: 'approved', revisedAmount: null, source: 'unreviewed' }
    } else if (
      review.reviewedFingerprint != null &&
      review.reviewedFingerprint !== rowFingerprint(row, kind ?? entryKindInSheet(sheet, id, row.startDate != null ? 'priceWork' : 'expense'), trustedFingerprint)
    ) {
      // 1.45.0: any change to the entry's own fields or evidence since the review reopens it.
      base = { decision: 'pending', revisedAmount: null, source: 'stale-review' }
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
  /**
   * 1.45.0: the stored row's fingerprint as the reader returned it (`reviewFingerprint`). With it the review stores
   * `reviewedFingerprint`; without it (an older caller passing only id and amount) the review is written amount-only.
   */
  reviewFingerprint?: string | null
  title?: unknown
  [field: string]: unknown
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
    const fingerprint = text(entry.reviewFingerprint) || null
    const storedKey = input.stored ? reviewKeyFor(stored, id) : undefined
    const prior = storedKey != null ? stored[storedKey] : undefined
    // Whether the stored review still applies to the entry as stored (the reader's rule, `timesheetEntryDecision`).
    const priorCurrent =
      prior != null &&
      (prior.reviewedFingerprint != null && fingerprint != null
        ? prior.reviewedFingerprint === fingerprint
        : prior.reviewedAmount == null || sameNumber(prior.reviewedAmount, amount))
    // 1.45.0 (review #322, §1 partial writes): only the reviews this save changes are written — a current review whose
    // decision and revised amount are unchanged is never rewritten (its reviewer, time and stored fields stay, an
    // older review is not stamped with a fingerprint); an entry still pending with no current review has nothing to
    // record.
    if (input.stored && prior && priorCurrent && prior.decision === decision && sameNumber(prior.revisedAmount, revisedAmount)) continue
    if (input.stored && decision === 'pending' && !priorCurrent) continue
    // A review stored under the id in another letter case is updated under that key, never a second one.
    output[`${TIMESHEET_ENTRY_REVIEWS_FIELD}.${storedKey ?? id}`] = {
      decision,
      revisedAmount,
      reviewedAmount: amount,
      ...(fingerprint != null ? { reviewedFingerprint: fingerprint } : {}),
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
 * same test as firestore.rules `isTimesheetReviewer`. Never the subject: a write by the
 * person whose sheet it is, under any of their ids (their own id, `writerFormerIds`,
 * `writerAliasIds`, and with `roster` every id `personIdSet` finds), is the owner's — admins
 * and the Super Admin included (rulebook 1.30.2; before it an admin counted as the reviewer of
 * their own sheet and could counter-sign it). Otherwise admins always; else someone whose own
 * id or former invite id is one of the subject's line managers (`lineManagerIds`).
 * A self-signed owner (`timesheetSelfSigned`) signs through the owner path
 * (`timesheetOwnerWriteFields` with `subjectHasLineManager: false`).
 */
export function timesheetWriterIsReviewer(input: {
  writerUserId: string | null | undefined
  subjectUserId: string | null | undefined
  writerIsAdmin?: boolean | null
  writerFormerIds?: readonly string[] | null
  /** Other users documents on the writer's email (`sameEmailUserIds`). */
  writerAliasIds?: readonly string[] | null
  subjectLineManagerIds?: readonly string[] | null
  /** The organisation roster: the writer's ids are `personIdSet(writer, roster)`. */
  roster?: ReadonlyArray<PersonRosterRow> | null
}): boolean {
  const writer = text(input.writerUserId).toLowerCase()
  if (!writer) return false
  const writerIds = personIdSet(
    {
      id: text(input.writerUserId),
      formerUserIds: input.writerFormerIds ?? [],
      sameEmailUserIds: input.writerAliasIds ?? [],
    },
    input.roster ?? []
  )
  const keys = new Set([writer, ...writerIds.map((id) => text(id).toLowerCase())].filter(Boolean))
  if (keys.has(text(input.subjectUserId).toLowerCase())) return false
  if (input.writerIsAdmin === true) return true
  // Line managers: the writer's own id or a former invite id (as the rules read `formerUserIds`).
  const managerKeys = new Set(
    [writer, ...(input.writerFormerIds ?? []).map((id) => text(id).toLowerCase())].filter(Boolean)
  )
  return (input.subjectLineManagerIds ?? []).some((id) => managerKeys.has(text(id).toLowerCase()))
}

/**
 * The owner's save without the parts only a reviewer writes. Always drops `payrollLineReviews`,
 * `extraEntryReviews` (and its dotted keys) and the manager sign-off and export fields
 * (`TIMESHEET_MANAGER_SIGN_OFF_FIELDS`, including dotted keys under them); drops `weeklyReportOverride` when the
 * owner has a line manager; drops the entry arrays once the sheet carries a manager sign-off
 * (`managerSignedAt` / `approvedAt`). The owner's own fields (`managerNote`, their operative signature) stay.
 * The result is what the owner may send: each app writes only the fields that changed, as a partial update
 * (`updateDoc` / `updateData`), so stored manager values are never resent. A reviewer saving someone else's
 * sheet does not use this.
 */
export function timesheetOwnerWriteFields<T extends Record<string, unknown>>(
  fields: T,
  input: { subjectHasLineManager: boolean; managerSigned: boolean }
): Partial<T> {
  const output: Record<string, unknown> = { ...fields }
  const drop = (key: string) => {
    for (const written of Object.keys(output)) {
      if (written === key || written.startsWith(`${key}.`)) delete output[written]
    }
  }
  for (const key of TIMESHEET_REVIEWER_ONLY_FIELDS) drop(key)
  for (const key of TIMESHEET_MANAGER_SIGN_OFF_FIELDS) drop(key)
  if (input.subjectHasLineManager) {
    for (const key of TIMESHEET_SELF_SIGNED_OWNER_FIELDS) drop(key)
  }
  if (input.managerSigned) {
    for (const key of TIMESHEET_ENTRY_ARRAY_FIELDS) drop(key)
  }
  // 1.45.0 (review #322): a fingerprint is never stored on an entry (the reader computes it; a stored one is ignored).
  for (const key of TIMESHEET_ENTRY_ARRAY_FIELDS) {
    if (Array.isArray(output[key])) {
      output[key] = (output[key] as unknown[]).map((row) => {
        if (!row || typeof row !== 'object' || !('reviewFingerprint' in (row as object))) return row
        const { reviewFingerprint: _ignored, ...rest } = row as Record<string, unknown>
        void _ignored
        return rest
      })
    }
  }
  return output as Partial<T>
}

/** Fields never part of a timesheet diff: write metadata the app stamps itself, and create-only identity. */
const TIMESHEET_DIFF_IGNORED_FIELDS = ['updatedAt', 'updatedBy', 'updatedFrom', 'createdAt'] as const

/**
 * 1.9.0 (§1, §8): what a timesheet save writes — the fields that differ between `base`, the sheet as this editor
 * loaded it, and `next`, the sheet it would save (both in stored field shape). `{ set, remove }`; a `null` in `next`
 * removes a field only when `base` had one. A field the editor did not change is never sent, so an owner's
 * signature, expenses or price work saved on another device after this editor loaded the sheet stay as stored
 * (before 1.9.0 the save diffed the whole local draft against the server copy and wrote every difference back).
 * Without a `base` (a sheet that was never loaded) every non-null field of `next` is written.
 */
export function timesheetChangedFields(
  base: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
): DocumentWriteFields {
  const strip = (row: Record<string, unknown> | null | undefined) => {
    if (!row) return row
    const out: Record<string, unknown> = { ...row }
    for (const key of TIMESHEET_DIFF_IGNORED_FIELDS) delete out[key]
    return out
  }
  return documentWriteFields(strip(base) ?? null, strip(next) ?? {}, { createOnly: ['userId'] })
}

// MARK: - Payroll line reviews (1.10.0, L13)

export type PayrollLineReview = {
  decision: TimesheetEntryDecision
  /** The amount an `edited` decision pays; null otherwise. */
  revisedAmount: number | null
  /**
   * 1.46.0 Edit hours (`revisedPayrollLineAmounts` → `PayrollLineEditReviewFields`), on an `edited` review only; null
   * when the review was stored without them (older reviews, approve / decline). The hours and money of each part.
   */
  revisedStandardHours?: number | null
  revisedOvertimeHours?: number | null
  revisedOvertimeClockHours?: number | null
  revisedOvertimeMultiplier?: number | null
  revisedStandardAmount?: number | null
  revisedOvertimeAmount?: number | null
  /** The booking fingerprint the review was made against (`overtimeBookingFingerprint`); null when not stored. */
  reviewedBookingFingerprint?: string | null
}

/**
 * Rulebook 1.46.0: the identity of a review as it applies to a line — its decision, amount, the Edit hours fields and
 * the booking fingerprint — so a signed snapshot line can record which review was applied when it was signed
 * (`appliedReviewKey`) and a later save re-applies a review only when it is a different one. '' for no review.
 */
export function payrollLineReviewKey(review: PayrollLineReview | null | undefined): string {
  if (!review) return ''
  const n = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? String(value) : '')
  return [
    review.decision,
    n(review.revisedAmount),
    n(review.revisedStandardHours),
    n(review.revisedOvertimeHours),
    n(review.revisedOvertimeClockHours),
    n(review.revisedOvertimeMultiplier),
    n(review.revisedStandardAmount),
    n(review.revisedOvertimeAmount),
    overtimeFingerprintKey(review.reviewedBookingFingerprint ?? ''),
  ].join('|')
}

/**
 * A live payroll line as the review is checked against it: the booking's fingerprint as it is now, whether the line is
 * an overtime line, and whether the booking now has its own overtime line on the sheet. A signed snapshot line is
 * checked the same way with the values it was signed with (`bookingFingerprint`, `bookingHadOvertimeLine`).
 */
export type PayrollLineLiveBooking = {
  bookingFingerprint?: string | null
  isOvertimeLine?: boolean | null
  bookingHasOvertimeLine?: boolean | null
}

/**
 * The line manager's review of one payroll (labour) line, `sheet.payrollLineReviews[lineId]`. The line id is matched
 * as stored first, then without case (`normalizeDocumentId`): iOS keys reviews by `UUID.uuidString` (upper case) and
 * web by the stored line id, so either app finds the other's review. Null when the line has no review.
 */
export function payrollLineReview(
  sheet: Record<string, unknown> | null | undefined,
  lineId: string | null | undefined,
  live?: PayrollLineLiveBooking | null
): PayrollLineReview | null {
  const raw = sheet && typeof sheet === 'object' ? (sheet as Record<string, unknown>).payrollLineReviews : null
  if (!raw || typeof raw !== 'object') return null
  const reviews = raw as Record<string, unknown>
  const id = typeof lineId === 'string' ? lineId.trim() : ''
  if (!id) return null
  let value = Object.prototype.hasOwnProperty.call(reviews, id) ? reviews[id] : undefined
  if (value === undefined) {
    const needle = normalizeDocumentId(id)
    const key = Object.keys(reviews).find((candidate) => normalizeDocumentId(candidate) === needle)
    value = key == null ? undefined : reviews[key]
  }
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const decision = parseTimesheetEntryDecision(row.decision)
  const revised = typeof row.revisedAmount === 'number' && Number.isFinite(row.revisedAmount) ? row.revisedAmount : null
  // 1.46.0: a review made against a booking that has changed since is stale — the line is pending at its live amount
  // (as a stale price work / expense review). Only when both the review and the live line carry a fingerprint; older
  // reviews and callers without one keep the review.
  const storedFingerprint = typeof row.reviewedBookingFingerprint === 'string' ? row.reviewedBookingFingerprint.trim() : ''
  const liveFingerprint = typeof live?.bookingFingerprint === 'string' ? live.bookingFingerprint.trim() : null
  // Slot spellings compared canonically (`overtimeFingerprintsMatch`): a review written on one app matches the booking
  // read on the other (`CUSTOM` on web, `CUSTOM_HOURS` on iOS).
  if (storedFingerprint && liveFingerprint != null && !overtimeFingerprintsMatch(storedFingerprint, liveFingerprint)) return null
  const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)
  // 1.46.0 (review): a standard-line review that carries overtime money was made when the booking had no overtime
  // line. The fingerprint does not cover the working hours, so if a working-hours change has since given the booking
  // its own overtime line, the review is stale too — the overtime is never paid on both lines.
  if (
    decision === 'edited' &&
    live?.isOvertimeLine !== true &&
    live?.bookingHasOvertimeLine === true &&
    ((num(row.revisedOvertimeAmount) ?? 0) > 0 || (num(row.revisedOvertimeHours) ?? 0) > 0)
  ) {
    return null
  }
  if (decision !== 'edited') return { decision, revisedAmount: null }
  const review: PayrollLineReview = { decision, revisedAmount: revised }
  const standardHours = num(row.revisedStandardHours)
  const overtimeHours = num(row.revisedOvertimeHours)
  if (standardHours != null && overtimeHours != null) {
    review.revisedStandardHours = standardHours
    review.revisedOvertimeHours = overtimeHours
    review.revisedOvertimeClockHours = num(row.revisedOvertimeClockHours) ?? overtimeHours
    review.revisedOvertimeMultiplier = num(row.revisedOvertimeMultiplier)
    review.revisedStandardAmount = num(row.revisedStandardAmount) ?? 0
    review.revisedOvertimeAmount = num(row.revisedOvertimeAmount) ?? 0
  }
  if (storedFingerprint) review.reviewedBookingFingerprint = storedFingerprint
  return review
}
