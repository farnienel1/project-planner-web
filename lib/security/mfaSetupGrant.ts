export const MFA_SETUP_GRANT_WINDOW_MS = 24 * 60 * 60 * 1000

export function invitationUsedRecently(usedAtMs: number | null, nowMs: number): boolean {
  return usedAtMs != null && nowMs - usedAtMs >= 0 && nowMs - usedAtMs <= MFA_SETUP_GRANT_WINDOW_MS
}

export function orgCreatedRecently(createdAtMs: number | null, nowMs: number): boolean {
  return createdAtMs != null && nowMs - createdAtMs >= 0 && nowMs - createdAtMs <= MFA_SETUP_GRANT_WINDOW_MS
}

/** First-time invite, founder setup, owner create, or a company created in the last day. */
export function mfaSetupGrantAllowed(input: {
  isPlatformOwner: boolean
  accountConfirmed: boolean | null
  invitationEmailMatches: boolean
  invitationIsUsed: boolean
  invitationUsedAtMs: number | null
  isOrgAdmin: boolean
  orgCreatedAtMs: number | null
  nowMs: number
}): boolean {
  if (input.isPlatformOwner) return true
  if (input.accountConfirmed === false) return true
  if (
    input.invitationEmailMatches &&
    input.invitationIsUsed &&
    invitationUsedRecently(input.invitationUsedAtMs, input.nowMs)
  ) {
    return true
  }
  return input.isOrgAdmin && orgCreatedRecently(input.orgCreatedAtMs, input.nowMs)
}
