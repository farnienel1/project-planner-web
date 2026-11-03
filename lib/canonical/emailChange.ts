/**
 * Rulebook 1.13.0 §14: a person changing their own sign-in email, the same on every platform.
 *
 * 1. The app asks Firebase Auth to change it after the person confirms the new address (web
 *    `verifyBeforeUpdateEmail`, iOS `sendEmailVerification(beforeUpdatingEmail:)`) and writes nothing else:
 *    `selfEmailChangeAction` says whether a request is needed. The rest of the profile save goes ahead with the stored
 *    email (the security rules refuse a users `email` that is not the signed-in Auth email, §16).
 * 2. On the next sign-in, once the token email is verified and differs from `users/{uid}.email`,
 *    `signInEmailSyncWrites` gives the writes: `users/{uid}.email` = the token email, the new
 *    `organizations/{orgId}/userEmails/{newEmail}` claim pointing at the account, and the old claim deleted when it
 *    was the account's. The security rules allow exactly these (a person's own `email` = token email; the claim for
 *    their token email; deleting their own claim on another email once Auth is verified).
 */

export function normalizeEmailText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type SelfEmailChangeAction = 'unchanged' | 'invalid' | 'verifyBeforeUpdate'

/** What a self profile save does about the email field: nothing, refuse it, or ask Auth to verify the new address. */
export function selfEmailChangeAction(input: { storedEmail: unknown; nextEmail: unknown }): SelfEmailChangeAction {
  const stored = normalizeEmailText(input.storedEmail)
  const next = normalizeEmailText(input.nextEmail)
  if (!next || next === stored) return 'unchanged'
  if (!EMAIL_SHAPE.test(next)) return 'invalid'
  return 'verifyBeforeUpdate'
}

export const SELF_EMAIL_INVALID_MESSAGE = 'Enter a valid email address.'

/** Shown after the verification email is sent. */
export function selfEmailChangeSentMessage(nextEmail: unknown): string {
  const email = normalizeEmailText(nextEmail)
  return `We sent a link to ${email}. Open it to confirm, then sign in with ${email}. Until then you sign in with your current email.`
}

export type SignInEmailSyncWrites = {
  /** Partial update of `users/{uid}`. */
  userFields: { email: string }
  /** `organizations/{orgId}/userEmails/{email}` to set (null without an organisation). */
  claimSet: { path: string; fields: { userId: string } } | null
  /** The old claim to delete, only when it was this account's (the app checks `userId` before deleting). */
  claimDelete: string | null
}

/**
 * The writes that bring `users/{uid}.email` and the organisation email claim in line with the signed-in Auth email
 * after Auth changed it. Null when nothing is to do: same email (ignoring case), no token email, or the token email
 * not verified yet.
 */
export function signInEmailSyncWrites(input: {
  userId: string
  organizationId?: string | null
  storedEmail: unknown
  tokenEmail: unknown
  tokenEmailVerified: boolean | null | undefined
}): SignInEmailSyncWrites | null {
  const userId = String(input.userId || '').trim()
  const token = normalizeEmailText(input.tokenEmail)
  const stored = normalizeEmailText(input.storedEmail)
  if (!userId || !token || input.tokenEmailVerified !== true || token === stored) return null
  const orgId = String(input.organizationId || '').trim()
  return {
    userFields: { email: token },
    claimSet: orgId ? { path: `organizations/${orgId}/userEmails/${token}`, fields: { userId } } : null,
    claimDelete: orgId && stored ? `organizations/${orgId}/userEmails/${stored}` : null,
  }
}
