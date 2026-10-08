/**
 * Decisions the two-wave roster loader makes once the first wave has settled.
 * Kept pure so the first-open failure modes can be tested without Firestore.
 */

import { isRetryableAuthLoadError } from '@/lib/auth/authBoot'

function textField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Account ids a managers / operatives catalogue row names explicitly. */
export function explicitAccountIds(data: Record<string, unknown>): string[] {
  const ids = [textField(data.userId), textField(data.userID), textField(data.uid), textField(data.linkedUserId)]
  return ids.filter((id, index, all) => id !== '' && all.indexOf(id) === index)
}

/**
 * The organisation users query is the backbone of the roster. When it fails for
 * a reason that clears once the ID token has settled (the first read after
 * sign-in), the whole load should run again rather than cache a roster built
 * only from the members map and catalogue fallbacks. The final try keeps the
 * fallback so a slow token still produces a list.
 */
export function shouldRetryRosterLoad(input: {
  usersQueryFailure: unknown | null
  finalAttempt: boolean
}): boolean {
  if (input.usersQueryFailure == null || input.finalAttempt) return false
  return isRetryableAuthLoadError(input.usersQueryFailure)
}

/**
 * Nothing came back and at least one source failed. Surface the first real
 * failure so the caller's retry can see a `permission-denied` or
 * `unauthenticated` code. A generic error here used to hide that code, so the
 * first open after sign-in showed an empty list and only a later visit loaded.
 */
export function rosterLoadFailure(input: {
  collectedCount: number
  complete: boolean
  firstFailure: unknown | null
}): Error | null {
  if (input.collectedCount > 0 || input.complete) return null
  if (input.firstFailure instanceof Error) return input.firstFailure
  return new Error('Failed to load users')
}

/**
 * Whether a catalogue row that matched nobody in memory still needs its own
 * read. With every first-wave source answered, a row that names no account id
 * has no account. A row that does name one is read anyway: that account can
 * belong to a person whose user document names another organisation and who
 * is on neither the members map nor the userEmails pointers.
 */
export function catalogueRowNeedsRead(input: { complete: boolean; data: Record<string, unknown> }): boolean {
  if (!input.complete) return true
  return explicitAccountIds(input.data).length > 0
}
