import { usersMissingEmploymentType } from '@/lib/canonical/payRate'

export type MissingEmploymentTypeRow = { id: string; firstName?: string; surname?: string; email?: string }

/**
 * Settings → Data health "People with no employment type": the rows `usersMissingEmploymentType` lists over the
 * organisation's users documents as stored (pay profiles laid over while `privatePay` is on). Every level is listed —
 * the Super Admin included (17 Nov owner bug: the Super Admin's employment type could not be set on web). Never writes.
 */
export function missingEmploymentTypeRows(
  docs: ReadonlyArray<Record<string, unknown> & { id: string }>
): MissingEmploymentTypeRow[] {
  const ids = new Set(usersMissingEmploymentType(docs as never))
  return docs
    .filter((row) => ids.has(row.id))
    .map((row) => ({
      id: row.id,
      firstName: typeof row.firstName === 'string' ? row.firstName : undefined,
      surname: typeof row.surname === 'string' ? row.surname : undefined,
      email: typeof row.email === 'string' ? row.email : undefined,
    }))
}
