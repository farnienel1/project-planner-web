/**
 * Rulebook 1.55.0 §8 / §13 (owner decisions 16 Nov): timesheet revisions — REV 1, REV 2, ….
 *
 * An exported timesheet never changes (the security rules lock it, admins included). Bookings stay the source of truth:
 * when a booking inside an exported sheet's pay run changes (the 1.47.0 rule — day, slot, times, overtime rate, break,
 * job or place, removed, or added after), a revision becomes DUE (`timesheetRevisionDue`, derived, never written by
 * whoever edits the booking). The person is told ("an update to your already exported timesheet") and sees the yellow
 * triangle; pressing "Review and sign again" creates the revision document, `settings/{original id}_rev{N}`, as their
 * own write, and they sign the live figures. A reviewer (`timesheetWriterIsReviewer`: an admin, or the person's line
 * manager) may create it too — when reviewing a self-signed person, or with "Create revision" for a correction a booking
 * did not cause. The revision is priced from the live bookings like any open sheet and goes through the normal signing
 * (person, then line manager; a self-signed person alone). Once exported it is frozen too, and the next post-export
 * change makes REV N + 1. Before export nothing changes from 1.47.0 (a changed signed sheet reopens, no REV number).
 *
 * Nothing here writes; the apps pass stored documents in and write what comes back.
 */
import { formatMoney } from './money'
import { roundPennies } from './payRate'
import { timesheetTotals } from './timesheetTotals'
import {
  parseTimesheetRevisionDocId,
  resolveTimesheetExportedAtMs,
  timesheetDocumentSubjectId,
  timesheetVersionSignedOff,
  timesheetTimestampMs,
  TIMESHEET_DOCUMENT_PREFIX,
  TIMESHEET_SIGNED_AFTER_MS,
  type TimesheetVersionRef,
} from './timesheetPeriod'
import { excludeActor, type NotificationPerson } from './notificationRecipients'
import { timesheetWriterIsReviewer } from './timesheetEntryReviews'

/** `settings/{original id}{TIMESHEET_REVISION_SUFFIX}{N}`, N = 1, 2, …. */
export const TIMESHEET_REVISION_SUFFIX = '_rev'
/** The most revisions one pay run can have (a guard against runaway ids; far above any real use). */
export const TIMESHEET_REVISION_MAX = 99
/** The notice the person gets when a revision is created for them to sign. */
export const TIMESHEET_REVISION_NOTICE_TYPE = 'timesheet_revision_to_sign'
export const TIMESHEET_REVISION_NOTICE_TITLE = 'Timesheet revision'
export const TIMESHEET_REVISION_NOTICE_MESSAGE = 'Your timesheet has a revision to sign'
/** The same type, sent by the server when a booking change makes a revision due (once per exported version). */
export const TIMESHEET_REVISION_DUE_NOTICE_TITLE = 'Update to your exported timesheet'
export const TIMESHEET_REVISION_DUE_NOTICE_MESSAGE =
  'There is an update to your already exported timesheet: a booking has changed. Please review and sign the update, or speak to your line manager if something isn\'t correct.'
/** The person's popup on the yellow triangle when a revision is due (My Timesheets and that row). */
export const TIMESHEET_REVISION_DUE_MESSAGE =
  'A booking has changed since this timesheet was exported. The exported timesheet stays as it was; please review and sign the update (a revision), or speak to your line manager if something isn\'t correct.'
export const TIMESHEET_REVISION_DUE_STATUS = 'Update to sign'
/** The reviewer's note on an exported sheet whose revision is due. */
export const TIMESHEET_REVISION_DUE_REVIEWER_MESSAGE =
  'Bookings have changed since this timesheet was exported. The exported timesheet stays as it was; the person signs an update (a revision), then you counter-sign it.'
export const TIMESHEET_REVIEW_AND_SIGN_REVISION_LABEL = 'Review and sign again'
export const TIMESHEET_CREATE_REVISION_LABEL = 'Create revision'
export const TIMESHEET_CREATE_REVISION_HELP =
  'This timesheet is exported and cannot be changed. A revision is a new version built from the live bookings, price work and expenses for this pay run. The person signs it, then their line manager counter-signs it.'
export const TIMESHEET_REVISION_OPEN_MESSAGE = 'A revision of this timesheet is already open. Finish and export it first.'
export const TIMESHEET_REVISION_NOT_EXPORTED_MESSAGE = 'Only an exported timesheet can have a revision.'
export const TIMESHEET_REVISION_NOT_REVIEWER_MESSAGE =
  'Only the person, an admin or the person’s line manager can create a revision of this timesheet.'
export const TIMESHEET_REVISION_LIMIT_MESSAGE = 'This pay run has reached the most revisions allowed.'
export const TIMESHEET_EARLIER_VERSIONS_LABEL = 'Earlier versions'
export const TIMESHEET_ORIGINAL_VERSION_LABEL = 'Original'

/**
 * The fields a revision document carries besides the ordinary timesheet fields. `revisionOf` is the original's
 * document id, `revision` N, `previousVersionId` the version it corrects (the original for REV 1). Written once, at
 * create; the security rules refuse any later change. The "difference" is measured from the previous version's exported
 * total, read from that (frozen) document when shown (`timesheetExportedTotal`) — never stored, so it cannot be forged.
 */
export const TIMESHEET_REVISION_FIELDS = [
  'revisionOf',
  'revision',
  'previousVersionId',
  'revisionCreatedBy',
  'revisionCreatedAt',
] as const

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export type { TimesheetVersionRef } from './timesheetPeriod'
export { parseTimesheetRevisionDocId, timesheetVersionSignedOff } from './timesheetPeriod'

/** True when the id names a revision (REV 1 or later). */
export function isTimesheetRevisionDocId(documentId: unknown): boolean {
  return (parseTimesheetRevisionDocId(documentId)?.revision ?? 0) > 0
}

/** The document id of revision N of an original sheet; the original's own id for N = 0; '' when not usable. */
export function timesheetRevisionDocId(baseDocumentId: unknown, revision: number): string {
  const base = parseTimesheetRevisionDocId(baseDocumentId)
  if (!base || base.revision !== 0) return ''
  if (revision === 0) return base.documentId
  if (!Number.isInteger(revision) || revision < 1 || revision > TIMESHEET_REVISION_MAX) return ''
  return `${base.documentId}${TIMESHEET_REVISION_SUFFIX}${revision}`
}

/** "REV 1", "REV 2"; '' for the original (revision 0). */
export function timesheetRevisionLabel(revision: unknown): string {
  const n = typeof revision === 'number' ? revision : Number(revision)
  return Number.isInteger(n) && n > 0 ? `REV ${n}` : ''
}

/**
 * The invoice number of a pay run's original timesheet, built only from what is stored on that original (review of
 * #344): `TS-{the id's stamp}-{first 6 letters / digits of the person's id, upper case}` — the id's part after
 * `timesheet_{userId}_` (digits only) and the stored `userId` (else the person the id names,
 * `timesheetDocumentSubjectId`). Before 1.55.0 invoices carried no number; this is derived, never stored, so both apps
 * print the same one for every sheet, old or new, whoever views it. Pass the ORIGINAL's id for every version (a
 * revision's `revisionOf`); '' when not usable.
 */
export function timesheetInvoiceNumber(input: { documentId: unknown; userId?: unknown }): string {
  const ref = parseTimesheetRevisionDocId(input?.documentId)
  if (!ref) return ''
  const base = ref.baseDocumentId
  const stored = text(input?.userId)
  const subject = stored && base.startsWith(`${TIMESHEET_DOCUMENT_PREFIX}${stored}_`) ? stored : timesheetDocumentSubjectId(base)
  if (!subject) return ''
  const stamp = base.slice(`${TIMESHEET_DOCUMENT_PREFIX}${subject}_`.length).replace(/[^0-9]/g, '')
  const person = subject.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()
  if (!stamp || !person) return ''
  return `TS-${stamp}-${person}`
}

/** The original invoice number plus "-REV1", "-REV2" … so accounts can match them; the number unchanged for 0. */
export function timesheetInvoiceNumberForRevision(baseInvoiceNumber: unknown, revision: unknown): string {
  const base = text(baseInvoiceNumber)
  if (!base) return ''
  const n = typeof revision === 'number' ? revision : Number(revision)
  return Number.isInteger(n) && n > 0 ? `${base}-REV${n}` : base
}

export type TimesheetRevisionDifference = {
  /** This version's total less the previous version's exported total (`timesheetExportedTotal`), rounded to pennies. */
  amount: number
  /** "+£44.12", "-£10.00", "£0.00" (`formatMoney`, the organisation currency). */
  text: string
}

/** The difference a revision shows: its total less the previous version's exported total (rulebook only; screens never subtract). */
export function timesheetRevisionDifference(input: { total: unknown; previousTotal: unknown; currency: unknown }): TimesheetRevisionDifference | null {
  const total = typeof input?.total === 'number' ? input.total : Number(input?.total)
  const previous = typeof input?.previousTotal === 'number' ? input.previousTotal : Number(input?.previousTotal)
  if (input?.previousTotal == null || input?.total == null || !Number.isFinite(total) || !Number.isFinite(previous)) return null
  const amount = roundPennies(total - previous)
  const money = formatMoney(Math.abs(amount), input.currency)
  return { amount, text: amount > 0 ? `+${money}` : amount < 0 ? `-${money}` : money }
}

/** One stored version of a pay run's timesheet, as `timesheetVersionsForPeriod` reads it. */
export type TimesheetVersion = TimesheetVersionRef & {
  /** Exported as the security rules read it (`resolveTimesheetExportedAtMs`: an `exportedAt` an invoice left is not). */
  exported: boolean
  /** Signed off: the line manager counter-signed, or a self-signed person signed with the signed snapshot written. */
  signedOff: boolean
  data: Record<string, unknown>
}

function realSigned(value: unknown): boolean {
  const ms = timesheetTimestampMs(value)
  return ms != null && ms > TIMESHEET_SIGNED_AFTER_MS
}

function versionOf(documentId: string, data: Record<string, unknown>): TimesheetVersion | null {
  const ref = parseTimesheetRevisionDocId(documentId)
  if (!ref) return null
  return {
    ...ref,
    // Review of #344: the security rules' exported test, the invoice leftover rule included (`timesheetStoredExported`).
    exported: resolveTimesheetExportedAtMs(data) != null,
    signedOff: timesheetVersionSignedOff(data),
    data,
  }
}

/**
 * The stored versions of one person's pay run, grouped by original: each chain is the original (revision 0, when
 * stored) then REV 1, REV 2 … in order. Rows that are not timesheet documents are left out. Two chains appear only when
 * the same pay run is stored under two original ids (older builds); callers pick between chains as before 1.55.0.
 */
export function timesheetVersionsForPeriod(
  documents: ReadonlyArray<{ documentId: string; data?: Record<string, unknown> | null }>
): TimesheetVersion[][] {
  const chains = new Map<string, TimesheetVersion[]>()
  for (const row of documents ?? []) {
    const version = versionOf(text(row?.documentId), record(row?.data))
    if (!version) continue
    const chain = chains.get(version.baseDocumentId) ?? []
    if (!chain.some((existing) => existing.revision === version.revision)) chain.push(version)
    chains.set(version.baseDocumentId, chain)
  }
  return Array.from(chains.values()).map((chain) => chain.sort((a, b) => a.revision - b.revision))
}

/** The latest version of a chain (what lists and the period page show); null for an empty chain. */
export function timesheetLatestVersion(chain: ReadonlyArray<TimesheetVersion> | null | undefined): TimesheetVersion | null {
  const list = chain ?? []
  return list.length > 0 ? list[list.length - 1] : null
}

/**
 * The version the weekly report and Payrun Snapshot use: the latest version that is exported or signed off. An open
 * revision (not yet signed off) leaves the previous exported version in force. A chain with nothing signed (an open
 * original) gives its latest version, as before 1.55.0.
 */
export function timesheetReportVersion(chain: ReadonlyArray<TimesheetVersion> | null | undefined): TimesheetVersion | null {
  const list = chain ?? []
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (list[index].revision === 0 || list[index].exported || list[index].signedOff) return list[index]
  }
  return timesheetLatestVersion(list)
}

/** The versions before the latest, newest first (shown read-only under the latest). */
export function timesheetEarlierVersions(chain: ReadonlyArray<TimesheetVersion> | null | undefined): TimesheetVersion[] {
  const list = [...(chain ?? [])]
  list.pop()
  return list.reverse()
}

/**
 * Whether a revision is due on a pay run: its latest version is exported and the live bookings differ from what that
 * version signed (`signedTimesheetBookingChanges` of the latest version: `exported` and `changed`). Derived on every
 * read, never stored. `nextRevision` / `documentId` name the revision "Review and sign again" creates.
 */
export function timesheetRevisionDue(input: {
  chain: ReadonlyArray<TimesheetVersion> | null | undefined
  /** `signedTimesheetBookingChanges` of the chain's latest version. */
  change: { changed?: boolean | null; exported?: boolean | null } | null | undefined
}): { due: boolean; nextRevision: number | null; documentId: string; label: string; message: string | null; reviewerMessage: string | null } {
  const latest = timesheetLatestVersion(input.chain)
  const none = { due: false, nextRevision: null, documentId: '', label: '', message: null, reviewerMessage: null }
  if (!latest || !latest.exported || input.change?.changed !== true || input.change?.exported !== true) return none
  const next = latest.revision + 1
  const documentId = timesheetRevisionDocId(latest.baseDocumentId, next)
  if (!documentId) return none
  return {
    due: true,
    nextRevision: next,
    documentId,
    label: timesheetRevisionLabel(next),
    message: TIMESHEET_REVISION_DUE_MESSAGE,
    reviewerMessage: TIMESHEET_REVISION_DUE_REVIEWER_MESSAGE,
  }
}

export type TimesheetRevisionCheck = {
  allowed: boolean
  reason: 'ok' | 'not-reviewer' | 'no-sheet' | 'not-exported' | 'revision-open' | 'limit'
  /** The revision number a create would make (latest + 1), or null. */
  nextRevision: number | null
  /** The document id a create would write, or ''. */
  documentId: string
  message: string
}

/**
 * Who may create the next revision, and on what. The person themself (`writerIsSubject`: "Review and sign again" when a
 * revision is due), or someone who may sign their sheet off (`timesheetWriterIsReviewer`: an admin, or the person's
 * line manager; "Create revision"). The chain's latest version must be exported, so no revision is open. The security
 * rules check the same (they cannot see whether a booking changed: a revision created with nothing changed shows £0.00).
 */
export function canCreateTimesheetRevision(input: {
  reviewer: Parameters<typeof timesheetWriterIsReviewer>[0]
  chain: ReadonlyArray<TimesheetVersion> | null | undefined
  /** The writer is the sheet's person (their own owner write). */
  writerIsSubject?: boolean | null
}): TimesheetRevisionCheck {
  const latest = timesheetLatestVersion(input.chain)
  const refuse = (reason: TimesheetRevisionCheck['reason'], message: string): TimesheetRevisionCheck => ({
    allowed: false,
    reason,
    nextRevision: null,
    documentId: '',
    message,
  })
  if (input.writerIsSubject !== true && !timesheetWriterIsReviewer(input.reviewer)) return refuse('not-reviewer', TIMESHEET_REVISION_NOT_REVIEWER_MESSAGE)
  if (!latest) return refuse('no-sheet', TIMESHEET_REVISION_NOT_EXPORTED_MESSAGE)
  if (!latest.exported) {
    return latest.revision > 0
      ? refuse('revision-open', TIMESHEET_REVISION_OPEN_MESSAGE)
      : refuse('not-exported', TIMESHEET_REVISION_NOT_EXPORTED_MESSAGE)
  }
  const next = latest.revision + 1
  const documentId = timesheetRevisionDocId(latest.baseDocumentId, next)
  if (!documentId) return refuse('limit', TIMESHEET_REVISION_LIMIT_MESSAGE)
  return { allowed: true, reason: 'ok', nextRevision: next, documentId, message: '' }
}

/**
 * The exported total of a stored version: its signed snapshot's invoice total (`timesheetTotals`, `decided`). Null when
 * the version has no signed snapshot (an older export): its labour cannot be priced from the document alone, so the
 * difference is unknown (`TIMESHEET_REVISION_DIFFERENCE_UNKNOWN`) — never a total without its labour.
 */
export function timesheetExportedTotal(data: Record<string, unknown> | null | undefined): number | null {
  const sheet = record(data)
  if (!sheet.weeklyReportOverride || typeof sheet.weeklyReportOverride !== 'object') return null
  return timesheetTotals({ sheet, payrollLines: [], extrasMode: 'decided' }).total
}

/** Review of #344: the difference cannot be worked out (the previous version has no signed snapshot). */
export const TIMESHEET_REVISION_DIFFERENCE_UNKNOWN = 'Difference not available (older export)'

/**
 * The fields a revision copies from the version it corrects, exactly as stored (the security rules check each one is
 * equal): the period identity and the person's entries with the line manager's decisions on them. Entries stored without
 * an id keep their id because a revision derives entry ids from its original's id (`timesheetEntryId`).
 */
export const TIMESHEET_REVISION_COPIED_FIELDS = [
  'userId',
  'weekStart',
  'weekEnd',
  'weekStartKey',
  'weekEndKey',
  'priceWorkEntries',
  'expenseEntries',
  'lateExtras',
  'extraEntryReviews',
  'payrollLineReviews',
] as const

/**
 * The create shape of revision `previous.revision + 1` (the security rules accept exactly these keys plus
 * `revisionCreatedAt` — the server time — and write metadata, which the app adds). It copies
 * `TIMESHEET_REVISION_COPIED_FIELDS` exactly as stored on the version it corrects: the period identity, the price work
 * and expense entries, the late extras (approved ones keep paying; one still pending can now be decided on the
 * revision) and the line manager's decisions (`extraEntryReviews`; Edit hours `payrollLineReviews`, which read as stale
 * once their booking changed, 1.46.0). It never copies signatures, the signed snapshot, notes, `exportedAt` or any
 * figure: labour is priced from the live bookings. Null when `previous` is not an exported version of a timesheet.
 */
export function timesheetRevisionCreateFields(input: {
  previous: { documentId: string; data: Record<string, unknown> | null | undefined }
  writerUserId: string
}): { documentId: string; revision: number; fields: Record<string, unknown> } | null {
  const ref = parseTimesheetRevisionDocId(input?.previous?.documentId)
  const data = record(input?.previous?.data)
  const writer = text(input?.writerUserId)
  if (!ref || !writer || resolveTimesheetExportedAtMs(data) == null || !text(data.userId) || data.weekStart == null) return null
  const revision = ref.revision + 1
  const documentId = timesheetRevisionDocId(ref.baseDocumentId, revision)
  if (!documentId) return null
  const fields: Record<string, unknown> = {}
  // Review of #344: a stored null is copied as null (the rules compare each copied field with the version it corrects).
  for (const key of TIMESHEET_REVISION_COPIED_FIELDS) if (data[key] !== undefined) fields[key] = data[key]
  fields.revisionOf = ref.baseDocumentId
  fields.revision = revision
  fields.previousVersionId = ref.documentId
  fields.revisionCreatedBy = writer
  return { documentId, revision, fields }
}

/** `timesheet_revision_to_sign`: the sheet's person (an account), never the person who created the revision. */
export function timesheetRevisionToSignRecipients(
  subject: NotificationPerson,
  actor: NotificationPerson,
  roster: Parameters<typeof excludeActor>[2]
): string[] {
  const id = typeof subject === 'string' ? text(subject) : text((subject as { id?: unknown } | null)?.id)
  return id ? excludeActor([id], actor, roster) : []
}

/** The notice's de-dupe key: one row per revision (`timesheetRevision|{revision document id}`). */
export function timesheetRevisionNoticeKey(revisionDocumentId: unknown): string | null {
  const ref = parseTimesheetRevisionDocId(revisionDocumentId)
  return ref && ref.revision > 0 ? `timesheetRevision|${ref.documentId}` : null
}
