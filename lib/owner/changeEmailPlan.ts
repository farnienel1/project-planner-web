/**
 * Owner console "Change login email" (`app/api/owner/change-email`): which organisations' email claims move, and
 * when the change is refused. Pure, so it is tested without Firestore.
 *
 * - The person's organisations are their home company (`users/{uid}.organizationId`, read with the rulebook's
 *   `documentOrganizationId`: an id, a path or a reference) and every company they hold a membership in.
 * - A claim `organizations/{org}/userEmails/{newEmail}` that already names another users document (a pending invite
 *   placeholder, another account) refuses the whole change before anything is written — never repointed.
 * - The old claim is deleted only where it names this person.
 */
import { documentOrganizationId } from '@/lib/canonical/peopleDocuments'

export const CHANGE_EMAIL_CLAIM_TAKEN_MESSAGE =
  'That email is already claimed by another user in one of this person’s organisations. Nothing was changed.'

const DOC_ID = /^[A-Za-z0-9_-]{1,128}$/

/** The organisations to move claims in: the home company first, then each membership, once each (stored case kept). */
export function changeEmailOrganizations(homeRaw: unknown, membershipIds: ReadonlyArray<string>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of [documentOrganizationId(homeRaw), ...membershipIds]) {
    const id = typeof raw === 'string' ? raw.trim() : ''
    if (!id || !DOC_ID.test(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/** True when a stored claim names another users document (refuse). A missing or empty claim is free. */
export function claimBelongsToSomeoneElse(claimUserId: string | null | undefined, uid: string): boolean {
  const owner = (claimUserId || '').trim()
  return Boolean(owner) && owner !== uid.trim()
}

/** True when the old claim may be deleted: it names this person. */
export function oldClaimIsTheirs(claimUserId: string | null | undefined, uid: string): boolean {
  return (claimUserId || '').trim() === uid.trim() && uid.trim() !== ''
}

/** Roster rows (`operatives` / `managers`) whose stored email is the old email in any letter case. */
export function rosterRowsOnEmail<T extends { email?: string | null }>(rows: ReadonlyArray<T>, oldEmail: string): T[] {
  const key = oldEmail.trim().toLowerCase()
  if (!key) return []
  return rows.filter((row) => (row.email || '').trim().toLowerCase() === key)
}
