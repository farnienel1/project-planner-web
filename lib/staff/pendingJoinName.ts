/**
 * Rulebook 1.82.0 §11 (review of #442, item 8): when an invitation is accepted but the organisation's name entry could
 * not be written then (the auth claims had not reached the token, or the write failed), the name the inviting company
 * typed (its placeholder, else the invitation) is kept on this device and used when the person first opens that
 * organisation (`memberNamesLive`), instead of the account's name. Device storage is a cache only (§1): it is cleared
 * once the entry exists, and every read and write is wrapped so a blocked storage never stops anything.
 */
export type PendingJoinName = { firstName: string; surname: string }

const PREFIX = 'pp.joinName:'

function storageKey(userId: string, organizationId: string): string {
  return `${PREFIX}${userId}:${organizationId}`.toLowerCase()
}

export function savePendingJoinName(userId: string, organizationId: string, name: PendingJoinName | null): void {
  if (!userId || !organizationId || !name) return
  try {
    window.localStorage.setItem(storageKey(userId, organizationId), JSON.stringify({ firstName: name.firstName, surname: name.surname }))
  } catch {
    // Storage blocked: the entry is then created from the account's name on first open (as before).
  }
}

export function readPendingJoinName(userId: string, organizationId: string): PendingJoinName | null {
  if (!userId || !organizationId) return null
  try {
    const raw = window.localStorage.getItem(storageKey(userId, organizationId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PendingJoinName>
    if (typeof parsed?.firstName !== 'string') return null
    return { firstName: parsed.firstName, surname: typeof parsed.surname === 'string' ? parsed.surname : '' }
  } catch {
    return null
  }
}

export function clearPendingJoinName(userId: string, organizationId: string): void {
  if (!userId || !organizationId) return
  try {
    window.localStorage.removeItem(storageKey(userId, organizationId))
  } catch {
    // Nothing to clear.
  }
}
