/**
 * Data health admin actions (owner, 3 Nov). Which rows to change comes from the rulebook's booking reader:
 * a status stored in an old spelling is `parseBookingDocument` repair `status_alias`, and its stored spelling is
 * `normalizeBookingStatus`; the setup placeholder is `isLegacyPlaceholderDocumentId`.
 */
import {
  isLegacyPlaceholderDocumentId,
  normalizeBookingStatus,
  parseBookingDocument,
  type BookingHealthRow,
} from '@/lib/canonical'

export type BookingStatusRepair = { id: string; data: Record<string, unknown>; status: string }

/** Bookings whose only fix here is the status spelling: the document and the status to write. */
export function bookingStatusRepairs(
  docs: ReadonlyArray<{ id: string; data: Record<string, unknown> }>
): BookingStatusRepair[] {
  const out: BookingStatusRepair[] = []
  for (const doc of docs) {
    const parsed = parseBookingDocument(doc.id, doc.data)
    if (!parsed.ok || !parsed.repairs.includes('status_alias')) continue
    const status = normalizeBookingStatus(doc.data.status)
    if (!status || status === doc.data.status) continue
    out.push({ id: doc.id, data: doc.data, status })
  }
  return out
}

/** The old setup placeholder row (`INITIAL-PLACEHOLDER`), refused by both apps' readers. */
export function isLegacyPlaceholderBookingRow(row: BookingHealthRow): boolean {
  return row.kind === 'refused' && isLegacyPlaceholderDocumentId(row.id)
}
