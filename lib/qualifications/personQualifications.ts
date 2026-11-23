/**
 * A person's assigned qualifications as the profile page shows them (owner issues 18 and 19, 23 Nov). Display only:
 * nothing stored changes.
 *
 * - Which `operatives` rows are the person's is the rulebook's `operativeRowsForPerson` (rulebook 1.73.0, over the
 *   person fold `taskPersonIndex`; placeholder rows left out). Never one row picked by email (platform guardrail 1).
 * - A qualification's expiry, and the merge of a person's rows, are the rulebook's (rulebook 1.73.0:
 *   `qualificationExpiryDate`, `withQualificationExpiry`, `personQualifications` in `lib/canonical`).
 */
import type { Operative } from '@/types'
import {
  operativeRowsForPerson as canonicalOperativeRowsForPerson,
  personQualifications,
  type PersonQualification,
} from '@/lib/canonical/operativeQualifications'
import type { TaskPersonRosterRow } from '@/lib/canonical/taskPeople'

/** Every `operatives` row that is this person: the rulebook's `operativeRowsForPerson` (rulebook 1.73.0). */
export function operativeRowsForPerson(input: {
  person: { id: string; email?: string | null }
  operatives: readonly Operative[]
  roster: ReadonlyArray<TaskPersonRosterRow>
}): Operative[] {
  return canonicalOperativeRowsForPerson(input)
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

