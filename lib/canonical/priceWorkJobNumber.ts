/**
 * Price work needs a job number (rulebook 1.30.1, owner decision 4 Nov; §8 timesheet price work entries and §26 PAYE
 * price work).
 *
 * One rule for both places — a timesheet `priceWorkEntries[]` entry (self-employed, My Timesheets) and a PAYE
 * `priceWorkItems/{id}` document:
 *   - A new item or entry needs a job number: free text, trimmed, 1–`PRICE_WORK_JOB_NUMBER_MAX` characters (the same
 *     shape as an expense's `jobNumber`). `priceWorkJobNumberError`.
 *   - Items and entries stored before 1.30.1 without one stay valid: readers never reject or rewrite them, and they
 *     show `PRICE_WORK_JOB_NUMBER_MISSING_TEXT` ("—") wherever the job number is shown (`priceWorkJobNumberText`).
 *   - An owner's edit of a timesheet price work entry (any of its own fields changed) asks for the job number before it
 *     saves (`timesheetPriceWorkJobNumberError`); a line manager's review (decision or revised amount) is not an edit
 *     and never asks. An entry the owner did not touch is never checked, so an older entry never blocks a signature.
 *
 * The security rules require `jobNumber` (1–60) on a new `priceWorkItems` document. Timesheet documents get no such
 * rule: older iOS builds save entries without `jobNumber`, so the timesheet check is the rulebook and the apps only.
 */

import { documentInstantMs } from './peopleDocuments'
import { normalizeDocumentId } from './scheduleSources'

export const PRICE_WORK_JOB_NUMBER_MAX = 60
export const PRICE_WORK_JOB_NUMBER_REQUIRED_MESSAGE = 'Add the job number for this price work.'
export const PRICE_WORK_JOB_NUMBER_TOO_LONG_MESSAGE = 'The job number can be up to 60 characters.'
/** Shown where a stored price work item or entry has no job number. */
export const PRICE_WORK_JOB_NUMBER_MISSING_TEXT = '—'
export const PRICE_WORK_JOB_NUMBER_LABEL = 'Job number'

function text(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof value === 'string' ? value.trim() : ''
}

/** Null when `value` is a usable price work job number (trimmed, 1–60 characters), else the message. */
export function priceWorkJobNumberError(value: unknown): string | null {
  const job = text(value)
  if (!job) return PRICE_WORK_JOB_NUMBER_REQUIRED_MESSAGE
  if (job.length > PRICE_WORK_JOB_NUMBER_MAX) return PRICE_WORK_JOB_NUMBER_TOO_LONG_MESSAGE
  return null
}

/** The job number as stored (trimmed), or "—" when there is none (an item or entry stored before 1.30.1). */
export function priceWorkJobNumberText(value: unknown): string {
  return text(value) || PRICE_WORK_JOB_NUMBER_MISSING_TEXT
}

/**
 * The owner's own fields of a timesheet entry; a change to any of them is an edit. Price work: name, description, job
 * number, the manager who agreed it, amount, start and end; an expense: name, description, job number, amount, date.
 * 1.45.0: the evidence list (by path, in order) is an owner field of both, so adding or removing evidence is an edit.
 */
const OWNER_ENTRY_FIELDS = {
  priceWork: ['title', 'details', 'jobNumber', 'agreedManagerName', 'amount'],
  expense: ['title', 'details', 'jobNumber', 'amount'],
} as const
const OWNER_ENTRY_DATE_FIELDS = { priceWork: ['startDate', 'endDate'], expense: ['date'] } as const

export type TimesheetOwnerEntryKind = 'priceWork' | 'expense'

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function evidencePaths(value: unknown): string[] {
  return (Array.isArray(value) ? value : []).map((entry) => text(record(entry).path)).filter(Boolean)
}

function sameOwnerFields(a: Record<string, unknown>, b: Record<string, unknown>, kind: TimesheetOwnerEntryKind): boolean {
  for (const key of OWNER_ENTRY_FIELDS[kind]) {
    if (key === 'amount') {
      if ((Number(a.amount) || 0) !== (Number(b.amount) || 0)) return false
    } else if (text(a[key]) !== text(b[key])) return false
  }
  for (const key of OWNER_ENTRY_DATE_FIELDS[kind]) {
    if ((documentInstantMs(a[key]) ?? null) !== (documentInstantMs(b[key]) ?? null)) return false
  }
  const left = evidencePaths(a.evidence)
  const right = evidencePaths(b.evidence)
  return left.length === right.length && left.every((path, index) => path === right[index])
}

/**
 * Rulebook 1.45.0 §8: the entries of `next` (stored shape) the owner added or whose own fields they changed, compared
 * with `previous` (the sheet as the editor loaded it, else as stored). An entry is matched by id without case
 * (`normalizeDocumentId`), and one stored without an id by its content (its id is derived on read, `timesheetEntryId`);
 * one with no match is new. A reviewer's decision or revised amount is not an owner field, so it is never an edit.
 * Entries the owner did not touch — older ones included — are left out, so they never block a save or a signature.
 */
export function timesheetOwnerTouchedEntries(
  previous: ReadonlyArray<unknown> | null | undefined,
  next: ReadonlyArray<unknown> | null | undefined,
  kind: TimesheetOwnerEntryKind
): Array<Record<string, unknown>> {
  const before = new Map<string, Record<string, unknown>>()
  const withoutId: Record<string, unknown>[] = []
  for (const raw of previous || []) {
    const row = record(raw)
    const id = normalizeDocumentId(row.id)
    if (!id) withoutId.push(row)
    else if (!before.has(id)) before.set(id, row)
  }
  const out: Array<Record<string, unknown>> = []
  for (const raw of next || []) {
    const row = record(raw)
    const id = normalizeDocumentId(row.id)
    const stored = id ? before.get(id) : undefined
    if (stored && sameOwnerFields(stored, row, kind)) continue
    if (!stored && withoutId.some((old) => sameOwnerFields(old, row, kind))) continue
    out.push(row)
  }
  return out
}

/**
 * The owner's timesheet save (§8): null when every price work entry the owner added or edited has a job number, else
 * `PRICE_WORK_JOB_NUMBER_REQUIRED_MESSAGE` (or the length message). `previous` is the sheet's `priceWorkEntries` as
 * stored or as the editor loaded it; `next` the entries it would save (stored shape: `id`, `title`, `details`,
 * `jobNumber`, `agreedManagerName`, `startDate`, `endDate`, `amount`; dates as Timestamp, Date, ms or ISO). An entry
 * is matched by id without case (`normalizeDocumentId`), and one stored without an id by its content (its id is derived
 * on read, `timesheetEntryId`); one with no match is new. An entry whose own fields are
 * unchanged is never checked (a decision or revised amount is the reviewer's, not an edit), so entries stored before
 * 1.30.1 without a job number stay valid until the owner edits them.
 */
export function timesheetPriceWorkJobNumberError(
  previous: ReadonlyArray<unknown> | null | undefined,
  next: ReadonlyArray<unknown> | null | undefined
): string | null {
  for (const row of timesheetOwnerTouchedEntries(previous, next, 'priceWork')) {
    const error = priceWorkJobNumberError(row.jobNumber)
    if (error) return error
  }
  return null
}
