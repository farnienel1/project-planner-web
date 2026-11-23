/**
 * A person's assigned qualifications as the profile page shows them (owner issues 18 and 19, 23 Nov). Display only:
 * nothing stored changes.
 *
 * - Which `operatives` rows are the person's is the rulebook's person fold (`taskPersonIndex`, rulebook 1.59.0 §21):
 *   every users document of the person (`personIdSet`), their emails, and the rows on those emails or ids or linked
 *   to those accounts (`linkedUserId` / `userId` / `uid`). Never one row picked by email (platform guardrail 1).
 * - A qualification's expiry, and the merge of a person's rows, are the rulebook's (rulebook 1.73.0:
 *   `qualificationExpiryDate`, `withQualificationExpiry`, `personQualifications` in `lib/canonical`).
 */
import type { Operative } from '@/types'
import { personQualifications, type PersonQualification } from '@/lib/canonical/operativeQualifications'
import { taskPersonIndex, type TaskPersonRosterRow } from '@/lib/canonical/taskPeople'
import { isPlaceholderOperative } from '@/lib/operatives/operativeRosterUtils'

function idKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/** Every `operatives` row that is this person, by the rulebook's person fold. Placeholder rows are left out. */
export function operativeRowsForPerson(input: {
  person: { id: string; email?: string | null }
  operatives: readonly Operative[]
  roster: ReadonlyArray<TaskPersonRosterRow>
}): Operative[] {
  const personId = (input.person.id || '').trim()
  if (!personId) return []
  const roster: TaskPersonRosterRow[] = [...input.roster]
  if (!roster.some((row) => idKey(row.id) === personId.toLowerCase())) {
    roster.push({ id: personId, email: input.person.email ?? '' })
  }
  const rows = input.operatives.filter((row) => row && row.id && !isPlaceholderOperative(row))
  const index = taskPersonIndex({ managers: [], operatives: rows, roster })
  const personKey = index.keyOf('operative', personId)
  return rows.filter((row) => index.keyOf('operative', row.id) === personKey)
}

export type PersonQualificationRow = PersonQualification

/**
 * The person's qualifications, one per qualification id (without case), from every row of theirs: the rulebook's
 * `personQualifications` (rulebook 1.73.0; active rows first, then `preferredRowId`, then the rows holding the most).
 */
export function personQualificationRows(input: {
  person: { id: string; email?: string | null }
  operatives: readonly Operative[]
  roster: ReadonlyArray<TaskPersonRosterRow>
  preferredRowId?: string | null
}): PersonQualificationRow[] {
  return personQualifications({ rows: operativeRowsForPerson(input), preferredRowId: input.preferredRowId })
}

export type QualificationMapField = 'qualificationExpiryDates' | 'qualificationCertificateURLs'

/** One field-path change of a qualification map: set `field.key` to `value`, or delete it. */
export type QualificationMapWrite =
  | { field: 'qualificationExpiryDates'; key: string; value: Date }
  | { field: 'qualificationCertificateURLs'; key: string; value: string }
  | { field: QualificationMapField; key: string; delete: true }

