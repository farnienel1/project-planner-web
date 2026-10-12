/**
 * Local Oldest / Newest preference for the Warnings list.
 *
 * Per signed-in user, this browser/device only. Survives refresh, leaving
 * Warnings, and sign-out / sign-in as the same user. Never Firestore, never
 * organizations/{orgId}, never warningDetection.
 *
 * Default oldest-first applies only when this user has never chosen a sort
 * on this device. A successful choice is remembered in memory and localStorage
 * and is never rewritten back to the default on read or remount.
 */

import {
  DEFAULT_WARNINGS_SORT_DIRECTION,
  parseWarningsSortDirection,
  type WarningsSortDirection,
} from '@/lib/canonical'

const remembered = new Map<string, WarningsSortDirection>()

export function warningsSortDirectionStorageKey(userId: string): string {
  return `warningsSortDirection:${String(userId || '').trim()}`
}

function storedChoice(raw: unknown): WarningsSortDirection | null {
  return raw === 'oldest' || raw === 'newest' ? raw : null
}

/** The saved choice for this user on this device, or null if they have never chosen. */
export function storedWarningsSortDirection(userId: string): WarningsSortDirection | null {
  const id = String(userId || '').trim()
  if (!id) return null
  if (typeof window !== 'undefined') {
    try {
      const stored = storedChoice(window.localStorage.getItem(warningsSortDirectionStorageKey(id)))
      if (stored) {
        remembered.set(id, stored)
        return stored
      }
    } catch {
      /* private mode / disabled storage — use the in-memory copy if we have one */
    }
  }
  return remembered.get(id) ?? null
}

export function readWarningsSortDirection(userId: string): WarningsSortDirection {
  return storedWarningsSortDirection(userId) ?? DEFAULT_WARNINGS_SORT_DIRECTION
}

export function writeWarningsSortDirection(userId: string, direction: WarningsSortDirection): void {
  const id = String(userId || '').trim()
  if (!id) return
  const value = parseWarningsSortDirection(direction)
  remembered.set(id, value)
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(warningsSortDirectionStorageKey(id), value)
  } catch {
    /* quota / private mode — memory still holds the choice for this session */
  }
}

export function resetWarningsSortPreferenceMemoryForTests(): void {
  remembered.clear()
}
