/**
 * "Last active" on people screens (owner 24 Nov): the newest `lastSeenAt` across every users document of the
 * person (one person may have several — a former invite id, a second document on the same email; rulebook §8
 * `personIdSet`), shown in the organisation's time zone, never the browser's. Display only.
 */

import { normalizeDocumentId, organizationTimeZone, personIdSet, type PersonRosterRow } from '@/lib/canonical'

type SeenRow = PersonRosterRow & { lastSeenAt?: Date | null }

function seenMs(value: Date | null | undefined): number | null {
  if (!(value instanceof Date)) return null
  const ms = value.getTime()
  return Number.isFinite(ms) && ms > 0 ? ms : null
}

/** The newest `lastSeenAt` of the person across their users documents (null when none has one). */
export function personLastSeenAt(person: SeenRow | null | undefined, roster: ReadonlyArray<SeenRow>): Date | null {
  if (!person) return null
  const ids = new Set(personIdSet(person, roster).map((id) => normalizeDocumentId(id)))
  let best = seenMs(person.lastSeenAt)
  for (const row of roster) {
    if (!row || !ids.has(normalizeDocumentId(row.id))) continue
    const ms = seenMs(row.lastSeenAt)
    if (ms != null && (best == null || ms > best)) best = ms
  }
  return best == null ? null : new Date(best)
}

/** "24 Nov 2026 at 14:05" in the organisation zone; "—" with none. */
export function lastActiveText(value: Date | null | undefined, timeZone: string): string {
  const ms = seenMs(value ?? null)
  if (ms == null) return '—'
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(ms))
  } catch {
    const fallback = organizationTimeZone(null)
    return timeZone === fallback ? '—' : lastActiveText(value, fallback)
  }
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? ''
  return `${part('day')} ${part('month')} ${part('year')} at ${part('hour')}:${part('minute')}`
}
