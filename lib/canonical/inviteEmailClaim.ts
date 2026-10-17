/**
 * Whether an invite email still has a live claim in this organisation.
 *
 * Screens stay in each app. Both platforms call this instead of treating any
 * `users` row with that email as taken. Re-invite after delete is a new
 * pending placeholder. The anonymised tombstone stays Inactive.
 */

import {
  isAnonymisedDeletedProfile,
  isIdentifiablePendingLeftover,
  type RosterSegmentProfile,
} from './userRosterSegment'

export type InviteEmailClaimUser = RosterSegmentProfile & {
  userId?: string | null
}

export type InviteEmailClaimPointer = {
  /** True when `organizations/{orgId}/userEmails/{email}` exists. */
  exists: boolean
  pointedUserId?: string | null
  pointedUser?: InviteEmailClaimUser | null
}

export type InviteEmailClaimInput = {
  inviteEmail: string
  /** `users` docs already in this org, including the pointed user when loaded. */
  existingUsers?: readonly InviteEmailClaimUser[] | null
  /**
   * Result of reading `organizations/{orgId}/userEmails/{email}`.
   * Null / omitted means that read failed, so a pending row with this email
   * is treated as still claimed.
   */
  emailPointer?: InviteEmailClaimPointer | null
}

export type InviteEmailClaimDecision =
  | { action: 'block' }
  | { action: 'allow'; reuseUserId?: string }

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function trimmedId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function pointedOwnsInviteEmail(
  pointed: InviteEmailClaimUser | null | undefined,
  inviteEmail: string
): boolean {
  if (!pointed) return false
  if (isAnonymisedDeletedProfile(pointed)) return false
  return normalizeEmail(pointed.email) === inviteEmail
}

/**
 * Block only a live claim: `userEmails/{email}` pointing at a non-anonymised
 * user who still holds that email, or a `users` doc in this org with that
 * email that is a real member (`passwordSet` true) or a still-claimed pending
 * invite. An anonymised tombstone, an identifiable leftover placeholder, and
 * Auth-only leftovers do not block. A leftover UUID that still has the email
 * is reused so the new invite can proceed. Never reuse a tombstone id.
 */
export function resolveInviteEmailClaim(input: InviteEmailClaimInput): InviteEmailClaimDecision {
  const inviteEmail = normalizeEmail(input.inviteEmail)
  if (!inviteEmail) return { action: 'allow' }

  const pointer = input.emailPointer
  const pointedUser = pointer?.pointedUser ?? null
  const livePointer =
    pointer != null && pointer.exists === true && pointedOwnsInviteEmail(pointedUser, inviteEmail)

  if (livePointer) return { action: 'block' }

  const claimedEmails = pointer == null ? null : []

  let reuseUserId = ''
  for (const user of input.existingUsers ?? []) {
    if (isAnonymisedDeletedProfile(user)) continue
    if (normalizeEmail(user.email) !== inviteEmail) continue
    if (user.passwordSet === true) return { action: 'block' }
    if (!isIdentifiablePendingLeftover(user, claimedEmails)) return { action: 'block' }
    const id = trimmedId(user.userId)
    if (id && !reuseUserId) reuseUserId = id
  }

  if (!reuseUserId && pointer?.exists === true && !pointedUser) {
    const pointedId = trimmedId(pointer.pointedUserId)
    if (pointedId) reuseUserId = pointedId
  }

  return reuseUserId ? { action: 'allow', reuseUserId } : { action: 'allow' }
}

export function inviteEmailHasLiveClaim(input: InviteEmailClaimInput): boolean {
  return resolveInviteEmailClaim(input).action === 'block'
}
