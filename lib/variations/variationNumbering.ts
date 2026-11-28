import {
  formatVariationNumber,
  nextVariationNumber,
  variationNumberTaken,
  variationNumberValue,
} from '@/lib/canonical/variationNumbers'

/** Rulebook 1.22.0 (§22): the trailing digits of a VO label (`variationNumberValue`). */
export function voNumeric(voNumber: string): number {
  return variationNumberValue(voNumber)
}

export function formatVoNumber(sequence: number, prefix = 'VO-', padding = 3): string {
  return formatVariationNumber(sequence, prefix, padding)
}

type NumberHistory = ReadonlyArray<{ from?: unknown; to?: unknown }> | null

/**
 * Rulebook 1.22.0 (§22): `nextVariationNumber` over every variation of the job, deleted included; 1.96.0 with each
 * variation's `numberHistory`, so a number freed by a renumber is never issued again.
 */
export function nextFreeVoNumber(
  existing: Array<{ voNumber: string; numberHistory?: NumberHistory }>,
  prefix = 'VO-',
  padding = 3
): string {
  return nextVariationNumber(
    existing.map((row) => ({ voNumber: row.voNumber, numberHistory: row.numberHistory ?? null })),
    prefix,
    padding
  )
}

/**
 * Rulebook 1.22.0 (§22): `variationNumberTaken` — deleted variations count, and (1.96.0) every number in another
 * variation's `numberHistory`, so a number is never reused.
 */
export function voNumberTaken(
  existing: Array<{ id?: string; voNumber: string; numberHistory?: NumberHistory }>,
  voNumber: string,
  exceptId?: string
): boolean {
  return variationNumberTaken(
    existing.map((row) => ({ id: row.id ?? null, voNumber: row.voNumber, numberHistory: row.numberHistory ?? null })),
    voNumber,
    exceptId ?? null
  )
}

/**
 * The number a new variation is saved with (owner 26 Nov): the field opens pre-filled with the rulebook's next number
 * (`nextVariationNumber`, every variation of the job, deleted included) and can be overridden, tracker on or off. What
 * is saved is exactly what the field shows, trimmed — never recomputed at save. A blank field, or a number another
 * variation of the job holds or ever held (`variationNumberTaken`, deleted included), is refused.
 */
export function newVariationNumberChoice(
  typed: string | null | undefined,
  existing: Array<{ id?: string; voNumber: string }>
): { voNumber: string; error: string | null } {
  const voNumber = String(typed ?? '').trim()
  if (!voNumber) return { voNumber, error: 'Enter a VO number.' }
  if (voNumberTaken(existing, voNumber)) return { voNumber, error: `${voNumber} is already used on this job. Pick another number.` }
  return { voNumber, error: null }
}

export function orderForTrackerEnable<T extends { voNumber: string; createdAt: Date }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const diff = voNumeric(a.voNumber) - voNumeric(b.voNumber)
    if (diff !== 0) return diff
    return a.createdAt.getTime() - b.createdAt.getTime()
  })
}

// Rulebook 1.52.0: the tracker's live preview and save are the rulebook's `variationRenumberPlan` (pinned Submitted /
// Closed keep their numbers; a number ever issued is never reused). The web-only `previewRenumber` is removed.
