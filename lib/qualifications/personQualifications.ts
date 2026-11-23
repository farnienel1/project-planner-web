/**
 * A person's assigned qualifications as the profile page shows them (owner issues 18 and 19, 23 Nov). Display only:
 * nothing stored changes.
 *
 * - Which `operatives` rows are the person's is the rulebook's person fold (`taskPersonIndex`, rulebook 1.59.0 §21):
 *   every users document of the person (`personIdSet`), their emails, and the rows on those emails or ids or linked
 *   to those accounts (`linkedUserId` / `userId` / `uid`). Never one row picked by email (platform guardrail 1).
 * - A qualification's expiry is `qualificationExpiryDates[qualificationId]` — the map the qualifications editor
 *   writes and the qualification-expiry warnings read (`qualificationExpiryOperatives`) — matched without case, as
 *   the certificate map (`qualificationCertificateUrl`). The assignment row's own `endDate` is not an expiry.
 */
import type { Operative } from '@/types'
import { qualificationCertificateUrl } from '@/lib/canonical/operativeQualifications'
import { taskPersonIndex, type TaskPersonRosterRow } from '@/lib/canonical/taskPeople'
import { isPlaceholderOperative } from '@/lib/operatives/operativeRosterUtils'

function idKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function validDate(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  return undefined
}

/** The stored expiry for one qualification: the exact key first, else the same id in another letter case. */
export function qualificationExpiryDate(
  dates: Record<string, Date> | undefined,
  qualificationId: string
): Date | undefined {
  if (!dates) return undefined
  const id = (qualificationId || '').trim()
  if (!id) return undefined
  const direct = validDate(dates[id])
  if (direct) return direct
  const target = id.toLowerCase()
  for (const [key, value] of Object.entries(dates)) {
    if (key.toLowerCase() === target) {
      const date = validDate(value)
      if (date) return date
    }
  }
  return undefined
}

/**
 * The expiry map after the editor sets (or clears) one qualification's date: every other spelling of that id is
 * removed, so a key stored in another letter case (iOS writes upper-case UUIDs) cannot keep showing the old date.
 */
export function withQualificationExpiry(
  dates: Record<string, Date> | undefined,
  qualificationId: string,
  date: Date | undefined
): Record<string, Date> {
  const target = idKey(qualificationId)
  const next: Record<string, Date> = {}
  for (const [key, value] of Object.entries(dates || {})) {
    if (key.toLowerCase() !== target) next[key] = value
  }
  if (date && target) next[qualificationId] = date
  return next
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

export type PersonQualificationRow = {
  id: string
  name: string
  expiry?: Date
  certificateUrl?: string
  /** The `operatives` row the qualification was read from (for a report link). */
  operativeId: string
}

function rowWeight(row: Operative): number {
  return (
    (row.qualifications?.length ?? 0) +
    Object.keys(row.qualificationExpiryDates || {}).length +
    Object.keys(row.qualificationCertificateURLs || {}).length
  )
}

/**
 * The person's qualifications, one per qualification id (without case), from every row of theirs. Rows are read in
 * order — `preferredRowId` first (the row the editor saves to), then active rows, then the rows holding the most —
 * and a qualification's expiry and certificate come from the first row that has them.
 */
export function personQualificationRows(input: {
  person: { id: string; email?: string | null }
  operatives: readonly Operative[]
  roster: ReadonlyArray<TaskPersonRosterRow>
  preferredRowId?: string | null
}): PersonQualificationRow[] {
  const preferred = idKey(input.preferredRowId)
  const rows = operativeRowsForPerson(input).sort((a, b) => {
    const ap = idKey(a.id) === preferred ? 1 : 0
    const bp = idKey(b.id) === preferred ? 1 : 0
    if (ap !== bp) return bp - ap
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
    return rowWeight(b) - rowWeight(a)
  })
  const out = new Map<string, PersonQualificationRow>()
  for (const row of rows) {
    for (const qual of row.qualifications || []) {
      const key = idKey(qual?.id)
      if (!key) continue
      const expiry = qualificationExpiryDate(row.qualificationExpiryDates, qual.id)
      const certificateUrl = qualificationCertificateUrl(row.qualificationCertificateURLs, qual.id)
      const current = out.get(key)
      if (!current) {
        out.set(key, { id: qual.id, name: qual.name, expiry, certificateUrl, operativeId: row.id })
        continue
      }
      if (!current.expiry && expiry) current.expiry = expiry
      if (!current.certificateUrl && certificateUrl) {
        current.certificateUrl = certificateUrl
        current.operativeId = row.id
      }
    }
  }
  return [...out.values()]
}
