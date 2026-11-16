/**
 * Rulebook 1.54.0 §8 (owner decision 16 Nov): price work and expenses can be added, edited or deleted after the line
 * manager has signed, until the sheet is exported — and doing so sends the sheet back for signing exactly like a
 * booking change does (1.47.0, `signedTimesheetBookingChanges`): the person signs again, then the line manager
 * counter-signs again, and that counter-signature rebuilds the signed snapshot. Nobody exports the sheet or generates
 * its invoice while it is reopened. Once the sheet is exported nothing can be added (`timesheetOwnerCanAddExtras`).
 *
 * Replaces 1.43.0's block ("This timesheet is signed off — add it to your next timesheet."). The 1.43.0 bug it fixed
 * (adding cleared only the person's own signature and left the sheet half signed) cannot come back: an owner's save
 * never clears a stored signature; whether the sheet must be signed again is DERIVED here, never written by anyone.
 *
 * References (what was signed), compared with the live entries (`parseTimesheetEntries` ids and `reviewFingerprint`):
 *  - the person: `operativeSignedExtras` (written with every operative signature from 1.54.0, `signedTimesheetExtrasRecord`,
 *    tied to that signature by `operativeSignedExtrasSignedAt`), else the signed snapshot's money rows;
 *  - the line manager: the signed snapshot's money rows (`weeklyReportOverride.priceWork` / `.expenses`), each carrying
 *    `entryFingerprint` from 1.54.0. A snapshot row written before 1.54.0 has none: it is matched by id (or, failing
 *    that, by title and job number) and compared on its title, job number and — for an agreed row — its amount, because
 *    before 1.54.0 entries could not change after the counter-signature and every reviewer save refreshed the rows.
 *
 * Guardrail 3 (old data never reads as changed): a sheet whose line manager has not signed is not this rule's business
 * (extras added before the counter-signature are reviewed as always); a self-signed sheet keeps its own flow (adding
 * asks the person to sign again, 1.43.0); a sheet with neither a record nor a snapshot never reads as changed.
 */

import { roundPennies } from './payRate'
import { normalizeDocumentId } from './scheduleSources'
import {
  timesheetEntryDecision,
  timesheetEntryEffectiveAmount,
  timesheetEntryFingerprint,
  type TimesheetEntryDecisionResult,
} from './timesheetEntryReviews'
import type { SignedTimesheetBookingChanges } from './timesheetBookingChanges'
import { resolveTimesheetExportedAtMs, timesheetTimestampMs, TIMESHEET_SIGNED_AFTER_MS } from './timesheetPeriod'

/** The person's popup / banner when their price work or expenses changed after they signed. */
export const SIGNED_TIMESHEET_EXTRAS_CHANGED_MESSAGE =
  'Price work or expenses have changed since this timesheet was signed. Please review and sign again.'
/** The line manager's review while the person has not signed the changed extras again. */
export const SIGNED_TIMESHEET_EXTRAS_CHANGED_REVIEWER_MESSAGE =
  'Price work or expenses have been added or changed since this timesheet was signed. It is back with the person to sign again; you can counter-sign once they have.'
/** The line manager's review once the person has signed the changed extras. */
export const SIGNED_TIMESHEET_EXTRAS_CHANGED_COUNTERSIGN_MESSAGE =
  'Price work or expenses changed after you counter-signed and the person has signed the new figures. Counter-sign again to approve them.'
/** The confirm before the person adds, edits or deletes price work or expenses on a sheet their line manager signed. */
export const SIGNED_TIMESHEET_EXTRAS_REOPEN_CONFIRM_MESSAGE =
  'Your line manager has already signed this timesheet. Changing price work or expenses sends it back for signing: you sign it again, then your line manager counter-signs it again.'

/** One price work or expense entry as the person signed it (`operativeSignedExtras[]`). */
export type SignedTimesheetExtra = {
  /** `priceWork` or `expense`. */
  kind: 'priceWork' | 'expense'
  /** The entry id as stored (derived ids from `timesheetEntryId` for an entry stored without one). */
  entryId: string
  /** `timesheetEntryFingerprint` of the entry as stored ('' when unknown). */
  fingerprint: string
}

/** A live entry (the app's loaded copy from `parseTimesheetEntries`): only the fields this rule reads. */
export type SignedTimesheetLiveExtra = {
  id?: unknown
  /** `parseTimesheetEntries` → `reviewFingerprint` (of the stored row). */
  reviewFingerprint?: unknown
  title?: unknown
  jobNumber?: unknown
  details?: unknown
  amount?: unknown
  /** The entry's inline decision as stored (or as the app resolved it); the rule decides with `timesheetEntryDecision`. */
  managerDecision?: unknown
  managerRevisedAmount?: unknown
}

/** A signed snapshot money row (`weeklyReportOverride.priceWork[]` / `.expenses[]`). */
export type SignedTimesheetSnapshotExtra = {
  id?: unknown
  title?: unknown
  jobNumber?: unknown
  details?: unknown
  amount?: unknown
  /** `approved` | `edited` | `declined` (a pending entry is stored as approved). */
  decision?: unknown
  /** 1.54.0: the entry's `reviewFingerprint` when the snapshot was built. */
  entryFingerprint?: unknown
}

export type SignedTimesheetLiveExtras = {
  priceWorkEntries?: ReadonlyArray<SignedTimesheetLiveExtra | null | undefined> | null
  expenseEntries?: ReadonlyArray<SignedTimesheetLiveExtra | null | undefined> | null
}

export type SignedTimesheetExtrasSheet = {
  operativeSignedAt?: unknown
  operativeSignedAtMs?: unknown
  operativeSignedExtras?: unknown
  /** The `operativeSignedAt` the record belongs to (the same value, written together). */
  operativeSignedExtrasSignedAt?: unknown
  managerSignedAt?: unknown
  approvedAt?: unknown
  exportedAt?: unknown
  exportedAtMs?: unknown
  /** As stored, the field the security rules test (`timesheetExportedFieldSet`). */
  exportedAtStored?: boolean | null
  /** The line manager's entry reviews (`extraEntryReviews`), so each entry is decided as the invoice decides it. */
  extraEntryReviews?: unknown
  weeklyReportOverride?: {
    priceWork?: ReadonlyArray<SignedTimesheetSnapshotExtra | null | undefined> | null
    expenses?: ReadonlyArray<SignedTimesheetSnapshotExtra | null | undefined> | null
  } | null
}

export type SignedTimesheetExtrasChanges = {
  changed: boolean
  exported: boolean
  reopened: boolean
  waitingFor: 'person' | 'lineManager' | null
  addedEntryIds: string[]
  changedEntryIds: string[]
  removedEntryIds: string[]
  /** The signed snapshot's money rows differ from the live entries (the snapshot is stale). */
  snapshotChanged: boolean
  message: string | null
  reviewerMessage: string | null
}

const RECORD_SIGNED_AT_MATCH_MS = 1000

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
}

function realMs(value: unknown): number | null {
  const ms = timesheetTimestampMs(value)
  return ms != null && ms > TIMESHEET_SIGNED_AFTER_MS ? ms : null
}

function present(value: unknown): boolean {
  if (value == null || value === '' || value === false) return false
  if (value instanceof Date) return !Number.isNaN(value.getTime())
  return true
}

function amountOf(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  return Number.isFinite(n) ? n : null
}

type Kind = 'priceWork' | 'expense'
type Row = {
  kind: Kind
  id: string
  fingerprint: string
  title: string
  jobNumber: string
  details: string | null
  amount: number | null
  decision: string
  /** Live rows: the decision in effect (`timesheetEntryDecision` on the stored sheet). */
  effective?: TimesheetEntryDecisionResult
}

function key(kind: Kind, id: string): string {
  return `${kind}|${normalizeDocumentId(id)}`
}

function contentKey(row: Pick<Row, 'kind' | 'title' | 'jobNumber'>): string {
  return `${row.kind}|${row.title.toLowerCase()}|${row.jobNumber.toLowerCase()}`
}

function liveRows(entries: SignedTimesheetLiveExtras | null | undefined, sheet?: SignedTimesheetExtrasSheet | null): Row[] {
  const out: Row[] = []
  const add = (kind: Kind, list: ReadonlyArray<SignedTimesheetLiveExtra | null | undefined> | null | undefined) => {
    for (const entry of list ?? []) {
      const id = text(entry?.id)
      if (!id) continue
      const raw = (entry ?? {}) as Record<string, unknown>
      // Review of #337 (1a): a row without the reader's fingerprint is fingerprinted here, never trusted as unchanged.
      const fingerprint = text(entry?.reviewFingerprint) || timesheetEntryFingerprint(raw, kind)
      out.push({
        kind,
        id,
        fingerprint,
        title: text(entry?.title),
        jobNumber: text(entry?.jobNumber),
        details: typeof entry?.details === 'string' ? entry.details.trim() : null,
        amount: amountOf(entry?.amount),
        decision: '',
        effective: sheet ? timesheetEntryDecision(sheet as Record<string, unknown>, raw, kind, fingerprint) : undefined,
      })
    }
  }
  add('priceWork', entries?.priceWorkEntries)
  add('expense', entries?.expenseEntries)
  return out
}

function snapshotRows(override: SignedTimesheetExtrasSheet['weeklyReportOverride']): Row[] | null {
  if (!override || typeof override !== 'object') return null
  const out: Row[] = []
  const add = (kind: Kind, list: ReadonlyArray<SignedTimesheetSnapshotExtra | null | undefined> | null | undefined) => {
    for (const row of Array.isArray(list) ? list : []) {
      if (!row) continue
      out.push({
        kind,
        id: text(row.id),
        fingerprint: text(row.entryFingerprint),
        title: text(row.title),
        jobNumber: text(row.jobNumber),
        details: typeof row.details === 'string' ? row.details.trim() : null,
        amount: amountOf(row.amount),
        decision: text(row.decision).toLowerCase(),
      })
    }
  }
  add('priceWork', override.priceWork)
  add('expense', override.expenses)
  return out
}

function recordRows(raw: unknown): Row[] | null {
  if (!Array.isArray(raw)) return null
  const out: Row[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const kind: Kind | null = r.kind === 'priceWork' ? 'priceWork' : r.kind === 'expense' ? 'expense' : null
    const id = text(r.entryId)
    if (!kind || !id) continue
    out.push({ kind, id, fingerprint: text(r.fingerprint), title: '', jobNumber: '', details: null, amount: null, decision: '' })
  }
  return out
}

type Diff = { added: string[]; changed: string[]; removed: string[] }

function isEmpty(diff: Diff | null): boolean {
  return !diff || (diff.added.length === 0 && diff.changed.length === 0 && diff.removed.length === 0)
}

/** The person's record against the live entries: ids (without case) and fingerprints. */
function diffRecord(signed: Row[], live: Row[]): Diff {
  const liveByKey = new Map(live.map((row) => [key(row.kind, row.id), row]))
  const signedKeys = new Set<string>()
  const diff: Diff = { added: [], changed: [], removed: [] }
  for (const row of signed) {
    const k = key(row.kind, row.id)
    signedKeys.add(k)
    const now = liveByKey.get(k)
    if (!now) diff.removed.push(row.id)
    else if (row.fingerprint && now.fingerprint && row.fingerprint !== now.fingerprint) diff.changed.push(now.id)
  }
  for (const row of live) if (!signedKeys.has(key(row.kind, row.id))) diff.added.push(row.id)
  return diff
}

function pennies(value: number | null | undefined): number | null {
  return value == null || !Number.isFinite(value) ? null : roundPennies(value)
}

function signedDecision(value: string): string {
  return value === '' || value === 'pending' ? 'approved' : value
}

/**
 * Review of #337 (1a, 1b): whether a signed snapshot money row and the live entry differ. The live entry is decided
 * exactly as its invoice row is (`timesheetEntryDecision` on the stored sheet: the review map, else the inline value
 * only while it is the decision the line manager signed). A decision that went stale (the entry changed since the
 * review, or an inline value the person changed) is a change. With the 1.54.0 fingerprint, any change to the entry's
 * own fields or evidence is a change. Without one (rows written before 1.54.0): the title, job number or description
 * differing is a change, and so is the money — the amount the entry pays now against the signed amount, to the penny,
 * whatever the decision; only a reviewer's own later decision (the review map, not stale) is not the person's change,
 * so there a raw amount is compared only while both sides are agreed rows.
 */
function snapshotRowChanged(row: Row, now: Row): boolean {
  const decided = now.effective
  if (decided && decided.source === 'stale-review') return true
  if (row.fingerprint) return Boolean(now.fingerprint) && row.fingerprint !== now.fingerprint
  if (row.title.toLowerCase() !== now.title.toLowerCase()) return true
  if (row.jobNumber.toLowerCase() !== now.jobNumber.toLowerCase()) return true
  if (row.details != null && now.details != null && row.details !== now.details) return true
  const signedAmount = pennies(row.amount)
  if (signedAmount == null || now.amount == null) return signedAmount !== pennies(now.amount)
  if (decided && decided.source === 'review') {
    const bothAgreed = signedDecision(row.decision) === 'approved' && signedDecision(decided.decision) === 'approved'
    return bothAgreed && pennies(now.amount) !== signedAmount
  }
  const paid = decided ? timesheetEntryEffectiveAmount(decided.decision, decided.revisedAmount, now.amount) : now.amount
  return pennies(paid) !== signedAmount
}

/** The signed snapshot's money rows against the live entries (see the module note for rows written before 1.54.0). */
function diffSnapshot(snapshot: Row[], live: Row[]): Diff {
  const diff: Diff = { added: [], changed: [], removed: [] }
  const used = new Set<number>()
  const liveIndexByKey = new Map<string, number>()
  live.forEach((row, index) => liveIndexByKey.set(key(row.kind, row.id), index))
  const matchFor = (row: Row): number | null => {
    if (row.id) {
      const index = liveIndexByKey.get(key(row.kind, row.id))
      if (index != null && !used.has(index)) return index
    }
    if (row.fingerprint) return null
    // Rows written before 1.54.0 for entries stored without an id: by content.
    const wanted = contentKey(row)
    const index = live.findIndex((candidate, i) => !used.has(i) && contentKey(candidate) === wanted)
    return index >= 0 ? index : null
  }
  for (const row of snapshot) {
    const index = matchFor(row)
    if (index == null) {
      diff.removed.push(row.id || row.title)
      continue
    }
    used.add(index)
    const now = live[index]
    if (snapshotRowChanged(row, now)) diff.changed.push(now.id)
  }
  live.forEach((row, index) => {
    if (!used.has(index)) diff.added.push(row.id)
  })
  return diff
}

/**
 * Rulebook 1.54.0 §8: what the person signs — one row per live price work and expense entry,
 * `{ kind, entryId, fingerprint }` (the entry's `reviewFingerprint`), sorted by kind and id. Stored as
 * `operativeSignedExtras` with every operative signature, a re-signature included, together with
 * `operativeSignedExtrasSignedAt` (the same value as that `operativeSignedAt`).
 */
export function signedTimesheetExtrasRecord(entries: SignedTimesheetLiveExtras | null | undefined): SignedTimesheetExtra[] {
  const rows = liveRows(entries)
  const seen = new Set<string>()
  const out: SignedTimesheetExtra[] = []
  for (const row of rows) {
    const k = key(row.kind, row.id)
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ kind: row.kind, entryId: row.id, fingerprint: row.fingerprint })
  }
  return out.sort((a, b) => {
    const ka = key(a.kind, a.entryId)
    const kb = key(b.kind, b.entryId)
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })
}

function lineManagerHasSigned(sheet: SignedTimesheetExtrasSheet): boolean {
  return present(sheet.managerSignedAt) || present(sheet.approvedAt)
}

function sheetExported(sheet: SignedTimesheetExtrasSheet): boolean {
  return resolveTimesheetExportedAtMs(sheet as Record<string, unknown>) != null || realMs(sheet.exportedAtMs) != null || sheet.exportedAtStored === true
}

function recordIsCurrent(sheet: SignedTimesheetExtrasSheet): boolean {
  const signed = realMs(sheet.operativeSignedAt) ?? realMs(sheet.operativeSignedAtMs)
  const recordSignedAt = realMs(sheet.operativeSignedExtrasSignedAt)
  return signed != null && recordSignedAt != null && Math.abs(signed - recordSignedAt) <= RECORD_SIGNED_AT_MATCH_MS
}

/**
 * Rulebook 1.54.0 §8: whether a counter-signed timesheet's price work or expenses changed since it was signed, and who
 * must act. Not exported: `reopened` — `waitingFor: 'person'` while the person's reference differs from the live
 * entries, `'lineManager'` once the person has signed the live entries but the snapshot is stale. Exported: frozen,
 * `changed` is a warning only. A sheet the line manager has not signed, and a self-signed sheet, never read as changed.
 */
export function signedTimesheetExtrasChanges(input: {
  sheet: SignedTimesheetExtrasSheet | null | undefined
  entries: SignedTimesheetLiveExtras | null | undefined
  selfSigned?: boolean | null
}): SignedTimesheetExtrasChanges {
  const none: SignedTimesheetExtrasChanges = {
    changed: false,
    exported: false,
    reopened: false,
    waitingFor: null,
    addedEntryIds: [],
    changedEntryIds: [],
    removedEntryIds: [],
    snapshotChanged: false,
    message: null,
    reviewerMessage: null,
  }
  const sheet = input.sheet
  if (!sheet) return none
  const exported = sheetExported(sheet)
  const base = { ...none, exported }
  if (input.selfSigned === true || !lineManagerHasSigned(sheet)) return base
  const live = liveRows(input.entries, sheet)
  const snapshot = snapshotRows(sheet.weeklyReportOverride)
  const snapshotDiff = snapshot ? diffSnapshot(snapshot, live) : null
  const record = recordIsCurrent(sheet) ? recordRows(sheet.operativeSignedExtras) : null
  const personDiff = record ? diffRecord(record, live) : snapshotDiff
  const personChanged = !isEmpty(personDiff)
  const snapshotChanged = !isEmpty(snapshotDiff)
  if (!personChanged && !snapshotChanged) return base
  const used = (personChanged ? personDiff : snapshotDiff) as Diff
  const ids = { addedEntryIds: used.added, changedEntryIds: used.changed, removedEntryIds: used.removed, snapshotChanged }
  if (exported) return { ...base, ...ids, changed: true, reviewerMessage: null }
  const waitingFor = personChanged ? 'person' : 'lineManager'
  return {
    ...base,
    ...ids,
    changed: true,
    reopened: true,
    waitingFor,
    message: waitingFor === 'person' ? SIGNED_TIMESHEET_EXTRAS_CHANGED_MESSAGE : null,
    reviewerMessage: waitingFor === 'person' ? SIGNED_TIMESHEET_EXTRAS_CHANGED_REVIEWER_MESSAGE : SIGNED_TIMESHEET_EXTRAS_CHANGED_COUNTERSIGN_MESSAGE,
  }
}

/**
 * Rulebook 1.54.0 §8: the baseline an owner's save writes the first time they change price work or expenses on a sheet
 * their line manager has signed — the entries AS STORED before the change, as the record of what they signed
 * (`operativeSignedExtras` + `operativeSignedExtrasSignedAt` = the current `operativeSignedAt`), so the change reads as
 * a change even on a sheet signed before 1.54.0. Null when the sheet is not counter-signed, is exported, is
 * self-signed, has no person signature, or already has a current record (never overwritten).
 */
export function signedTimesheetExtrasBaselineFields(input: {
  sheet: SignedTimesheetExtrasSheet | null | undefined
  storedEntries: SignedTimesheetLiveExtras | null | undefined
  selfSigned?: boolean | null
}): { operativeSignedExtras: SignedTimesheetExtra[]; operativeSignedExtrasSignedAt: unknown } | null {
  const sheet = input.sheet
  if (!sheet || input.selfSigned === true || !lineManagerHasSigned(sheet) || sheetExported(sheet)) return null
  const signedAt = sheet.operativeSignedAt ?? sheet.operativeSignedAtMs
  if (realMs(signedAt) == null) return null
  if (recordIsCurrent(sheet)) return null
  return { operativeSignedExtras: signedTimesheetExtrasRecord(input.storedEntries), operativeSignedExtrasSignedAt: signedAt }
}

export type SignedTimesheetChanges = SignedTimesheetBookingChanges & {
  /** The price work and expense part (1.54.0). */
  extras: SignedTimesheetExtrasChanges
  /**
   * Whether the booking part changed (review of #337): when false and the sheet is reopened, only price work or
   * expenses changed, so the counter-signature rebuilds the snapshot's money rows only and keeps its labour rows.
   */
  bookingsChanged: boolean
}

/**
 * Rulebook 1.54.0 §8: one "has this signed sheet changed?" answer from the booking rule (1.47.0) and the extras rule,
 * in the booking rule's shape so every caller (`timesheetListBucket`, `signedTimesheetActions`, the Payrun Snapshot,
 * the weekly report feed, Export) reads it unchanged. Reopened when either part is; waiting for the person when either
 * part waits for them, else for the line manager. The person's message names bookings when bookings changed, else
 * price work or expenses.
 */
export function signedTimesheetChanges(
  bookings: SignedTimesheetBookingChanges,
  extras: SignedTimesheetExtrasChanges | null | undefined
): SignedTimesheetChanges {
  const e = extras ?? {
    changed: false,
    exported: bookings.exported,
    reopened: false,
    waitingFor: null,
    addedEntryIds: [],
    changedEntryIds: [],
    removedEntryIds: [],
    snapshotChanged: false,
    message: null,
    reviewerMessage: null,
  }
  if (!e.changed) return { ...bookings, extras: e, bookingsChanged: bookings.changed }
  if (!bookings.changed) {
    return {
      ...bookings,
      bookingsChanged: false,
      changed: true,
      exported: bookings.exported || e.exported,
      reopened: e.reopened,
      waitingFor: e.waitingFor,
      message: e.message,
      reviewerMessage: e.reviewerMessage,
      extras: e,
    }
  }
  const reopened = bookings.reopened || e.reopened
  const waitingFor = !reopened ? null : bookings.waitingFor === 'person' || e.waitingFor === 'person' ? 'person' : 'lineManager'
  const fromBookings = bookings.waitingFor === waitingFor
  return {
    ...bookings,
    bookingsChanged: true,
    changed: true,
    reopened,
    waitingFor,
    message: waitingFor === 'person' ? (bookings.waitingFor === 'person' ? bookings.message : e.message) : null,
    reviewerMessage: fromBookings ? bookings.reviewerMessage : e.reviewerMessage,
    extras: e,
  }
}
