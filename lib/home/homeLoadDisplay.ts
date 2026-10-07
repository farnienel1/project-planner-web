/**
 * Home must not paint 0 / "All clear" while the reads that feed that number
 * are still empty. A count remembered for this company stays up until the
 * new read finishes.
 */

export type HomeCountKind = 'warnings' | 'projects' | 'tasksToday' | 'tasksWeek' | 'tasksPending'

type CountStorage = Pick<Storage, 'getItem' | 'setItem'>

export function homeCountStorageKey(kind: HomeCountKind, organizationId: string): string {
  return `pp.homeCount.v1:${kind}:${organizationId}`
}

export function readRememberedHomeCount(
  storage: CountStorage | null | undefined,
  kind: HomeCountKind,
  organizationId: string
): number | null {
  if (!storage || !organizationId) return null
  try {
    const raw = storage.getItem(homeCountStorageKey(kind, organizationId))
    if (raw == null || raw === '') return null
    const value = Number(raw)
    if (!Number.isFinite(value) || value < 0) return null
    return value
  } catch {
    return null
  }
}

export function writeRememberedHomeCount(
  storage: CountStorage | null | undefined,
  kind: HomeCountKind,
  organizationId: string,
  count: number
): void {
  if (!storage || !organizationId || !Number.isFinite(count) || count < 0) return
  try {
    storage.setItem(homeCountStorageKey(kind, organizationId), String(Math.round(count)))
  } catch {
    /* The live number is still on screen. */
  }
}

/** A finished read wins. Until then, keep the last count for this company. */
export function shownHomeCount(live: number | null, remembered: number | null): number | null {
  if (live != null) return live
  return remembered
}

export function warningStatusLabel(count: number | null): string {
  if (count == null) return 'Scanning…'
  if (count === 0) return 'All clear'
  return `${count} active`
}

export function activeProjectSubtitle(count: number | null): string {
  if (count == null) return 'Loading projects…'
  return `${count} active project${count === 1 ? '' : 's'}`
}
