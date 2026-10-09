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
 * Nothing came back, and either a source failed or the organisation lists
 * members that no read returned. A denied or empty read is not an empty
 * company. Surface the first real failure when its code is retryable
 * (`permission-denied`, `unauthenticated`, …) so the caller's retry can see
 * it; otherwise hand back a retryable `unavailable` error. A generic error
 * here used to hide the code, so the first open after sign-in showed an empty
 * list and only a later visit loaded.
 */
export function rosterLoadFailure(input: {
  collectedCount: number
  complete: boolean
  firstFailure: unknown | null
  /** Ids on the organisation's members map, whether or not they were read. */
  listedMemberCount?: number
}): Error | null {
  if (input.collectedCount > 0) return null
  if (input.complete && (input.listedMemberCount ?? 0) === 0) return null
  if (input.firstFailure instanceof Error && isRetryableAuthLoadError(input.firstFailure)) return input.firstFailure
  const error = new Error('Failed to load users') as Error & { code?: string }
  error.code = 'unavailable'
  return error
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
