/** An invitation that has not been accepted. Manage users still lists these people. */
export function isPendingPerson(user: { status?: string | null; passwordSet?: boolean }): boolean {
  if (user.status === 'pending') return true
  return user.passwordSet === false
}

export function withoutPendingPeople<T extends { status?: string | null; passwordSet?: boolean }>(people: T[]): T[] {
  return people.filter((person) => !isPendingPerson(person))
}
