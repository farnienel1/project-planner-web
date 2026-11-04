import { bookingIdsForAccount } from '@/lib/canonical'

/**
 * Every id the Overtime screen loads, sends and approves a person's bookings under: their `personIdSet` ids plus every
 * `operatives` row on their email (`bookingIdsForAccount`, rulebook §10) — never one row picked by email. Bookings
 * filed under an operatives row are approved by admins only (owner decision A, 4 Nov: the line manager sees
 * "Needs an admin", `overtimeApprovalWrites` → `needsAdmin`).
 */
export function overtimePersonIds(
  subject: { id: string; email?: string | null },
  personIds: ReadonlyArray<string>,
  operatives: ReadonlyArray<{ id: string; email?: string | null }>
): string[] {
  return bookingIdsForAccount({ id: subject.id, email: subject.email, aliasIds: personIds }, operatives)
}
