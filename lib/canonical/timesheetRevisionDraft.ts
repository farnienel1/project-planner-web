/**
 * Rulebook 1.90.0 §8 (owner request 24 Nov, point 4): a revision a reviewer creates starts as a DRAFT.
 *
 * Before 1.90.0 "Make changes" (Create revision) on an exported timesheet made REV N and sent it straight to the person,
 * who could sign it before the line manager had finished changing its bookings. Now a revision created by a reviewer
 * (the person's line manager or an admin, `timesheetRevisionCreateFields({ draft: true })`) stores `revisionDraft: true`:
 * - it stays with the reviewer — the person cannot sign or save it (the security rules refuse their write while the
 *   stored draft is set), their screens say it is being prepared, and no `timesheet_revision_to_sign` notice is sent;
 * - the reviewer changes its bookings with ⚙ / ✕ (1.76.0 B1); each change is recorded on the draft
 *   (`reviewerBookingEdits`, `forRevisionDraft`, `timesheetReviewerBookingEditRecord`);
 * - "Save changes and send timesheet to {name}" is grey until the draft holds a change (`timesheetRevisionDraftChanges`,
 *   derived from the stored draft and the version it corrects — never a screen-only flag) and then blue; pressing it
 *   removes `revisionDraft` (`timesheetRevisionDraftSendWriteFields`) and sends the notice;
 * - "Cancel revision" (red, after a confirm) deletes the unexported draft. Booking changes already made stay in
 *   scheduling (they were written to the bookings), so the exported version then reads "Revision due" and the person
 *   can create their own revision (1.55.0).
 * A revision the person creates ("Review and sign again") is never a draft. A revision stored without the field (every
 * revision before 1.90.0, and those made by an app that does not pass `draft`) behaves exactly as before.
 *
 * Nothing here writes; the apps pass stored documents in and write what comes back.
 */
import { resolveTimesheetExportedAtMs } from './timesheetPeriod'
import { timesheetSheetIsRevision } from './timesheetSnapshot'

/** The stored field: `true` while the reviewer prepares the revision. Written only at a reviewer's create; removed by Send. */
export const TIMESHEET_REVISION_DRAFT_FIELD = 'revisionDraft'

export const TIMESHEET_REVISION_CANCEL_LABEL = 'Cancel revision'
/** Under a grey Send button. */
export const TIMESHEET_REVISION_DRAFT_SEND_WAITING_HELP =
  'Change a booking with ⚙ or ✕ first. The button turns blue once you have made a change.'
/** The person's line while a draft is open. */
export const TIMESHEET_REVISION_DRAFT_PERSON_MESSAGE =
  'Your line manager is making changes to this timesheet. You can review and sign it once they send it to you.'
/** A person's save refused because the revision is still a draft (also the message for a refused write). */
export const TIMESHEET_REVISION_DRAFT_REFUSED_MESSAGE =
  'This revision is still being prepared by your line manager. You can sign it once they send it to you.'
export const TIMESHEET_REVISION_DRAFT_SENT_MESSAGE = 'Sent. They have been told the revision is ready to sign.'
export const TIMESHEET_REVISION_DRAFT_CANCELLED_MESSAGE = 'Revision cancelled.'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function firstName(name: unknown): string {
  return text(name).split(/\s+/)[0] ?? ''
}

/** True while a revision is a draft: a revision (REV 1+), stored `revisionDraft: true`, not exported. */
export function timesheetRevisionIsDraft(sheet: Record<string, unknown> | null | undefined): boolean {
  if (!sheet) return false
  if (sheet[TIMESHEET_REVISION_DRAFT_FIELD] !== true) return false
  if (!timesheetSheetIsRevision(sheet as { revision?: unknown; revisionOf?: unknown })) return false
  return resolveTimesheetExportedAtMs(sheet) == null
}

/** "Save changes and send timesheet to Sam" (the person's first name; "the person" when unknown). */
export function timesheetRevisionSendLabel(personName?: string | null): string {
  return `Save changes and send timesheet to ${firstName(personName) || 'the person'}`
}

/** Under a blue Send button: "Sends REV 2 to Sam to review and sign. You sign it off after." */
export function timesheetRevisionSendReadyHelp(revisionLabel?: string | null, personName?: string | null): string {
  const rev = text(revisionLabel) || 'the revision'
  return `Sends ${rev} to ${firstName(personName) || 'the person'} to review and sign. You sign it off after.`
}

/** The confirm before Cancel revision. */
export function timesheetRevisionCancelConfirmMessage(revisionLabel?: string | null, changeCount = 0): string {
  const rev = text(revisionLabel) || 'this revision'
  const kept =
    changeCount > 0
      ? ' The booking changes you made stay in scheduling, so the exported timesheet will show an update is due and the person can review and sign it.'
      : ''
  return `Cancel ${rev}? The revision is deleted and nothing is sent.${kept}`
}

function sameReview(a: unknown, b: unknown): boolean {
  const x = record(a)
  const y = record(b)
  const amount = (value: unknown) => {
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(n) ? Math.round(n * 100) : null
  }
  return text(x.decision) === text(y.decision) && amount(x.revisedAmount) === amount(y.revisedAmount)
}

function reviewMapChanges(draft: unknown, previous: unknown): number {
  const now = record(draft)
  const before = new Map(Object.entries(record(previous)).map(([key, value]) => [key.trim().toLowerCase(), value]))
  let count = 0
  for (const [key, value] of Object.entries(now)) {
    const prior = before.get(key.trim().toLowerCase())
    if (prior === undefined || !sameReview(value, prior)) count += 1
  }
  return count
}

export type TimesheetRevisionDraftChanges = {
  /** Bookings changed or removed from this draft's review (its `reviewerBookingEdits` records). */
  bookingEdits: number
  /** Line or price work / expense decisions added or changed since the version it corrects. */
  reviewChanges: number
  count: number
  changed: boolean
}

/**
 * What the reviewer has changed on a draft since it was created, from stored data only: the booking edits recorded on
 * the draft (`reviewerBookingEdits`, one per booking), and the review decisions (`payrollLineReviews`,
 * `extraEntryReviews`) the draft holds that the version it corrects did not hold the same way (decision and revised
 * amount; a decision the create dropped is not a change). An edit undone by hand still counts (the record stays).
 */
export function timesheetRevisionDraftChanges(input: {
  draft: Record<string, unknown> | null | undefined
  previous?: Record<string, unknown> | null
}): TimesheetRevisionDraftChanges {
  const draft = record(input?.draft)
  const previous = record(input?.previous)
  let bookingEdits = 0
  for (const value of Object.values(record(draft.reviewerBookingEdits))) {
    if (text(record(value).bookingId)) bookingEdits += 1
  }
  const reviewChanges =
    reviewMapChanges(draft.payrollLineReviews, previous.payrollLineReviews) +
    reviewMapChanges(draft.extraEntryReviews, previous.extraEntryReviews)
  const count = bookingEdits + reviewChanges
  return { bookingEdits, reviewChanges, count, changed: count > 0 }
}

export type TimesheetRevisionDraftState = {
  /** The sheet is a draft revision. */
  draft: boolean
  /** The viewer is the reviewer who may send or cancel it (a reviewer, never the person). */
  reviewerActs: boolean
  changes: TimesheetRevisionDraftChanges
  /** Send is blue (enabled). */
  canSend: boolean
  canCancel: boolean
  /** False while a draft: the person must not be offered signing. */
  personMaySign: boolean
  sendLabel: string
  /** One line under the buttons. */
  help: string | null
  cancelLabel: string
  /** The person's line while a draft is open (null for the reviewer, or when not a draft). */
  personMessage: string | null
}

/** Everything a screen needs to show a draft revision, for the person or the reviewer. */
export function timesheetRevisionDraftState(input: {
  sheet: Record<string, unknown> | null | undefined
  /** The stored version this revision corrects (`previousVersionId`), for the review-decision comparison. */
  previous?: Record<string, unknown> | null
  viewerIsReviewer: boolean
  viewerIsSubject: boolean
  personName?: string | null
  revisionLabel?: string | null
}): TimesheetRevisionDraftState {
  const draft = timesheetRevisionIsDraft(input?.sheet)
  const changes = draft
    ? timesheetRevisionDraftChanges({ draft: input.sheet, previous: input.previous })
    : { bookingEdits: 0, reviewChanges: 0, count: 0, changed: false }
  const reviewerActs = draft && input.viewerIsReviewer === true && input.viewerIsSubject !== true
  return {
    draft,
    reviewerActs,
    changes,
    canSend: reviewerActs && changes.changed,
    canCancel: reviewerActs,
    personMaySign: !draft,
    sendLabel: timesheetRevisionSendLabel(input.personName),
    help: !reviewerActs ? null : changes.changed ? timesheetRevisionSendReadyHelp(input.revisionLabel, input.personName) : TIMESHEET_REVISION_DRAFT_SEND_WAITING_HELP,
    cancelLabel: TIMESHEET_REVISION_CANCEL_LABEL,
    personMessage: draft && input.viewerIsSubject === true ? TIMESHEET_REVISION_DRAFT_PERSON_MESSAGE : null,
  }
}

/**
 * Send: the partial update that ends the draft — `revisionDraft` removed (the app adds write metadata). Null when the
 * sheet is not a draft (nothing to write).
 */
export function timesheetRevisionDraftSendWriteFields(sheet: Record<string, unknown> | null | undefined): { set: Record<string, unknown>; remove: string[] } | null {
  return timesheetRevisionIsDraft(sheet) ? { set: {}, remove: [TIMESHEET_REVISION_DRAFT_FIELD] } : null
}
