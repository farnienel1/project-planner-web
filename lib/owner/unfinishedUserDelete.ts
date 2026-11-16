import { isPlatformOwnerEmail } from '@/lib/canonical/passwordPolicy'
import { abandonedSignupCutoff, isUnfinishedSetupName } from '@/lib/owner/unfinishedSetup'
import { timestampMs } from '@/lib/security/requireOrgAccess'

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
  /** `users/{uid}/orgMemberships`. */
  memberships: { state: 'read'; count: number } | { state: 'unreadable' }
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
 * was never set, or the sign-up is more than 12 months old (`abandonedSignupCutoff`). Anything that could
 * not be read refuses — a failed read never makes a live person look unfinished.
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

  if (user.passwordSet === true) {
    const createdAtMs = timestampMs(user.createdAt)
    const cutoffMs = abandonedSignupCutoff(new Date(input.nowMs)).getTime()
    if (createdAtMs == null || createdAtMs <= 0 || createdAtMs > cutoffMs) {
      return refuse(409, 'This sign-up is less than 12 months old. Nothing was deleted.')
    }
  }
  return { allowed: true }
}
