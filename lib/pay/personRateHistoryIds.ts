import { bookingIdsForAccount, normalizeDocumentId, personIdSet, type PersonIdsInput, type PersonRosterRow } from '@/lib/canonical'

export type PersonRateHistoryIds = {
  /** Every users id the person goes by (`personIdSet`): own id, former invite ids, same-email ids, roster rows. */
  userIds: string[]
  /** Every `operatives` row that is this person (`bookingIdsForAccount`: rows on their email, or with one of their ids). */
  operativeIds: string[]
}

/**
 * Rulebook §8 / §10 (1.36.0, FU-5): the ids a person's pay-rate history rows may be filed under. Composes the rulebook's
 * person-id rules — `personIdSet` for the users ids and `bookingIdsForAccount` for the `operatives` rows — so web never
 * picks ONE catalogue row on the email (`findOperativeForUser`) when it reads a person's rate history. Ids keep their
 * stored case and are de-duplicated without case. `extraOperativeIds` (a booking's own row) are kept first.
 */
export function personRateHistoryIds(
  person: (PersonIdsInput & { id: string }) | null | undefined,
  operatives: ReadonlyArray<{ id: string; email?: string | null }>,
  options: { roster?: ReadonlyArray<PersonRosterRow> | null; aliasUserIds?: ReadonlyArray<string>; extraOperativeIds?: ReadonlyArray<string | null | undefined> } = {}
): PersonRateHistoryIds {
  const userIds = person
    ? dedupe([...personIdSet(person, options.roster ?? []), ...(options.aliasUserIds ?? [])])
    : []
  const rowKeys = new Set(operatives.map((row) => normalizeDocumentId(row.id)).filter(Boolean))
  const accountIds = person
    ? bookingIdsForAccount(
        { id: person.id, email: person.email ?? null, formerIds: [...(person.formerUserIds ?? []), ...userIds], aliasIds: [] },
        operatives.map((row) => ({ id: row.id, email: row.email ?? '' }))
      )
    : []
  const operativeIds = dedupe([
    ...(options.extraOperativeIds ?? []).map((id) => String(id || '')),
    ...accountIds.filter((id) => rowKeys.has(normalizeDocumentId(id))),
  ])
  return { userIds, operativeIds }
}

function dedupe(ids: ReadonlyArray<string>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of ids) {
    const id = raw.trim()
    const key = normalizeDocumentId(id)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(id)
  }
  return out
}
