/**
 * Rulebook 1.55.0 §8: the REV label, invoice number and difference a timesheet version shows. Every figure and word is
 * the rulebook's (`timesheetRevisionLabel`, `timesheetInvoiceNumber`, `timesheetInvoiceNumberForRevision`,
 * `timesheetExportedTotal`, `timesheetRevisionDifference`, `TIMESHEET_REVISION_DIFFERENCE_UNKNOWN`); this file only
 * joins them for a screen or document.
 */
import {
  TIMESHEET_REVISION_DIFFERENCE_UNKNOWN,
  parseTimesheetRevisionDocId,
  timesheetExportedTotal,
  timesheetInvoiceNumber,
  timesheetInvoiceNumberForRevision,
  timesheetRevisionDifference,
  timesheetRevisionLabel,
  type TimesheetVersion,
} from '@/lib/canonical'

export type TimesheetRevisionCopy = {
  /** 'REV 1', or '' for the original. */
  label: string
  /** From the stored original (its id and stored `userId`), never the viewer's or the current users id. */
  invoiceNumber: string
  /** "+£44.12" from the previous version, `TIMESHEET_REVISION_DIFFERENCE_UNKNOWN`, or null for the original. */
  differenceText: string | null
  /** "REV 1 · +£44.12 from the previous version" for documents, or ''. */
  note: string
}

export function timesheetRevisionCopy(input: {
  /** The stored document id of this version (`timesheetSourceDocumentId`). */
  documentId: string | null | undefined
  /** The period's stored versions (`timesheetVersionChain`). */
  chain: ReadonlyArray<TimesheetVersion>
  /** This version's total (`timesheetTotals`). */
  total: number | null | undefined
  currency: string
}): TimesheetRevisionCopy {
  const ref = parseTimesheetRevisionDocId(input.documentId)
  const revision = ref?.revision ?? 0
  const original = input.chain.find((version) => version.revision === 0)
  const invoiceNumber = ref
    ? timesheetInvoiceNumberForRevision(
        timesheetInvoiceNumber({ documentId: ref.baseDocumentId, userId: original?.data.userId ?? input.chain[0]?.data.userId }),
        revision
      )
    : ''
  const label = timesheetRevisionLabel(revision)
  if (revision === 0) return { label, invoiceNumber, differenceText: null, note: '' }
  const previous = input.chain.find((version) => version.revision === revision - 1)
  const previousTotal = previous ? timesheetExportedTotal(previous.data) : null
  const difference = previousTotal == null ? null : timesheetRevisionDifference({ total: input.total, previousTotal, currency: input.currency })
  const differenceText = difference?.text ?? (previous ? TIMESHEET_REVISION_DIFFERENCE_UNKNOWN : null)
  return {
    label,
    invoiceNumber,
    differenceText,
    note: difference ? `${label} · ${difference.text} from the previous version` : differenceText ? `${label} · ${differenceText}` : label,
  }
}
