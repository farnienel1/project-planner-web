import { isPlatformOwnerEmail } from '@/lib/canonical/passwordPolicy'
import { abandonedSignupCutoff, isUnfinishedSetupName } from '@/lib/owner/unfinishedSetup'

/** What the server read for one "delete unfinished sign-up" request (owner console audit H2). */
export type UnfinishedUserDeleteInput = {
  uid: string
  /** `users/{uid}` as plain values, or null when it does not exist. */
  user: Record<string, unknown> | null
  /** The organisation `users/{uid}.organizationId` names. */
  homeOrg:
    | { state: 'none' }
    | { state: 'missing' }
    | { state: 'unreadable' }
    | { state: 'found'; fields: Record<string, unknown> }
  /** `users/{uid}/orgMemberships`, read with the server key (the rules refuse the owner's token this list). */
  memberships: { state: 'read'; count: number } | { state: 'unreadable' }
  /**
   * The Firebase Auth account, read on the server with the server key. `createdAtMs: null` = no Auth account.
   * The 12-month age uses this, never the client-written `users.createdAt` (review of #340).
   */
  authAccount: { state: 'read'; createdAtMs: number | null } | { state: 'unreadable' }
  nowMs: number
}

export type UnfinishedUserDeleteDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 404 | 409 | 503; reason: string }

function refuse(status: 400 | 404 | 409 | 503, reason: string): UnfinishedUserDeleteDecision {
  return { allowed: false, status, reason }
}

/**
 * Server re-check before the owner deletes an "unfinished sign-up" (owner console PLAN §5, PR 0):
 * no organisation, or only an unfinished one of their own; not a member anywhere; and either the password
 * was never set (`passwordSet` stored exactly `false`), or the Firebase Auth account is more than 12 months
 * old (`abandonedSignupCutoff`). Anything that could not be read, and a missing `passwordSet`, refuses — a
 * failed read never makes a live person look unfinished.
 */
export function unfinishedUserDeleteDecision(input: UnfinishedUserDeleteInput): UnfinishedUserDeleteDecision {
  const user = input.user
  if (!user) return refuse(404, 'User not found')
  if (isPlatformOwnerEmail(user.email)) return refuse(400, 'The owner account cannot be deleted.')
  if (user.ghost === true) return refuse(409, 'This is a ghost operative, a live person. It is not an unfinished sign-up.')

  if (input.memberships.state === 'unreadable') {
    return refuse(503, 'Could not check this person’s organisation memberships. Nothing was deleted.')
  }
  if (input.memberships.count > 0) {
    return refuse(409, 'This person belongs to an organisation. Nothing was deleted.')
  }

  const org = input.homeOrg
  if (org.state === 'unreadable') {
    return refuse(503, 'Could not read this person’s organisation. Nothing was deleted.')
  }
  if (org.state === 'found') {
    if (!isUnfinishedSetupName(typeof org.fields.name === 'string' ? org.fields.name : '')) {
      return refuse(409, 'This person’s organisation is set up and in use. Nothing was deleted.')
    }
    const members = org.fields.members
    const others =
      members && typeof members === 'object'
        ? Object.keys(members as Record<string, unknown>).filter((id) => id !== input.uid)
        : []
    if (others.length > 0) {
      return refuse(409, 'Other people belong to this person’s organisation. Nothing was deleted.')
    }
  }

  if (user.passwordSet === false) return { allowed: true }
  if (user.passwordSet !== true) {
    return refuse(409, 'Could not tell whether this sign-up was finished (no password flag). Nothing was deleted.')
  }
  if (input.authAccount.state === 'unreadable') {
    return refuse(503, 'Could not read this person’s login. Nothing was deleted.')
  }
  const createdAtMs = input.authAccount.createdAtMs
  const cutoffMs = abandonedSignupCutoff(new Date(input.nowMs)).getTime()
  if (createdAtMs == null || createdAtMs > cutoffMs) {
    return refuse(409, 'This login is less than 12 months old, or its age is unknown. Nothing was deleted.')
  }
  return { allowed: true }
}
