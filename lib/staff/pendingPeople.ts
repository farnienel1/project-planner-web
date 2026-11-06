import { isGhostUser } from '@/lib/canonical/userRosterSegment'

/** An invitation that has not been accepted. Manage users still lists these people. */
export function isPendingPerson(user: { status?: string | null; passwordSet?: boolean; ghost?: boolean }): boolean {
  // Rulebook 1.34.0 §11: a ghost operative has no login by design and is never a pending invite (`isGhostUser`).
  if (isGhostUser(user)) return false
  if (user.status === 'pending') return true
  return user.passwordSet === false
}

export function withoutPendingPeople<T extends { status?: string | null; passwordSet?: boolean; ghost?: boolean }>(people: T[]): T[] {
  return people.filter((person) => !isPendingPerson(person))
}
