/**
 * Rulebook 1.54.0 §8 (owner decision 16 Nov, "allow adding after sign-off so they can re-issue"): price work and
 * expenses added after the line manager has signed — **late extras**.
 *
 * Why its own list (two independent reviews of #337): letting the person change the signed entries after the line
 * manager signed meant their pay could be raised without a new counter-signature. So the signed entries stay frozen
 * (the security rules refuse any change to `priceWorkEntries` / `expenseEntries` once `managerSignedAt` / `approvedAt`
 * is set, as before 1.54.0) and the person adds, edits and deletes entries in one more array, `lateExtras`, until the
 * sheet is exported. A late extra pays **only** once the line manager (or an admin — never the person under any id)
 * approves it in the existing review map (`extraEntryReviews[id]`, written with `lateExtra: true` and the entry's
 * `reviewedFingerprint`); any later change to the entry makes that review stale. An inline decision on a late extra is
 * never read. An unapproved late extra is pending and appears nowhere in money (invoice rows, totals, the weekly
 * report, the snapshot). The reviewer's save that approves it also adds it to the signed snapshot's money rows (marked
 * `lateExtra: true`); labour rows are never touched.
 *
 * While a late extra waits for a decision, or the snapshot's late rows differ from the approved ones, the sheet reads
 * as waiting for the line manager (`timesheetChangesWithLateExtras`): Awaiting lists, the hub count, the Payrun
 * Snapshot and the export guard treat it so, and nothing is exported. Sheets without late extras behave exactly as
 * before 1.54.0.
 */

import { roundPennies } from './payRate'
import { normalizeDocumentId } from './scheduleSources'
import type { SignedTimesheetBookingChanges } from './timesheetBookingChanges'
import {
  parseTimesheetEntryReviews,
  timesheetEntryEffectiveAmount,
  timesheetEntryFingerprint,
  timesheetEntryReviewFor,
  type TimesheetEntryDecision,
} from './timesheetEntryReviews'
import { timesheetExportedFieldSet } from './timesheetSnapshot'
import {
  parseTimesheetEntries,
  type TimesheetExpenseEntryDocument,
  type TimesheetPriceWorkEntryDocument,
} from './workDocumentReaders'

/** The array on `settings/timesheet_*` the person writes after the line manager signed (until exported). */
export const TIMESHEET_LATE_EXTRAS_FIELD = 'lateExtras'

export type TimesheetLateExtraKind = 'priceWork' | 'expense'

/** The person's label on a late extra still waiting for a decision. */
export const TIMESHEET_LATE_EXTRA_WAITING_LABEL = 'Added after sign-off — waiting for your line manager'
export const TIMESHEET_LATE_EXTRA_APPROVED_LABEL = 'Added after sign-off — approved'
export const TIMESHEET_LATE_EXTRA_DECLINED_LABEL = 'Added after sign-off — declined'
/**
 * Third review of #337: a late extra whose id is a signed entry's id (ids without case) or another late extra's is never
 * paid and never reviewed; both sides see this instead of a decision.
 */
export const TIMESHEET_LATE_EXTRA_ID_TAKEN_LABEL = "Can't be reviewed — same reference as a signed item"
/** The reviewer's prompt while late extras wait for them. */
export const TIMESHEET_LATE_EXTRAS_REVIEWER_MESSAGE =
  'Price work or expenses were added after this timesheet was signed. Approve or decline each one — only what you approve is paid.'
/** Export names a sheet it skipped for this reason. */
export const TIMESHEET_LATE_EXTRAS_EXPORT_SKIPPED_MESSAGE =
  'Not exported — price work or expenses added after sign-off are waiting for the line manager.'
/** The confirm before the person adds a late extra. */
export const TIMESHEET_LATE_EXTRA_ADD_CONFIRM_MESSAGE =
  'Your timesheet is already signed off. This will be sent to your line manager to approve; it is paid only once they approve it.'

const AMOUNT_EPSILON = 0.005

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function finite(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  return Number.isFinite(number) ? number : null
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row)) : []
}

/** A late extra's kind as stored (`kind`), or null when it is neither (such a row is ignored). */
export function timesheetLateExtraKind(row: Record<string, unknown> | null | undefined): TimesheetLateExtraKind | null {
  const kind = text(row?.kind)
  return kind === 'priceWork' || kind === 'expense' ? kind : null
}

export type TimesheetLateExtraState = 'approved' | 'declined' | 'pending' | 'ignored'

export type TimesheetLateExtraDecisionResult = {
  /** `approved` / `edited` pay; `declined` pays 0; `pending` waits for the line manager; `ignored` never counts. */
  state: TimesheetLateExtraState
  decision: TimesheetEntryDecision
  revisedAmount: number | null
  /** What it pays now (0 unless approved). */
  paid: number
  reason: 'review' | 'no-review' | 'stale-review' | 'not-late-review' | 'id-taken' | 'no-kind' | 'no-id'
}

/**
 * Third review of #337: the key a late extra's trusted fingerprint is kept under in an app's fingerprint map (`late:` +
 * the id without case), so a late extra and a signed entry whose ids differ only by letter case never share (or replace)
 * each other's fingerprint. Signed entries keep the plain key (`timesheetEntryFingerprintMap`).
 */
export function timesheetLateExtraFingerprintKey(id: unknown): string {
  return `late:${normalizeDocumentId(id)}`
}

/** The reader's fingerprints for an app's loaded late extras, under `timesheetLateExtraFingerprintKey`. */
export function timesheetLateExtraFingerprintMap(
  entries: ReadonlyArray<{ id?: unknown; reviewFingerprint?: unknown } | null | undefined> | null | undefined
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const entry of entries || []) {
    const id = text(entry?.id)
    const fingerprint = text(entry?.reviewFingerprint)
    if (id && fingerprint) out[timesheetLateExtraFingerprintKey(id)] = fingerprint
  }
  return out
}

function signedEntryIds(sheet: Record<string, unknown>): Set<string> {
  const ids = new Set<string>()
  for (const key of ['priceWorkEntries', 'expenseEntries']) {
    for (const row of rowsOf(sheet[key])) {
      const id = normalizeDocumentId(row.id)
      if (id) ids.add(id)
    }
  }
  return ids
}

/**
 * The decision in effect for ONE late extra (`entry`, as stored in `lateExtras`) on `sheet` (the stored document):
 * only a review in `extraEntryReviews` written for a late extra (`lateExtra: true`) with a `reviewedFingerprint` equal to
 * the entry's fingerprint (`timesheetEntryFingerprint(entry, kind)`, or `trustedFingerprint` the reader computed for an
 * app's loaded copy) and its amount counts. An entry whose id is one of the signed entries' ids, or with no valid kind,
 * is ignored (never paid). Inline `managerDecision` / `managerRevisedAmount` are never read.
 */
export function timesheetLateExtraDecision(
  sheet: Record<string, unknown> | null | undefined,
  entry: Record<string, unknown> | null | undefined,
  trustedFingerprint?: string | null
): TimesheetLateExtraDecisionResult {
  const row = entry || {}
  const pending = (reason: TimesheetLateExtraDecisionResult['reason']): TimesheetLateExtraDecisionResult => ({
    state: 'pending',
    decision: 'pending',
    revisedAmount: null,
    paid: 0,
    reason,
  })
  const ignored = (reason: TimesheetLateExtraDecisionResult['reason']): TimesheetLateExtraDecisionResult => ({
    state: 'ignored',
    decision: 'pending',
    revisedAmount: null,
    paid: 0,
    reason,
  })
  const kind = timesheetLateExtraKind(row)
  if (!kind) return ignored('no-kind')
  const id = text(row.id)
  if (!id) return ignored('no-id')
  const data = sheet && typeof sheet === 'object' ? sheet : {}
  if (signedEntryIds(data).has(normalizeDocumentId(id))) return ignored('id-taken')
  const review = timesheetEntryReviewFor(parseTimesheetEntryReviews(data), id)
  if (!review) return pending('no-review')
  if (!review.lateExtra || !review.reviewedFingerprint) return pending('not-late-review')
  const fingerprint = text(trustedFingerprint) || timesheetEntryFingerprint(row, kind)
  if (review.reviewedFingerprint !== fingerprint) return pending('stale-review')
  const amount = finite(row.amount) ?? 0
  if (review.reviewedAmount != null && Math.abs(review.reviewedAmount - amount) >= AMOUNT_EPSILON) return pending('stale-review')
  if (review.decision === 'pending') return pending('no-review')
  if (review.decision === 'declined') return { state: 'declined', decision: 'declined', revisedAmount: null, paid: 0, reason: 'review' }
  const paid = roundPennies(timesheetEntryEffectiveAmount(review.decision, review.revisedAmount, amount))
  return { state: 'approved', decision: review.decision, revisedAmount: review.revisedAmount, paid, reason: 'review' }
}

export type TimesheetLateExtraRow = {
  id: string
  kind: TimesheetLateExtraKind
  /** The stored row. */
  row: Record<string, unknown>
  decision: TimesheetLateExtraDecisionResult
}

/**
 * Every late extra on the sheet with its decision, in stored order. A second row with an id already seen (ids without
 * case) is ignored, so nothing is paid twice.
 */
export function timesheetLateExtraRows(
  sheet: Record<string, unknown> | null | undefined,
  options: { entryFingerprints?: Record<string, string> | null } = {}
): TimesheetLateExtraRow[] {
  const data = sheet && typeof sheet === 'object' ? sheet : {}
  const seen = new Set<string>()
  const out: TimesheetLateExtraRow[] = []
  for (const row of rowsOf(data[TIMESHEET_LATE_EXTRAS_FIELD])) {
    const kind = timesheetLateExtraKind(row)
    const id = text(row.id)
    if (!kind || !id) continue
    const key = normalizeDocumentId(id)
    const trusted = options.entryFingerprints ? options.entryFingerprints[timesheetLateExtraFingerprintKey(id)] ?? null : null
    const decision = seen.has(key)
      ? ({ state: 'ignored', decision: 'pending', revisedAmount: null, paid: 0, reason: 'id-taken' } as const)
      : timesheetLateExtraDecision(data, row, trusted)
    seen.add(key)
    out.push({ id, kind, row, decision })
  }
  return out
}

export type TimesheetLateExtraEntryDocument =
  | (TimesheetPriceWorkEntryDocument & { kind: 'priceWork'; lateDecision: TimesheetLateExtraDecisionResult })
  | (TimesheetExpenseEntryDocument & { kind: 'expense'; lateDecision: TimesheetLateExtraDecisionResult })

/**
 * Reads `lateExtras` with the entry reader (`parseTimesheetEntries`: ids, evidence of the owner's own claim files,
 * dates, the stored row's `reviewFingerprint`), in stored order, each with its kind and late decision. The reader's
 * ordinary `managerDecision` / `managerRevisedAmount` are replaced by the late decision (never an inline value).
 */
export function parseTimesheetLateExtras(
  sheetDocId: string,
  sheet: Record<string, unknown> | null | undefined,
  options?: { timeZone?: string | null; organizationId?: string | null; ownerUserIds?: ReadonlyArray<unknown> | null } | null
): TimesheetLateExtraEntryDocument[] {
  const data = sheet && typeof sheet === 'object' ? sheet : {}
  const rows = timesheetLateExtraRows(data)
  const byId = new Map(rows.map((row) => [normalizeDocumentId(row.id), row]))
  const raw = rowsOf(data[TIMESHEET_LATE_EXTRAS_FIELD]).filter((row) => timesheetLateExtraKind(row) && text(row.id))
  const parsed = parseTimesheetEntries(
    sheetDocId,
    {
      userId: data.userId,
      priceWorkEntries: raw.filter((row) => row.kind === 'priceWork'),
      expenseEntries: raw.filter((row) => row.kind === 'expense'),
    },
    options
  )
  const decided = (id: string) => byId.get(normalizeDocumentId(id))?.decision
  const out: TimesheetLateExtraEntryDocument[] = []
  for (const row of raw) {
    const key = normalizeDocumentId(row.id)
    const lateDecision = decided(text(row.id))
    if (!lateDecision) continue
    const apply = <T extends { managerDecision: TimesheetEntryDecision; managerRevisedAmount: number | null }>(entry: T): T => ({
      ...entry,
      managerDecision: lateDecision.decision,
      managerRevisedAmount: lateDecision.revisedAmount,
    })
    if (row.kind === 'priceWork') {
      const entry = parsed.priceWorkEntries.find((item) => normalizeDocumentId(item.id) === key)
      if (entry && !out.some((item) => normalizeDocumentId(item.id) === key)) out.push({ ...apply(entry), kind: 'priceWork', lateDecision })
    } else {
      const entry = parsed.expenseEntries.find((item) => normalizeDocumentId(item.id) === key)
      if (entry && !out.some((item) => normalizeDocumentId(item.id) === key)) out.push({ ...apply(entry), kind: 'expense', lateDecision })
    }
  }
  return out
}

export type TimesheetLateExtrasSnapshotRow = {
  id: string
  title: string
  details: string
  jobNumber: string
  /** The entry's date (expense) or start date (price work), as stored. */
  date: unknown
  amount: number
  decision: 'approved' | 'edited'
  entryFingerprint: string
  lateExtra: true
}

/** The signed snapshot's money rows for the approved late extras (what the reviewer's approving save writes). */
export function timesheetLateExtrasSnapshotRows(
  sheet: Record<string, unknown> | null | undefined,
  options: { entryFingerprints?: Record<string, string> | null } = {}
): { priceWork: TimesheetLateExtrasSnapshotRow[]; expenses: TimesheetLateExtrasSnapshotRow[] } {
  const priceWork: TimesheetLateExtrasSnapshotRow[] = []
  const expenses: TimesheetLateExtrasSnapshotRow[] = []
  for (const late of timesheetLateExtraRows(sheet, options)) {
    if (late.decision.state !== 'approved' || late.decision.paid <= 0) continue
    const row = {
      id: late.id,
      title: text(late.row.title),
      details: typeof late.row.details === 'string' ? late.row.details : '',
      jobNumber: typeof late.row.jobNumber === 'number' ? String(late.row.jobNumber) : text(late.row.jobNumber),
      date: late.kind === 'priceWork' ? late.row.startDate ?? late.row.date : late.row.date,
      amount: late.decision.paid,
      decision: late.decision.decision === 'edited' ? ('edited' as const) : ('approved' as const),
      entryFingerprint: options.entryFingerprints?.[timesheetLateExtraFingerprintKey(late.id)] || timesheetEntryFingerprint(late.row, late.kind),
      lateExtra: true as const,
    }
    if (late.kind === 'priceWork') priceWork.push(row)
    else expenses.push(row)
  }
  return { priceWork, expenses }
}

/**
 * Third review of #337: a signed snapshot's money rows as a report may count them while late extras wait for the line
 * manager. A row marked `lateExtra` counts only while that late extra is still approved at the same pennies (an edited,
 * deleted or declined late extra leaves the snapshot only at the reviewer's next save); every other row is kept. An
 * exported sheet (`exportedAtStored`, else `timesheetExportedFieldSet` of the stored `exportedAt`) is frozen: its rows are
 * kept as signed.
 */
export function timesheetSnapshotMoneyRowsCurrent<R extends { id?: unknown; amount?: unknown; lateExtra?: unknown }>(
  sheet: Record<string, unknown> | null | undefined,
  rows: ReadonlyArray<R>,
  options: { entryFingerprints?: Record<string, string> | null; exportedAtStored?: boolean | null } = {}
): R[] {
  const data = sheet && typeof sheet === 'object' ? sheet : {}
  const exported = typeof options.exportedAtStored === 'boolean' ? options.exportedAtStored : timesheetExportedFieldSet(data.exportedAt)
  if (exported || !rows.some((row) => row?.lateExtra === true)) return [...rows]
  const approved = new Map<string, number>()
  for (const late of timesheetLateExtraRows(data, options)) {
    if (late.decision.state === 'approved' && late.decision.paid > 0) approved.set(normalizeDocumentId(late.id), late.decision.paid)
  }
  return rows.filter((row) => {
    if (row?.lateExtra !== true) return true
    const paid = approved.get(normalizeDocumentId(row.id))
    return paid != null && Math.abs(roundPennies(finite(row.amount) ?? 0) - paid) < AMOUNT_EPSILON
  })
}

export type TimesheetLateExtrasSummary = {
  /** Late extras waiting for a decision (or whose decision went stale). */
  pending: number
  approved: number
  declined: number
  /** The signed snapshot's late rows are the approved late extras (id and pennies); true without a snapshot. */
  snapshotInStep: boolean
  exported: boolean
  /** Not exported, and a late extra waits or the snapshot's late rows are out of step. */
  waitingForLineManager: boolean
}

/**
 * Where a sheet's late extras stand. `exported` is `timesheetExportedFieldSet` of the stored `exportedAt` (or
 * `exportedAtStored` when an app passes it).
 */
export function timesheetLateExtrasSummary(
  sheet: Record<string, unknown> | null | undefined,
  options: { entryFingerprints?: Record<string, string> | null; exportedAtStored?: boolean | null } = {}
): TimesheetLateExtrasSummary {
  const data = sheet && typeof sheet === 'object' ? sheet : {}
  const rows = timesheetLateExtraRows(data, options)
  const count = (state: TimesheetLateExtraState) => rows.filter((row) => row.decision.state === state).length
  const exported = typeof options.exportedAtStored === 'boolean' ? options.exportedAtStored : timesheetExportedFieldSet(data.exportedAt)
  let snapshotInStep = true
  const override = data.weeklyReportOverride
  if (override && typeof override === 'object') {
    const snapshot = override as Record<string, unknown>
    const signedLate = new Map<string, number>()
    for (const key of ['priceWork', 'expenses']) {
      for (const row of rowsOf(snapshot[key])) {
        if (row.lateExtra === true) signedLate.set(normalizeDocumentId(row.id), roundPennies(finite(row.amount) ?? 0))
      }
    }
    const approved = new Map<string, number>()
    for (const row of rows) {
      if (row.decision.state === 'approved' && row.decision.paid > 0) approved.set(normalizeDocumentId(row.id), row.decision.paid)
    }
    snapshotInStep =
      signedLate.size === approved.size &&
      [...approved].every(([id, paid]) => signedLate.has(id) && Math.abs((signedLate.get(id) ?? 0) - paid) < AMOUNT_EPSILON)
  }
  const pending = count('pending')
  return {
    pending,
    approved: count('approved'),
    declined: count('declined'),
    snapshotInStep,
    exported,
    waitingForLineManager: !exported && (pending > 0 || !snapshotInStep),
  }
}

export type TimesheetChanges = SignedTimesheetBookingChanges & {
  /** Late extras wait for the line manager (`timesheetLateExtrasSummary`). */
  lateExtrasWaiting: boolean
  /** The bookings themselves changed (1.47.0). False when only late extras wait: nothing is re-signed or re-priced. */
  bookingsChanged: boolean
}

const NO_BOOKING_CHANGE: SignedTimesheetBookingChanges = {
  changed: false,
  exported: false,
  reopened: false,
  waitingFor: null,
  basis: 'none',
  changedBookingIds: [],
  addedBookingIds: [],
  removedBookingIds: [],
  message: null,
  reviewerMessage: null,
}

/**
 * One answer for lists, counts, the export guard and the Payrun Snapshot (§8): the 1.47.0 booking change as it was, and
 * — when no booking change reopened the sheet — a sheet whose late extras wait reads as reopened and waiting for the
 * line manager (`waitingFor: 'lineManager'`, `reviewerMessage` the late-extras prompt, `message` null: the person has
 * nothing to sign). Null when neither applies and no booking answer was given.
 */
export function timesheetChangesWithLateExtras(
  bookingChange: SignedTimesheetBookingChanges | null | undefined,
  late: Pick<TimesheetLateExtrasSummary, 'waitingForLineManager'> | null | undefined
): TimesheetChanges | null {
  const waiting = late?.waitingForLineManager === true
  if (bookingChange?.reopened) return { ...bookingChange, lateExtrasWaiting: waiting, bookingsChanged: true }
  if (waiting) {
    return {
      ...(bookingChange ?? NO_BOOKING_CHANGE),
      changed: true,
      reopened: true,
      waitingFor: 'lineManager',
      message: null,
      reviewerMessage: TIMESHEET_LATE_EXTRAS_REVIEWER_MESSAGE,
      lateExtrasWaiting: true,
      bookingsChanged: false,
    }
  }
  if (!bookingChange) return null
  return { ...bookingChange, lateExtrasWaiting: false, bookingsChanged: bookingChange.changed }
}

/**
 * The label for one late extra (the person's list and the reviewer's). Third review of #337: an ignored one whose id is
 * taken (a signed entry's, or an earlier late extra's) reads `TIMESHEET_LATE_EXTRA_ID_TAKEN_LABEL`.
 */
export function timesheetLateExtraLabel(
  decision: Pick<TimesheetLateExtraDecisionResult, 'state'> & { reason?: TimesheetLateExtraDecisionResult['reason'] }
): string | null {
  if (decision.state === 'approved') return TIMESHEET_LATE_EXTRA_APPROVED_LABEL
  if (decision.state === 'declined') return TIMESHEET_LATE_EXTRA_DECLINED_LABEL
  if (decision.state === 'pending') return TIMESHEET_LATE_EXTRA_WAITING_LABEL
  if (decision.state === 'ignored' && (decision.reason == null || decision.reason === 'id-taken')) return TIMESHEET_LATE_EXTRA_ID_TAKEN_LABEL
  return null
}

/**
 * Third review of #337: whether a reviewer may decide this late extra now — never one that is ignored (its id is a
 * signed entry's or an earlier late extra's: its decision would be written under, and replace, that entry's review),
 * and never once the sheet is exported (`exported`: the stored `exportedAt`, `timesheetExportedFieldSet`; an exported
 * sheet's late extras are frozen, as the security rules hold).
 */
export function timesheetLateExtraReviewable(
  decision: Pick<TimesheetLateExtraDecisionResult, 'state'> | null | undefined,
  options: { exported?: boolean | null } = {}
): boolean {
  if (options.exported === true) return false
  return decision != null && decision.state !== 'ignored'
}
