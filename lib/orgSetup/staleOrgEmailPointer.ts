/**
 * organizations/{orgId}/userEmails/{email} must not block a deleted login from
 * being invited or setting up again. A live user with this email still owns it.
 */
export function shouldReclaimOrgEmailPointer(input: {
  pointedUserExists: boolean
  pointedEmail?: string | null
  inviteEmail: string
}): boolean {
  if (!input.pointedUserExists) return true
  const pointed = String(input.pointedEmail || '').trim().toLowerCase()
  if (!pointed) return true
  return pointed !== input.inviteEmail.trim().toLowerCase()
}

export function orgEmailPointerUserId(data: Record<string, unknown> | undefined): string {
  return String(data?.userId || '').trim()
}
