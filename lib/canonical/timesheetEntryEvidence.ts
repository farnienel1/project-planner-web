/**
 * Timesheet price work and expense evidence, editing and deleting (rulebook 1.45.0 §8, owner decisions 14 Nov).
 *
 * Before 1.45.0 both apps stored only a placeholder `receiptName` ("receipt.jpg" / "receipt-uploaded") on a timesheet
 * expense entry and never uploaded the file. From 1.45.0 a `settings/timesheet_*` `priceWorkEntries[]` or
 * `expenseEntries[]` entry may carry `evidence[]` in the PAYE claim evidence shape (`claimEvidence.ts`): files, photos
 * and frozen personal site audit copies the sheet's owner uploaded into their own claim folder
 * (`organizations/{orgId}/payeClaims/{uid}/…`), which their active line managers and active admins — the timesheet's
 * reviewers — already read.
 *
 *   - Readers: `parseTimesheetEntries` returns each entry's `evidence`, the sheet owner's own claim files only
 *     (`timesheetEvidenceOwnerIds`). An older entry's `receiptName` stays, read-only (`CLAIM_EVIDENCE_LEGACY_RECEIPT_NOTE`).
 *   - Writers: the owner's save (`timesheetOwnerWriteFields`) carries the entry arrays with their evidence until the line
 *     manager signs (then the arrays are dropped, as before). The entries the owner added or changed
 *     (`timesheetOwnerTouchedEntries`) are checked by `timesheetOwnerEntriesError`: price work needs a job number
 *     (1.30.1); a new or edited expense needs at least one piece of evidence; evidence is at most 20 and every file is in
 *     the owner's own folder. Entries the owner did not touch are never checked, rejected or rewritten.
 *   - Edit and delete: the owner, before the line manager signs (`canEditTimesheetEntry`, the same test as adding,
 *     `timesheetOwnerCanAddExtras`). Removed evidence is deleted only inside the §24 undo window
 *     (`timesheetEntryEvidenceToDelete`); every other file is kept for recovery.
 *   - Invoice: one page per piece of evidence after the invoice, for the price work and expense rows on it
 *     (`timesheetEvidencePages`, the PAYE report's page shape).
 *
 * No security rule checks timesheet entries (older iOS builds save them without these fields, §8); the check is the
 * rulebook and the apps. The Storage rule for the claim folder is unchanged.
 */

import {
  claimEvidenceListError,
  claimEvidenceRemoved,
  payeClaimEvidenceDrawAs,
  payeClaimEvidenceToDelete,
  payeClaimEvidenceWriteFields,
  type PayeClaimEvidence,
} from './claimEvidence'
import { formatMoney } from './money'
import { formatPaymentRunDay } from './paymentRuns'
import { priceWorkJobNumberError, priceWorkJobNumberText, timesheetOwnerTouchedEntries } from './priceWorkJobNumber'
import { normalizeDocumentId } from './scheduleSources'
import { timesheetOwnerCanAddExtras, type TimesheetExtrasSheet } from './timesheetSnapshot'
import type { PayeClaimEvidencePage } from './payeClaims'
import type { TimesheetEntriesDocument } from './workDocumentReaders'

function text(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

export const TIMESHEET_ENTRY_EDIT_LABEL = 'Edit'
export const TIMESHEET_ENTRY_DELETE_LABEL = 'Delete'
export const TIMESHEET_ENTRY_SAVE_CHANGES_LABEL = 'Save changes'
export const TIMESHEET_ENTRY_DELETE_CONFIRM_MESSAGE =
  'Delete this entry from your timesheet? Its evidence is kept for recovery unless you added it in the last few minutes.'
export const TIMESHEET_ENTRY_EDIT_PRICE_WORK_TITLE = 'Edit Price Work'
export const TIMESHEET_ENTRY_EDIT_EXPENSE_TITLE = 'Edit Expense'

/** The stored shape of an entry's evidence list (`payeClaimEvidenceWriteFields` per entry). */
export function timesheetEntryEvidenceWriteFields(evidence: ReadonlyArray<Partial<PayeClaimEvidence>> | null | undefined): Array<Record<string, unknown>> {
  return (evidence || []).map(payeClaimEvidenceWriteFields)
}

export type TimesheetOwnerEntriesInput = {
  /** The sheet as this editor loaded it (else as stored): its `priceWorkEntries` / `expenseEntries`, stored shape. */
  previous: { priceWorkEntries?: ReadonlyArray<unknown> | null; expenseEntries?: ReadonlyArray<unknown> | null } | null | undefined
  /** The entries the owner's save would write. */
  next: { priceWorkEntries?: ReadonlyArray<unknown> | null; expenseEntries?: ReadonlyArray<unknown> | null }
  /** The organisation and the owner's ids (`timesheetEvidenceOwnerIds`): evidence must be in their own folder. */
  organizationId?: string | null
  ownerUserIds?: ReadonlyArray<unknown> | null
}

/**
 * Rulebook 1.45.0 §8: null when the owner's timesheet save may go ahead, else the first message. Only the entries the
 * owner added or changed (`timesheetOwnerTouchedEntries`, evidence included) are checked: price work needs a job number
 * (`priceWorkJobNumberError`, 1.30.1); an expense needs at least one piece of evidence
 * (`EXPENSE_EVIDENCE_REQUIRED_MESSAGE`); price work evidence is optional; every list holds at most 20 and, given the
 * organisation and owner ids, only files in the owner's own claim folder. An older entry the owner did not touch —
 * without a job number or with only a `receiptName` — never blocks a save or a signature. A reviewer's save is never
 * checked (decisions are not owner fields).
 */
export function timesheetOwnerEntriesError(input: TimesheetOwnerEntriesInput): string | null {
  const evidenceContext = { organizationId: input.organizationId ?? undefined, ownerUserIds: input.ownerUserIds ?? null }
  for (const row of timesheetOwnerTouchedEntries(input.previous?.priceWorkEntries, input.next.priceWorkEntries, 'priceWork')) {
    const job = priceWorkJobNumberError(row.jobNumber)
    if (job) return job
    const evidence = claimEvidenceListError(Array.isArray(row.evidence) ? (row.evidence as PayeClaimEvidence[]) : [], evidenceContext)
    if (evidence) return evidence
  }
  for (const row of timesheetOwnerTouchedEntries(input.previous?.expenseEntries, input.next.expenseEntries, 'expense')) {
    const evidence = claimEvidenceListError(Array.isArray(row.evidence) ? (row.evidence as PayeClaimEvidence[]) : [], {
      ...evidenceContext,
      required: true,
    })
    if (evidence) return evidence
  }
  return null
}

/**
 * Rulebook 1.45.0 §8: whether the viewer may edit or delete a price work or expense entry on this sheet — only its
 * owner (`viewerIsOwner`: the sheet is theirs under any of their ids), and only while they may add one
 * (`timesheetOwnerCanAddExtras`: not once the line manager has signed; a self-signed sheet stays open and asks the
 * person to sign again). A reviewer never edits the entry itself (they decide it: ✓ ✕ ⚙). `message` says why not.
 */
export function canEditTimesheetEntry(
  sheet: TimesheetExtrasSheet | null | undefined,
  options: { viewerIsOwner: boolean; selfSigned?: boolean | null }
): { allowed: boolean; message: string | null } {
  if (!options.viewerIsOwner) return { allowed: false, message: null }
  return timesheetOwnerCanAddExtras(sheet, { selfSigned: options.selfSigned })
}

/**
 * Rulebook 1.45.0 §8 / §24: after an owner's save that removed entries or evidence, the files to delete from Storage —
 * those no longer on any entry of the sheet, uploaded by the viewer within the undo window
 * (`payeClaimEvidenceToDelete`). Every other removed file is kept for recovery. `before` / `after` are the sheet's
 * entries (any shape with `evidence`).
 */
export function timesheetEntryEvidenceToDelete(input: {
  before: { priceWorkEntries?: ReadonlyArray<{ evidence?: ReadonlyArray<Pick<PayeClaimEvidence, 'path'>> | null }> | null; expenseEntries?: ReadonlyArray<{ evidence?: ReadonlyArray<Pick<PayeClaimEvidence, 'path'>> | null }> | null }
  after: { priceWorkEntries?: ReadonlyArray<{ evidence?: ReadonlyArray<Pick<PayeClaimEvidence, 'path'>> | null }> | null; expenseEntries?: ReadonlyArray<{ evidence?: ReadonlyArray<Pick<PayeClaimEvidence, 'path'>> | null }> | null }
  organizationId: string
  viewerUserId: string
  nowMs: number
}): string[] {
  const all = (sheet: typeof input.before) =>
    [...(sheet.priceWorkEntries || []), ...(sheet.expenseEntries || [])].flatMap((entry) => [...(entry?.evidence || [])])
  return payeClaimEvidenceToDelete(claimEvidenceRemoved(all(input.before), all(input.after)), {
    organizationId: input.organizationId,
    viewerUserId: input.viewerUserId,
    nowMs: input.nowMs,
  })
}

/**
 * Rulebook 1.45.0 §8: the invoice's evidence pages, after the invoice itself — one per piece of evidence on each price
 * work or expense row of the invoice (`rows`: `timesheetInvoiceRows`, so a declined entry is not there), in invoice
 * order, headed by the entry (name, date, job number, amount — the invoice row's amount — and for price work the
 * manager who agreed it), the evidence's own title and the entry's description, drawn as the PAYE report draws it
 * (`payeClaimEvidenceDrawAs`). The entry is found by id without case in `entries` (`parseTimesheetEntries`), so a
 * signed snapshot's row still finds its live entry's evidence. Labour rows have none.
 */
export function timesheetEvidencePages(input: {
  rows: ReadonlyArray<{ kind: string; id: string; amount: number; jobNumber?: string | null }>
  entries: TimesheetEntriesDocument
  currency: unknown
}): PayeClaimEvidencePage[] {
  const out: PayeClaimEvidencePage[] = []
  const find = <T extends { id: string }>(list: ReadonlyArray<T>, id: string) =>
    list.find((entry) => normalizeDocumentId(entry.id) === normalizeDocumentId(id))
  for (const row of input.rows) {
    if (row.kind !== 'priceWork' && row.kind !== 'expense') continue
    const priceWork = row.kind === 'priceWork'
    const entry = priceWork ? find(input.entries.priceWorkEntries, row.id) : find(input.entries.expenseEntries, row.id)
    if (!entry || entry.evidence.length === 0) continue
    let date = ''
    if (priceWork) {
      const pw = entry as TimesheetEntriesDocument['priceWorkEntries'][number]
      const start = pw.startDayKey || ''
      const end = pw.endDayKey && pw.endDayKey > start ? pw.endDayKey : ''
      date = start ? (end ? `${formatPaymentRunDay(start)} – ${formatPaymentRunDay(end)}` : formatPaymentRunDay(start)) : ''
    } else {
      const ex = entry as TimesheetEntriesDocument['expenseEntries'][number]
      date = ex.dayKey ? formatPaymentRunDay(ex.dayKey) : ''
    }
    const amount = formatMoney(row.amount, input.currency)
    const jobNumber = priceWork ? priceWorkJobNumberText(row.jobNumber || entry.jobNumber) : text(row.jobNumber || entry.jobNumber)
    const approvedBy = priceWork ? text((entry as TimesheetEntriesDocument['priceWorkEntries'][number]).agreedManagerName) : ''
    entry.evidence.forEach((evidence, index) => {
      const evidenceTitle = `Evidence ${index + 1} of ${entry.evidence.length}: ${evidence.name}${evidence.kind === 'personalSiteAudit' ? ' (personal site audit copy)' : ''}`
      out.push({
        itemId: entry.id,
        heading: [entry.title, date, amount].filter(Boolean).join(' · '),
        details: [evidenceTitle, entry.details].filter(Boolean),
        path: evidence.path,
        name: evidence.name,
        contentType: evidence.contentType,
        drawAs: payeClaimEvidenceDrawAs(evidence),
        itemName: entry.title || 'Untitled',
        date,
        jobNumber,
        approvedBy,
        amount,
        evidenceTitle,
        notes: [text(entry.details)].filter(Boolean),
      })
    })
  }
  return out
}
