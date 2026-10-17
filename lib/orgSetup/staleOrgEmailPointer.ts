import { resolveInviteEmailClaim } from '@/lib/canonical/inviteEmailClaim'

/**
 * organizations/{orgId}/userEmails/{email} must not block a deleted login from
 * being invited or setting up again. A live user with this email still owns it.
 * The live-claim rule is `resolveInviteEmailClaim`.
 */
export function shouldReclaimOrgEmailPointer(input: {
  pointedUserExists: boolean
  pointedEmail?: string | null
  inviteEmail: string
}): boolean {
  const pointedUser = input.pointedUserExists ? { email: input.pointedEmail ?? '' } : null
  return (
    resolveInviteEmailClaim({
      inviteEmail: input.inviteEmail,
      existingUsers: [],
      emailPointer: {
        exists: true,
        pointedUserId: input.pointedUserExists ? 'pointed' : 'missing',
        pointedUser,
      },
    }).action === 'allow'
  )
}

export function orgEmailPointerUserId(data: Record<string, unknown> | undefined): string {
  return String(data?.userId || '').trim()
}
