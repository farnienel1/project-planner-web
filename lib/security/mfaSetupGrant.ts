export const MFA_SETUP_GRANT_WINDOW_MS = 24 * 60 * 60 * 1000

export function invitationUsedRecently(usedAtMs: number | null, nowMs: number): boolean {
  return usedAtMs != null && nowMs - usedAtMs >= 0 && nowMs - usedAtMs <= MFA_SETUP_GRANT_WINDOW_MS
}

/**
 * The caller's own Firebase Auth account was created within the window. The creation time must come from
 * Firebase Auth on the server (`accounts:lookup`, `verifyFirebaseIdToken().createdAtMs`), never from a
 * document the client can write. Unknown, future or non-numeric times are refused.
 */
export function authAccountCreatedRecently(createdAtMs: number | null, nowMs: number): boolean {
  return (
    typeof createdAtMs === 'number' &&
    Number.isFinite(createdAtMs) &&
    nowMs - createdAtMs >= 0 &&
    nowMs - createdAtMs <= MFA_SETUP_GRANT_WINDOW_MS
  )
}

export function orgCreatedRecently(createdAtMs: number | null, nowMs: number): boolean {
  return createdAtMs != null && nowMs - createdAtMs >= 0 && nowMs - createdAtMs <= MFA_SETUP_GRANT_WINDOW_MS
}

/**
 * First-time invite, founder setup, owner create, or a company created in the last day — and only while the
 * caller's own Firebase Auth account is less than a day old. Every skip path needs that server-side fact:
 * `accountConfirmed` and an organisation's `createdAt` are written by the client, and the owner path used to
 * have no condition at all (owner console audit C1, C2, C3).
 */
export function mfaSetupGrantAllowed(input: {
  isPlatformOwner: boolean
  accountConfirmed: boolean | null
  invitationEmailMatches: boolean
  invitationIsUsed: boolean
  invitationUsedAtMs: number | null
  isOrgAdmin: boolean
  orgCreatedAtMs: number | null
  /** Firebase Auth account creation time, read on the server; null when it could not be read. */
  authAccountCreatedAtMs: number | null
  nowMs: number
}): boolean {
  if (!authAccountCreatedRecently(input.authAccountCreatedAtMs, input.nowMs)) return false
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
