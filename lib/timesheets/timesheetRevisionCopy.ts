/**
 * Rulebook 1.55.0 §8: the REV label, invoice number and difference a timesheet version shows. Every figure and word is
 * the rulebook's (`timesheetRevisionLabel`, `timesheetInvoiceNumber`, `timesheetInvoiceNumberForRevision`,
 * `timesheetExportedTotal`, `timesheetRevisionDifference`); this file only joins them for a screen or document.
 */
import {
  timesheetExportedTotal,
  timesheetInvoiceNumber,
  timesheetInvoiceNumberForRevision,
  timesheetRevisionDifference,
  timesheetRevisionLabel,
  type TimesheetVersion,
} from '@/lib/canonical'
import { dayKey } from '@/lib/ios-parity/londonTime'

export type TimesheetRevisionCopy = {
  /** 'REV 1', or '' for the original. */
  label: string
  invoiceNumber: string
  /** "+£44.12" from the previous version, or null for the original / when the previous version is not loaded. */
  differenceText: string | null
  /** "REV 1 · +£44.12 from the previous version" for documents, or ''. */
  note: string
}

export function timesheetRevisionCopy(input: {
  subjectId: string
  periodStart: Date
  timeZone: string
  revision: number | null | undefined
  /** The period's stored versions (`timesheetVersionChain`). */
  chain: ReadonlyArray<TimesheetVersion>
  /** This version's total (`timesheetTotals`). */
  total: number | null | undefined
  currency: string
}): TimesheetRevisionCopy {
  const revision = typeof input.revision === 'number' && input.revision > 0 ? input.revision : 0
  const base = timesheetInvoiceNumber({ subjectId: input.subjectId, startDayKey: dayKey(input.periodStart, input.timeZone) })
  const invoiceNumber = timesheetInvoiceNumberForRevision(base, revision)
  const label = timesheetRevisionLabel(revision)
  if (revision === 0) return { label, invoiceNumber, differenceText: null, note: '' }
  const previous = input.chain.find((version) => version.revision === revision - 1)
  const difference = previous
    ? timesheetRevisionDifference({ total: input.total, previousTotal: timesheetExportedTotal(previous.data), currency: input.currency })
    : null
  return {
    label,
    invoiceNumber,
    differenceText: difference?.text ?? null,
    note: difference ? `${label} · ${difference.text} from the previous version` : label,
  }
}
