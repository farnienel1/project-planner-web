/**
 * Rulebook 1.55.0 §8: the REV label, invoice number and difference a timesheet version shows. Every figure and word is
 * the rulebook's (`timesheetRevisionLabel`, `timesheetInvoiceNumber`, `timesheetInvoiceNumberForRevision`,
 * `timesheetExportedTotal`, `timesheetRevisionDifference`, `TIMESHEET_REVISION_DIFFERENCE_UNKNOWN`); this file only
 * joins them for a screen or document.
 */
import {
  TIMESHEET_ORIGINAL_VERSION_LABEL,
  documentInstantMs,
  formatMoney,
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

export type EarlierVersionCard = {
  documentId: string
  /** "Original", "REV 1", … */
  label: string
  /** When it was signed off (the line manager's signature, else the person's), epoch ms; null when unknown. */
  signedAtMs: number | null
  exportedAtMs: number | null
  personName: string
  lineManagerName: string
  /** "£1,250.00", or the rulebook's "not available" wording for an older export without a signed copy. */
  totalText: string
  /** The version that followed it ("REV 1"). */
  nextLabel: string
  /** What the next version changed: "+2 bookings · 1 changed · −£66.18", "No booking changes · +£0.00". */
  changeText: string
}

function signedBookings(data: Record<string, unknown>): Map<string, string> {
  const out = new Map<string, string>()
  const record = Array.isArray(data.operativeSignedBookings) ? (data.operativeSignedBookings as Array<Record<string, unknown>>) : null
  if (record) {
    for (const row of record) {
      const id = String(row?.bookingId ?? '').trim().toLowerCase()
      if (id) out.set(id, String(row?.fingerprint ?? ''))
    }
    return out
  }
  const override = data.weeklyReportOverride as { lines?: Array<Record<string, unknown>> } | null | undefined
  for (const line of override?.lines ?? []) {
    const id = String(line?.bookingId ?? '').trim().toLowerCase()
    if (id && !out.has(id)) out.set(id, String(line?.bookingFingerprint ?? ''))
  }
  return out
}

function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/**
 * 17 Nov follow-up (display only): one card per earlier version of a pay run, newest first — its label, when and by whom
 * it was signed, its total, and what the next version changed (bookings added, removed or changed, and the money
 * difference from `timesheetRevisionDifference`). Every figure is the rulebook's (`timesheetExportedTotal`,
 * `timesheetRevisionDifference`); bookings are compared by id from what each version signed (`operativeSignedBookings`,
 * else its signed lines). `latestTotal` is the total the page shows for the latest version (it may not be exported yet).
 */
export function earlierVersionCards(input: {
  chain: ReadonlyArray<TimesheetVersion>
  latestTotal: number | null | undefined
  currency: string
}): EarlierVersionCard[] {
  const chain = [...input.chain].sort((a, b) => a.revision - b.revision)
  if (chain.length < 2) return []
  const latest = chain[chain.length - 1]
  const totalOf = (version: TimesheetVersion) =>
    version === latest && input.latestTotal != null ? input.latestTotal : timesheetExportedTotal(version.data)
  const cards: EarlierVersionCard[] = []
  for (let index = 0; index < chain.length - 1; index += 1) {
    const version = chain[index]
    const next = chain[index + 1]
    const total = timesheetExportedTotal(version.data)
    const before = signedBookings(version.data)
    const after = signedBookings(next.data)
    let added = 0
    let removed = 0
    let changed = 0
    for (const [id, fingerprint] of after) {
      if (!before.has(id)) added += 1
      else if (fingerprint && before.get(id) && before.get(id) !== fingerprint) changed += 1
    }
    for (const id of before.keys()) if (!after.has(id)) removed += 1
    const parts: string[] = []
    if (added) parts.push(`+${count(added, 'booking')}`)
    if (removed) parts.push(`−${count(removed, 'booking')}`)
    if (changed) parts.push(`${changed} changed`)
    if (parts.length === 0) parts.push('No booking changes')
    const nextTotal = totalOf(next)
    const difference = total == null || nextTotal == null ? null : timesheetRevisionDifference({ total: nextTotal, previousTotal: total, currency: input.currency })
    parts.push(difference ? difference.text.replace(/^-/, '−') : TIMESHEET_REVISION_DIFFERENCE_UNKNOWN)
    const data = version.data
    cards.push({
      documentId: version.documentId,
      label: timesheetRevisionLabel(version.revision) || TIMESHEET_ORIGINAL_VERSION_LABEL,
      signedAtMs: documentInstantMs(data.managerSignedAt) ?? documentInstantMs(data.operativeSignedAt) ?? null,
      exportedAtMs: documentInstantMs(data.exportedAt) ?? null,
      personName: String(data.operativeSignedByName ?? '').trim(),
      lineManagerName: String(data.managerSignedByName ?? '').trim(),
      totalText: total == null ? TIMESHEET_REVISION_DIFFERENCE_UNKNOWN.replace('Difference', 'Total') : formatMoney(total, input.currency),
      nextLabel: timesheetRevisionLabel(next.revision) || TIMESHEET_ORIGINAL_VERSION_LABEL,
      changeText: parts.join(' · '),
    })
  }
  return cards.reverse()
}
